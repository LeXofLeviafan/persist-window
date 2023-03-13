addEventListener('load', () => {
  let {reFrame: rf, reagent: r, util: {getIn, merge, keys, entries, dict}} = require('mreframe');
  if (typeof browser === 'undefined') var browser = chrome;
  let _storage = browser.storage.session || browser.storage.local;

  const RE = {sync: /\.sync$/, mark: /\.mark$/};

  let valid = x => x?.url?.match(/^(https?|ftp|file):/);
  let bookmarkDirs = bookmarks => bookmarks.filter(x => x.children).map(({id, title, children}) =>
    ({id, title, size: children.filter(valid).length, children: bookmarkDirs(children)}));

  ['unlink', 'open', 'bookmark', 'sync'].forEach(k => rf.regFx(`$${k}`, params =>
    browser.runtime.sendMessage({type: k, ...params}).then(window.close)));

  rf.regEventDb('set-window', [rf.trimV], (db, [window, incognito]) => merge(db, {window, incognito}));
  rf.regEventDb('set-bookmarks', [rf.path('bookmarks'), rf.unwrap], (_, x) => x);
  rf.regEventDb('upd-sync', [rf.unwrap], (db, values, marks = values.filter(v => v.length > 2)) =>
    merge(db, {sync: merge(db.sync, dict(values)), mark: merge(db.mark, dict(marks.map(([id, _, x]) => [id, x])))}));
  rf.regEventDb('upd-mark', [rf.path('mark'), rf.unwrap], (db, values) => merge(db, dict(values)));
  rf.regEventDb('set-input', [rf.path('confirm', 'value'), rf.unwrap], (_, s) => s);
  rf.regEventFx('confirm', [rf.path('confirm'), rf.unwrap], ({db}, success) => {
    let dispatch = (!success ? db.onFailure : db.onSuccess && [...db.onSuccess, db.value]);
    return merge({db: {}}, dispatch && {dispatch});
  });
  rf.regEventDb('open', [rf.trimV], (db, [id, title]) =>
    merge(db, {confirm: {msg: `Open the bookmark folder "${title}" in new ${!db.incognito ? "" : "private"} window?`,
                         onSuccess: [`-open`, id]}}));
  rf.regEventFx(`-open`, [rf.unwrap], ({db: {incognito}}, id) => ({$open: {bookmarkFolder: id, incognito}}));
  rf.regEventDb('unlink', [rf.trimV], (db, [{id, title}]) =>
    merge(db, {confirm: {msg: `Unlink the bookmark folder "${title}" from this window?`, onSuccess: [`-unlink`, id]}}));
  rf.regEventFx(`-unlink`, [rf.unwrap], ({db}, id) => ({$unlink: {windowId: db.window}}));
  rf.regEventDb('bookmark', [rf.trimV], (db, [parent, title]) =>
    merge(db, {confirm: {msg: `Name the bookmark folder to create in "${title}"`,
                         prompt: true, onSuccess: ['-bookmark', parent]}}));
  rf.regEventFx('-bookmark', [rf.trimV], ({db}, [parentId, title]) =>
    ({$bookmark: {windowId: db.window, parentId, bookmarkFolder: title}}));
  rf.regEventFx('sync', ({db}) => ({$sync: {windowId: db.window}}));

  rf.regSub('confirm', getIn);
  rf.regSub('window', getIn);
  rf.regSub('sync', getIn);
  rf.regSub('mark', getIn);
  rf.regSub('bookmarks', getIn);
  rf.regSub('_sync', '<-', ['sync'], (o, [_, ...path]) => dict(entries(o).map(([k, v]) => [v, k]).filter(([k]) => k)));
  rf.regSub('sync*', '<-', ['_sync'], (o, [_, ...path]) => getIn(o, path));
  rf.regSub('synced?', '<-', ['sync'], '<-', ['window'], ([o={}, k]) => o[k]);
  rf.regSub('_bookmarks', '<-', ['bookmarks'], function rec (xs) {return (xs||[]).flatMap(x => [x, ...rec(x.children)])});
  rf.regSub('bookmark*', '<-', ['_bookmarks'], '<-', ['synced?'], ([xs, id]) => xs.find(x => x.id === id));

  let FocusInput = r.createClass({
    componentDidMount () {this.dom.focus()},
    reagentRender: attrs => ['input', attrs],
  });

  let Confirm = ({msg, prompt, value=""} = rf.dsub(['confirm'])||{}) => msg &&
    ['.confirm',
      ['div', ['strong', msg.slice(0, 1).toUpperCase() + msg.slice(1)]],
      prompt && ['p', [FocusInput, {value, oninput () {rf.dispatchSync(['set-input', this.value])}}]],
      ['.buttons',
        ['button', {onclick: () => rf.disp(['confirm'])}, "Cancel"], " ",
        ['button', {disabled: prompt && !value?.trim(), onclick: () => rf.disp(['confirm', true])}, "OK"]]];

  let BookmarkFolderTree = (bookmarks, synced=rf.dsub(['synced?'])) => bookmarks &&
    ['ul', ...bookmarks.map(({id, title, size, children, sync=rf.dsub(['sync*', id]), mark=rf.dsub(['mark', sync])}) =>
      ['li',
        ['.bookmark', {class: {sync, mark, current: id === synced}},
          ['code', size], " ", title, " ",
          !sync && ['button', {title: "Open in new window", onclick: () => rf.disp(['open', id, title])}, "open"], " ",
          !synced &&
            ['button', {title: "Sync window tabs in subfolder", onclick: () => rf.disp(['bookmark', id, title])}, "+"]],
        children && [BookmarkFolderTree, children, synced]])];

  let WindowInfo = ([id, bookmark] = [['window'], ['bookmark*']].map(rf.dsub)) =>
    ['.bookmark.sync', {class: {mark: rf.dsub(['mark', id])}},
      ['code', bookmark?.size], " ", bookmark?.title, " ",
      ['button', {title: "Update bookmarks", onclick: () => rf.disp(['sync'])}, "sync"],
      ['button', {title: "Stop updating bookmarks", onclick: () => rf.disp(['unlink', bookmark])}, "unlink"]];

  let App = () =>
    ['main', [Confirm],
      rf.dsub(['synced?']) && [WindowInfo],
      [BookmarkFolderTree, rf.dsub(['bookmarks'])]];

  (syncBookmarks => {
    syncBookmarks();
    ['onCreated', 'onRemoved', 'onMoved'].forEach(k => browser.bookmarks[k].addListener(syncBookmarks));
  })(() => browser.bookmarks.getTree().then(([{children}]) => rf.disp(['set-bookmarks', bookmarkDirs(children)])));
  browser.windows.getCurrent().then(window => rf.disp(['set-window', window.id, window.incognito]));
  browser.windows.getAll()
    .then(windows => Promise.all(windows.map(({id}) =>
      _storage.get([`${id}.sync`, `${id}.mark`]).then(o => [id, o[`${id}.sync`], o[`${id}.mark`]]))))
    .then(values => rf.disp(['upd-sync', values]));
  _storage.onChanged.addListener(o =>
    entries(RE).forEach(([k, re]) =>
      rf.disp([`upd-${k}`, keys(o).filter(k => k.match(re)).map(k => [k.replace(re, ""), o[k].newValue])])));
  addEventListener('keydown', e => (e.key === 'Enter') && rf.dsub(['confirm']) && rf.disp(['confirm', e.key === 'Enter']));
  r.render([App], document.body);
});
