import test from 'node:test';
import assert from 'node:assert/strict';
import {windowWeather} from '../../../app/src/main/assets/home/window-weather.mjs';

test('zoom changes the window backing resolution while still weather reuses the previous texture',t=>{
  const scales=[],draws=[];
  const context=()=>({
    setTransform(s){scales.push(s);},
    fillRect(){},
    drawImage(...args){draws.push(args);}
  });
  const previousWindow=Object.getOwnPropertyDescriptor(globalThis,'document');
  const previousImage=Object.getOwnPropertyDescriptor(globalThis,'Image');
  Object.defineProperty(globalThis,'document',{configurable:true,value:{
    createElement:()=>({getContext:context})
  }});
  Object.defineProperty(globalThis,'Image',{configurable:true,value:class {complete=false;}});
  t.after(()=>{
    if(previousWindow)Object.defineProperty(globalThis,'document',previousWindow);else delete globalThis.document;
    if(previousImage)Object.defineProperty(globalThis,'Image',previousImage);else delete globalThis.Image;
  });

  const weather=windowWeather(()=>{});
  const clear={daylight:1,season:'spring',weather:'clear'};
  assert.equal(weather(0,clear,false,220).width,384);
  assert.equal(weather(100,clear,false,240),null);
  assert.equal(weather(200,clear,false,610).width,768);
  assert.deepEqual(draws.at(-1).slice(1),[0,0,384,168]);
  assert.equal(weather(300,clear,false,382),null);
  assert.equal(weather(400,clear,false,250).height,168);
  assert.deepEqual(scales,[1,1,2,2,1,1]);
});
