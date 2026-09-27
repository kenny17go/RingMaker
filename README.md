# RingMaker V1.0.6

A mobile-first, local-only PWA to trim personal audio into a <=29-second custom iPhone ringtone.

## Deploy to GitHub Pages

1. Create a new GitHub repository named `ringmaker`.
2. Upload **all files at the root of this folder** (not the enclosing ZIP folder).
3. GitHub repository > Settings > Pages > Deploy from branch > main / (root).
4. Open `https://YOUR_USERNAME.github.io/ringmaker/` in iPhone Safari > Share > Add to Home Screen.

For local development: `python3 -m http.server 8000` from this folder; open `http://localhost:8000`.

## Features

- Load locally selected MP3/M4A/WAV/other audio files supported by Safari's audio decoder; no upload.
- Display waveform; trim start and length (maximum 29.0s), fade in/out, adjust loudness and preview using an iOS-native HTMLAudioElement WAV clip (avoids suspended AudioContext preview playback).
- Safari MediaRecorder AAC/MP4 -> M4A, then Web Share file or download. Capability is detected at runtime. **Runs in real time; keep Safari foreground during encoding.** Browser device support varies; test on physical iPhone.
- Export PCM WAV backup universally (but iOS 26 direct Use as Ringtone expects MP3/M4A).
- YouTube URL embedded preview only; never downloads or rips media.
- Installable PWA with offline application shell; audio and YouTube embeds are not cached.

## Set ringtone (iOS 26)

Save M4A into Files -> long-press file -> Share -> Use as Ringtone. Webpages cannot programmatically change the system default ringtone.

## Known constraints

- M4A export requires `MediaRecorder.isTypeSupported('audio/mp4')` (or AAC profile variant) and `AudioContext.createMediaStreamDestination()` in the current browser. If unsupported, save WAV backup and use a separate trusted converter or GarageBand.
- MediaRecorder uses real-time capture and may insert a small leading/trailing codec delay; the 29-second cap leaves margin below 30 seconds. Check final file on the device.
- Certain DRM-protected tracks cannot be imported or decoded.
- The YouTube embedded player may block some videos or need a network connection. No YouTube media extraction.
- Files are processed in memory; very large songs may exhaust Safari memory. Use ordinary compressed audio of reasonable size.

## Privacy

No analytics, third-party audio upload, servers or account. Entering a YouTube URL loads YouTube's embed from Google's domain, subject to its privacy policy.

## Versions

V1.0.6 in homepage, README, manifest, service worker, ZIP filename.


## V1.0.6
- Touch-friendly two-endpoint waveform selection; handles enforce 1–29 seconds.
- Native iPhone audio segment preview with seekable timeline and ±5-second skip controls; output remains untouched.
- Export sharing button text: 儲存到 iPhone. iOS requires selecting Save to Files, then Use as Ringtone from Files.
- Versioned assets and service-worker cache.

## V1.0.6
- Fix duplicate `preview()` declaration that silently replaced the seekable player with old code.
- Sync elapsed time, slider, and waveform playhead on `timeupdate` plus foreground animation/100ms timer while playback is active.
- Add visible playback time below waveform and progress highlighting.

## V1.0.6
- Large countdown from the selected segment duration (29 seconds for the default).
- Time-based progress bar starts with actual MediaRecorder recording; it shows a separate encoding state after audio playback finishes.
- Completion displays the existing Save to iPhone action; failures reset the progress panel.
