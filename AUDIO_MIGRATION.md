# File audio migration

## Current SUN BONUS music

During SUN entry and the eight-second active bonus, play the supplied `public/ゲームショーのテーマ.wav` through one reusable HTMLAudioElement at volume 0.20. Pause normal BGM (preserving its position), restart the theme at each bonus, and return to normal BGM when the active bonus ends or the collaboration is left. All pickup SFX are suppressed throughout the collaboration event; the old three-second bonus pickup cue is no longer instantiated. Manual pause, background and SOUND OFF pause music; resume continues the selected track without seeking. No simultaneous normal/bonus BGM. A collaboration run preloads the theme; normal builds do not include or request it. The supplied 48 kHz stereo 16-bit PCM file is trimmed to 8.65 seconds (entry 0.65 + bonus 8), with a 150 ms fade-out, reducing 31,647,760 bytes to 1,660,844 bytes. Samples before the fade are unchanged; there is no recompression. The theme does not loop. `scripts/trim-sun-theme.cjs` prepares the source asset and saves the long original in an OS temporary directory outside the repository. Builds copy the trimmed source byte-for-byte. Four SFX elements remain, plus normal BGM and the lazily prepared theme. Historical comparison notes below describe prior iterations.

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
| `Game._updateSuction()` | no collision sound |
| `Game._consume()` | pop, grow, vacuum |
| `Game.endGame()` | clear on success / timeup on failure |
| `collaborations/ohsun.js` SUN entry | grow |
| Game sound button | setEnabled, existing `mogu.sound` persistence |

## Files / levels

- `js/Audio.js`: file-only player, one BGM instance plus five SFX elements (button, timeup, clear, low normal pickup, bonus pickup). At most two SFX play together. Growth/vacuum and higher pickup pitches are not loaded. Collision audio remains disabled. Unused WAV variants have been removed; source generation and distribution now contain only active effects.
- `public/audio/*.wav`: four active files only: `button`, `clear`, `timeup`, `suction-1`. Unused original pickup pitches, growth/vacuum/collision cues, higher suction pitches and the superseded bonus burst were removed. The generator and build allowlist include only these four files.
- `scripts/generate-sfx.cjs`: deterministic offline renderer retaining original pitches, envelopes, note sequences and noise sweeps; never shipped to the game. Regenerate with `node scripts/generate-sfx.cjs`.
- `main.js`: audio-only lifecycle hooks; independent visibility/app/page suspension reasons prevent premature resume. Short SFX are discarded on suspension, BGM resumes from its position. Blocked playback retries on user gesture.
- `scripts/build-web.js`: includes WAV assets; `scripts/preview-ohsun.cjs`: serves WAV assets locally.
- `scripts/test-audio*.cjs`: audio-specific regression and real-media browser tests.
- `package.json` and `scripts/normalize-ios-paths.cjs`: sync-after hook normalizes Capacitor's generated Windows path separators in the Swift package file; avoids invalid Swift escape sequences without manually maintaining generated output.

BGM volume 0.20 (original MP3 retained); normal/bonus pickup 0.70, button 0.55, timeup/clear 0.70. Growth and vacuum cues are temporarily disabled and their media elements are not constructed.
Successful results use a 1.5-second ascending C-major chime (`clear.wav`). Pending pickup playback and current SFX are stopped before the fanfare; BGM continues. Failure retains the descending timeup sound. Both respect the existing SOUND setting.
Pickup playback (non-interrupting hits): one prerecorded low 0.14-second `suction-1.wav` hit is used for every combo count and allowed to end naturally. Collections during playback are dropped before scheduling audio work, without pause/seek/play or changing pitch. Only a fresh collection after playback finishes can start the next hit. Simultaneous collections share one hit; there is no backlog, automatic loop or idle watchdog. The generic cooldown remains intact. This reduces media restarts compared with per-frame interruption; actual iPhone verification is still required. Visual quality is unchanged. Growth/vacuum sound methods are no-ops for this device comparison; no audio elements are loaded for them. The two-SFX cap and clear/timeup priority remain. OFF/background/pause/results cancel pickup playback and queued frames immediately. Scores and combo counting are unaffected.
Audibility adjustment: pickup peak is approximately 6.3 dB higher than the initial migration. With these media volumes applied, the worst-case absolute peak sum is 0.20 + 2 × 0.32 × 0.70 = 0.648. Actual device/recording output remains subject to device verification.
Pickup startup protection: intervening pickups are dropped while play is pending or the hit is playing, without queued backlog. A subsequent pickup may replace a start stuck for at least 1500 ms. A single delayed hit can finish naturally, with no timer cutting it off before sound begins. Rejection does not retry every frame, and token checks ignore cancelled requests' late completion. Unit tests cover 100 ignored mid-hit collections, fresh post-end hits, pitch changes, delayed/rejected/stuck starts and lifecycle. The browser test verifies no active playback interruptions and a natural end for every started hit; it also delays one start by 350 ms to check actual media progress through the complete short file.
SUN BONUS pickup override: while the collaboration event is running (entering/active/ending), the first eligible collection triggers `sun-pickup.wav`, a 0.46-second three-pop burst baked into one file. Later collections can trigger it at most once every 3000 ms. There is no repeating timer: no collection means no new sound. Mode transitions respect any still-playing pickup instead of interrupting it. The bonus sound uses the same pickup lane, 0.70 volume and 0.32 peak, so the two-SFX cap is unchanged. OFF/background/results reset the bonus audio state. Tests verify interval boundaries, idle silence, normal-mode restoration and actual browser playback; Safari performance still needs device verification.
Pickup timbre: each hit retains a 12 ms body before a gentler decay, with a quiet, short upper chime baked into the same WAV. Peak 0.32 and media volume 0.70 are unchanged. RMS is approximately 0.086-0.087, with a 20 ms quiet tail; tests guard average level, peak and the tail. Confirm pickup clarity alongside BGM on iPhone.
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

## Simplified-cue iPhone comparison

Normal suction is fixed to `suction-1.wav`. Growth and vacuum methods remain no-ops, preserving gameplay and visuals. SUN BONUS uses the trimmed theme and suppresses pickups. Four SFX media elements remain, plus normal BGM and the lazily prepared bonus theme. Unused source effects and Finder metadata files were moved outside the repository for recovery. Audio generation no longer recreates removed effects, and the build allowlist prevents obsolete effects from being distributed. Keep diagnostics, tests, source art and store screenshots for maintenance and release work.
