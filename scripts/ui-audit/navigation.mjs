import assert from 'node:assert/strict';
import {framedFixture} from './phone-frame.mjs';
for(const width of [424,390,360]){
 const f=await framedFixture({width,empty:true});await f.goto();
 await f.outerPage.screenshot({path:`/tmp/cams-nav-${width}.png`});
 const caps=await f.page.locator('.reading-caption').evaluateAll(es=>es.map(e=>({y:e.getBoundingClientRect().bottom,x:e.getBoundingClientRect().x,width:e.getBoundingClientRect().width,font:getComputedStyle(e).font,align:getComputedStyle(e).textAlign})));
 assert.equal(caps.length,2);assert.ok(Math.abs(caps[0].y-caps[1].y)<1);assert.equal(caps[0].font,caps[1].font);assert.ok(Math.abs(caps[0].width-caps[1].width)<1);assert.equal(caps[0].align,'center');
 for(const category of ['activity','sleep','body','checkin','food','overview']){
  await f.page.locator(`[data-home-category=${category}]`).click();assert.ok(await f.page.locator('.home-categories').isVisible());assert.ok(await f.page.locator('.bottom-nav [data-view=dashboard]').getAttribute('aria-current'));
  assert.equal(await f.page.locator('[data-home-category][aria-pressed=true]').getAttribute('data-home-category'),category);
  if(width===424)await f.outerPage.screenshot({path:`/tmp/cams-nav-${category}.png`});
 }
 for(const view of ['nutrition','inbox','life','dashboard']){await f.page.locator(`.bottom-nav [data-view=${view}]`).click();assert.equal(new URL(f.page.url()).hash,`#${view}`);}
 assert.equal(await f.page.locator('[data-home-category=overview]').getAttribute('aria-pressed'),'true');assert.equal(f.writes.length,0);assert.deepEqual(f.errors,[]);await f.close();
}
console.log('All categories remain on Today; all global tabs work; captions align at 3 phone widths; zero writes.');
