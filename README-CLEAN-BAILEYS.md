# clean-baileys — reportSpam + sound-sticker fork of @whiskeysockets/baileys 7.0.0-rc14

**Status: PUBLISHED — repo SY3D-ME3R/ITACHI-BAILEYS (public), live on BOT 2 (ITACHI UCHIHA) since 2026-11-25; sound-sticker support added 2026-11-28.**
Built 2026-11-24/25 PKT for BOT 2 (ITACHI UCHIHA).

## What this is

Upstream `@whiskeysockets/baileys` **7.0.0-rc14** (fresh from the npm registry,
tarball kept here as `rc14.tgz`, 977K) plus TWO additive features:

1. a `reportSpam(jid, options?)` socket method that reports a chat as spam to
   WhatsApp. It exists because the user was scammed $200 and wants to report the
   scammer's number; rc14 has no report API (verified 3× from the tarball), and
   every fork that has one (felicia/vamx/hanzo) belongs to the same confirmed
   malicious "PhantomSub" family (GHSA-h8f3-w3fx-c43w) — so we built our own
   clean version instead of swapping to them.
2. **sound stickers (2026-11-27):** `sendSoundSticker(jid, { sticker, audio,
   seconds? })` plus the `stickerAudio` branch of `generateWAMessageContent`
   and the `addSoundSha256ToStickerWebP` EXIF helper. It exists because the
   user ordered BOT 2's `.s` command upgraded: reply to a video → a sticker
   WITH audio; rc14's `StickerMessage` has no audio field, so the audio could
   never go on the wire without a proto change. The mechanism was ported from
   AunuBaileys 2.7.0/2.8.0 (reference unpacked at /tmp/aunu/package during the
   build) — mechanism only, no other Aunu code, no version/dep changes.

**Nothing was taken from any fork.** The function was written fresh from the
public protocol description (IQ stanza: tag `iq`, xmlns `spam`, to
`S_WHATSAPP_NET`, type `set`) and from rc14's own node patterns
(blocklist `list`/`item` nodes, `query()` + `assertNodeErrorFree`).

## Changes (full diff: `DIFF-vs-rc14.txt` — 27 files, +505/−6 lines)

### reportSpam (11 files, +167/−2)

| File | Change |
|---|---|
| `lib/Types/Chat.js` | Added frozen `SPAM_FLOWS` (`OverflowMenuReport: 'overflow_menu_report'`) |
| `lib/Types/Chat.d.ts` | `SPAM_FLOWS` + `SpamFlow`, `ReportSpamOptions`, `ReportSpamResult` types |
| `lib/Socket/chats.js` | `buildSpamReportNode()` (exported helper), `reportSpamWithQuery()` (exported, testable core), `reportSpam` socket method (one-line delegate), added to socket return object |
| `lib/Socket/chats.d.ts` | `buildSpamReportNode` + `reportSpamWithQuery` declarations, `reportSpam` method |
| `lib/Socket/{business,communities,groups,messages-recv,messages-send,newsletter,index}.d.ts` | `reportSpam` method declaration (same pattern rc14 uses for `updateBlockStatus`) |

Nothing else changed: no auth/creds/session/connection/reconnect/pairing
code touched, no newsletter code touched, no new dependencies, no preinstall
scripts, no extra network calls. The only traffic the new code can cause is
the single report IQ stanza.

### Sound stickers (16 files + 1 new test file, +338/−4)

