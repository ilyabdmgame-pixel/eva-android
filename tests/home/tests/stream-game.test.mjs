import test from 'node:test';
import assert from 'node:assert/strict';
import {createStreamGame} from '../../../app/src/main/assets/home/stream-game.mjs';

function run(game,count,hz,input){
  for(let i=0;i<count;i++)game.advance(1/hz,input);
}
function picture(game){
  const calls=[];
  game.draw({fillRect(...args){calls.push([this.fillStyle,...args]);}});
  return calls;
}

test('the autonomous player jumps, collects lights, reaches a flag and plays the next course',()=>{
  const game=createStreamGame(),first=picture(game);
  let airborne=false,collected=false,finish=false;
  for(let i=0;i<3600;i++){
    game.advance(1/30);
    const s=game.state;
    airborne||=s.y<36&&s.ground===-1;
    collected||=s.score>0;
    finish||=s.mode==='finish';
    if(s.ground>=0&&s.mode==='play')assert.equal(s.y,s.roofs[s.ground].top);
  }
  assert(airborne&&collected&&finish);
  assert(game.state.stage>=3);
  assert(new Set(first.map(call=>call[0])).size>20);
  assert.notDeepEqual(picture(game),first);
});

test('missing a jump costs a heart, respawns at a checkpoint and eventually starts a new attempt',()=>{
  const game=createStreamGame();
  run(game,14*60,60,{jump:false});
  assert(game.state.attempt>1);
  game.reset();
  assert.equal(game.state.hearts,3);
  assert.equal(game.state.attempt,1);
  assert.equal(game.state.x,8);
  assert.equal(game.state.score,0);
});

test('30 and 60 Hz produce the same simulation; a suspended frame never fast-forwards a match',()=>{
  const fast=createStreamGame(),slow=createStreamGame();
  run(fast,60*45,60);run(slow,30*45,30);
  assert.deepEqual(fast.state,slow.state);
  const t=fast.state.time;
  fast.advance(220);
  assert(fast.state.time-t<.251);
  fast.advance(NaN);
  assert(Number.isFinite(fast.state.x));
});

test('a viewer notices a real checkpoint without interrupting the conversation cadence',async()=>{
  const {createStreamDialogue}=await import('../../../app/src/main/assets/home/stream-dialogue.mjs');
  const dialogue=createStreamDialogue(0,()=>0),board={time:0,stage:0,score:3,hearts:3};
  dialogue.observeGame(board);
  assert(dialogue.next(3000).chat);
  board.time=4;board.stage=1;dialogue.observeGame(board);
  assert.equal(dialogue.next(4500),null);
  assert(!dialogue.next(6000).chat);
  const flag=dialogue.next(9000);
  assert(flag.chat&&/флаг/i.test(flag.text));
  assert(dialogue.next(12000).chat);
});
