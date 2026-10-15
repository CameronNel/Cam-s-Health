import test from 'node:test';
import assert from 'node:assert/strict';
import {liquidRenderSize} from '../dist/liquid-scene.js';

test('goal bubbles cover native phone pixels with additional edge supersampling',()=>{
  for(const cssSize of [80,88,125,140])for(const dpr of [1,2,2.625,3,3.5,4]){
    const size=liquidRenderSize(cssSize,cssSize,dpr);
    assert.ok(size.width>=Math.ceil(cssSize*dpr),`${cssSize}px at ${dpr} DPR is undersampled`);
    assert.equal(size.width,size.height);
  }
  assert.ok(liquidRenderSize(140,140,3).width>420,'3× phone gets subpixel antialiasing headroom');
});

test('glass rendering stays bounded and preserves layout aspect at large sizes',()=>{
  for(const dpr of [1,3,8]){
    const {width,height}=liquidRenderSize(1200,600,dpr);
    assert.ok(width<=640&&height<=640);
    assert.equal(width/height,2);
  }
  const fractional=liquidRenderSize(88.5,88.5,2.625);
  assert.ok(Number.isInteger(fractional.width)&&fractional.width>88.5*2.625);
});

test('density-only changes sharpen the buffer without altering the CSS aspect',()=>{
  const initial=liquidRenderSize(140,100,1),retina=liquidRenderSize(140,100,3);
  assert.ok(retina.width>initial.width&&retina.height>initial.height);
  assert.equal(retina.width/retina.height,initial.width/initial.height);
  const defaultSquare=liquidRenderSize(140,140,1);
  for(const invalid of [0,-1,NaN,Infinity])assert.deepEqual(liquidRenderSize(140,140,invalid),defaultSquare);
});
