# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Four-column chat layout with responsive sidebars and mobile overlays
- Space rail with compact/expanded modes and create-space stub route
- Account settings page and space settings base page
- Member list with presence badges (online, away, offline, unknown)
- Theme preference composable with explicit localStorage persistence
- App i18n composable with English/German locale persistence
- SVG favicon and global head registration

### Changed

- Space navigation now separates icon-button interaction from text-click area
- Room navigation supports home categories for personal/unassigned rooms
- Chat shell styling refined with distinct visual background accents

### Fixed

- Space-to-room parent mapping now uses Matrix `m.space.parent` state
- Space avatar resolution now supports Matrix mxc avatar URLs with fallback

## [0.1.0] - 2025-02-13

### Added

- Matrix-based chat client (Spaces, Categories, Rooms)
- Login page with Matrix authentication
- Chat page with room list, message list, and input field
- Matrix client composable (login, sync, rooms, messages, pagination)
- Nuxt UI + Tailwind CSS, Dark Mode as default
- Unit tests (Vitest, Chai)
- Integration tests (Nuxt Test Utils)
- E2E tests (Cucumber + Playwright)
- Configurable headless/headed mode for E2E tests

### Technical

- Nuxt 4, Vue 3, matrix-js-sdk
- Components: ChatRoomList, ChatMessageList, ChatMessageInput

[Unreleased]: https://github.com/mjkatgithub/Decentra/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/mjkatgithub/Decentra/releases/tag/v0.1.0
