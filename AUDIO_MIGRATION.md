# File audio migration

## Comparison / call inventory

Reference (read-only): `C:/MyWork/startup/00010_CosmiiCannon/www/index.html`, lines 3483–3570.
The supplied `00010/_CosmiiCannon` path did not exist; the sibling above was used.
Reference uses reusable HTML media objects, rejected-play handling, and pause → seek to zero → play for SFX.

Previous implementation: one MP3 BGM plus live oscillator, gain, buffer-source noise and bandpass synthesis in `js/Audio.js`.
No custom native audio session/player/plugin was found in the app-owned iOS sources or dependencies.
No native audio implementation needed removal; no native session configuration was added.

| Caller | Sound |
| --- | --- |
| `main.js` pointer gesture | unlock / BGM |
| `main.js` visibility / Capacitor app state / page hide-show | pause and resume |
| `Game._btn()` | button |
| `Game._updateSuction()` | thud |
| `Game._consume()` | pop, grow, vacuum |
| `Game.endGame()` | timeup |
| `collaborations/ohsun.js` SUN entry | grow |
| Game sound button | setEnabled, existing `mogu.sound` persistence |

## Files / levels

- `js/Audio.js`: file-only player, one BGM instance, at most three SFX voices, one pickup voice across all pitches.
- `public/audio/*.wav`: 14 pickup pitches and five other SFX. 44.1 kHz, mono, 16-bit PCM, normalized peak 0.32 (-9.9 dBFS).
- `scripts/generate-sfx.cjs`: deterministic offline renderer retaining original pitches, envelopes, note sequences and noise sweeps; never shipped to the game. Regenerate with `node scripts/generate-sfx.cjs`.
- `main.js`: audio-only lifecycle hooks; independent visibility/app/page suspension reasons prevent premature resume. Short SFX are discarded on suspension, BGM resumes from its position. Blocked playback retries on user gesture.
- `scripts/build-web.js`: includes WAV assets; `scripts/preview-ohsun.cjs`: serves WAV assets locally.
- `scripts/test-audio*.cjs`: audio-specific regression and real-media browser tests.
- `package.json` and `scripts/normalize-ios-paths.cjs`: sync-after hook normalizes Capacitor's generated Windows path separators in the Swift package file; avoids invalid Swift escape sequences without manually maintaining generated output.

BGM volume 0.20 (original MP3 retained); pop 0.70, button/thud 0.55, grow/timeup 0.70, vacuum 0.60.
Audibility adjustment: pickup peak is approximately 6.3 dB higher than the initial migration. With these media volumes applied, the worst-case absolute peak sum is 0.20 + 3 × 0.32 × 0.70 = 0.872; retain the three-voice cap. Actual device/recording output remains subject to device verification.
File attenuation and bounded concurrency provide additional SFX headroom, beyond media-element volume settings. Final recording balance must still be verified on iPhone.
The existing app has a single SOUND switch, not separate BGM/SFX switches. UI and `mogu.sound` semantics remain unchanged; no other saved data changes.

## Build / verification

`npm ci --ignore-scripts` (dependencies were absent), `npm run sync:ios` (builds `www` from source, then syncs to `ios/App/App/public`). Do not edit generated copies.
`node scripts/test-audio.cjs`, `node scripts/test-audio-browser.cjs <playwright path>`, and existing core/SUN/build suites.
Xcode and device recording are unavailable on the Windows workstation. Capacitor synchronization is not a native build success.
On a Mac: install locked dependencies, run `npm run sync:ios`, open `ios/App/App.xcodeproj`, resolve Swift packages and build/run the App scheme on the target iPhone with the project's signing settings.

## iPhone recording checklist (not yet executed)

With SOUND ON, connect Safari Web Inspector to the running app. For each condition, set the media mute flags below, then use Control Center screen recording with **microphone OFF**. These debug flags do not alter saved preferences or shipping UI.

```js
// BGM only
__game.audio.bgm.muted = false;
Object.values(__game.audio.sfx).forEach(a => a.muted = true);
// SFX only
__game.audio.bgm.muted = true;
Object.values(__game.audio.sfx).forEach(a => a.muted = false);
// Both ON (restore normal playback)
__game.audio.bgm.muted = false;
Object.values(__game.audio.sfx).forEach(a => a.muted = false);
```

For all three: record title → game → dense pickups/vacuum/SUN (local preview if enabled) → result → retry. Listen to the saved recording for crackle, clipping, missing sounds and duplicate BGM.
Also test Control Center interruptions, Home/app switch → return, lock → unlock, repeated foreground events, SOUND OFF → force quit/relaunch, and ON again. Confirm no stale SFX burst or unwanted OFF-state resume. Check speaker/headphones and record iPhone model/iOS version. Do not claim the recording defect resolved until these device checks pass.