| File | Change |
|---|---|
| `WAProto/WAProto.proto` | `StickerMessage` gains `optional AudioMessage audioMessage = 26;` |
| `WAProto/index.js` | **HAND-PATCHED** (6 edits: prototype field, `_audioMessage` oneof, encode tag 210, decode case 26, fromObject, toObject) — see note below |
| `WAProto/index.d.ts` | Regenerated with protobufjs@7.4.0 — diff is exactly 4 lines (the two `audioMessage` declarations) |
| `lib/Utils/messages.js` | `isWebPBuffer`, `webpCanvasSize`, `buildSoundSha256Exif`, exported `addSoundSha256ToStickerWebP` (EXIF tag 0x5741, VP8X EXIF flag, VP8X synthesis for plain VP8/VP8L), local `soundStickerMediaToBuffer` (capped read, Boom 413 past cap), and the `stickerAudio` branch in `generateWAMessageContent` (caps: sticker 5MB, audio 16MB) |
| `lib/Utils/messages.d.ts` | `addSoundSha256ToStickerWebP` declaration |
| `lib/Socket/messages-send.js` | `sendSoundSticker` socket method (thin wrapper over `generateWAMessage` + `relayMessage`) |
| `lib/Socket/messages-send.d.ts` (+ `{business,chats,communities,groups,messages-recv,newsletter,index}.d.ts`) | `sendSoundSticker` method declaration (same pattern rc14 uses for `sendMessage`) |
| `lib/Types/Message.d.ts` | Exported `SoundStickerOptions` type + `stickerAudio: SoundStickerOptions` member of `AnyRegularMessageContent` |
| `test_soundsticker_proto.mjs` | NEW — 17 proto round-trip tests (see Verification) |

**Why WAProto/index.js was hand-patched instead of regenerated:** the exact
flags in `WAProto/GenerateStatics.sh` were tried with `protobufjs-cli`
1.1.3 (installed in /tmp, never in this tree) and with protobufjs
7.6.6 / 7.5.6 / 7.4.0 / 7.3.2 / 7.2.6 / 7.2.3 / 7.2.0 / 7.1.0 — EVERY version
produced template drift vs the original generated file. The original has
BOTH `decode(r, l, e)` + `if (t === e) break;` AND "Virtual OneOf" comments;
no released protobufjs version has both (the `e` param was removed from
protobufjs's decoder before 7.1.0; the comments come from cli static.js).
Regenerating would have rewritten the whole 60k-line file with a different
generator's output. Instead the 6 field-26 edits were applied by hand,
mirroring AunuBaileys' generated `StickerMessage` field-26 fragments verbatim
(adapted to this fork's `$root.proto` namespace — Aunu uses `$root.waproto`;
Aunu's toObject quirk `d.audio = "audioMessage"` was NOT copied, the fork
correctly uses `d._audioMessage = "audioMessage"` like its own
`Message.toObject`). Backups of the pre-patch files were kept in /tmp during
the build. Consequence: `WAProto/index.js.map` is now stale for `index.js`
(debug-only artifact, left in place).

**Git-install fix (2026-11-25):** upstream's `package.json` carries
`"prepare": "npm run build"` (tsc) and `"prepack": "npm run build"`. When
npm installs a package from a git URL it runs `prepare`, and the build fails
there (no `src/` in the published tree, no `typescript` installed) — so a
plain `github:SY3D-ME3R/ITACHI-BAILEYS` install failed on the first try.
Both scripts are REMOVED in this fork (the only `package.json` difference
from rc14 besides nothing else); the shipped `lib/` is already built, so
nothing needs compiling at install time. Verified by a fresh
`npm install github:SY3D-ME3R/ITACHI-BAILEYS#<sha>` after the removal.

## How reportSpam works

```js
await sock.reportSpam('923001234567@s.whatsapp.net');
// → { jid, flow: 'overflow_menu_report', reported: true, node: <server IQ result> }
await sock.reportSpam(jid, { flow: 'custom_flow', source, subject, isKnownChat: false });
```

- Validates first (jid must decode to a real PN/LID user JID; flow must be a
  non-empty string) and throws `Boom` 400 **before any query** on bad input.
- Sends one IQ stanza and returns `{ jid, flow, reported: true, node }`.
- If the server rejects the stanza, it throws
  `Boom('reportSpam was rejected by the server')` — it never pretends success.
- It does **NOT block** the contact — call `updateBlockStatus(jid, 'block')`
  separately if blocking is wanted.

## How sendSoundSticker works

```js
await sock.sendSoundSticker('923001234567@s.whatsapp.net', {
    sticker: animatedWebpBuffer,   // animated WebP, <= 5MB (BOT 2 targets <= 900KB)
    audio: opusOggBuffer,          // Opus OGG, <= 16MB
    seconds: 3                     // optional; <= 6s for BOT 2's .s command
});
// → the full sent WAMessage (stickerMessage with nested audioMessage)
```

- `generateWAMessageContent({ stickerAudio })` resolves both media to bytes,
  takes `sha256(audio)`, injects `{"sound-sha256": "<hex>"}` into the WebP
  EXIF (TIFF tag 0x5741; synthesises a VP8X EXIF chunk if the WebP has none),
  uploads sticker (`isAnimated: true`) and audio (`audio/ogg; codecs=opus`)
  in parallel via `prepareWAMessageMedia`, then nests the uploaded
  `audioMessage` into the `stickerMessage` (field 26), with
  `isAnimated: true`, `isLottie: false`, `stickerSentTs: Date.now()`.
- `addSoundSha256ToStickerWebP(webp, sha256Hex)` is exported for callers that
  build the sticker themselves.
- Validation is honest, never fake: oversize sticker/audio throw `Boom` 413,
  a bad `seconds` value throws 400, missing audio throws — the branch never
  sends a "sound sticker" without the audio actually attached.
- The wire format (EXIF `sound-sha256` + field 26 nested `audioMessage`) is
  the one WhatsApp's own sound-sticker clients use (verified against the
  AunuBaileys reference implementation, which ships it).

