(() => {
  if (document.getElementById('eva-pet-header')) return;
  const settings = document.getElementById('voice-settings-open');
  if (settings) {
    const button = document.createElement('button');
    button.id = 'eva-pet-controls';
    button.type = 'button';
    button.innerHTML = uiIcon('tune') + '<span>Рабочий стол и питомец</span>';
    button.addEventListener('click', () => EvaApp.petSettings());
    settings.insertAdjacentElement('afterend', button);
  }
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = '/eva-pet-ui.css';
  document.head.append(style);
  const sharedStyle = document.createElement('link');
  sharedStyle.rel = 'stylesheet';
  sharedStyle.href = '/eva-composer.css';
  document.head.append(sharedStyle);
  const header = document.createElement('div');
  header.id = 'eva-pet-header';
  const title = document.createElement('strong');
  title.textContent = 'Ева';
  header.append(title);
  const voiceStatus = document.createElement('span');
  voiceStatus.id = 'eva-mini-listening';
  voiceStatus.setAttribute('role', 'status');
  header.append(voiceStatus);
  const games = document.createElement('button');
  games.type = 'button';
  games.id = 'eva-pet-games-launcher';
  games.className = 'pet-composer-extra';
  games.textContent = 'Игры';
  games.setAttribute('aria-label', 'Игры с Евой');
  games.addEventListener('click', openGames);
  header.append(games);
  for (const [icon, label, action] of [
    ['tune','Поведение в приложении','petAppProfile'],
    ['map','Покажи, что видишь','petMap'],
    ['close','Закрыть мини-чат','closePetChat']
  ]) {
    const control = document.createElement('button');
    control.type = 'button';
    control.innerHTML = uiIcon(icon);
    control.setAttribute('aria-label', label);
    if (action === 'petAppProfile' || action === 'petMap') control.className = 'pet-composer-extra';
    control.title = label;
    control.addEventListener('click', () => EvaApp[action]());
    header.append(control);
  }
  document.body.prepend(header);

  const composer = document.getElementById('form');
  const input = document.getElementById('input');
  const mic = document.getElementById('mic');
  const expand = document.createElement('button');
  expand.id = 'eva-compose-expand';
  expand.type = 'button';
  expand.hidden = true;
  expand.setAttribute('aria-label', 'Развернуть чат');
  const expandIcon = document.createElement('i');
  expandIcon.className = 'eva-composer-icon eva-composer-expand';
  expandIcon.setAttribute('aria-hidden', 'true');
  expand.append(expandIcon);
  expand.addEventListener('click', () => EvaApp.expandPetChat());
  composer?.append(expand);
  let composing = false;
  const voiceSession = () => document.body.classList.contains('eva-voice-session');
  const draftKey = () => (voiceSession() ? 'eva-voice-draft:' : 'eva-pet-draft:') +
    (localStorage.getItem('eva-current-thread') || 'new');
  window.evaPetComposer = (active, themed) => {
    composer?.classList.toggle('eva-composer', themed);
    expand.hidden = !themed;
    window.updateComposerActions?.();
    if (active === composing) return;
    composing = active;
    if (composing && !input.value) {
      input.value = localStorage.getItem(draftKey()) || '';
      if (input.value) input.dispatchEvent(new Event('input'));
    }
  };
  input?.addEventListener('input', () => {
    if (!composing || (voiceSession() && mic?.classList.contains('listening'))) return;
    if (input.value) localStorage.setItem(draftKey(), input.value);
    else localStorage.removeItem(draftKey());
  });
  input?.addEventListener('focus', () => {
    if (voiceSession()) window.evaStopAssistant?.();
  });
  composer?.addEventListener('submit', () => {
    if (!composing || !input.value.trim()) return;
    const key = draftKey();
    EvaApp.petComposerDetails();
    queueMicrotask(() => { if (!input.value) localStorage.removeItem(key); });
  }, true);
  mic?.addEventListener('click', () => {
    if (composing && !voiceSession()) EvaApp.petComposerDetails();
  }, true);

  const items = [
    { id:'ball', name:'Мяч' }, { id:'camera', name:'Фотоаппарат' }, { id:'plane', name:'Самолёт' }
  ];
  let dialog, stage, heading, timer;
  const make = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function action(text, fn, className) {
    const node = make('button', text, className);
    node.type = 'button';
    node.addEventListener('click', fn);
    return node;
  }
  function prop(item) {
    const art = make('img');
    art.alt = '';
    art.src = '/eva-pet-game/' + item.id + '.png';
    return art;
  }
  function stopClock() { clearTimeout(timer); }
  function later(fn, delay) { stopClock(); timer = setTimeout(fn, delay); }
  function closeGames() {
    if (!dialog?.open) return false;
    dialog.close();
    stopClock();
    document.removeEventListener('visibilitychange', onVisibility);
    dialog.remove();
    dialog = stage = heading = null;
    games.focus();
    return true;
  }
  function onVisibility() { if (document.hidden) closeGames(); }
  function page(name) {
    stopClock();
    heading.textContent = name;
    stage.replaceChildren();
    heading.focus();
  }
  function status(text) {
    const node = make('p', text, 'game-status');
    node.setAttribute('aria-live','polite');
    node.setAttribute('aria-atomic','true');
    stage.append(node);
    return node;
  }
  function endButtons(restart) {
    const row = make('div', '', 'game-actions');
    const replay = action('Ещё раз', restart, 'game-primary');
    row.append(replay, action('К играм', menu));
    stage.append(row);
    replay.focus();
  }
  function openGames() {
    if (dialog?.open) return;
    dialog = make('dialog');
    dialog.id = 'eva-pet-games';
    dialog.setAttribute('aria-labelledby','eva-game-title');
    const bar = make('div', '', 'game-bar');
    heading = make('h2');
    heading.id = 'eva-game-title';
    heading.tabIndex = -1;
    bar.append(heading, action('В чат', closeGames, 'game-close'));
    stage = make('section', '', 'game-stage');
    dialog.append(bar, stage);
    document.body.append(dialog);
    dialog.addEventListener('cancel', e => { e.preventDefault(); closeGames(); });
    document.addEventListener('visibilitychange', onVisibility);
    window.evaPetGameBack = closeGames;
    dialog.showModal();
    menu();
  }
  function menu() {
    page('Игры с Евой');
    function choice(name, description, item, start) {
      const entry = action('', start, 'game-entry');
      const copy = make('span');
      copy.append(make('strong',name), make('small',description));
      entry.append(prop(item),copy);
      stage.append(entry);
    }
    choice('Карманные пары','Найди три пары в моих карманах.',items[1],pairs);
    choice('Отбей подачу','Лови момент. У тебя пять мячей.',items[0],volley);
  }
  function pairs() {
    page('Карманные пары');
    const cards = [...items, ...items];
    for (let i=cards.length-1; i>0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    const line = status('Открой два кармана с одинаковой вещью.');
    const board = make('div', '', 'pocket-board');
    stage.append(board);
    let first = -1, matches = 0, turns = 0, locked = false;
    const buttons = cards.map((_,i) => {
      const tile = action('', () => flip(i), 'pocket-tile');
      board.append(tile);
      return tile;
    });
    function cover(i) {
      buttons[i].className = 'pocket-tile';
      buttons[i].replaceChildren(make('span', String(i+1)));
      buttons[i].setAttribute('aria-label', 'Открыть карман ' + (i+1));
    }
    function flip(i) {
      if (locked || i===first || buttons[i].disabled) return;
      const tile = buttons[i];
      tile.className = 'pocket-tile shown';
      tile.replaceChildren(prop(cards[i]));
      tile.setAttribute('aria-label', 'Карман ' + (i+1) + ' — ' + cards[i].name);
      if (first<0) { first=i; line.textContent=cards[i].name + '. Выбирай второй.'; return; }
      const a = first;
      first = -1;
      turns++;
      if (cards[a]===cards[i]) {
        matches++;
        for (const k of [a,i]) {
          buttons[k].disabled=true;
          buttons[k].classList.add('found');
        }
        line.textContent = matches===3 ? 'Все три пары твои. Ходов: ' + turns + '. Карманы верни!' :
          'Нашлись! Пар: ' + matches + ' из 3.';
        if (matches===3) endButtons(pairs);
      } else {
        locked=true;
        line.textContent=cards[a].name + ' и ' + cards[i].name + '. Мимо.';
        later(() => { cover(a); cover(i); locked=false; line.textContent='Открывай следующую пару.'; }, 1200);
      }
    }
    buttons.forEach((_,i) => cover(i));
  }
  function volley() {
    page('Отбей подачу');
    const line = status('Жми «Отбить», когда Ева подаст мяч.');
    const court = action('', press, 'volley-court');
    const label = make('strong','Я готова. Начнём?');
    const ball = prop(items[0]);
    court.append(ball,label);
    stage.append(court);
    let state='between', round=0, hits=0, sentAt=0;
    function finish(hit, text) {
      stopClock();
      if (hit) hits++;
      state='between';
      court.className='volley-court';
      line.textContent='Подача ' + round + '/5 · Отбито ' + hits + '. ' + text;
      if (round===5) {
        court.remove();
        line.textContent='Отбито ' + hits + ' из 5. ' + (hits===5?'Ладно, берёшь мои кеды и место в сборной.':hits?'Мяч верни, чемпион.':'Хорошо, что окна виртуальные.');
        endButtons(volley);
      } else { label.textContent='Следующая подача'; }
    }
    function press() {
      if (state==='flying') {
        const ms = Math.round(performance.now()-sentAt);
        finish(ms<=1600, ms<=1600 ? 'Есть! ' + ms + ' мс.' : 'Ушёл в аут.');
      } else if (state==='waiting') { finish(false,'Рано. Я ещё шнурок вязала.'); }
      else {
        round++;
        state='waiting';
        court.className='volley-court waiting';
        label.textContent='Жди…';
        line.textContent='Подача ' + round + '/5 · Отбито ' + hits + '. Следи за мячом.';
        later(() => {
          state='flying';
          court.className='volley-court flying';
          label.textContent='Отбить!';
          line.textContent='Мяч летит! Отбей подачу.';
          sentAt=performance.now();
          later(() => finish(false,'Мимо. Чуть папку не снесло.'),1600);
        }, 950+Math.random()*1500);
      }
    }
  }
})();
