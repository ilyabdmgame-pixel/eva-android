'use strict';

(function (root) {
  // One stroke and accent system for small controls on the launcher, chat and compact voice window.
  const shapes = {
    menu: '<path d="M4 6.5h16M4 12h12.5M4 17.5h16"/>',
    close: '<path d="m6.5 6.5 11 11m0-11-11 11"/>',
    add: '<path d="M12 5v14M5 12h14"/>',
    remove: '<path d="M5 12h14"/>',
    more: '<g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.55"/><circle cx="12" cy="12" r="1.55"/><circle cx="19" cy="12" r="1.55"/></g>',
    attach: '<path d="m8.5 14.5 6.2-6.2a2.1 2.1 0 0 1 3 3l-8.1 8.1a4.2 4.2 0 1 1-5.9-5.9l9-9a5.35 5.35 0 0 1 7.6 7.5l-7.9 7.9"/>',
    mic: '<rect x="8.6" y="2.5" width="6.8" height="12.6" rx="3.4"/><path d="M5.1 11.6a6.9 6.9 0 0 0 13.8 0M12 18.5v3m-3.4 0h6.8"/><path class="ui-icon-accent" d="M11 6.2h2"/>',
    send: '<path d="M3 10.2 20.8 3.5l-5.9 17-4.2-6-5.8-2.2c-1.7-.6-2.5-1.2-1.9-2.1Z"/><path class="ui-icon-accent" d="m10.7 14.5 6.7-7"/>',
    stop: '<rect x="5.5" y="5.5" width="13" height="13" rx="3" fill="currentColor" stroke="none"/>',
    expand: '<path d="M14.7 4.2h5.1v5.1M19.6 4.4l-6.2 6.2M9.3 19.8H4.2v-5.1m.2 4.9 6.2-6.2"/>',
    home: '<path d="m2.8 10.9 8.4-7.1a1.2 1.2 0 0 1 1.6 0l8.4 7.1M5.2 9.2v10.7h5V14h3.6v5.9h5V9.2"/><path class="ui-icon-accent" d="M16 5.5V3.9h2.1v3.3"/>',
    tune: '<path d="M3 6.2h5m4 0h9M3 12h10m4 0h4M3 17.8h3m4 0h11"/><g class="ui-icon-accent"><circle cx="10" cy="6.2" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="17.8" r="2"/></g>',
    map: '<path d="m3 6 5.9-2.5 6.2 2.4L21 3.5v14.6l-6 2.5-6.1-2.4L3 20.6V6Z"/><path class="ui-icon-accent" d="M8.9 3.8v14.1m6.2-11.6v14"/>',
    volume: '<path d="M3.2 9.4h4.2l5.1-4.2v13.6l-5.1-4.2H3.2Z"/><path class="ui-icon-accent" d="M15.5 8.5a5.1 5.1 0 0 1 0 7m2.8-9.7a9 9 0 0 1 0 12.4"/>',
    mute: '<path d="M3.2 9.4h4.2l5.1-4.2v13.6l-5.1-4.2H3.2Z"/><path class="ui-icon-accent" d="m16.4 9.3 4.8 5.4m0-5.4-4.8 5.4"/>',
    headphones: '<path d="M4.3 14v-3.2a7.7 7.7 0 0 1 15.4 0V14"/><rect x="3" y="11.7" width="4.7" height="7.5" rx="2.1"/><rect x="16.3" y="11.7" width="4.7" height="7.5" rx="2.1"/><path class="ui-icon-accent" d="M17.7 19.2c-.9 1.6-2.1 2-4.5 2"/>',
    grid: '<rect x="3.3" y="3.3" width="7" height="7" rx="2"/><rect x="13.7" y="3.3" width="7" height="7" rx="2"/><rect x="3.3" y="13.7" width="7" height="7" rx="2"/><rect class="ui-icon-accent" x="13.7" y="13.7" width="7" height="7" rx="2"/>',
    folder: '<path d="M3.2 7.2V5.7c0-.9.8-1.6 1.8-1.6h4.7l2 2h7.4c1 0 1.8.8 1.8 1.8v10.1c0 1.1-.9 2-2 2H5.2a2 2 0 0 1-2-2V7.2Z"/><path class="ui-icon-accent" d="M3.7 8.7h16.6"/>',
    compass: '<circle cx="12" cy="12.2" r="8.6"/><path class="ui-icon-accent" d="m15.8 8.3-2.3 5.2-5.3 2.4 2.4-5.2 5.2-2.4Z"/>',
    coin: '<circle cx="12" cy="12" r="8.7"/><path class="ui-icon-accent" d="M12 6.8c.4 3.2 1.9 4.7 5.2 5.2-3.3.5-4.8 2-5.2 5.2-.5-3.2-2-4.7-5.2-5.2 3.2-.5 4.7-2 5.2-5.2Z"/>',
    avatar: '<path d="M4 13c0-5.6 3.3-9.4 8-9.4s8 3.8 8 9.4l-.8 5.4-2.8-1.1M4.8 18.4l2.8-1.1"/><path d="M6.7 11.4c1.2 0 3.2-.8 4.7-2.4 1.1 1.2 3.3 2 5.9 2.1v2.5c0 4-3 6.9-5.4 6.9S6.7 17.6 6.7 14v-2.6Z"/><path class="ui-icon-accent" d="M9.5 13.8h.1m4.8 0h.1"/>',
    angles: '<path d="M3 5.6h13.7v12.8H3zM17 6.8l3.9-2.2v15L17 17.5"/><path class="ui-icon-accent" d="M6.2 13.5c1.3-2.8 5.8-2.8 7.3 0m-5.8-4h.1m4.1 0h.1"/>',
    monitor: '<rect x="2.6" y="4.2" width="18.8" height="13.6" rx="2.4"/><path d="M12 18v2.9m-4.1 0h8.2"/><path class="ui-icon-accent" d="M5.4 12h3l2-4.3 3.2 7 1.9-3.9h3"/>',
    clock: '<circle cx="12" cy="12" r="8.7"/><path class="ui-icon-accent" d="M12 6.4v5.7l3.7 2.1"/>',
    restart: '<path d="M4.2 9.4a8.1 8.1 0 1 1 .2 5.9m-.9-10v4.8h4.8"/><path class="ui-icon-accent" d="M12 8v4l2.6 1.8"/>',
    refresh: '<path d="M4.1 10a8.2 8.2 0 0 1 13.8-3.9l2.5 2.4m0-5v5h-5M19.9 14a8.2 8.2 0 0 1-13.8 3.9l-2.5-2.4m0 5v-5h5"/>',
    move: '<path d="M12 3v18M3 12h18m-12.4-6L12 2.7 15.4 6m-6.8 12 3.4 3.3 3.4-3.3M6 8.6 2.7 12 6 15.4m12-6.8 3.3 3.4-3.3 3.4"/>',
    rotateLeft: '<path d="M4 8.9h10.4a5.5 5.5 0 0 1 0 11h-2.1M8.5 4.4 4 8.9l4.5 4.5"/>',
    rotateRight: '<path d="M20 8.9H9.6a5.5 5.5 0 0 0 0 11h2.1m4-15.5L20 8.9l-4.5 4.5"/>',
    open: '<path d="M12.9 4.2h6.9V11m-.2-6.6-9.2 9.2"/><path d="M10.4 5.9H5.5A1.5 1.5 0 0 0 4 7.4v11.1A1.5 1.5 0 0 0 5.5 20h11.1a1.5 1.5 0 0 0 1.5-1.5v-4.9"/>',
    item: '<path d="m12 2.9 8.5 4.8v8.7L12 21.1l-8.5-4.7V7.7L12 2.9Z"/><path class="ui-icon-accent" d="m3.7 7.8 8.3 4.8 8.3-4.8M12 12.6v8.1"/>',
    game: '<path d="M7.8 6h8.4c3.3 0 4.2 1.7 5 6.2.5 3.4.4 5.8-1.8 5.8-2 0-3.6-2.7-4.8-2.7H9.4c-1.2 0-2.7 2.7-4.8 2.7-2.2 0-2.3-2.4-1.8-5.8.7-4.5 1.8-6.2 5-6.2Z"/><path d="M7.6 9v4.1m-2-2h4.1"/><path class="ui-icon-accent" d="M15.6 11.8h.1m2.4-2.2h.1"/>',
    activity: '<path d="M13.1 3.4c.6 4.9 2.1 6.5 6.5 7.4-4.4.9-5.9 2.6-6.5 7.4-.8-4.8-2.2-6.5-6.6-7.4 4.4-.9 5.8-2.5 6.6-7.4Z"/><path class="ui-icon-accent" d="M5.5 14.3v5.5m-2.7-2.7h5.5"/>',
    moon: '<path d="M19.7 15.5A8.4 8.4 0 0 1 9.8 4.2a8.6 8.6 0 1 0 9.9 11.3Z"/><path class="ui-icon-accent" d="M17.3 3.9v5m-2.5-2.5h5"/>',
    cloud: '<path d="M7.2 18.3a4.6 4.6 0 0 1-.3-9.2 6.1 6.1 0 0 1 11.6.6 4.4 4.4 0 0 1-.5 8.6H7.2Z"/><path class="ui-icon-accent" d="M9.1 15.2h4.1"/>',
    place: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle class="ui-icon-accent" cx="12" cy="10" r="2.1"/>',
    next: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
    work: '<rect x="3" y="4" width="18" height="6.5" rx="2"/><rect x="3" y="13.5" width="18" height="6.5" rx="2"/><path class="ui-icon-accent" d="M6.5 7.2h.1m0 9.6h.1m4-9.6h6.7m-6.7 9.6h6.7"/>',
    workshop: '<path d="m4 20 7.1-7.1m2.5-2.5 2.5-2.5M12.7 4.6l3.1-1.3 4.8 4.8-1.3 3.1-2-.1L12.8 6.7l-.1-2.1ZM5.5 15.6l2.9 2.9"/>',
    note: '<path d="M5 3.5h9.4L19 8v12.5H5V3.5Z"/><path d="M14 3.9v4.6h4.4"/><path class="ui-icon-accent" d="M8.2 12.2h7.1m-7.1 3.5h5.2"/>',
    tasks: '<rect x="5" y="4.6" width="14" height="16.3" rx="2"/><rect x="9" y="2.8" width="6" height="3.7" rx="1"/><path class="ui-icon-accent" d="m8.3 13 2.4 2.5 4.8-5.1"/>',
    model: '<path d="m6 7.4 6 3.5 6-3.5M12 11v7.1"/><circle cx="5.5" cy="6.9" r="2.7"/><circle cx="18.5" cy="6.9" r="2.7"/><circle class="ui-icon-accent" cx="12" cy="18.7" r="2.7"/>',
    archive: '<rect x="3.4" y="3.7" width="17.2" height="4.8" rx="1.3"/><path d="M5.3 8.7v10.9h13.4V8.7"/><path class="ui-icon-accent" d="M9.6 12.2h4.8"/>',
    chat: '<path d="M20.8 11.3c0 4.5-4.1 7.7-9 7.7a9.8 9.8 0 0 1-3.3-.5L4 20l.9-3.9a6.5 6.5 0 0 1-2-4.8c0-4.4 4-7.9 8.9-7.9s9 3.5 9 7.9Z"/><path class="ui-icon-accent" d="M9 11.3h5.8M11.9 8.4v5.8"/>',
    bin: '<path d="M4.5 7h15m-12.8.3 1 12h8.6l1-12M9.1 7l.8-3h4.2l.8 3m-4.5 3.8v5.2m3-5.2v5.2"/>',
    check: '<path d="m4.8 12.3 4.5 4.7L19.5 6.7"/>',
    search: '<circle cx="10.6" cy="10.4" r="6.4"/><path class="ui-icon-accent" d="m15.4 15.2 5 5.2"/>'
  };

  function html(name) {
    if (!Object.hasOwn(shapes, name)) return '';
    return '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">'+shapes[name]+'</svg>';
  }
  function hydrate(scope) {
    for (const marker of scope.querySelectorAll('[data-eva-icon]')) {
      const markup = html(marker.dataset.evaIcon);
      if (markup) marker.outerHTML = markup;
    }
  }
  const api = {html, hydrate};
  root.EvaIcons = api;
  if (typeof document !== 'undefined') hydrate(document);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
