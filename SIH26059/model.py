"""PolarRoute research engine. Synthetic baseline; no operational navigation claims."""
import csv
import hashlib
import heapq
import io
import json
import math
import time
from datetime import datetime, timezone
from functools import lru_cache
import numpy as np

H, W, STEP_HOURS = 30, 44, 6
BOUNDS = [72.0, -69.0, 82.0, -65.0]
DX = 111.195 * math.cos(math.radians(-67)) * 10 / (W-1)
DY = 111.195 * 4 / (H-1)
MODES = ('distance', 'balanced', 'fuel')


def field(seed=59, phase=0, severity=1):
    y, x = np.mgrid[0:H, 0:W]
    c=.10+.53*np.exp(-((x-22-phase*.10)**2/45+(y-14)**2/85))
    c+=.30*np.exp(-((x-33)**2/80+(y-24)**2/30))
    c+=.07*np.sin(x*.21+y*.15+seed)*np.cos(phase*.1)
    return np.clip(c*severity,0,1)


def neighbors(a):
    # Regional boundary values repeat; opposite sides of the grid are not adjacent.
    return np.concatenate((a[:,:1],a[:,:-1]),axis=1),np.concatenate((a[:1],a[:-1]),axis=0)


def features(p,c,t):
    west,north=neighbors(c)
    return np.stack([np.ones_like(c),c,c-p,west-c,north-c,t],axis=-1)


def truth_step(p,c,t,rng):
    west,north=neighbors(c)
    return np.clip(.994*c+.28*(c-p)+.10*(west-c)+.06*(north-c)-.004*(t+1.8)
                   +rng.normal(0,.006,c.shape),0,1)


def train_model():
    rng=np.random.default_rng(26059);xs=[];ys=[]
    for seed in range(12):
        p,c=field(seed,-1),field(seed,0);t=np.full((H,W),-1.6+seed*.04)
        for _ in range(10):
            n=truth_step(p,c,t,rng);xs.append(features(p,c,t).reshape(-1,6));ys.append(n.ravel());p,c=c,n
    x,y=np.concatenate(xs),np.concatenate(ys)
    return np.linalg.solve(x.T@x+.01*np.eye(6),x.T@y)


COEFFICIENTS=train_model()


def forecast(previous,current,temp,steps,method='ridge'):
    out=[current.copy()]
    for _ in range(steps):
        nxt=current.copy() if method=='persistence' else np.clip(features(previous,current,temp)@COEFFICIENTS,0,1)
        out.append(nxt);previous,current=current,nxt
    return np.array(out)


def sample_scenario(kind='standard'):
    if kind not in ('standard','blocked','crosswind'):raise ValueError('Unknown scenario.')
    yy,xx=np.mgrid[0:H,0:W];land=np.zeros((H,W),bool)
    for x in range(W):land[max(26,int(28+2*math.sin(x*.22))):,x]=True
    c=field(severity=1.85 if kind=='blocked' else 1);p=field(phase=-1,severity=1.85 if kind=='blocked' else 1)
    if kind=='blocked':c[:,21:24]=.99;p[:,21:24]=.99
    wu=6+1.3*np.sin(yy/6)+.4*np.cos(xx/5);wv=-2+.7*np.cos(xx/7)
    wave=1.1+.6*np.exp(-((xx-15)**2+(yy-6)**2)/110)
    if kind=='crosswind':wu=wu*1.8;wv=wv-5;wave+=2*np.exp(-((xx-22)**2+(yy-7)**2)/75)
    return dict(name={'standard':'Coastal passage','blocked':'Closed corridor','crosswind':'Crosswind passage'}[kind],
      source='Synthetic demonstration; fictional coastline and environmental fields',data_kind='synthetic',
      observed_at='2026-10-01T00:00:00Z',bounds=BOUNDS,
      previous=p.tolist(),current=c.tolist(),temperature=np.full((H,W),-1.5).tolist(),land=land.tolist(),
      current_u=(.10+.04*np.sin(yy/5)).tolist(),current_v=(.035+.025*np.cos(xx/8)).tolist(),
      wind_u=wu.tolist(),wind_v=wv.tolist(),wave_height=wave.tolist(),
      depth=np.where(land,0,100+1700*(1-yy/H)).tolist(),start=[4,18],goal=[39,11],
      icebergs=[dict(id='Berg A',x=21,y=12,sail=12,draft=100),dict(id='Berg B',x=30,y=21,sail=8,draft=70)])


