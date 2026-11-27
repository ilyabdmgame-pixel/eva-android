'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createInterface } = require('node:readline');
const test = require('node:test');
const { codexInstructions, createPersonaRpc } = require('../runtime/codex-mobile/persona');

function startResponsesMock(requests, beforeReply) {
  return http.createServer(async (req, res) => {
    const parts = [];
    for await (const chunk of req) parts.push(chunk);
    requests.push(JSON.parse(Buffer.concat(parts)));
    if (beforeReply) await beforeReply(requests.length);
    const message = {
      id: 'msg_' + requests.length,
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text: 'Поняла.', annotations: [] }]
    };
    const response = { id: 'resp_' + requests.length, output: [message], status: 'completed' };
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    for (const event of [
      { type: 'response.created', response: { ...response, output: [], status: 'in_progress' } },
      { type: 'response.output_item.added', output_index: 0, item: { ...message, content: [] } },
      { type: 'response.output_text.delta', item_id: message.id, output_index: 0, content_index: 0, delta: 'Поняла.' },
      { type: 'response.output_item.done', output_index: 0, item: message },
      { type: 'response.completed', response }
    ]) res.write('data: ' + JSON.stringify(event) + '\n\n');
    res.end();
  });
}

async function startCodex(home, baseUrl, t, installPersona = true) {
  const child = spawn(process.env.EVA_TEST_CODEX || 'codex', [
    'app-server', '--listen', 'stdio://',
    '-c', 'model_provider="eva_test"',
    '-c', 'model_providers.eva_test.name="Local test"',
    '-c', 'model_providers.eva_test.base_url=' + JSON.stringify(baseUrl),
    '-c', 'model_providers.eva_test.wire_api="responses"',
    '-c', 'model_providers.eva_test.requires_openai_auth=false',
    '-c', 'model_providers.eva_test.supports_websockets=false',
    ...(installPersona ? ['-c', 'developer_instructions=' + JSON.stringify(codexInstructions)] : [])
  ], { cwd: home, env: { ...process.env, CODEX_HOME: home }, stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  const lines = createInterface({ input: child.stdout });
  const pending = new Map();
  const turns = new Map();
  let id = 0;
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', text => { stderr = (stderr + text).slice(-4000); });
  lines.on('line', line => {
    const message = JSON.parse(line);
    if (message.method === 'turn/completed') {
      const turn = message.params.turn;
      turns.set(turn.id, turn);
      if (pending.has(turn.id)) pending.get(turn.id).resolve(turn);
    } else if (!message.method && pending.has(message.id)) {
      const callback = pending.get(message.id);
      if (message.error) callback.reject(Object.assign(new Error(message.error.message), { code: message.error.code, data: message.error.data }));
      else callback.resolve(message.result);
    }
  });
  child.on('error', error => { for (const callback of pending.values()) callback.reject(error); });
  child.on('exit', () => {
    for (const callback of pending.values()) callback.reject(new Error('Codex exited: ' + stderr));
  });
  function wait(key, send) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(key);
        reject(new Error('Codex timeout: ' + key + '\n' + stderr));
      }, 30000); // A cold app-server can take several seconds to start on ARM64.
      const finish = callback => result => { clearTimeout(timer); pending.delete(key); callback(result); };
      pending.set(key, { resolve: finish(resolve), reject: finish(reject) });
      if (send) send();
    });
  }
  function request(method, params) {
    const requestId = ++id;
    return wait(requestId, () => child.stdin.write(JSON.stringify({ id: requestId, method, params }) + '\n'));
  }
  await request('initialize', { clientInfo: { name: 'eva_local_test', version: '0.1.0' }, capabilities: { experimentalApi: true } });
  child.stdin.write('{"method":"initialized","params":{}}\n');
  const rpc = installPersona ? createPersonaRpc(request) : request;
  return {
    rpc,
    completed(turnId) { return turns.get(turnId) || wait(turnId); },
    async say(threadId, text, options = {}) {
      const { turn } = await rpc('turn/start', { threadId, input: [{ type: 'text', text }], ...options });
      assert.equal((turns.get(turn.id) || await wait(turn.id)).status, 'completed');
    },
    async close() {
      const stopped = once(child, 'exit');
      child.kill();
      await stopped;
    }
  };
}

