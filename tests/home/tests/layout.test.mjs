import test from 'node:test';
import assert from 'node:assert/strict';
import {worldObjects,worldPoint,localPath} from '../../../app/src/main/assets/home/district.mjs';
import {placementIssue,editableFixture} from '../../../app/src/main/assets/home/layout.mjs';
import {walkHeading,walkPose} from '../../../app/src/main/assets/home/orientation.mjs';

test('layout keeps fixture identity and resolves its new district and ground contacts',()=>{
  const bench=worldObjects({}).find(o=>o.id===12),p=worldPoint('square',1,1);
  const light={...bench,id:131},door={...p,width:1,vertical:true};
  assert(editableFixture(bench));
  assert(!editableFixture({...bench,z:1}));
  assert.equal(placementIssue(bench,p,[],[],[]),'');
  assert(placementIssue(bench,p,[],[door],[]));
  assert(placementIssue(bench,p,[],[],[p]));
  assert(placementIssue(bench,p,[{...light,...p}],[],[]));
  assert(placementIssue(bench,{u:0,v:-7},[],[],[]));
  const moved=worldObjects({chairs:{12:{...p,world:true,sector:'square'}}}).find(o=>o.id===12);
  assert.deepEqual([moved.name,moved.u,moved.v,moved.sector],[bench.name,p.u,p.v,'square']);
});
test('headings select eight walking directions and hold direction near a boundary',()=>{
  const directions=['down-right','down','down-left','left','up-left','up','up-right','right'];
  for(const [i,dir] of directions.entries()){
    const a=i*Math.PI/4;
    assert.equal(walkHeading(Math.cos(a),Math.sin(a)),dir);
    assert.equal(walkPose('eva',dir,.5).row,[0,2,0,4,1,3,1,4][i]);
  }
  assert.equal(walkHeading(1,.45,'down-right'),'down-right');
  assert.equal(walkHeading(0,0,'left'),'left');
});

test('open floors allow a direct approach, obstacles fall back to the town route',()=>{
  const from={u:0,v:0},to={u:2,v:2};
  assert.deepEqual(localPath(from,to,()=>false),[to]);
  assert.equal(localPath(from,to,(u,v)=>Math.hypot(u-1,v-1)<.10),null);
});
