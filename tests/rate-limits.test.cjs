'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {createRateLimits}=require('../runtime/codex-mobile/rate-limits');

test('room quota uses the week window, shares refreshes, and expires at the reset',async()=>{
 let now=1000000,calls=0;
 const caps=createRateLimits(async()=>{
  calls++;
  return {rateLimitsByLimitId:{codex:{
   primary:{windowDurationMins:10080,usedPercent:28,resetsAt:1030},
   secondary:{windowDurationMins:300,usedPercent:99,resetsAt:1035}
  }}};
 },()=>now);
 assert.equal(caps.week(),null);
 const response=await caps.refresh();
 assert.equal(calls,1);
 assert.equal(response.fiveHour.remaining,1);
 assert.deepEqual(caps.week(),{remaining:72,resetsAt:1030});
 now=1030000;
 assert.equal(caps.week(),null);
 assert.equal((await caps.refresh()).week,null);
 assert.equal(calls,2);
});

test('an in-flight read from the old account cannot refill the cache after clearing it',async()=>{
 let resolve;
 const caps=createRateLimits(()=>new Promise(done=>{resolve=done;}),()=>1000000);
 const pending=caps.refresh();
 await Promise.resolve();
 caps.clear();
 resolve({rateLimits:{secondary:{windowDurationMins:10080,usedPercent:4,resetsAt:1100}}});
 await pending;
 assert.equal(caps.week(),null);
});