def array(value):
    a=np.asarray(value,dtype=float)
    return np.full((H,W),float(a)) if a.ndim==0 else a


def validate(s):
    if not isinstance(s,dict):raise ValueError('Scenario must be a JSON object.')
    for k in ('name','source','observed_at'):
        if not isinstance(s.get(k),str) or not 1<=len(s[k])<=240:raise ValueError(f'{k} needs 1–240 characters.')
    try:
        dt=datetime.fromisoformat(s['observed_at'].replace('Z','+00:00'))
        if dt.tzinfo is None:raise ValueError()
    except ValueError:raise ValueError('observed_at must include an ISO timezone, such as Z.')
    b=s.get('bounds')
    if not isinstance(b,list) or len(b)!=4 or any(type(v) not in (int,float) or not math.isfinite(v) for v in b):raise ValueError('bounds must be [west,south,east,north].')
    if not(-180<=b[0]<b[2]<=180 and -85<=b[1]<b[3]<=-45 and .05<=b[2]-b[0]<=30 and .05<=b[3]-b[1]<=15):raise ValueError('Use 45–85°S, width 0.05–30°, height 0.05–15°; no dateline crossing.')
    for k,lo,hi in [('previous',0,1),('current',0,1),('temperature',-10,15),('land',0,1)]:
        a=np.asarray(s.get(k),dtype=float)
        if a.shape!=(H,W) or not np.isfinite(a).all() or (a<lo).any() or (a>hi).any():raise ValueError(f'{k} must be a finite {H}×{W} grid in [{lo},{hi}]. Missing values cannot become open water.')
        if k=='land' and not np.isin(a,[0,1]).all():raise ValueError('land must contain booleans or 0/1.')
    for k,lo,hi in [('wind_u',-50,50),('wind_v',-50,50),('current_u',-3,3),('current_v',-3,3),('wave_height',0,20),('depth',0,12000)]:
        if s.get('data_kind')=='observational' and k not in s:continue
        a=array(s.get(k,0 if k=='wave_height' else 10000 if k=='depth' else None))
        if a.shape!=(H,W) or not np.isfinite(a).all() or (a<lo).any() or (a>hi).any():raise ValueError(f'{k} must be a finite scalar or {H}×{W} grid in [{lo},{hi}].')
    for k in ('start','goal'):
        p=s.get(k)
        if not isinstance(p,list) or len(p)!=2 or any(type(v)!=int for v in p) or not(0<=p[0]<W and 0<=p[1]<H):raise ValueError(f'{k} must be [column,row] within the grid.')
    if not isinstance(s.get('icebergs'),list) or len(s['icebergs'])>20:raise ValueError('Provide 0–20 iceberg records.')
    ids=set()
    for b in s['icebergs']:
        if not isinstance(b,dict) or not isinstance(b.get('id'),str) or not 1<=len(b['id'])<=40 or b['id'] in ids:raise ValueError('Icebergs need unique names, 1–40 characters each.')
        ids.add(b['id'])
        for k,lo,hi in [('x',0,W-1),('y',0,H-1),('sail',1,100),('draft',5,600)]:
            v=b.get(k)
            if type(v) not in (float,int) or not math.isfinite(v) or not lo<=v<=hi:raise ValueError(f'Iceberg {k} must be in [{lo},{hi}].')
        if s['land'][int(round(b['y']))][int(round(b['x']))]:raise ValueError(f"{b['id']} starts on land.")
    if 'missing' in s:
        a=np.asarray(s['missing'])
        if a.shape!=(H,W) or not np.isin(a,[0,1]).all():raise ValueError('missing must be a boolean 30×44 grid.')
    if s.get('data_kind')=='observational' and s['icebergs'] and any(k not in s for k in ('wind_u','wind_v','current_u','current_v')):
        raise ValueError('Iceberg drift requires wind and current data. Import verified forcing before adding icebergs to an observational scenario.')
    zones=s.get('exclusion_zones',[])
    if not isinstance(zones,list) or len(zones)>8:raise ValueError('Provide up to eight exclusion zones.')
    for zone in zones:
        if not isinstance(zone,dict):raise ValueError('Each exclusion zone must be an object.')
        for key,lo,hi in [('x',0,W-1),('y',0,H-1),('radius_km',5,100)]:
            value=zone.get(key)
            if type(value) not in (int,float) or not math.isfinite(value) or not lo<=value<=hi:raise ValueError(f'Zone {key} must be in [{lo},{hi}].')
    if 'forecast_frames' in s:
        a=np.asarray(s['forecast_frames'],float)
        if a.ndim!=3 or a.shape[1:]!=(H,W) or not 5<=len(a)<=13 or not np.isfinite(a).all() or ((a<0)|(a>1)).any():raise ValueError('forecast_frames needs 5–13 finite concentration grids in [0,1], one per 6 hours including time zero.')
        if not np.allclose(a[0],s['current'],atol=1e-6):raise ValueError('First supplied forecast must equal current concentration.')
    return s


