import test from 'node:test';
import assert from 'node:assert/strict';
import {seatMotion,seatSample} from '../../../app/src/main/assets/home/seat-motion.mjs';

const seat={id:7};
const floor={u:2,v:3};
const chair={u:3,v:4};

test('sit and rise end at their anchors and keep fewer frames in reduced motion',()=>{
 const sit=seatMotion(seat,floor,chair,'down-left',100);
 assert.deepEqual(seatSample(sit,100),{...floor,amount:0,complete:false});
 assert.deepEqual(seatSample(sit,1000),{...chair,amount:1,complete:true});
 assert.deepEqual(seatSample(sit,100,true),{...chair,amount:1,complete:true});
 const rise=seatMotion(seat,chair,floor,'down-left',1000,1,0);
 assert.ok(rise.duration<sit.duration);
 assert.deepEqual(seatSample(rise,1000),{...chair,amount:1,complete:false});
 assert.deepEqual(seatSample(rise,2000),{...floor,amount:0,complete:true});
});

test('standing part way through a sit begins from the rendered position and pose',()=>{
 const sit=seatMotion(seat,floor,chair,'down-left',0),before=seatSample(sit,330);
 assert.ok(before.amount>0&&before.amount<1);
 const reverse=seatMotion(seat,before,floor,sit.facing,330,before.amount,0);
 assert.deepEqual(seatSample(reverse,330),before);
 assert.deepEqual(seatSample(reverse,1200),{...floor,amount:0,complete:true});
});
