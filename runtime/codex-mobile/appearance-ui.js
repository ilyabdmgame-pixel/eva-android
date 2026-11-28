'use strict';

(() => {
  const byId = id => document.getElementById(id);
  const dialog = byId('appearance-settings'), stage = byId('avatar-stage');
  const style = byId('appearance-style'), file = byId('appearance-file'), status = byId('appearance-status');
  const thumb = byId('appearance-thumb');
  const requestHeaders = { 'x-codex-token': location.hash.slice(1) };
  let committed = '', currentVersion = '', currentUrl = '', generation = 0, refreshId = 0;
  let fetching = false, writingStyle = false, writingImage = false;
  const showStatus = text => { status.textContent = text; };

  async function call(route, options = {}, asImage = false) {
    const response = await fetch(route, { ...options, cache: 'no-store', headers: { ...requestHeaders, ...options.headers } });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw Error(result.error || 'Не удалось открыть настройки образа.');
    }
    return asImage ? response.blob() : response.json();
  }
  function updateButtons() {
    byId('appearance-save').disabled = fetching || writingStyle || style.value.trim() === committed;
    byId('appearance-reset-style').disabled = fetching || writingStyle || (!committed && !style.value.trim());
    byId('appearance-pick').disabled = fetching || writingImage;
    byId('appearance-reset-portrait').disabled = fetching || writingImage;
  }
  function announce(active) {
    document.documentElement.dataset.evaCustomPortrait = active ? '1' : '0';
    document.dispatchEvent(new CustomEvent('eva-personal-portrait', { detail: { active } }));
  }
  function removeImage() {
    generation++;
    document.body.classList.remove('eva-custom-portrait');
    byId('personal-portrait-image')?.remove();
    thumb.removeAttribute('src'); thumb.hidden = true;
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = ''; currentVersion = '';
    announce(false);
  }
  function decoded(node, src) {
    return new Promise((resolve, reject) => {
      node.onload = () => { node.onload = node.onerror = null; resolve(); };
      node.onerror = () => { node.onload = node.onerror = null; reject(Error('Не удалось прочитать изображение.')); };
      node.src = src;
    });
  }
  async function showPortrait(version) {
    byId('appearance-reset-portrait').hidden = !version;
    byId('appearance-portrait-state').textContent = version ? 'Свой 2D-портрет' : 'Авторский портрет Евы';
    if (!version) {
      if (currentUrl || document.documentElement.dataset.evaCustomPortrait !== '0') removeImage();
      return;
    }
    if (currentVersion === version && currentUrl) return;
    const id = ++generation;
    document.documentElement.dataset.evaCustomPortrait = '1';
    let url = '';
    try {
      url = URL.createObjectURL(await call('/appearance/portrait', {}, true));
      const node = new Image(); node.id = 'personal-portrait-image'; node.alt = 'Личный портрет в чате';
      await decoded(node, url);
      if (id !== generation) return;
      byId('personal-portrait-image')?.remove(); stage.append(node);
      thumb.src = url; thumb.hidden = false;
      const previous = currentUrl;
      currentUrl = url; currentVersion = version; url = '';
      document.body.classList.add('eva-custom-portrait');
      announce(true);
      if (previous) URL.revokeObjectURL(previous);
    } catch (error) {
      if (id !== generation) return;
      removeImage();
      throw error;
    } finally { if (url) URL.revokeObjectURL(url); }
  }
  async function refresh() {
    const id = ++refreshId;
    if (dialog.open) { fetching = true; updateButtons(); }
    try {
      const state = await call('/appearance');
      if (id !== refreshId) return;
      if (style.value === committed) style.value = state.style;
      committed = state.style;
      await showPortrait(state.portraitVersion);
    } catch (error) {
      if (id === refreshId) {
        if (document.documentElement.dataset.evaCustomPortrait === 'pending') announce(false);
        if (dialog.open) showStatus(error.message);
      }
    } finally {
      if (id === refreshId) { fetching = false; updateButtons(); }
    }
  }
  async function saveStyle(value) {
    if (writingStyle) return;
    writingStyle = true; updateButtons(); showStatus('');
    const submitted = style.value;
    try {
      const result = await call('/appearance/style', { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({style:value}) });
      committed = result.style;
      if (style.value === submitted) style.value = committed;
      showStatus(committed ? 'Характер сохранён. Применится к следующему ответу.' : 'Обычный характер Евы восстановлен.');
    } catch(error) { showStatus(error.message); }
    finally { writingStyle = false; updateButtons(); }
  }
  function sourceDimensions(bytes) {
    const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const name = (at, length) => String.fromCharCode(...bytes.subarray(at, at + length));
    if (bytes.length > 24 && d.getUint32(0) === 0x89504e47 && d.getUint32(4) === 0x0d0a1a0a && name(12,4) === 'IHDR') {
      return [d.getUint32(16), d.getUint32(20)];
    }
    if (bytes.length > 30 && name(0,4) === 'RIFF' && name(8,4) === 'WEBP') {
      const type = name(12,4);
      if (type === 'VP8X') return [1+bytes[24]+256*bytes[25]+65536*bytes[26], 1+bytes[27]+256*bytes[28]+65536*bytes[29]];
      if (type === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 1 && bytes[25] === 0x2a) {
        return [d.getUint16(26,true)&0x3fff,d.getUint16(28,true)&0x3fff];
      }
      if (type === 'VP8L' && bytes[20] === 0x2f) {
        const n = d.getUint32(21,true);
        return [(n & 0x3fff) + 1, ((n >>> 14) & 0x3fff) + 1];
      }
    }
    if (bytes[0] === 255 && bytes[1] === 216) {
      for (let p = 2; p + 4 < bytes.length;) {
        if (bytes[p++] !== 255) break;
        while (bytes[p] === 255 && p < bytes.length) p++;
        const code = bytes[p++];
        if (code === 0xda || code === 0xd9 || p + 2 > bytes.length) break;
        if (code === 1 || (code >= 0xd0 && code <= 0xd7)) continue;
        const length = d.getUint16(p);
        if (length < 2 || p + length > bytes.length) break;
        if ((code >= 0xc0 && code <= 0xcf) && ![0xc4,0xc8,0xcc].includes(code) && length >= 7) {
          return [d.getUint16(p+5), d.getUint16(p+3)];
        }
        p += length;
      }
    }
    throw Error('Выбери изображение в формате PNG, JPEG или WebP.');
  }
  async function renderFile(selected) {
    if (selected.size > 12 * 1024 * 1024) throw Error('Выбери файл до 12 МиБ.');
    const [w,h] = sourceDimensions(new Uint8Array(await selected.arrayBuffer()));
    if (!w || !h || w*h > 24000000) throw Error('Выбери рисунок до 24 мегапикселей.');
    // Browser decoding honors the original orientation. A new canvas retains
    // transparency and discards the source's EXIF and other embedded data.
    const url = URL.createObjectURL(selected);
    try {
      const picture = new Image(); await decoded(picture, url);
      const width = picture.naturalWidth, height = picture.naturalHeight;
      if (!width || !height || width*height > 24000000) throw Error('Не удалось прочитать размеры портрета.');
      const scale = Math.min(1, 1600/Math.max(width,height), Math.sqrt(2000000/(width*height)));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1,Math.floor(width*scale)); canvas.height = Math.max(1,Math.floor(height*scale));
      const context = canvas.getContext('2d');
      if (!context) throw Error('WebView не смог открыть рисунок.');
      context.imageSmoothingQuality = 'high'; context.drawImage(picture,0,0,canvas.width,canvas.height);
      return await new Promise((resolve,reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('Не удалось подготовить портрет.')), 'image/png'));
    } finally { URL.revokeObjectURL(url); }
  }
  async function changePortrait(selected) {
    if (writingImage) return;
    writingImage = true; updateButtons(); showStatus(selected ? 'Подготавливаю рисунок…' : '');
    try {
      const result = selected ? await call('/appearance/portrait', { method:'PUT',headers:{'Content-Type':'image/png'},body:await renderFile(selected) })
                              : await call('/appearance/portrait', { method:'DELETE' });
      await showPortrait(result.portraitVersion);
      document.dispatchEvent(new CustomEvent('eva-use-personal-portrait'));
      showStatus(selected ? 'Портрет установлен.' : 'Авторский 2D-портрет восстановлен.');
    } catch (error) { showStatus(error.message); }
    finally { writingImage = false; updateButtons(); }
  }
  byId('appearance-open').onclick = () => {
    showStatus(''); dialog.showModal(); refresh();
  };
  byId('appearance-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { style.value = committed; });
  byId('appearance-style-form').onsubmit = e => { e.preventDefault(); saveStyle(style.value); };
  style.addEventListener('input', updateButtons);
  byId('appearance-reset-style').onclick = () => saveStyle('');
  byId('appearance-pick').onclick = () => file.click();
  byId('appearance-reset-portrait').onclick = () => changePortrait(null);
  file.onchange = () => { const selected = file.files[0]; file.value = ''; if (selected) changePortrait(selected); };
  window.EvaAppearance = { refresh };
  if (typeof es !== 'undefined') es.addEventListener('message', e => {
    try { if (JSON.parse(e.data).type === 'appearance-changed') refresh(); } catch {}
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  refresh();
})();