def metrics(s):
    west,south,east,north=s['bounds'];lat=(south+north)/2
    return 111.195*math.cos(math.radians(lat))*(east-west)/(W-1),111.195*(north-south)/(H-1)


def lonlat(s,p):
    w,so,e,n=s['bounds'];return [w+p[0]/(W-1)*(e-w),n-p[1]/(H-1)*(n-so)]


def haversine(a,b):
    l1,p1,l2,p2=map(math.radians,[a[0],a[1],b[0],b[1]])
    q=math.sin((p2-p1)/2)**2+math.cos(p1)*math.cos(p2)*math.sin((l2-l1)/2)**2
    return 6371.0088*2*math.asin(min(1,math.sqrt(q)))


def sample(a,x,y):
    x=np.clip(x,0,W-1);y=np.clip(y,0,H-1);ix=np.floor(x).astype(int);iy=np.floor(y).astype(int)
    jx=np.minimum(ix+1,W-1);jy=np.minimum(iy+1,H-1);fx=x-ix;fy=y-iy
    return a[iy,ix]*(1-fx)*(1-fy)+a[iy,jx]*fx*(1-fy)+a[jy,ix]*(1-fx)*fy+a[jy,jx]*fx*fy


def iceberg_tracks(s,steps,wind_scale=1):
    if not s['icebergs']:return []
    rng=np.random.default_rng(59);dx,dy=metrics(s);tracks=[]
    wu,wv,cu,cv=(array(s[k]) for k in ('wind_u','wind_v','current_u','current_v'))
    for b in s['icebergs']:
        alpha=math.sqrt(1.293*1.3*b['sail']/(1027*.9*b['draft']))
        a=alpha*rng.uniform(.7,1.3,40);du=rng.normal(0,.025,40);dv=rng.normal(0,.025,40);du-=du.mean();dv-=dv.mean()
        x=np.full(40,float(b['x']));y=np.full(40,float(b['y']));out=[np.stack((x,y),-1)]
        def velocity(x,y):
            lat=s['bounds'][3]-np.clip(y,0,H-1)/(H-1)*(s['bounds'][3]-s['bounds'][1])
            local_dx=111.195*np.cos(np.radians(lat))*(s['bounds'][2]-s['bounds'][0])/(W-1)
            u=sample(cu,x,y)+du+a*sample(wu,x,y)*wind_scale;v=sample(cv,x,y)+dv+a*sample(wv,x,y)*wind_scale
            return u*3.6/local_dx,-v*3.6/dy
        # ponytail: static forcing and no grounding/coriolis/sea-ice mechanics; use a validated model for operations.
        for _ in range(steps):
            for _ in range(12):
                vx,vy=velocity(x,y);vx,vy=velocity(x+.25*vx,y+.25*vy);x=x+.5*vx;y=y+.5*vy
            out.append(np.stack((x,y),-1))
        members=np.stack(out,axis=1);mean=members.mean(0);dist=np.sqrt((((members-mean)*[dx,dy])**2).sum(-1));land=np.array(s['land'],bool)
        onland=bool(any(land[int(round(yy)),int(round(xx))] for xx,yy in mean if 0<=xx<=W-1 and 0<=yy<=H-1))
        exits=bool(((members[:,:,0]<0)|(members[:,:,0]>W-1)|(members[:,:,1]<0)|(members[:,:,1]>H-1)).any())
        tracks.append(dict(id=b['id'],alpha=round(alpha,5),path=mean.tolist(),radius_km=np.quantile(dist,.9,axis=0).tolist(),members=members.tolist(),
            displacement_km=round(haversine(lonlat(s,mean[0]),lonlat(s,mean[-1])),2),intersects_land=onland,exits_domain=exits))
    return tracks