test('Codex receives Eva instructions and earlier messages after resuming a saved chat', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eva-persona-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const requests = [];
  const server = startResponsesMock(requests);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const url = 'http://127.0.0.1:' + server.address().port + '/v1';
  const codex = await startCodex(dir, url, t);
  const { thread } = await codex.rpc('thread/start', { cwd: dir, model: 'gpt-5.4' });
  await codex.say(thread.id, 'Это первое сообщение.');
  await codex.close();
  const restarted = await startCodex(dir, url, t);
  const resumed = await restarted.rpc('thread/resume', { threadId: thread.id });
  assert.equal(resumed.thread.id, thread.id);
  await restarted.say(thread.id, 'Это второе сообщение.', {spoken:true});
  await restarted.close();
  assert.equal(requests.length, 2);
  for (const request of requests) {
    const developerText = request.input
      .filter(item => item.role === 'developer')
      .flatMap(item => item.content)
      .map(item => item.text).join('\n');
    assert.ok(developerText.includes(codexInstructions));
  }
  assert.doesNotMatch(JSON.stringify(requests[0].input), /Этот ответ будут слушать/);
  assert.ok(requests[1].input.some(item => item.role === 'developer' &&
    item.content.some(part => part.text?.includes('Этот ответ будут слушать'))));
  const resumedInput = requests[1].input.filter(item => item.role === 'user')
    .flatMap(item => item.content).map(item => item.text).join('\n');
  assert.match(resumedInput, /Это первое сообщение\./);
  assert.match(resumedInput, /Это второе сообщение\./);
});

test('a chat created before the persona was configured keeps its ID and gains the instructions', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eva-persona-upgrade-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const requests = [];
  const server = startResponsesMock(requests);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const url = 'http://127.0.0.1:' + server.address().port + '/v1';
  const previous = await startCodex(dir, url, t, false);
  const { thread } = await previous.rpc('thread/start', { cwd: dir, model: 'gpt-5.4' });
  await previous.say(thread.id, 'История существующего чата.');
  await previous.close();
  const current = await startCodex(dir, url, t);
  await current.rpc('thread/resume', { threadId: thread.id });
  await current.say(thread.id, 'Продолжим.');
  await current.close();
  assert.equal(requests.length, 2);
  const developer = requests[1].input.filter(item => item.role === 'developer');
  assert.ok(developer.some(item => item.content.some(part => part.text?.includes(codexInstructions))));
  assert.ok(requests[1].input.some(item => item.role === 'user' &&
    item.content.some(part => part.text?.includes('История существующего чата.'))));
});

test('Codex accepts a correction during an active turn and rejects stale targets', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eva-steer-'));
  const requests = [];
  const {promise: arrived, resolve: markArrived} = Promise.withResolvers();
  const {promise: held, resolve: release} = Promise.withResolvers();
  const server = startResponsesMock(requests, count => {
    if (count === 1) { markArrived(); return held; }
  });
  t.after(() => { release(); server.close(); return fs.rm(dir, { recursive: true, force: true }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const codex = await startCodex(dir, 'http://127.0.0.1:' + server.address().port + '/v1', t);
  const {thread} = await codex.rpc('thread/start', {cwd: dir, model: 'gpt-5.4'});
  const {turn} = await codex.rpc('turn/start', {
    threadId: thread.id, input: [{type: 'text', text: 'Первоначальное задание.'}]
  });
  await arrived;
  const input = [{type: 'text', text: 'Уточнение в работающем чате.'}];
  await assert.rejects(codex.rpc('turn/steer', {threadId: thread.id, expectedTurnId: 'stale', input}),
    {code: -32600, message: /^expected active turn id/});
  const accepted = await codex.rpc('turn/steer', {
    threadId: thread.id, expectedTurnId: turn.id, clientUserMessageId: 'test-steer-0001', input
  });
  assert.equal(accepted.turnId, turn.id);
  release();
  assert.equal((await codex.completed(turn.id)).status, 'completed');
  const resumedInput = requests.slice(1).flatMap(request => request.input).filter(item => item.role === 'user')
    .flatMap(item => item.content).map(item => item.text).join('\n');
  assert.match(resumedInput, /Уточнение в работающем чате\./);
  await assert.rejects(codex.rpc('turn/steer', {threadId: thread.id, expectedTurnId: turn.id, input}),
    {code: -32600, message: 'no active turn to steer'});
  await codex.close();
});
