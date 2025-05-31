const TREE = 'treestyletab@piro.sakura.ne.jp';
let _storage = browser.storage.session || browser.storage.local;

let percent = (n, m) => Math.floor(100 * n / m);  // for progress notifications
let valid = ({url}) => `${url}`.match(/^(https?|ftp):/);
let groupBy = (xs, f) => xs.reduce((o, x, k) => ((k = f(x)), (o[k] = o[k]||[]).push(x), o), {});
let mapKeys = (o, f) => Object.fromEntries(Object.keys(o).map(k => [f(k, o[k]), o[k]]));
let $forEach = (xs, f) => xs.reduce((p, x, i) => p.then(() => f(x, i)), Promise.resolve());
let $delay = (seconds, f) => new Promise(resolve => setTimeout(() => resolve(f()), seconds*1000));
let debounce = (seconds, f, last={}) => (...args) => {
  clearTimeout(last[args]);   delete last[args];
  last[args] = setTimeout(() => f(...args), seconds*1000);
};

let tablist = (tabs, prefix='') => tabs.flatMap(({title, url, children=[]}) =>
  [{title: (!prefix ? title : `${prefix} ${title}`), url}, ...tablist(children, prefix+'>')]).filter(valid);

let bookmarklist = bookmarks => bookmarks.filter(valid).map(({id, title, url}) => ({id, title, url}));

let toStructure = xs => xs.map(x => x.title).reduce((o, s, i) => {
  let idx = o.stack[0]?.idx || 0,  level = s.match(/^(>*) /)?.[1].length || 0;
  let last = o.stack.pop();
  while (last?.level >= level)
    last = o.stack.pop();
  if (!last) {
    o.res.push(-1);
    o.stack = [{level: 0, idx: i}];
  } else {
    o.res.push(last.idx - idx);
    o.stack.push(last, {level, idx: i});
  }
  return o;
}, {res: [], stack: []}).res.map(n => ({parent: n}));

let eqTabs = (xs, ys) =>
  (xs.length === ys.length) && xs.every((x, i) => (x.title === ys[i].title) && (x.url === ys[i].url));

let Store = (KEYS, {prefix = '', key = id => (k => `${prefix}${id}.${k}`)}={}) => ({
  get: id => _storage.get(KEYS.map( key(id) )).then(o => mapKeys(o, k => k.replace(/^.*\./, ""))),
  set: (id, ...os) => _storage.set( mapKeys(Object.assign({}, ...os), key(id)) ),
  remove: id => _storage.remove(KEYS.map( key(id) )),
});
let $window = Store(['tabs', 'sync', 'mark']);

let notify = (id, {title, ...params}, type=('progress' in params ? 'progress' : 'basic')) =>
  browser.notifications.create(`${id}`,
    {type, iconUrl: "icon/bookmark-48.png", title: "Persist Window" + (!title ? "" : ` (${title})`), ...params});

let notifyProgress = (id, n, m) => notify(id, {message: `Opening tabs… (${n} / ${m})`, progress: percent(n, m)});

let openDiscarded = (windowId, tabs, progress) => $forEach(tabs, (tab, idx) =>
  browser.tabs.create({windowId, discarded: true, ...tab}).then(() => progress && progress(idx+1)));

let openInNewWindow = async (bookmarkFolder, {incognito}={}) => {
  let tabs = await browser.bookmarks.getChildren(bookmarkFolder).then(bookmarklist);
  let window = await browser.windows.create({incognito}),  _blank = window.tabs[0];
  await notify(window.id, {message: "Opening tabs…", progress: 0});
  let _blocker = (message, sender) =>  // temporarily block new tabs handling for this window
    (sender.id == TREE) && (['try-handle-newtab', 'try-fixup-tree-on-tab-moved'].includes(message.type)) &&
      (message.tab.windowId == window.id) && Promise.resolve(true);
  try {
    browser.runtime.onMessageExternal.addListener(_blocker);
    await openDiscarded(window.id, tabs.map(({url, title}) => ({url, title: title.replace(/^>+ /, "")})),
      idx => (idx % 20 == 0) && notifyProgress(window.id, idx, tabs.length));
    let structure = [[{parent: -1}], ...toStructure(tabs)];
    await browser.runtime.sendMessage(TREE, {type: 'set-tree-structure', window: window.id, tabs: '*', structure})
      .catch(console.warn);
    (tabs.length > 0) && await browser.tabs.remove(_blank.id);
    await notifyProgress(window.id, tabs.length, tabs.length);
  } catch (error) {
    notify(window.id, {title: "error", message: `${error}`});
    throw error;
  } finally {
    browser.runtime.onMessageExternal.removeListener(_blocker);
  }
  return $delay(1, () => window);
}

