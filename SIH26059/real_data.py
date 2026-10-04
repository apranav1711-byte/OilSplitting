"""Dated NOAA OISST + ERA5 inputs. Missing observations are never open water."""
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.parse import urlencode
import hashlib
import json
import threading
import numpy as np
from model import H,W,validate

ROOT=Path(__file__).resolve().parent
DATA=ROOT/'data'
CACHE=ROOT/'.cache'
DEFAULT_DATE='2026-09-17'
REAL_BOUNDS=[68.,-70.,84.,-63.]
LOCK=threading.Lock() # netCDF/HDF5 reads are serialized; this is a local prototype.

def fetch(url):
    with urlopen(Request(url,headers={'User-Agent':'PolarRoute-research/1.0'}),timeout=45) as response:
        payload=response.read(20_000_001)
    if len(payload)>20_000_000:raise ValueError('Provider response exceeded 20 MB.')
    return payload

def inside_ring(lons,lats,ring):
    inside=np.zeros(lons.shape,bool)
    for a,b in zip(ring,ring[1:]+ring[:1]):
        x1,y1=a[:2];x2,y2=b[:2]
        if y1==y2:continue
        inside^=((y1>lats)!=(y2>lats))&(lons<(x2-x1)*(lats-y1)/(y2-y1)+x1)
    return inside

def coastline_mask(lons,lats,geometry):
    land=np.zeros(lons.shape,bool)
    for rings in geometry:
        part=inside_ring(lons,lats,rings[0])
        for hole in rings[1:]:part&=~inside_ring(lons,lats,hole)
        land|=part
    return land

def decoded_grid(var,iy,ix):
    # netCDF4 decodes packed values and _FillValue. OISST ice is 0..1 after
    # scale_factor=.01 (stored integers 0..100), despite its '%' units label.
    raw=var[0,0,:,:]
    a=raw[np.ix_(iy,ix)]
    return np.asarray(a.filled(np.nan),float)

