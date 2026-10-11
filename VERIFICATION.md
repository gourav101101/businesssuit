# Verification

- 10 domain tests passed: quoted/multiline Hindi CSV, TXT parsing, ambiguous text preservation, time normalization, 32-slot spacing, invalid windows, IST-to-UTC conversion and caption export round trip.
- 4 AI adapter contract tests passed: inline PDF construction, separation of instructions and untrusted input, rejection of empty/malformed output, and preservation of structured Hindi drafts.
- Strict TypeScript check passed.
- Production build passed; a final build is run again before packaging source changes.
- 13 browser/API checks passed using local D1/R2 records and headless Chrome: authenticated overview, unauthenticated API denial, ZIP import, revision conflict rejection, approvals, schedules, edit history, honest disconnected publishing state, workspace isolation, city copies, ZIP export, all navigation screens, mobile fit, and no uncaught runtime exceptions.
- Desktop and 390px mobile screenshots inspected. Test reports and screenshots are local-only under ignored tests/artifacts/.

No live Facebook publish, OAuth approval, token renewal, AI extraction, or engagement-metric call was verified because credentials were intentionally deferred by the user. A configured interface or adapter is not evidence that an external service has been tested.
