# clean-baileys — reportSpam fork of @whiskeysockets/baileys 7.0.0-rc14

**Status: STAGING ONLY — not published, not pushed, not deployed anywhere.**
Built 2026-11-24/25 PKT for BOT 2 (ITACHI UCHIHA). The main agent reviews and
publishes/deploys this; nothing here is live.

## What this is

Upstream `@whiskeysockets/baileys` **7.0.0-rc14** (fresh from the npm registry,
tarball kept here as `rc14.tgz`, 977K) plus ONE additive feature: a
`reportSpam(jid, options?)` socket method that reports a chat as spam to
WhatsApp. It exists because the user was scammed $200 and wants to report the
scammer's number; rc14 has no report API (verified 3× from the tarball), and
every fork that has one (felicia/vamx/hanzo) belongs to the same confirmed
malicious "PhantomSub" family (GHSA-h8f3-w3fx-c43w) — so we built our own
clean version instead of swapping to them.

**Nothing was taken from any fork.** The function was written fresh from the
public protocol description (IQ stanza: tag `iq`, xmlns `spam`, to
`S_WHATSAPP_NET`, type `set`) and from rc14's own node patterns
(blocklist `list`/`item` nodes, `query()` + `assertNodeErrorFree`).

## Changes (full diff: `DIFF-vs-rc14.txt` — 11 files, +167/−2 lines)

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
the single report IQ stanza. `package.json` and `WAProto/` are byte-identical
to rc14. Auth-state format is untouched, so existing sessions load as-is —
**no re-pairing by design**.

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

## Verification done (all local, no real WhatsApp traffic)

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
- `bot2_test_results.txt`, `bot2_test_results_pristine.txt` — BOT 2 suites.
- `README-CLEAN-BAILEYS.md` — this file.
