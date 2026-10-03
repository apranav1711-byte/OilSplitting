"""Run with python -m unittest -v. Tests software properties, not field accuracy."""
import copy
import json
import unittest
import numpy as np
from model import *

class ModelTests(unittest.TestCase):
    def test_forecasts_and_routes(self):
        r=run(sample_scenario())
        a=np.array(r['forecasts']);self.assertEqual(a.shape,(13,H,W))
        self.assertTrue(np.isfinite(a).all());self.assertTrue(((a>=0)&(a<=1)).all())
        self.assertEqual(len(r['routes']),3)
        for p in r['routes']:
            self.assertEqual(p['path'][0],r['scenario']['start']);self.assertEqual(p['path'][-1],r['scenario']['goal'])
            for x,y in p['path']:self.assertFalse(r['blocked'][y][x])
        repeat=run(sample_scenario())
        self.assertEqual(r['stats']['run_id'],repeat['stats']['run_id'])
        for k in ('routes','forecasts','tracks','blocked'):self.assertEqual(r[k],repeat[k])
        self.assertEqual(json.loads(json.dumps(r,allow_nan=False))['routes'],r['routes'])

    def test_closed_corridor(self):
        self.assertEqual(run(sample_scenario('blocked'))['routes'],[])

    def test_manual_exclusion_zones(self):
        s=sample_scenario();s['exclusion_zones']=[{'x':4,'y':18,'radius_km':15}]
        r=run(s);self.assertEqual(r['routes'],[])
        self.assertTrue(r['block_reasons']['zones'][18][4])
        self.assertTrue(any('zones' in w for w in r['warnings']))
        s['exclusion_zones'][0]['radius_km']=float('nan')
        with self.assertRaises(ValueError):run(s)

    def test_clearance_never_opens_cells(self):
        a=run(sample_scenario(),{'buffer_km':5});b=run(sample_scenario(),{'buffer_km':35})
        self.assertTrue((np.array(b['blocked'])|~np.array(a['blocked'])).all())

    def test_zero_forcing_has_no_drift(self):
        s=sample_scenario()
        for k in ['wind_u','wind_v','current_u','current_v']:s[k]=0
        # Mean stochastic current perturbation is near zero, not exactly zero.
        tr=iceberg_tracks(s,12)
        for t in tr:self.assertLess(np.linalg.norm(np.array(t['path'][-1])-t['path'][0]),.4)

    def test_bad_inputs(self):
        s=sample_scenario();s['current'][0][0]=float('nan')
        with self.assertRaises(ValueError):run(s)
        with self.assertRaises(ValueError):run(sample_scenario(),{'speed':0})
        with self.assertRaises(ValueError):run(sample_scenario(),{'horizon':30})

    def test_endpoints_and_no_corner_cutting(self):
        s=sample_scenario();s['start']=[0,0];s['goal']=[1,1]
        blocked=np.ones((H,W),bool);blocked[0,0]=blocked[1,1]=False
        self.assertIsNone(route(s,np.zeros((H,W)),blocked,10,'distance'))
        s['start']=[-1,0]
        with self.assertRaises(ValueError):run(s)

    def test_shortest_path_lower_bound(self):
        s=sample_scenario();s['start']=[0,0];s['goal']=[10,0]
        r=route(s,np.zeros((H,W)),np.zeros((H,W),bool),10,'distance')
        expected=sum(haversine(lonlat(s,[x,0]),lonlat(s,[x+1,0])) for x in range(10))
        self.assertAlmostEqual(r['distance_km'],expected,places=2)

    def test_spatial_sampling_and_boundary(self):
        y,x=np.mgrid[0:H,0:W];a=x+2*y
        self.assertAlmostEqual(float(sample(a,2.5,3.5)),9.5)
        west,north=neighbors(a)
        np.testing.assert_array_equal(west[:,0],a[:,0])
        np.testing.assert_array_equal(north[0],a[0])

    def test_wave_and_depth_constraints(self):
        for key,value,reason in [('wave_height',12,'waves'),('depth',5,'depth')]:
            s=sample_scenario();s[key]=value;r=run(s)
            self.assertEqual(r['routes'],[])
            self.assertEqual(r['stats']['reason_counts'][reason],H*W)

    def test_horizon_rejects_long_passages(self):
        r=run(sample_scenario(),{'speed':5,'horizon':24})
        self.assertEqual(r['routes'],[])
        self.assertTrue(r['rejected_routes'])
        self.assertTrue(all(p['eta_hours']>24 for p in r['rejected_routes']))

    def test_supplied_and_persistence_forecasts(self):
        s=sample_scenario();s['forecast_frames']=[copy.deepcopy(s['current']) for _ in range(5)]
        r=run(s,{'forecast_method':'supplied','horizon':24})
        self.assertEqual(r['forecasts'][0],r['forecasts'][-1])
        with self.assertRaises(ValueError):run(s,{'forecast_method':'supplied','horizon':72})
        s['forecast_frames'][0][0][0]=.99
        with self.assertRaises(ValueError):run(s)
        r=run(sample_scenario(),{'forecast_method':'persistence'})
        self.assertEqual(r['forecasts'][0],r['forecasts'][-1])

    def test_csv_grid_and_invalid_values(self):
        header='longitude,latitude,current,previous,temperature,land,wind_u,wind_v,current_u,current_v'
        rows=[f'{x},{y},0.1,0.12,-1.5,0,6,-2,0.1,0.03' for y in (-65,-69) for x in (72,82)]
        s=import_csv(header+'\n'+'\n'.join(rows))
        self.assertEqual(np.shape(s['current']),(H,W))
        self.assertEqual(s['bounds'],BOUNDS)
        with self.assertRaises(ValueError):import_csv(header+'\n'+'\n'.join(rows[:-1]))
        with self.assertRaises(ValueError):import_csv(header+'\n'+'\n'.join(rows).replace('0.1,0.12','nan,0.12'))

    def test_invalid_geometry_and_all_land(self):
        s=sample_scenario();s['icebergs'][0]['draft']=-1
        with self.assertRaises(ValueError):run(s)
        s=sample_scenario();s['land']=np.ones((H,W),bool).tolist();s['icebergs']=[]
        r=run(s);self.assertEqual(r['routes'],[])
        self.assertTrue(all(v is None for v in r['stats']['ice_mean']))

    def test_evaluation_reproducible(self):
        e=evaluate();self.assertEqual(e,evaluate());self.assertEqual(len(e['rmse']),12)
        self.assertTrue(all(np.isfinite(e['rmse'])))

if __name__=='__main__':unittest.main()
