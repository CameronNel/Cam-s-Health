import test from 'node:test';
import assert from 'node:assert/strict';
import {createPressHandlers} from '../dist/gestures.js';

function fixture(){
  let pending=null,time=0,opened=0,previewed=0,blocked=0;
  const handlers=createPressHandlers({open:()=>opened++,preview:()=>previewed++,schedule:fn=>(pending=fn,1),unschedule:()=>pending=null,now:()=>time});
  const pointer={button:0,isPrimary:true,clientX:20,clientY:20};
  const click={detail:1,preventDefault:()=>blocked++,stopPropagation:()=>{}};
  return {handlers,pointer,click,fire:()=>pending?.(),advance:n=>time+=n,counts:()=>({opened,previewed,blocked}),hasTimer:()=>!!pending};
}
test('a tap opens full details, never preview',()=>{const f=fixture();f.handlers.down(f.pointer);f.handlers.up();f.handlers.click(f.click);assert.deepEqual(f.counts(),{opened:1,previewed:0,blocked:0});});
test('holding previews and release cannot also open full details',()=>{const f=fixture();f.handlers.down(f.pointer);f.fire();f.advance(4000);f.handlers.up();f.handlers.click(f.click);assert.deepEqual(f.counts(),{opened:0,previewed:1,blocked:1});});
test('scrolling movement or pointer cancellation cancels the hold',()=>{const f=fixture();f.handlers.down(f.pointer);f.handlers.move({...f.pointer,clientY:38});assert.equal(f.hasTimer(),false);f.handlers.down(f.pointer);f.handlers.cancel();assert.equal(f.hasTimer(),false);assert.equal(f.counts().previewed,0);});
test('keyboard activation is never swallowed after a preview',()=>{const f=fixture();f.handlers.down(f.pointer);f.fire();f.handlers.click({...f.click,detail:0});assert.equal(f.counts().opened,1);});
test('a later tap still opens normally; right button never starts a hold',()=>{const f=fixture();f.handlers.down(f.pointer);f.fire();f.handlers.up();f.advance(800);f.handlers.down(f.pointer);f.handlers.up();f.handlers.click(f.click);assert.equal(f.counts().opened,1);f.handlers.down({...f.pointer,button:2});assert.equal(f.hasTimer(),false);});
