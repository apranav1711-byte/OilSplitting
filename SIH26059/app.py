"""Local-only PolarRoute server. Run: python app.py"""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from model import run, sample_scenario, evaluate, import_csv
from real_data import observations

ROOT=Path(__file__).resolve().parent

class Handler(BaseHTTPRequestHandler):
    def send(self,code,body,mime='application/json'):
        if not isinstance(body,bytes):body=json.dumps(body,allow_nan=False).encode()
        self.send_response(code);self.send_header('Content-Type',mime)
        self.send_header('Content-Length',str(len(body)));self.send_header('X-Content-Type-Options','nosniff')
        self.end_headers();self.wfile.write(body)

    def do_GET(self):
        u=urlparse(self.path)
        if u.path=='/':self.send(200,(ROOT/'index.html').read_bytes(),'text/html; charset=utf-8')
        elif u.path in ('/style.css','/ui.js'):
            self.send(200,(ROOT/u.path[1:]).read_bytes(),'text/css; charset=utf-8' if u.path.endswith('.css') else 'text/javascript; charset=utf-8')
        elif u.path=='/api/scenario':
            try:self.send(200,sample_scenario(parse_qs(u.query).get('kind',['standard'])[0]))
            except ValueError as e:self.send(400,{'error':str(e)})
        elif u.path=='/api/evaluation':self.send(200,evaluate())
        elif u.path=='/api/observations':
            try:self.send(200,observations(parse_qs(u.query).get('date',[None])[0]))
            except (OSError,ValueError,RuntimeError) as e:self.send(503,{'error':'Observation data unavailable: '+str(e)[:250]})
        elif u.path=='/health':self.send(200,{'status':'ok','project':'SIH26059'})
        else:self.send(404,{'error':'Not found'})

    def do_POST(self):
        if self.path not in ('/api/run','/api/import-csv'):return self.send(404,{'error':'Not found'})
        # Calculation/import requests are local. Public provider reads use fixed URLs.
        if self.headers.get('Origin') not in (None,'http://127.0.0.1:8059','http://localhost:8059'):
            return self.send(403,{'error':'Cross-origin requests are not allowed.'})
        try:
            n=int(self.headers.get('Content-Length','0'))
            if not 1<=n<=2_000_000:raise ValueError('Request must be 1 byte to 2 MB.')
            payload=json.loads(self.rfile.read(n))
            if self.path=='/api/import-csv':
                if not isinstance(payload.get('csv'),str):raise ValueError('csv must be text.')
                self.send(200,import_csv(payload['csv'],payload.get('name','Imported grid')))
            else:self.send(200,run(payload.get('scenario',sample_scenario()),payload.get('options')))
        except (ValueError,TypeError,KeyError,AttributeError) as e:self.send(400,{'error':str(e)})

if __name__=='__main__':
    print('PolarRoute: http://127.0.0.1:8059 (Ctrl+C to stop)',flush=True)
    ThreadingHTTPServer(('127.0.0.1',8059),Handler).serve_forever()
