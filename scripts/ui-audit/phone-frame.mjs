import {createFixture,settle,DATE} from './fixture.mjs';

// Private, browser-rendered reference frame. These external bars are simulations,
// never production elements or proof of a physical Oppo installation.
export function phoneGeometry(width=424){
 const height=Math.round(width*19.6/9),status=Math.round(width*47/424),navigation=Math.round(width*52/424);
 return{width,height,status,navigation,appHeight:height-status-navigation,ratio:'19.6:9',externalBars:'reference-derived simulation'};
}
export async function framedFixture(options={}){
 const geometry=phoneGeometry(options.width||424),f=await createFixture({...options,height:geometry.height});
 const outer=f.page;
 await f.context.route('**/__audit/oppo-frame*',async route=>{
  const u=new URL(route.request().url()),view=u.searchParams.get('view')||'dashboard',date=u.searchParams.get('date')||DATE;
  const src=u.searchParams.get('recovery')==='1'?'/update.html':`/?date=${encodeURIComponent(date)}#${encodeURI(view)}`;
  await route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden}body{display:grid;grid-template-rows:${geometry.status}px ${geometry.appHeight}px ${geometry.navigation}px;font-family:Arial,sans-serif;color:#e8e8e8}.status{display:flex;align-items:center;justify-content:space-between;padding:0 ${Math.round(30*geometry.width/424)}px;font-size:${14*geometry.width/424}px;font-weight:600}.status svg{width:55px;height:15px}iframe{border:0;display:block;width:100%;height:100%}.system-nav{display:flex;align-items:center;justify-content:space-evenly;padding:0 55px;color:#777}.system-nav svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.3}</style></head><body><div class="status" aria-label="Simulated system status bar"><span>23:03</span><svg viewBox="0 0 55 15"><path fill="#ddd" d="M1 12h2V9H1zm4 0h2V7H5zm4 0h2V4H9zm4 0h2V1h-2z"/><rect x="23" y="2" width="27" height="11" rx="3" fill="none" stroke="#ddd"/><path fill="#ddd" d="M50 5h3v5h-3"/><rect x="25" y="4" width="19" height="7" rx="1" fill="#b9db89"/></svg></div><iframe id="app" title="Cam’s Life local preview" src="${src}"></iframe><div class="system-nav" aria-label="Simulated system navigation"><svg viewBox="0 0 20 20"><path d="M3 5h14M3 10h14M3 15h14"/></svg><svg viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" rx="4"/></svg><svg viewBox="0 0 20 20"><path d="M14 3 4 10l10 7z"/></svg></div></body></html>`});
 });
 let frame;
 const proxy=new Proxy(outer,{get(target,key){
  if(['evaluate','locator','getByText','getByRole','getByLabel','getByPlaceholder','getByTestId','url'].includes(key))return(...args)=>frame[key](...args);
  const value=target[key];return typeof value==='function'?value.bind(target):value;
 }});
 f.page=proxy;f.geometry=geometry;f.outerPage=outer;
 f.goto=async(view='dashboard',{date=DATE,wait=true,recovery=false}={})=>{
  await outer.goto(`${f.origin}/__audit/oppo-frame?view=${encodeURIComponent(view)}&date=${date}${recovery?'&recovery=1':''}`,{waitUntil:'domcontentloaded'});
  await outer.locator('#app').waitFor();
  frame=outer.frames().find(x=>x.parentFrame()===outer.mainFrame());
  if(!frame)throw Error('App frame failed to attach');
  if(wait){await frame.locator(recovery?'#check':'.bottom-nav').waitFor();if(!recovery&&f.privateError&&['dashboard','inbox','life'].includes(view))await frame.locator('.notice.warning').filter({hasText:'Life sync needs attention'}).first().waitFor();if(!recovery&&f.privateError&&view==='settings')await frame.getByText('Private records unavailable',{exact:true}).waitFor();await settle(proxy);}
 };
 return f;
}