def envelope(tracks,steps,buffer_km,dx=DX,dy=DY):
    yy,xx=np.mgrid[0:H,0:W];blocked=np.zeros((H,W),bool)
    for b in tracks:
        for k in range(max(1,steps)):
            a=np.array(b['path'][k])*[dx,dy];z=np.array(b['path'][min(k+1,steps)])*[dx,dy];vx,vy=z-a
            f=np.clip(((xx*dx-a[0])*vx+(yy*dy-a[1])*vy)/max(vx*vx+vy*vy,1e-12),0,1)
            d=np.hypot(xx*dx-a[0]-f*vx,yy*dy-a[1]-f*vy)
            r=max(b['radius_km'][k],b['radius_km'][min(k+1,steps)])
            blocked|=d<=buffer_km+r+math.hypot(dx,dy)/2
    return blocked


def route(s,ice,blocked,speed,mode):
    sy,sx=s['start'][1],s['start'][0];gy,gx=s['goal'][1],s['goal'][0]
    if blocked[sy,sx] or blocked[gy,gx]:return None
    cu,cv=array(s.get('current_u',0)),array(s.get('current_v',0));waves=array(s.get('wave_height',0));mx,my=metrics(s)
    def edge(y,x,ny,nx):
        km=haversine(lonlat(s,[x,y]),lonlat(s,[nx,ny]));c=float((ice[y,x]+ice[ny,nx])/2);wave=float((waves[y,x]+waves[ny,nx])/2)
        norm=math.hypot((nx-x)*mx,(ny-y)*my)
        current=((float(cu[y,x]+cu[ny,nx])/2)*(nx-x)*mx-(float(cv[y,x]+cv[ny,nx])/2)*(ny-y)*my)/max(norm,1e-9)*3.6
        ground=max(1,speed*1.852*max(.25,1-.6*c)-.15*wave*wave+current)
        return km,c,wave,km/ground,km*(1+4*c*c+.08*wave*wave)*(speed/10)**2
    q=[(0,sy,sx)];costs={(sy,sx):0};parent={};expanded=0
    while q:
        score,y,x=heapq.heappop(q)
        if score!=costs[(y,x)]:continue
        expanded+=1
        if (y,x)==(gy,gx):break
        for dy,dx in ((0,1),(0,-1),(1,0),(-1,0),(1,1),(1,-1),(-1,1),(-1,-1)):
            ny,nx=y+dy,x+dx
            if not(0<=ny<H and 0<=nx<W) or blocked[ny,nx]:continue
            if dx and dy and (blocked[y,nx] or blocked[ny,x]):continue
            km,c,wave,_,fuel=edge(y,x,ny,nx)
            weight=km if mode=='distance' else fuel if mode=='fuel' else km*(1+12*c*c+.2*wave*wave);new=score+weight
            if new<costs.get((ny,nx),float('inf')):
                costs[(ny,nx)]=new;parent[(ny,nx)]=(y,x);heapq.heappush(q,(new,ny,nx))
    if (gy,gx) not in costs:return None
    p=[(gy,gx)]
    while p[-1]!=(sy,sx):p.append(parent[p[-1]])
    p.reverse();distance=hours=fuel=exposure=0;legs=[]
    for (y,x),(ny,nx) in zip(p,p[1:]):
        km,c,wave,duration,f=edge(y,x,ny,nx);distance+=km;hours+=duration;fuel+=f;exposure+=km*c
        legs.append(dict(cell=[nx,ny],lonlat=lonlat(s,[nx,ny]),distance_km=round(distance,3),eta_hours=round(hours,3),ice_fraction=round(c,4),wave_m=round(wave,2)))
    return dict(mode=mode,path=[[x,y] for y,x in p],distance_km=round(distance,2),eta_hours=round(hours,2),fuel_index=round(fuel,2),
                mean_ice=round(exposure/max(distance,1e-9),4),max_ice=round(max(float(ice[y,x]) for y,x in p),4),legs=legs,expanded_nodes=expanded)


