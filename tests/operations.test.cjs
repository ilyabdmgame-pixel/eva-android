const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {buildPlan,remoteSlug,operations}=require('../runtime/codex-mobile/eva-ops');

test('phone and project operations keep arguments intact and target the configured installation',()=>{
  const config={phoneRuntime:'/live',repository:'/checkout',applicationId:'test.eva.app',buildProfile:'/private/sdk.json'};
  assert.deepEqual(buildPlan(config,'phone','click',['Текст с пробелом']).args,['/live/phone.js','click','Текст с пробелом']);
  assert.deepEqual(buildPlan(config,'project','build',[]).args,['tools/build_offline.py','--profile','/private/sdk.json']);
  assert.deepEqual(buildPlan(config,'project','install-check',['update.apk']).args,['tools/install_apk.py',path.resolve('update.apk'),'--check','--package','test.eva.app']);
  assert(operations.adb.includes('foreground'));
  assert.throws(()=>buildPlan(config,'phone','unknown',[]));
});
test('work servers are looked up locally, remote operations use known units, diagnostics are read-only',()=>{
  const config={servers:{work:{host:'office',services:{worker:'eva-worker.service'}}}};
  const plan=buildPlan(config,'server','status',['work','worker']);
  assert.equal(plan.bin,'ssh');
  assert.deepEqual(plan.args.slice(-4),['systemctl','show','eva-worker.service','--property=Id,LoadState,ActiveState,SubState']);
  assert.throws(()=>buildPlan(config,'server','restart',['work','unregistered']));
  assert.throws(()=>buildPlan(config,'server','logs',['work','worker','other']));
  assert.throws(()=>buildPlan(config,'server','uptime',['unknown']));
  const wrapper=buildPlan({servers:{work:{transport:'/opt/ssh/production'}}},'server','uptime',['work']);
  assert.deepEqual(wrapper,{bin:'/opt/ssh/production',args:['uptime']});
});
test('Git publication uses the current branch and an explicit repo, without incorporating personal configuration',()=>{
  const cfg={git:'/git/bin/git',gitExecPath:'/git/libexec',repository:'/project'};
  assert.deepEqual(buildPlan(cfg,'github','push',[]),{bin:cfg.git,args:['push','origin','HEAD'],env:{GIT_EXEC_PATH:cfg.gitExecPath},cwd:cfg.repository});
  assert.deepEqual(buildPlan(cfg,'github','pull',[]).args,['pull','--ff-only']);
  for(const url of ['https://github.com/example/project.git','git@github.com:example/project.git','ssh://git@github.com/example/project'])
    assert.equal(remoteSlug(url),'example/project');
});
