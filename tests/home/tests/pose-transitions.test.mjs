import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {actionPose,standingPose} from '../../../app/src/main/assets/home/orientation.mjs';
import {actionAnchors} from '../../../app/src/main/assets/home/action-anchors.mjs';
import {worldObjects} from '../../../app/src/main/assets/home/district.mjs';
import {nextTurn,restoreTurn,seatFront,hasReverse} from '../../../app/src/main/assets/home/prop-finish.mjs';
import {nextStation,jobPose} from '../../../app/src/main/assets/home/workstations.mjs';

test('all action frames use a planted atlas, valid crown and consistent facing',()=>{
 for(const dir of ['up-right','up-left','down-left','down-right','up','down','right','left']){
   const standing=standingPose('eva',dir);
   for(const act of ['reach','stoop','sit','sleep']){
     for(let i=0;i<8;i++){
       const p=actionPose(dir,act,i/7);
       assert.equal(p.flip,standing.flip);assert.equal(p.height,1.62);assert.equal(p.column,i);
       assert(actionAnchors[p.key].heads[p.row][i].every(v=>v>=0&&v<=1));
     }
   }
   for(const m of ['wry','pleased','surprised','curious'])assert.equal(actionPose(dir,'idle',0,m).row,dir.includes('-')?4:standing.row);
 }
});
test('twelve reverse-view drawings exist and preserve placement on all four turns and reload',()=>{
 const fixtures=worldObjects({}),models=new Map(fixtures.filter(hasReverse).map(o=>[o.art,o]));
 assert.equal(models.size,12);
 for(const o of models.values()){
   const bytes=readFileSync(new URL('../../../app/src/main/assets/home/art/back-'+o.art+'.png',import.meta.url));assert.equal(bytes[25],6);
   let x=o;
   for(let i=1;i<=4;i++){
     x=nextTurn(x);
     assert.equal(Boolean(x.back),i===2||i===3);assert.equal(Boolean(x.turned),!!(i%2));
     const restored=restoreTurn(o,{back:x.back,turned:x.turned});
     for(const key of ['w','d','artFlip','seatDirection'])assert.equal(restored[key]??(key==='seatDirection'?'down-left':false),x[key]??false);
     if(i===2){const f=seatFront(o),b=seatFront(x);assert(Math.abs(f[1]+b[1]-2*o.v-o.d)<1e-8);}
   }
 }
});
test('studio tasks reserve distinct stations and use current fixture locations',()=>{
 const people=[{key:'ren'},{key:'nika'}],fixtures=worldObjects({});
 for(const p of people){p.job=nextStation(p,'school',fixtures,people);assert(p.job);}
 assert.notEqual(people[0].job.id,people[1].job.id);
 for(const p of people){
   Object.assign(p.job,{arrived:true,start:1000,end:8000});p.direction='up-left';
   assert.equal(jobPose(p,1000,false).column,0);assert(jobPose(p,1800,false).column>0);assert.equal(jobPose(p,8000,false).column,0);
 }
 assert.equal(nextStation(people[0],'school',[],people),null);
});
