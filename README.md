_Keep your window tabs stored as a bookmarks folder, updated automatically._

# Persist Window

Suppose your browsing style tends to have you keep multiple browser windows open
continously (possibly in private mode), with an extensive amount of tabs open in
most of them, with long-term web-surfing sessions.

The primary downside of this browsing style is the danger of losing your session
if your browser process stops abruptly (i.e. on power failure, OS freeze, or
software crash). This can be rectified somewhat by bookmarking all of your tabs
periodically, but it's a hassle and it's easy to forget to do that.

**Persist Window** is a WebExtension that allows to keeps track of your session
by bookmarking all the tabs in a given window and keeping these bookmarks up to
date. (Only Firefox is supported as of now.)

## Features

* Bookmark all your tabs in the current window and keep them updated over time
  (`+` button in the popup panel, next to each existing bookmark folder – the
  chosen folder is the parent of the one that will be created)

* Open all the bookmarks within a folder in a new window and continue a previous
  session (`open` button in the popup panel, next to existing unlinked folders;
  the window will be private _if the current window is private_)  
  **Note: only `http(s)` and `ftp` URLs are opened/saved**

* Stop saving your tabs at any time – mostly useful for creating a new folder to
  keep the old one as a sort of backup (`unlink` button in the popup panel)

* The bookmarks are synced with a delay – this allows you to undo your changes
  or unlink the folder if you made a mistake (the extension button has a yellow
  badge in windows with pending changes)

* The bookmarks are updated immediately when the window is closed, as well as on
  user request (`sync` button in the popup panel)

* The [Tree Style Tab](https://addons.mozilla.org/en-US/firefox/addon/tree-style-tab)
  extension is supported: bookmark trees are saved as such, and they're `open`ed
  as trees (this requires giving user permission in the TST preferences)

## Implementation notes

### Libraries

* [mreframe](https://www.npmjs.com/package/mreframe) is used for rendering popup
  panel
