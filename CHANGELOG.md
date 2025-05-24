# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [0.0.6] - 2025-05-24

### Added

- Progress notifications when opening a new window

### Changed

- Paused TST events in the window that is being opened (for the duration of the process)

### Fixed

- Fixed tabs tree being applied to a wrong window (if switched out during tab opening)


## [0.0.5] - 2023-03-15

### Added

- `homepage_url` in manifest

### Fixed

- Fixed setting/unsetting of `mark` in storage


## [0.0.4] - 2023-03-14

### Added

- LICENSE file

### Changed

- Made `open` only load the 1st tab (the rest are opened in discarded state)
- Made `openInNewWindow()` treat `incognito` as a keyword argument
- Integrated `$tabs`, `$sync` & `$mark` into `$window`

### Removed

- Excluded `file:` URLs from the validity filters
  ([the browser won't allow opening them](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/create#url))

### Fixed

- Contents of the CHANGELOG file (wording, dates, links)


## [0.0.3] - 2023-03-13

### Fixed

- Fixed rendering error on large bookmark trees


## [0.0.2] - 2023-03-13

### Added

- README and CHANGELOG files

### Changed

- Included explicit version number in the library filenames
- Removed the unnecessary non-minified version of mreframe
  ([sources are available online](https://github.com/LeXofLeviafan/mreframe/tree/main/src))

### Fixed

- Fixed broken `unlink` and `sync` buttons
- Adjusted prompt input width to match dialog width
- Stopped saving tab state of unwatched windows
- Stopped overwriting unchanged bookmarks


## [0.0.1] - 2023-03-11


[0.0.6]: https://github.com/LeXofLeviafan/persist-window/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/LeXofLeviafan/persist-window/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/LeXofLeviafan/persist-window/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/LeXofLeviafan/persist-window/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/LeXofLeviafan/persist-window/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/LeXofLeviafan/persist-window/releases/tag/v0.0.1
