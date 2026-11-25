'use strict';

const fs = require('node:fs');
const path = require('node:path');

const persona = fs.readFileSync(path.join(__dirname, 'persona.md'), 'utf8').trim();
const codexInstructions = [
  persona,
  'Пользуйся только доступными инструментами. Действуй на телефоне по соответствующей просьбе пользователя. Не выдавай передачу команды за подтверждение её результата.'
].join('\n\n');

const voiceInstructions = 'Этот ответ будут слушать. Сохрани голос Евы и скажи главное короткими фразами. Когда нужны команды, ссылки или таблицы, объясни их смысл простой фразой и приведи детали по делу.';

function forReply(instructions, spoken) {
  return spoken === true ? instructions + '\n\n' + voiceInstructions : instructions;
}

function withPersona(params = {}) {
  return { ...params, developerInstructions: codexInstructions };
}


// A resumed rollout can retain the developer instructions from when it was created.
// Set turn-level instructions as well, including when Codex compacts the history.
function createPersonaRpc(request) {
  const threads = new Map();

  return async function rpc(method, params = {}) {
    if (method === 'thread/start' || method === 'thread/resume') {
      const result = await request(method, withPersona(params));
      if (result.thread?.id && result.model) {
        threads.set(result.thread.id, { model: result.model, effort: result.reasoningEffort });
      }
      return result;
    }

    if (method === 'turn/start') {
      const { spoken, ...turnParams } = params;
      const remembered = threads.get(params.threadId);
      let model = params.model || remembered?.model;
      if (!model) {
        const { data } = await request('model/list', {});
        model = (data.find(entry => entry.isDefault) || data[0])?.model;
      }
      if (!model) throw new Error('Codex не сообщил модель для этого чата.');
      const effort = params.effort ?? remembered?.effort ?? null;
      const options = {
        ...turnParams,
        collaborationMode: {
          mode: 'default',
          settings: { model, reasoning_effort: effort, developer_instructions: forReply(codexInstructions, spoken) }
        }
      };
      const result = await request(method, options);
      threads.set(params.threadId, { model, effort });
      return result;
    }

    const result = await request(method, params);
    if (method === 'thread/delete' || method === 'thread/archive') threads.delete(params.threadId);
    return result;
  };
}

module.exports = { persona, codexInstructions, forReply, createPersonaRpc };