## ⚠️ Uncertainty — read this before trusting it live

The exact child-node shape of the spam list node and the wire value of the
default flow are **best-effort reconstructions, NOT verified against a live
WhatsApp server**. The stanza shape (`iq`/`spam`/`set`) comes from the public
protocol description; the `list`/`item` child shape follows rc14's own
blocklist conventions; the `spam_flow` attribute name and the
`overflow_menu_report` value are our best reconstruction. The function is
built to fail honestly (throws on rejection), and `options.flow` lets the
caller override the flow string if the default proves wrong. **A live report
against a real number is the only proof it works end to end — that test has
NOT been done and can only be done by the user from a live session.**

Sound stickers: the field-26 wire format and the EXIF `sound-sha256` scheme
are **proven against the AunuBaileys reference implementation and by local
encode→decode round-trips (17/17), but NOT yet proven end to end against a
live WhatsApp client** — only a real `.s` send from a live BOT 2 session and
a real phone showing the sticker WITH a playable sound proves the client
renders it. That live test is still owed (fork push → BOT 2 pin update →
BOT 2 push → S01 deploy → his live `.s` test).

## Verification done (all local, no real WhatsApp traffic)

### reportSpam

- `node --check` on both changed `.js` files: PASS.
- `test_reportspam.mjs` (stubbed `query`): **26/26 PASS** — stanza shape
  (iq/spam/S_WHATSAPP_NET/set, jid inside), success result, server-rejection
  throws, query-failure propagates, invalid jid/flow throw before any query,
  LID jid accepted, c.us normalises to s.whatsapp.net.
- `test_socket_exposes.mjs` (real `makeWASocket` built offline): **7/7 PASS**
  — package loads, `SPAM_FLOWS` exported from root, socket exposes
  `reportSpam` as a function, `updateBlockStatus`/`fetchBlocklist`/`sendMessage`
  intact, exposed method validates before any query.
- `tsc --noEmit` on `lib/index.d.ts`: **0 new errors** (3 pre-existing errors
  identical on pristine rc14: `Bussines.d.ts` + 2× `whatsapp-rust-bridge`).
