'use strict';
const fs = require('node:fs');
const path = require('node:path');

function createWorkshopOpener(rpc, dir = '/root/eva-workshop') {
  let opening;
  async function resolve() {
    const file = path.join(dir, 'thread.json');
    let saved;
    try { saved = JSON.parse(fs.readFileSync(file, 'utf8')).id; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (saved) {
      try {
        const {thread} = await rpc('thread/read', {threadId: saved});
        if (thread.cwd !== dir) throw Error('Сохранённый чат принадлежит другому проекту');
        return saved;
      } catch (error) {
        if (!/thread not loaded|no rollout found for thread id|thread not found/i.test(error.message)) throw error;
      }
    }
    const matches = [];
    let cursor;
    do {
      const result = await rpc('thread/list', {cwd: dir, limit: 100, ...(cursor && {cursor})});
      matches.push(...result.data.filter(t => t.cwd === dir));
      cursor = result.nextCursor;
    } while (cursor);
    let thread = matches.find(t => t.id === saved);
    if (!thread && matches.length > 1) throw Error('Нашлось несколько чатов мастерской. Требуется выбрать нужный.');
    thread ||= matches[0] || (await rpc('thread/start', {cwd: dir})).thread;
    if (!thread?.id || thread.cwd !== dir) throw Error('Не удалось открыть чат мастерской');
    fs.writeFileSync(file + '.tmp', JSON.stringify({id: thread.id}) + '\n', {mode: 0o600});
    fs.renameSync(file + '.tmp', file);
    return thread.id;
  }
  return () => opening ||= resolve().finally(() => { opening = undefined; });
}
module.exports = {createWorkshopOpener};
