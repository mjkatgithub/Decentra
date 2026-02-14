# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