def run(s,options=None):
    started=time.perf_counter();validate(s)
    if options is not None and not isinstance(options,dict):raise ValueError('options must be an object.')
    o=options or {}
    def number(k,default,lo,hi):
        v=o.get(k,default)
        if type(v) not in (int,float) or not math.isfinite(v) or not lo<=v<=hi:raise ValueError(f'{k} must be between {lo} and {hi}.')
        return v
    horizon=number('horizon',72,24,72)
    if horizon not in (24,48,72):raise ValueError('horizon must be 24, 48 or 72 hours.')
    speed=number('speed',12,5,18);limit=number('ice_limit',.65,.15,.9);buffer=number('buffer_km',12,5,40);wind=number('wind_scale',1,0,2)
    max_wave=number('max_wave',4,1,10);draft=number('vessel_draft',8,1,20);method=o.get('forecast_method','ridge');steps=int(horizon/6)
    if method not in ('ridge','persistence','supplied'):raise ValueError('forecast_method must be ridge, persistence or supplied.')
    if s.get('data_kind')=='observational' and method=='ridge':raise ValueError('Use persistence or supplied forecasts with real observations. The synthetic-trained baseline is restricted to demo data.')
    if method=='supplied':
        if 'forecast_frames' not in s or len(s['forecast_frames'])<steps+1:raise ValueError('Not enough supplied 6-hour forecast frames for this horizon.')
        forecasts=np.array(s['forecast_frames'][:steps+1])
    else:forecasts=forecast(np.array(s['previous']),np.array(s['current']),np.array(s['temperature']),steps,method)
    tracks=iceberg_tracks(s,steps,wind);ice=forecasts.max(0);dx,dy=metrics(s)
    reasons=dict(land=np.array(s['land'],bool),ice=ice>=limit,iceberg=envelope(tracks,steps,buffer,dx,dy),waves=array(s.get('wave_height',0))>max_wave,depth=array(s.get('depth',10000))<draft+3)
    yy,xx=np.mgrid[0:H,0:W];zones=np.zeros((H,W),bool)
    for zone in s.get('exclusion_zones',[]):
        zones|=np.hypot((xx-zone['x'])*dx,(yy-zone['y'])*dy)<=zone['radius_km']+math.hypot(dx,dy)/2
    reasons['zones']=zones
    reasons['missing']=np.array(s.get('missing',np.zeros((H,W),bool)),bool)
    blocked=np.logical_or.reduce(list(reasons.values()));routes=[];rejected=[]
    for mode in MODES:
        r=route(s,ice,blocked,speed,mode)
        if r:
            r['within_horizon']=bool(r['eta_hours']<=horizon);(routes if r['within_horizon'] else rejected).append(r)
    warnings=list(s.get('source_notes',[]))
    if s.get('data_kind','user-supplied')=='synthetic':warnings.append('Synthetic scenario: environmental fields and coastline are not observations.')
    if method=='ridge':warnings.append('Sea-ice model is trained on synthetic sequences, not Antarctic observations.')
    if 'wave_height' not in s:warnings.append('No wave field supplied; waves were not assessed.')
    if 'depth' not in s:warnings.append('No depth field supplied; under-keel clearance was not assessed.')
    if any(t['exits_domain'] for t in tracks):warnings.append('Some ensemble members leave the forcing domain; boundary forcing is held constant outside it.')
    if any(t['intersects_land'] for t in tracks):warnings.append('A mean iceberg track intersects land; iceberg grounding is not modelled.')
    age=(datetime.now(timezone.utc)-datetime.fromisoformat(s['observed_at'].replace('Z','+00:00'))).total_seconds()/3600
    if s.get('data_kind')!='synthetic' and age>24:warnings.append(f'Imported observations are {age:.0f} hours old. This is a historical scenario, not a current advisory.')
    if rejected:warnings.append(f'{len(rejected)} candidate(s) rejected because their passage exceeds the forecast horizon.')
    if not routes:
        for key in ('start','goal'):
            x,y=s[key];why=[k for k,v in reasons.items() if v[y,x]]
            if why:warnings.append(f"{key.title()} blocked by: {', '.join(why)}.")
        warnings.append('No accepted route. Review constraints, endpoints or forecast coverage.')
    opts=dict(horizon=horizon,speed=speed,ice_limit=limit,buffer_km=buffer,wind_scale=wind,max_wave=max_wave,vessel_draft=draft,forecast_method=method)
    fingerprint=hashlib.sha256(json.dumps({'scenario':s,'options':opts},sort_keys=True,allow_nan=False).encode()).hexdigest()[:12]
    return dict(scenario={k:v for k,v in s.items() if k not in ('previous','current','temperature','forecast_frames')},options=opts,
        forecasts=np.round(forecasts,4).tolist(),tracks=tracks,blocked=blocked.tolist(),block_reasons={k:v.tolist() for k,v in reasons.items()},routes=routes,rejected_routes=rejected,
        grid=dict(width=W,height=H,dx_km=dx,dy_km=dy),warnings=warnings,
        stats=dict(run_id=fingerprint,elapsed_ms=round((time.perf_counter()-started)*1000,1),blocked_percent=round(float(blocked.mean()*100),1),reason_counts={k:int(v.sum()) for k,v in reasons.items()},
                   ice_mean=[round(float(f[~(reasons['land']|reasons['missing'])].mean()),4) if (~(reasons['land']|reasons['missing'])).any() else None for f in forecasts]),
        model='Synthetic ridge / persistence / supplied fields; spatial RK2 reduced-drag ensemble; constrained routing',
        limitations=['Sensitivity spread is not calibrated probability.','Fuel index is a relative proxy, not litres or measured savings.',
                     'Static forcing; no Coriolis, sea-ice mechanics, melting or iceberg grounding.','Prototype routes are not certified safe navigation.'])


