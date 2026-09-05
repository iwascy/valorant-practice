# Vandal Reference Audio

Source: [Valorant Weapon Vandal](https://tuna.voicemod.net/sound/dbd907e7-0d36-40f7-a6d2-68b7f0e83fa0), uploaded by **yayiyi94** to Voicemod Tuna. The source describes the recording as "Sound of vandal firing." Retrieved 2026-09-05.

Source player URL: https://us-tuna-sounds-files.voicemod.net/dbd907e7-0d36-40f7-a6d2-68b7f0e83fa0.mp3

Original: 13.871-second, 44.1 kHz stereo MP3. The first three isolated transients were selected; the later burst and automatic-fire sections were excluded. This is a community reference recording, not an authenticated current-version asset supplied by Riot.

| File | Decoded source start | Duration | SHA-256 |
| --- | --- | --- | --- |
| shot-1.wav | 1.0617 s | 0.82 s | a7efb4fcc11d18a4296e10c8cfebe05ceb1588504c8be1b5202d2e6ea2dac1ae |
| shot-2.wav | 2.8435 s | 0.82 s | 1fb54d4c7576f4721bd33fa9281c9202d2714e1c0bea1fd7a78a3a2da6b5389e |
| shot-3.wav | 4.7433 s | 0.82 s | 930217888dfc4961bafcf8a9c1bba0a97962a595a78a24be205a2dca6c13725f |

Processing: FFmpeg decoded-sample `atrim` (start sample is floor(start seconds * 44100), length 36162 samples), `asetpts=PTS-STARTPTS`, mono downmix, gain 2.6, 0.3 ms fade-in, 100 ms fade-out starting at 720 ms, 16-bit PCM WAV. No pitch shifting or time stretching. Clips alternate without immediate repetition. The complete original recording is not bundled.

Original MP3 SHA-256: `3c5f73cf8a48668dca3085dacf440dc6e2456a298a1a8a854200d8ae9a19f942`.

Rights: underlying VALORANT sound effects belong to Riot Games and their respective rights holders. The community download page does not establish a redistribution license; these reference excerpts are included for this local fan-training prototype and are not covered by the code's ISC metadata. Public distribution requires appropriate rights review or replacement with cleared recordings. The original procedural fallback in `src/vandal-sound.ts` is available independently of these reference clips.
