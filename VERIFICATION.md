# Verification

- 10 domain tests passed: quoted/multiline Hindi CSV, TXT parsing, ambiguous text preservation, time normalization, 32-slot spacing, invalid windows, IST-to-UTC conversion and caption export round trip.
- 4 AI adapter contract tests passed: inline PDF construction, separation of instructions and untrusted input, rejection of empty/malformed output, and preservation of structured Hindi drafts.
- Strict TypeScript check passed.
- Production build passed; a final build is run again before packaging source changes.
- 13 browser/API checks passed using local D1/R2 records and headless Chrome: authenticated overview, unauthenticated API denial, ZIP import, revision conflict rejection, approvals, schedules, edit history, honest disconnected publishing state, workspace isolation, city copies, ZIP export, all navigation screens, mobile fit, and no uncaught runtime exceptions.
- Desktop and 390px mobile screenshots inspected. Test reports and screenshots are local-only under ignored tests/artifacts/.

On 11 October 2026, direct Page-token retrieval, encrypted connection storage and live connection health passed for Indore Ki Baat, Ujjain AI, Bhopal Wale and Dewas Se Hai. Dewas received its own local workspace. Local Graph version and encryption settings were loaded from ignored .dev.vars. This validates local Page connections, not hosted deployment or post delivery.

The Meta App Secret was loaded locally. A fresh User Token was successfully exchanged for a long-lived User Token (Meta returned 5,177,938 seconds, approximately 60 days). Page tokens were retrieved from that exchanged token, encrypted and stored for all four Pages, then each connection passed live health verification. This confirms token exchange and connection health; it does not establish a guaranteed Page-token lifetime.

No live Facebook publish, application OAuth callback, AI extraction, or engagement-metric call was verified. A connection health check is not evidence of successful post delivery. Server login flags are enabled locally; the full browser OAuth flow and hosted deployment still require verification.

## Account and deployment readiness verification

- Archived four exact QA workspaces; preserved all four connected real workspaces and all 32 Dewas scheduled posts with remote IDs, plus 64 assets.
- Added first-owner setup, password login/logout/change, hashed server sessions, same-origin authentication requests, rate limiting, and server-administrator password recovery. Production defaults to password authentication; temporary local identity stops after setup.
- Added cached token/data-access health and authenticated background jobs independent of browser identity. Live jobs endpoint returned 200 for all four Pages; anonymous workspace and jobs requests returned 401. All four Meta connections returned valid on inspection.
- Added Facebook OAuth pagination and granular-scope fallback for granted Pages missing from me/accounts. This fallback is compiled but still needs a real interactive reconnect to verify end to end.
- 23 automated tests passed; TypeScript and production build passed. Isolated browser verified owner setup at 390px and 1440px with no horizontal overflow and rejected login through the real Worker password-hashing runtime. No real owner account was created during testing.
- Public hosting is not deployed. Owner must choose their password at /setup. Follow DEPLOYMENT.md for HTTPS, resource/data migration, Meta redirect registration, cron and backup configuration. Email recovery and self-hosted team account provisioning remain outside the current owner-login implementation.

## Bulk controls verification

- Added location caption lines and optional native Place IDs, category, literal find/replace, prefix/footer and per-story preview. Metadata survives CSV/TXT imports and ZIP export. Native tagging is advanced and has not been live-published to Meta during testing.
- Six dedicated tests passed: atomic remote protection, approval/history behavior, footer idempotency, literal text edits, metadata round-trip and outgoing scheduled-feed/immediate-photo payloads. Existing 23 tests also passed.
- TypeScript and production build passed. Read-only browser checks at 390px and 1440px verified the bulk dialog fits and protects existing remote posts. No existing posts were edited or published in testing.
- Competitor research and next-release priorities: BULK-CONTROLS.md.

## All Pages planner and saved presets

- `/planner` shows authorized workspaces together, connected destination names/IDs, queue and pause state, date/status/workspace filters, same-workspace time-collision notices and CSV export. One-, seven- and thirty-day agenda views use IST.
- Content library > select stories > Bulk edit now supports up to 20 named presets per workspace. Save or remove presets without modifying posts. Loading replaces the preview settings; applying still requires explicit Save changes. Find-and-replace is intentionally not persisted in reusable presets.
- Two new tests passed: preset validation/save/delete preserves scheduled posts; planner access is restricted and excludes caption/token payloads. TypeScript and production build passed. Read-only browser checked four real workspaces at 390px and 1440px and the updated bulk dialog.

## Login entry correction

Opening the site now requires a real Newsdesk session even during local development. The old preview cookie cannot open workspaces or scheduling APIs. `/login` displays the first-owner form inline when no account exists; later it displays normal email/password sign-in. The loopback-only setup marker permits first-account setup, not newsroom access. Production setup still requires the server bootstrap secret. The owner chooses their own password; no credentials were created by the assistant.

## TXT paragraph import fix (12 October 2026)

Structured TXT now uses Title/Headline or numbered Post boundaries instead of blank lines. Caption paragraphs, disclaimer and hashtag lines stay together; metadata at the end stays attached. Checked the supplied user attachment: exactly 30 stories, all filenames/sources/times retained, 07:30–13:18, no parser warnings. Added three regression tests; 22 import/bulk/domain tests passed. Existing saved posts were not modified. Rebuild the import preview from the original file to use the corrected parser.

## Bulk scheduling progress correction

Bulk Facebook scheduling now opens a persistent progress dialog after queue creation instead of closing immediately. It counts only selected posts with remote IDs and scheduled/published status as confirmed. While open it advances the existing protected queue and refreshes status; concurrent worker claims remain protected by revision checks. Errors, stopped queues and local pause are displayed without automatic resubmission. Closing the dialog does not clear the saved queue; background processing still requires the server/runner. Existing queued posts were not submitted as part of verification. TypeScript and all three queue concurrency/reconciliation tests passed.

## Automatic screen updates

Workspace data now refreshes every five seconds across sections, with no full-page reload. Reads pause during edits, modals, brand settings and local mutations so forms and approval revisions are not overwritten. All Pages planner refreshes automatically too. Requests do not overlap, hidden tabs stop polling, focus/online events resume checks, and cleanup aborts stale requests. A footer displays last update time and connection failures. This reads Newsdesk records; Meta verification still depends on the queue worker. Targeted live-data lifecycle test passed.

### Manual section refresh (2026-10-12)
Replaced five-second workspace/planner polling and monitor polling with explicit Refresh controls. Requests update React data without browser navigation or resetting filters and selections. Editor/modal activity disables workspace refresh; brand drafts are preserved. Planner and monitor load on entry, then refresh on demand. Scheduling progress remains live during submissions. Manual-fetch regression test and TypeScript check passed; no live Facebook mutations performed.