@lru_cache(maxsize=1)
def evaluate():
    rng=np.random.default_rng(99059);sq=[];base=[]
    for seed in range(30,36):
        p,c=field(seed,-1),field(seed,0);t=np.full((H,W),-1.4);pred=forecast(p,c,t,12);truth=[c]
        for _ in range(12):n=truth_step(p,c,t,rng);truth.append(n);p,c=c,n
        truth=np.array(truth);sq.append(((pred[1:]-truth[1:])**2).mean(axis=(1,2)));base.append(((truth[0]-truth[1:])**2).mean(axis=(1,2)))
    return dict(dataset='Six held-out synthetic sequences, seeds 30–35. Not Antarctic validation.',lead_hours=list(range(6,73,6)),rmse=np.sqrt(np.mean(sq,0)).tolist(),
        persistence_rmse=np.sqrt(np.mean(base,0)).tolist(),coefficients=COEFFICIENTS.tolist(),training_samples=12*10*H*W,test_sequences=6)


def import_csv(text,name='Imported grid'):
    """Import a complete regular lon/lat grid, nearest-neighbor aligned to 30×44."""
    rows=list(csv.DictReader(io.StringIO(text)))
    if not rows or len(rows)>20000:raise ValueError('CSV needs 4–20,000 complete grid rows.')
    required=('longitude','latitude','current','previous','temperature','land','wind_u','wind_v','current_u','current_v')
    if not all(k in rows[0] for k in required):raise ValueError('CSV columns required: '+', '.join(required))
    try:
        xs=sorted(set(float(r['longitude']) for r in rows));ys=sorted(set(float(r['latitude']) for r in rows),reverse=True)
        if len(xs)<2 or len(ys)<2 or len(xs)*len(ys)!=len(rows):raise ValueError('CSV must be a complete rectangular grid.')
        lookup={(float(r['longitude']),float(r['latitude'])):r for r in rows}
        if len(lookup)!=len(rows):raise ValueError('Duplicate coordinate pair.')
        if not np.isfinite(xs+ys).all():raise ValueError('Coordinates must be finite.')
        limits={'current':(0,1),'previous':(0,1),'temperature':(-10,15),'land':(0,1),'wind_u':(-50,50),'wind_v':(-50,50),'current_u':(-3,3),'current_v':(-3,3),'wave_height':(0,20),'depth':(0,12000)}
        for key,(lo,hi) in limits.items():
            if key not in rows[0]:continue
            values=np.array([float(r[key]) for r in rows])
            if not np.isfinite(values).all() or ((values<lo)|(values>hi)).any():raise ValueError(f'CSV {key} must be finite and within [{lo},{hi}], including cells omitted by resampling.')
            if key=='land' and not np.isin(values,[0,1]).all():raise ValueError('CSV land must be 0 or 1.')
        if len({r.get('observed_at','') for r in rows})>1:raise ValueError('CSV must describe one observation timestamp.')
        ix=np.abs(np.array(xs)[None,:]-np.linspace(xs[0],xs[-1],W)[:,None]).argmin(1);iy=np.abs(np.array(ys)[None,:]-np.linspace(ys[0],ys[-1],H)[:,None]).argmin(1)
        s=dict(name=name,source='User CSV; nearest-neighbor resampled. Verify source, mask and units.',data_kind='user-supplied',
               observed_at=rows[0].get('observed_at') or '2000-01-01T00:00:00Z',bounds=[xs[0],ys[-1],xs[-1],ys[0]],start=[2,H//2],goal=[W-3,H//2],icebergs=[])
        for k in required[2:]+tuple(k for k in ('wave_height','depth') if k in rows[0]):s[k]=[[float(lookup[(xs[i],ys[j])][k]) for i in ix] for j in iy]
        validate(s);return s
    except (KeyError,TypeError,OverflowError) as e:raise ValueError('Invalid or missing CSV grid value.') from e
