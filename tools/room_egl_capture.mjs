// Used only when EVA_EGL_REPLAY=1. Normal browser checks render directly to their WebGL context.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const run = promisify(execFile);
const replayScript = fileURLToPath(new URL('./room_egl_replay.py', import.meta.url));

export async function roomEglReplay(output) {
  const source = await readFile(new URL('./room_egl_trace.js', import.meta.url), 'utf8');
  const entries = [];
  return {
    source,
    async frame(page, name) {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(name)) throw Error('Invalid frame name');
      // The expanded broadcast intentionally suspends the 3D scene and uses its live 2D source.
      const broadcast = await page.evaluate(`document.querySelector('#sheet[data-page="stream-view"] .broadcast-screen')?.toDataURL('image/png') ?? null`);
      if (broadcast) {
        await writeFile(path.join(output, name + '-gpu.png'), Buffer.from(broadcast.split(',')[1], 'base64'));
        return;
      }
      const previous = await page.evaluate('evaGlesCapture.start()');
      await page.until('worldCheck().paintCount>' + previous, 'No fresh room frame');
      const last = await page.evaluate('evaGlesCapture.finish(' + JSON.stringify(name) + ')');
      while (entries.length < last) {
        const limit = Math.min(entries.length + 80, last);
        entries.push(...await page.evaluate('evaGlesCapture.slice(' + entries.length + ',' + limit + ')'));
      }
      const work = await mkdtemp(path.join(tmpdir(), 'eva-room-gles-'));
      try {
        const recording = path.join(work, 'commands.json'), target = path.join(output, name + '-gpu.png');
        await writeFile(recording, JSON.stringify(entries));
        const {stdout} = await run(process.env.EVA_EGL_PYTHON || 'python3', [replayScript, recording, name, target], {
          timeout: 120000, maxBuffer: 1024 * 1024,
          env: {EGL_PLATFORM: 'surfaceless', LIBGL_ALWAYS_SOFTWARE: '1', ...process.env}
        });
        process.stdout.write(stdout);
        // Use the original DOM/compositor for the launcher chrome, chat and focus feedback.
        const url = 'data:image/png;base64,' + await readFile(target, 'base64');
        await page.evaluate(`Object.assign(document.getElementById('scene').style, {backgroundImage:'url('+${JSON.stringify(url)}+')',backgroundSize:'100% 100%'})`);
      } finally {
        await rm(work, {recursive: true, force: true});
      }
    }
  };
}
