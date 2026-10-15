import {BODY_FIELDS, METHODS, validDate, ensureDay, assertUnchanged, toMetric} from './body.js';
import {shiftDate} from './model.js';

export const BODY_METRICS = [['weightKg','Weight'],['bodyFatPct','Body fat'],['skeletalMuscleKg','Reported muscle'],...BODY_FIELDS];
const keys = new Set(BODY_METRICS.map(([key])=>key));
const DAY = 86400000;
export const metricStorageUnit = key => key==='bodyFatPct'?'%':key==='weightKg'||key==='skeletalMuscleKg'?'kg':'cm';
export const metricValue = (day,key) => key==='weightKg'?day?.weightKg??null:['bodyFatPct','skeletalMuscleKg'].includes(key)?day?.body?.[key]??null:day?.body?.measurementsCm?.[key]??null;
export function readings(data,key,end,range='all',method='all') {
  if(!keys.has(key)) return [];
  const start=range==='all'?'0000-00-00':shiftDate(end,1-Number(range));
  return Object.entries(data.days).filter(([date])=>date>=start&&date<=end).map(([date,day])=>({date,value:metricValue(day,key),method:day.body?.method||'Not specified',notes:day.body?.notes||''})).filter(p=>Number.isFinite(p.value)&&(method==='all'||p.method===method)).sort((a,b)=>a.date.localeCompare(b.date));
}
export function smoothedWeight(points,windowDays=7) {
  return points.map(point=>{const start=Date.parse(point.date)-(windowDays-1)*DAY;const sample=points.filter(p=>p.date<=point.date&&Date.parse(p.date)>=start);return {date:point.date,value:sample.reduce((sum,p)=>sum+p.value,0)/sample.length,count:sample.length};});
}
export function readingSegments(points,maxGapDays=7,matchMethod=false) {
  const segments=[];
  for(const point of points){const prior=segments.at(-1)?.at(-1);if(!prior||(Date.parse(point.date)-Date.parse(prior.date))/DAY>maxGapDays||(matchMethod&&(prior.method!==point.method||point.method==='Not specified')))segments.push([]);segments.at(-1).push(point);}
  return segments;
}
export function compareDates(data,a,b) {
  const left=data.days[a]||{},right=data.days[b]||{},leftMethod=left.body?.method||'Not specified',rightMethod=right.body?.method||'Not specified';
  return BODY_METRICS.map(([key,label])=>{const before=metricValue(left,key),after=metricValue(right,key),comparable=key==='weightKg'||(leftMethod===rightMethod&&leftMethod!=='Not specified');return {key,label,before,after,comparable,change:before!=null&&after!=null&&comparable?after-before:null,leftMethod,rightMethod};});
}
export function pairedReadings(day) {
  return [['upperArm','Upper arm'],['forearm','Forearm'],['thigh','Thigh'],['calf','Calf']].map(([key,label])=>{const left=day?.body?.measurementsCm?.[key+'Left']??null,right=day?.body?.measurementsCm?.[key+'Right']??null;return {key,label,left,right,difference:left!=null&&right!=null?right-left:null};});
}
export function parseCSV(text) {
  if(typeof text!=='string'||text.length>350000)throw Error('Choose a CSV smaller than 350 KB.');
  const rows=[];let row=[],field='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){const char=text[i];if(char==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(quoted||!field)quoted=!quoted;else throw Error('Unexpected quote in CSV.');}else if(char===','&&!quoted){row.push(field);field='';}else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';}else field+=char;}
  if(quoted)throw Error('The CSV contains an unclosed quote.');row.push(field);if(row.some(v=>v.trim()))rows.push(row);
  if(rows.length<2)throw Error('The CSV needs a header and at least one reading.');if(rows.length>2001)throw Error('Import up to 2,000 readings at once.');
  const headers=rows.shift().map(s=>s.trim());if(headers.some(h=>!h))throw Error('Every CSV column needs a header.');
  if(rows.some(r=>r.length!==headers.length))throw Error('Every CSV row must have the same number of columns as its header.');
  return {headers,rows};
}
export function guessMapping(headers) {
  const normalized=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
  return headers.map(header=>{const n=normalized(header);if(['date','measurementdate','day'].includes(n))return 'date';if(['method','measurementmethod'].includes(n))return 'method';if(['notes','note'].includes(n))return 'notes';if(['weight','weightkg','bodyweightkg'].includes(n))return 'weightKg';if(['weightlb','weightlbs','bodyweightlb'].includes(n))return 'weightKg:imperial';if(['bodyfat','bodyfatpct','bodyfatpercent','fatpct'].includes(n))return 'bodyFatPct';if(['muscle','musclekg','skeletalmusclekg','reportedmusclekg'].includes(n))return 'skeletalMuscleKg';if(['musclelb','skeletalmusclelb'].includes(n))return 'skeletalMuscleKg:imperial';for(const [key,label] of BODY_FIELDS){if([normalized(key),normalized(key+'Cm'),normalized(label),normalized(label+' cm')].includes(n))return key;if([normalized(key+'In'),normalized(label+' in')].includes(n))return key+':imperial';}return '';});
}
const pathFor=key=>key==='weightKg'?['weightKg']:['bodyFatPct','skeletalMuscleKg','method','notes'].includes(key)?['body',key]:['body','measurementsCm',key];
const getPath=(day,path)=>path.reduce((value,key)=>value?.[key],day);
const putPath=(day,path,value)=>{let target=day;path.slice(0,-1).forEach(key=>target=target[key]??={});target[path.at(-1)]=value;};
export function previewImport(data,csv,mapping) {
  if(mapping.length!==csv.headers.length||mapping.filter(key=>key==='date').length!==1)throw Error('Map exactly one column to Date.');
  const mapped=mapping.filter(Boolean);if(new Set(mapped.map(k=>k.split(':')[0])).size!==mapped.length)throw Error('Map each measurement only once.');
  if(!mapped.some(k=>keys.has(k.split(':')[0])))throw Error('Map at least one measurement.');
  const candidates=new Map(),errors=[];
  csv.rows.forEach((row,index)=>{try{const date=row[mapping.indexOf('date')].trim();if(!validDate(date))throw Error('Date must be a real YYYY-MM-DD date.');const record=candidates.get(date)||{date,values:{},sourceRows:[]};record.sourceRows.push(index+2);
    mapping.forEach((mapped,col)=>{if(!mapped||mapped==='date')return;const [key,units='metric']=mapped.split(':');if(!keys.has(key)&&!['method','notes'].includes(key))throw Error('Unsupported mapped field.');const raw=row[col].trim();if(!raw)return;let value=raw;if(key==='method'){if(!METHODS.includes(raw))throw Error('Method must match a listed measurement method.');}else if(key==='notes'){if(raw.length>5000)throw Error('Notes may contain at most 5,000 characters.');}else{if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw))throw Error('Measurements must be positive numbers; leave unknown cells blank.');value=toMetric(Number(raw),key==='skeletalMuscleKg'?'weightKg':key,units);const max=key==='weightKg'?500:key==='bodyFatPct'?99.9:key==='skeletalMuscleKg'?300:400;if(value<=0||value>max)throw Error(`${key} exceeds its supported range.`);}if(Object.hasOwn(record.values,key)&&record.values[key]!==value)throw Error('Two CSV rows give different values for the same date and field.');record.values[key]=value;});candidates.set(date,record);
  }catch(error){errors.push({row:index+2,message:error.message});}});
  const changes=[],duplicates=[],conflicts=[];
  for(const record of candidates.values()){
    const day=data.days[record.date]||{},weight=record.values.weightKg??day.weightKg,muscle=record.values.skeletalMuscleKg??day.body?.skeletalMuscleKg;
    if(weight!=null&&muscle!=null&&muscle>weight){errors.push({row:record.sourceRows[0],message:'Reported muscle cannot exceed same-day weight.'});continue;}
    for(const [key,value] of Object.entries(record.values)){const path=pathFor(key),baseline=getPath(day,path)??null;const change={date:record.date,key,path,value,baseline:structuredClone(baseline)};if(baseline===value)duplicates.push(change);else{changes.push(change);if(baseline!=null&&baseline!=='')conflicts.push(change);}}
  }
  return {changes,duplicates,conflicts,errors,rowCount:csv.rows.length,dateCount:candidates.size};
}
export function applyBodyImport(data,preview,{replaceExisting=false,now=new Date().toISOString()}={}) {
  if(preview.errors.length)throw Error('Resolve the CSV errors before importing.');if(preview.conflicts.length&&!replaceExisting)throw Error('Review and explicitly allow replacement of the existing fields.');if(!preview.changes.length)throw Error('These readings are already recorded. Nothing to import.');
  // Check every field before making the first mutation. Disjoint changes remain safe.
  for(const change of preview.changes)assertUnchanged(getPath(data.days[change.date],change.path)??null,change.baseline);
  for(const change of preview.changes){const day=ensureDay(data,change.date);putPath(day,change.path,change.value);if(change.path[0]==='body')day.body.recordedAt=now;}
  return data;
}
export function checkInCalendar(reminder,startDate,uid='cams-health-body-check-in') {
  if(!validDate(startDate)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(reminder.time)||!Array.isArray(reminder.weekdays)||!reminder.weekdays.length||reminder.weekdays.some(n=>!Number.isInteger(n)||n<0||n>6))throw Error('Choose at least one weekday and a valid reminder time.');
  const names=['SU','MO','TU','WE','TH','FR','SA'];let start=startDate;for(let i=0;i<7&&!reminder.weekdays.includes(new Date(start+'T12:00:00Z').getUTCDay());i++)start=shiftDate(start,1);
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Cams Health//Body check-in//EN','CALSCALE:GREGORIAN','BEGIN:VTIMEZONE','TZID:Europe/Amsterdam','BEGIN:DAYLIGHT','DTSTART:19700329T020000','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU','TZOFFSETFROM:+0100','TZOFFSETTO:+0200','TZNAME:CEST','END:DAYLIGHT','BEGIN:STANDARD','DTSTART:19701025T030000','RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU','TZOFFSETFROM:+0200','TZOFFSETTO:+0100','TZNAME:CET','END:STANDARD','END:VTIMEZONE','BEGIN:VEVENT',`UID:${uid.replace(/[^a-zA-Z0-9-]/g,'')}@cams-health`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART;TZID=Europe/Amsterdam:${start.replaceAll('-','')}T${reminder.time.replace(':','')}00`,`RRULE:FREQ=WEEKLY;BYDAY=${[...new Set(reminder.weekdays)].sort().map(n=>names[n]).join(',')}`,'SUMMARY:Body check-in','DESCRIPTION:Open Cams Health to record your own measurements.','URL:https://cams-health.cameronnel111.chatgpt.site','BEGIN:VALARM','TRIGGER:PT0M','ACTION:DISPLAY','DESCRIPTION:Body check-in','END:VALARM','END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
