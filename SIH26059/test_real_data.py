"""Offline checks for observation decoding, masks, and honest model boundaries."""
import unittest
import numpy as np
import netCDF4
from real_data import decoded_grid,coastline_mask,observations
from model import run

class ObservationTests(unittest.TestCase):
    def test_packed_ice_and_missing_value(self):
        with netCDF4.Dataset('test',mode='w',diskless=True,persist=False) as d:
            for k,n in [('t',1),('z',1),('y',2),('x',2)]:d.createDimension(k,n)
            v=d.createVariable('ice','i2',('t','z','y','x'),fill_value=-999)
            v.scale_factor=.01;v.set_auto_maskandscale(False)
            v[:]=np.array([[[[100,50],[-999,15]]]])
            v.set_auto_maskandscale(True)
            a=decoded_grid(v,np.array([0,1]),np.array([0,1]))
            self.assertEqual(a[0,0],1);self.assertEqual(a[0,1],.5)
            self.assertTrue(np.isnan(a[1,0]))

    def test_coastline_hole(self):
        outer=[[0,0],[4,0],[4,4],[0,4],[0,0]]
        hole=[[1,1],[3,1],[3,3],[1,3],[1,1]]
        mask=coastline_mask(np.array([.5,2,5]),np.array([.5,2,2]),[[outer,hole]])
        self.assertEqual(mask.tolist(),[True,False,False])

    def test_bundled_observations_no_synthetic_forcing(self):
        s=observations('2026-09-17')
        self.assertEqual(s['observed_at'],'2026-09-17T12:00:00Z')
        self.assertNotIn('current_u',s);self.assertNotIn('wave_height',s);self.assertEqual(s['icebergs'],[])
        self.assertEqual(len(s['sources']),3)
        r=run(s,{'forecast_method':'persistence'})
        self.assertEqual(r['forecasts'][0],r['forecasts'][-1])
        for y,row in enumerate(s['missing']):
            for x,missing in enumerate(row):
                if missing:self.assertTrue(r['blocked'][y][x])
        with self.assertRaises(ValueError):run(s,{'forecast_method':'ridge'})

    def test_date_validation(self):
        with self.assertRaises(ValueError):observations('../../secrets')
        with self.assertRaises(ValueError):observations('1970-01-01')

if __name__=='__main__':unittest.main()
