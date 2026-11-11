# Changelog

## 0.8.0 — 2026-11-11

- Fix keyboard ball-in-hand placement and keep essential exit controls visible.
- Separate the per-rack physics world from the display camera; support uniform resizing and portrait rotation.
- Save stable turns, restore interrupted games, validate versioned snapshots and clear completed games.
- Confirm restarts during unfinished games; explain wins caused by the opponent's eight-ball foul.
- Add help, rules, game summary, persistent difficulty and fixed-power controls; improve narrow layouts and explicit spin reset.
- Add direct scratch-risk scoring and restitution-aware one-cushion kick planning to the local AI.
- Restore desktop CSS safely, contain initialization failure and make destruction idempotent.
- Split maintainable source modules; deterministically regenerate the offline bundle and embedded WAV assets.
- Include the preview fixture, regression tests and CI configuration in the source repository.

Validation uses production code, independent Chromium and an isolated local Harness Web profile. Native Electron window controls, real minimization, multi-monitor scaling and actual approval flows still need desktop-specific acceptance. No model/API experiments are required.