def build_snapshot(day,blob,wind_fetch=fetch):
    import netCDF4
    w,so,e,n=REAL_BOUNDS
    lons,lats=np.meshgrid(np.linspace(w,e,W),np.linspace(n,so,H))
    geometry=json.loads((DATA/'antarctica.json').read_text())['polygons']
    with netCDF4.Dataset('oisst',memory=blob) as d:
        ix=np.abs(np.asarray(d['lon'][:])[None,:]-lons[0,:,None]).argmin(1)
        iy=np.abs(np.asarray(d['lat'][:])[None,:]-lats[:,0,None]).argmin(1)
        ice=decoded_grid(d['ice'],iy,ix);sst=decoded_grid(d['sst'],iy,ix)
        dt=netCDF4.num2date(d['time'][0],d['time'].units)
        observed=dt.strftime('%Y-%m-%dT%H:%M:%SZ')
        if observed[:10]!=day:raise ValueError('NOAA response date does not match the selected day.')
        if np.any(np.isfinite(ice)&((ice<0)|(ice>1))):raise ValueError('Unexpected NOAA ice scaling; refusing to guess units.')
    land=coastline_mask(lons,lats,geometry)
    missing=(~np.isfinite(ice)|~np.isfinite(sst))&~land
    # Numeric sentinels only under a separately validated exclusion mask.
    ice=np.where(np.isfinite(ice),ice,1);sst=np.where(np.isfinite(sst),sst,0)
    supported=~(land|missing)
    if not supported.any():raise ValueError('No supported ocean cells in the requested NOAA analysis.')
    yy,xx=np.where(supported)
    left=int(np.argmin(xx+ice[yy,xx]*6));right=int(np.argmax(xx-ice[yy,xx]*6))
    url=f'https://www.ncei.noaa.gov/data/sea-surface-temperature-optimum-interpolation/v2.1/access/avhrr/{day[:7].replace("-","")}/oisst-avhrr-v02r01.{day.replace("-","")}.nc'
    notes=['NOAA OISST ice is a seven-day median concentration product, not an instantaneous SAR detection.',
           'Nearest-neighbor alignment to the planning grid does not increase the native 0.25-degree resolution.',
           'No connected ocean-current, wave, bathymetry or iceberg inventory. These hazards are unassessed.',
           'Future frames use persistence, not a learned operational forecast. ETA and fuel remain illustrative calculations.',
           'Missing ice/SST cells are excluded; masked ice is not assumed to mean open water.']
    s=dict(name='Prydz Bay / East Antarctica',source='NOAA OISST v2.1 + Natural Earth 1:50m; dated observation analysis',data_kind='observational',
       observed_at=observed,bounds=REAL_BOUNDS,current=np.round(ice,4).tolist(),previous=np.round(ice,4).tolist(),temperature=np.round(sst,3).tolist(),
       land=land.tolist(),missing=missing.tolist(),icebergs=[],start=[int(xx[left]),int(yy[left])],goal=[int(xx[right]),int(yy[right])],
       coastline=geometry,source_notes=notes,previous_interval_hours=0,
       sources=[dict(name='NOAA OISST v2.1',kind='Observation-based analysis',date=observed,url=url,sha256=hashlib.sha256(blob).hexdigest()),
                dict(name='Natural Earth 1:50m land',kind='Generalized cartography; not a navigation chart',date='Static map',url='https://www.naturalearthdata.com/about/terms-of-use/')])
    # Twenty-five ERA5 samples at the analysis hour; bilinear interpolation is explicit.
    pts=[(lat,lon) for lat in np.linspace(n,so,5) for lon in np.linspace(w,e,5)]
    query=urlencode(dict(latitude=','.join(str(a) for a,b in pts),longitude=','.join(str(b) for a,b in pts),start_date=day,end_date=day,
        hourly='wind_speed_10m,wind_direction_10m',wind_speed_unit='ms',models='era5',timezone='GMT',cell_selection='nearest'))
    wind_url='https://archive-api.open-meteo.com/v1/archive?'+query
    try:
        records=json.loads(wind_fetch(wind_url));hour=int(observed[11:13]);us=[];vs=[]
        if not isinstance(records,list) or len(records)!=25:raise ValueError('Expected 25 ERA5 samples.')
        for record in records:
            hourly=record['hourly'];idx=hourly['time'].index(day+f'T{hour:02d}:00')
            speed=hourly['wind_speed_10m'][idx];direction=hourly['wind_direction_10m'][idx]
            if speed is None or direction is None:raise ValueError('ERA5 wind is missing.')
            us.append(-float(speed)*np.sin(np.radians(direction)));vs.append(-float(speed)*np.cos(np.radians(direction)))
        for key,values in [('wind_u',us),('wind_v',vs)]:
            coarse=np.array(values).reshape(5,5)
            across=np.array([np.interp(np.linspace(0,4,W),np.arange(5),row) for row in coarse])
            fine=np.array([np.interp(np.linspace(0,4,H),np.arange(5),across[:,i]) for i in range(W)]).T
            s[key]=np.round(fine,4).tolist()
        s['sources'].append(dict(name='ERA5 via Open-Meteo',kind='Reanalysis wind; 5×5 samples, bilinear alignment',date=observed,url=wind_url))
    except (OSError,ValueError,KeyError,TypeError) as exc:
        notes.append('ERA5 unavailable for this request; wind is unassessed. '+str(exc)[:150])
    validate(s)
    return s

def observations(day=None):
    day=day or DEFAULT_DATE
    try:parsed=date.fromisoformat(day)
    except (TypeError,ValueError):raise ValueError('Choose a date in YYYY-MM-DD format.')
    if parsed<date(1982,1,1) or parsed>=datetime.now(timezone.utc).date():raise ValueError('Choose a past date from 1982 onward; recent final products may not be available.')
    bundled=DATA/(day+'.json');cached=CACHE/(day+'.json')
    with LOCK:
        for file in (bundled,cached):
            if file.exists():return validate(json.loads(file.read_text(encoding='utf-8')))
        url=f'https://www.ncei.noaa.gov/data/sea-surface-temperature-optimum-interpolation/v2.1/access/avhrr/{parsed:%Y%m}/oisst-avhrr-v02r01.{parsed:%Y%m%d}.nc'
        s=build_snapshot(day,fetch(url));CACHE.mkdir(exist_ok=True)
        cached.write_text(json.dumps(s,allow_nan=False),encoding='utf-8')
        return s
