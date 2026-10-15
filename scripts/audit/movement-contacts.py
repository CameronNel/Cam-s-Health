#!/usr/bin/env python3
"""Contact sheets composed only from the actual integrated browser screenshots."""
import json, os, sys, math, textwrap, hashlib
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont
root=Path(sys.argv[1] if len(sys.argv)>1 else '/workspace/cams-health-layout-audit/movements-final')
run=json.loads((root/'results.json').read_text())
out=root/'contacts';out.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
head=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
captures=run['captures'];index={'sourceHash':run['sourceHash'],'sourceChangedSinceStart':run.get('sourceChangedSinceStart'),'pages':[],'captureCount':len(captures),'kind':'Actual local Chromium captures; contact sheets are reduced viewing copies, native PNGs retained.'}
groups={
 'camera':[c for c in captures if c['id'].startswith('demo:')],
 'poses':[c for c in captures if '--pose-' in c['id']],
 'phone':[c for c in captures if c['id'].endswith('--oppo-popup')],
}
for kind,items in groups.items():
 cols=4 if kind in ['camera','poses'] else 4
 rows=5 if kind!='phone' else 3
 tilew=300 if kind!='phone' else 212
 imageh=238 if kind!='phone' else 462
 labelh=45; gap=10; top=50
 for page,start in enumerate(range(0,len(items),cols*rows),1):
  batch=items[start:start+cols*rows]
  canvas=Image.new('RGB',(cols*(tilew+gap)+gap,top+math.ceil(len(batch)/cols)*(imageh+labelh+gap)+gap),'#080a0e')
  draw=ImageDraw.Draw(canvas);draw.text((gap,12),f'Movement audit · {kind} · {page} · {run["sourceHash"][:12]}',font=head,fill='#e8e6ef')
  record={'category':kind,'page':page,'file':f'{kind}-{page:02}.jpg','captures':[]}
  for local,c in enumerate(batch):
   native=root/c['file'];im=Image.open(native).convert('RGB');x=gap+(local%cols)*(tilew+gap);y=top+(local//cols)*(imageh+labelh+gap)
   fitted=ImageOps.contain(im,(tilew,imageh),Image.Resampling.LANCZOS)
   canvas.paste(fitted,(x+(tilew-fitted.width)//2,y+(imageh-fitted.height)//2))
   label=c['id'].replace('demo:','').replace('demo-','').replace('three-quarter','¾').replace('--35pct',' ·35%').replace('--pose-',' ·pose ')
   lines=textwrap.wrap(label,width=41 if kind!='phone' else 28)[:3]
   for row,line in enumerate(lines):draw.text((x,y+imageh+3+row*14),line,font=font,fill='#c4bfd1')
   record['captures'].append({'id':c['id'],'native':c['file'],'nativeSize':list(im.size),'sha256':hashlib.sha256(native.read_bytes()).hexdigest()})
  canvas.save(out/record['file'],quality=92,subsampling=0)
  record['size']=list(canvas.size);index['pages'].append(record)
(out/'index.json').write_text(json.dumps(index,indent=2))
print(json.dumps({'pages':len(index['pages']),'categories':{k:len(v) for k,v in groups.items()},'sourceHash':run['sourceHash']}))
