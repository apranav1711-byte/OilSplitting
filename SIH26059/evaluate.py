"""Write synthetic evaluation and example outputs for reproducing the demo."""
import json
from pathlib import Path
from model import evaluate,run,sample_scenario

root=Path(__file__).resolve().parent/'research'
root.mkdir(exist_ok=True)
for name,obj in [('evaluation.json',evaluate()),('sample-scenario.json',sample_scenario()),
                 ('demo-results.json',run(sample_scenario())),
                 ('closed-corridor-results.json',run(sample_scenario('blocked')))]:
    (root/name).write_text(json.dumps(obj,indent=2 if name=='evaluation.json' else None,allow_nan=False)+'\n',encoding='utf-8')
print('Wrote four reproducible research artifacts to',root)
