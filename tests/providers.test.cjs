const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const {EventEmitter} = require('node:events');

test('external providers preserve persona, conversation history and explicit model choices', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eva-providers-'));
  const previous = process.env.MIRA_PROVIDER_FILE;
  process.env.MIRA_PROVIDER_FILE = path.join(dir, 'providers.json');
  t.after(() => {
    if (previous === undefined) delete process.env.MIRA_PROVIDER_FILE;
    else process.env.MIRA_PROVIDER_FILE = previous;
    fs.rmSync(dir, {recursive: true, force: true});
  });
  const {chat, catalog, info, save} = require('../runtime/codex-mobile/providers');
  const {persona} = require('../runtime/codex-mobile/persona');
  const defaults = {gemini: 'gemini-3.5-flash-lite', deepseek: 'deepseek-flash',
    claude: 'claude-sonnet-5-5', openrouter: 'openrouter/free'};
  const calls = [];
  let next = {};
  t.mock.method(fs, 'appendFileSync', () => {});
  t.mock.method(https, 'request', (url, options, callback) => {
    const req = new EventEmitter();
    let body = '';
    req.write = chunk => { body += chunk; };
    req.end = () => {
      calls.push({url, headers: options.headers, body: body && JSON.parse(body), signal: options.signal});
      queueMicrotask(() => {
        if (options.signal?.aborted) return req.emit('error', options.signal.reason);
        const response = new EventEmitter();
        response.statusCode = next.status || 200;
        callback(response);
        response.emit('data', Buffer.from(JSON.stringify(next.payload)));
        response.emit('end');
      });
    };
    return req;
  });

  const history = [{role: 'user', content: 'Мой первый вопрос'},
    {role: 'assistant', content: 'Мой ответ'}, {role: 'user', content: 'Уточнение'}];
  const signal = new AbortController().signal;
  for (const [provider, model] of Object.entries(defaults)) {
    assert.equal(info()[provider].model, model);
    save(provider, model, 'fake-key-' + provider);
    next = provider === 'claude' ? {payload: {content: [{type: 'text', text: 'Готово'}],
      usage: {input_tokens: 4, output_tokens: 2}}} : {payload: {choices: [{message: {content: 'Готово'}}],
      usage: {prompt_tokens: 4, completion_tokens: 2}}};
    const spoken = provider === 'claude' || provider === 'gemini';
    const result = await chat({provider, messages: history, spoken}, signal);
    assert.equal(result.text, 'Готово');
    assert.deepEqual(result.usage, {input_tokens: 4, output_tokens: 2, total_tokens: null});
    const request = calls.at(-1);
    assert.equal(request.signal, signal);
    assert.equal(request.body.model, model);
    const isClaude = provider === 'claude';
    assert.equal(isClaude ? request.headers['x-api-key'] : request.headers.authorization,
      (isClaude ? '' : 'Bearer ') + 'fake-key-' + provider);
    assert.match(request.url, /^https:\/\//);
    const personality = isClaude ? request.body.system : request.body.messages[0].content;
    assert.ok(personality.includes(persona));
    assert.equal(personality.includes('Этот ответ будут слушать'),spoken);
    assert.deepEqual(isClaude ? request.body.messages : request.body.messages.slice(1), history);
    assert.deepEqual(info()[provider], {model, configured: true});
  }

  await chat({provider: 'openrouter', messages: history, model: 'test/free:free',
    room: {name: 'Мира', members: ['Мира', 'Алиса']}}, signal);
  const mira = calls.at(-1).body.messages[0].content;
  assert.match(mira, /Имя в этой комнате: Мира/);
  assert.doesNotMatch(mira, /Ты Ева/);
  assert.match(mira, /своими словами/);
  assert.equal(calls.at(-1).body.model, 'test/free:free');
  await chat({provider: 'openrouter', messages: history,
    room: {name: 'Ева', members: ['Мира', 'Ева']}}, signal);
  assert.ok(calls.at(-1).body.messages[0].content.includes(persona));
  const sent = calls.length;
  await assert.rejects(chat({provider: 'gemini', messages: [null]}, signal), /неверный формат/);
  await assert.rejects(chat({provider: 'openrouter', messages: history, model: 'test/paid'}, signal), /бесплатная/);
  assert.equal(calls.length, sent);

  next = {status: 429, payload: {error: {message: 'Недоступно fake-key-gemini'}}};
  await assert.rejects(chat({provider: 'gemini', messages: history}, signal), error =>
    error.message.includes('429') && !error.message.includes('fake-key-gemini'));
  next = {payload: {choices: []}};
  await assert.rejects(chat({provider: 'openrouter', messages: history}, signal), /пустой ответ/);
  await assert.rejects(chat({provider: 'openrouter', messages: history}, AbortSignal.abort()), /aborted/i);
  next = {payload: {data: [null, {id: 'test/paid'}, {id: 'test/free:free', name: 6,
    architecture: {input_modalities: ['text', null], output_modalities: 'text'}}]}};
  assert.deepEqual(await catalog('openrouter'), [
    {id: 'test/free:free', name: 'test/free:free', input: ['text'], output: [], tools: false}
  ]);
  save('gemini', 'my-selected-model', '', true);
  assert.deepEqual(info().gemini, {model: 'my-selected-model', configured: false});
  await assert.rejects(chat({provider: 'gemini', messages: history}, signal), /API-ключ/);
});