let getTabs = windowId => browser.runtime.sendMessage(TREE, {type: 'get-tree', window: windowId})
                            .catch(() => browser.tabs.query({windowId})).then(tablist);

let bookmarkTabs = (windowId, title, parentId) =>
  Promise.all([getTabs(windowId), browser.bookmarks.create({parentId, title})]).then(([tabs=[], {id}]) =>
    tabs.reduce((p, tab) => p.then(() => browser.bookmarks.create({parentId: id, ...tab})), Promise.resolve())
      .then(() => id));

let sync = windowId => $window.get(windowId).then(({sync, tabs: oldtabs}) =>
  sync && getTabs(windowId).then(tabs => {
    browser.action.setBadgeText({windowId, text: `${tabs.length}`});
    let mark = oldtabs && !eqTabs(tabs, oldtabs);
    if (mark) {
      browser.alarms.create(`${windowId}`, {delayInMinutes: .2});
      browser.action.setBadgeBackgroundColor({windowId, color: 'yellow'});
    }
    return $window.set(windowId, {tabs}, mark && {mark});
  }));
let sync_ = debounce(.1, sync);

let setBookmarks = (windowId, bookmarkFolder) => $window.set(windowId, {sync: bookmarkFolder}).then(() => sync(windowId));

let updateBookmarks = windowId => $window.get(windowId).then(({tabs, sync}) =>
  sync && tabs && browser.bookmarks.getChildren(sync).then(bookmarklist).then(bookmarks => {
    if (!eqTabs(tabs, bookmarks)) {  // primitive implementation – not trying to match the URLs
      bookmarks.slice(0, tabs.length).forEach((x, i) => eqTabs([x], [tabs[i]]) || browser.bookmarks.update(x.id, tabs[i]));
      bookmarks.slice(tabs.length).forEach(({id}) => browser.bookmarks.remove(id));
      $forEach(tabs.slice(bookmarks.length), tab => browser.bookmarks.create({parentId: sync, ...tab}));
    }
    browser.action.setBadgeBackgroundColor({windowId, color: 'green'});  // logs a warning if the window is closed
    $window.set(windowId, {mark: false});
  }));


browser.action.setBadgeBackgroundColor({color: 'green'});
(subscribe => {
  browser.runtime.onMessageExternal.addListener((message, sender) => {
    if ((sender.id === TREE) && ['ready', 'permissions-changed'].includes(message.type))
      subscribe();
  });
  subscribe(); // in case TST has been loaded already
})(() => browser.runtime.sendMessage(TREE, {
  type: 'register-self',
  name: "Persist Window",
  icons: browser.runtime.getManifest().icons,
  listeningTypes: ['tree-attached', 'tree-detached', 'try-handle-newtab', 'try-fixup-tree-on-tab-moved'],
  permissions: ['tabs'],
}).then(console.log).catch(console.warn));

browser.alarms.onAlarm.addListener(({name: windowId}) => updateBookmarks( Number(windowId) ));

['onInstalled', 'onStartup'].forEach(k => browser.runtime[k].addListener(() => browser.windows.getAll().then(windows =>
  windows.forEach(window => sync(window.id)))));

['tabs', 'windows'].forEach(k => browser[k].onCreated.addListener(({windowId}) => sync(windowId)));
browser.tabs.onAttached.addListener((_, {newWindowId}) => sync(newWindowId));
browser.tabs.onDetached.addListener((_, {oldWindowId}) => sync(oldWindowId));
browser.tabs.onMoved.addListener((_, {windowId}) => sync(windowId));
browser.tabs.onRemoved.addListener((_, x) => x.isWindowClosing || setTimeout(() => sync(x.windowId), 250));
browser.tabs.onUpdated.addListener((id, _, {windowId}) => sync(windowId));
browser.windows.onRemoved.addListener(id => updateBookmarks(id).then(() => $window.remove(id)));

browser.runtime.onMessageExternal.addListener((message, sender) => {
  if ((sender.id == TREE) && ['tree-attached', 'tree-detached'].includes(message.type))
    sync_(message.tab.windowId);
});

browser.runtime.onMessage.addListener(({type, windowId, bookmarkFolder, incognito, parentId}) => {
  if (type === 'bookmark')
    bookmarkTabs(windowId, bookmarkFolder, parentId).then(id => setBookmarks(windowId, id));
  else if (type === 'unlink')
    $window.remove(windowId).then(() => browser.action.setBadgeText({windowId, text: ""}));
  else if (type === 'open')
    openInNewWindow(bookmarkFolder, {incognito}).then(({id}) =>
      sync(id)?.then(() => setBookmarks(id, bookmarkFolder)).then(() => notify(id, {message: "Finished"})));
  else if (type === 'sync')
    updateBookmarks(windowId);
});