- BOT 2 re-check (`~/workspace/destroyer-silver`, patched lib via NODE_PATH):
  - `node --check` on all 129 command+lib `.js` files: **129/129 PASS**.
  - 52 existing `test_*.js` suites: **37 PASS, 15 FAIL — and the same 15 fail
    identically against pristine rc14** (results in `bot2_test_results.txt`
    and `bot2_test_results_pristine.txt`). Causes are pre-existing: stale
    tests requiring deleted command files (`./commands/calc`, `./commands/currency`,
    `./commands/onwa`, …), a missing `/tmp` fixture (`test_sticker_cmd`), and
    live-API failures (`test_aimlapi_video`, `test_aivideo_cmd`, `test_style2`).
    **Zero regressions from this patch.**
  - Boot test with patched lib (verified `require.resolve` → this tree,
    version 7.0.0-rc14, `SPAM_FLOWS` present): server listening, `GET /status`
    → 200 active JSON, `GET /` → bot JSON, no errors, still running at the
    25 s timeout. (One earlier boot attempt used v2's baileys 6.7.24 by
    mistake — `npm install` had deleted the test symlink; caught by the
    resolve check, symlink restored, boot re-run properly. Lesson: always
    assert `require.resolve` before trusting a NODE_PATH boot test.)

### Sound stickers (2026-11-27)

- `node --check` on every touched `.js` file (WAProto/index.js,
  lib/Utils/messages.js, lib/Socket/messages-send.js): PASS.
- `tsc --noEmit` on the 10 touched/related `.d.ts` files (all 8 socket
  `.d.ts`, messages.d.ts, Message.d.ts): **0 errors**.
- `test_soundsticker_proto.mjs`: **17/17 PASS** — field-26 wire tag 0xD2 0x01
  present in the encoded bytes, encode→decode preserves the nested
  `audioMessage` (mimetype, fileSha256, mediaKey, seconds=3, fileLength),
  toObject/fromObject round-trip intact, plain sticker without audio
  unaffected.
- `test_reportspam.mjs`: **26/26 PASS** (no regression).
- `test_socket_exposes.mjs`: **7/7 PASS** (no regression).
- End-to-end with the real BOT 2 `.s` command (destroyer-silver
  `test_soundsticker_cmd.js`, real ffmpeg/ffprobe, mock sock): **28/28 PASS**
  — (a) animated WebP, (b) EXIF `sound-sha256` == sha256(audio),
  (c) audio decodes as valid Opus OGG, (d) `stickerMessage` carries a nested
  `audioMessage`, (e) patched-WAProto round-trip preserves field 26,
  (f) pic path still yields a normal sticker with no audio, (g) no-audio
  video falls back to a plain animated sticker with an honest message;
  plus the 10s-video trim case (note + seconds ≤ 6). Full evidence in the
  build report; the BOT 2 suite comparison (63 tests) is recorded there too.

## Re-running the tests

```sh
cd ~/workspace/clean-baileys
npm install --ignore-scripts --no-save   # upstream deps only, ~2 min
node test_reportspam.mjs                 # 26 stub tests
node test_socket_exposes.mjs             # 7 socket tests
```

(`node_modules/` was removed after testing to keep this staging tree clean;
reinstall with the command above. Do NOT run plain `npm install` — the
package has a `preinstall` version-check script; `--ignore-scripts` skips it.)

## Files in this directory

- `lib/`, `WAProto/`, `package.json`, `LICENSE`, `README.md`,
  `engine-requirements.js` — the forked package (rc14 + patch).
- `rc14.tgz` — the pristine upstream tarball this was built from.
- `apply_patch.py` — the script that applied the patch (anchors asserted).
- `DIFF-vs-rc14.txt` — unified diff vs pristine rc14.
- `test_reportspam.mjs`, `test_socket_exposes.mjs` — the tests above.
- `test_soundsticker_proto.mjs` — the 17 sound-sticker proto round-trip tests.
- `bot2_test_results.txt`, `bot2_test_results_pristine.txt` — BOT 2 suites.
- `README-CLEAN-BAILEYS.md` — this file.
