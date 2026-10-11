# Newsdesk implementation

Full-stack editorial application using React/Vinext, Cloudflare D1 and R2, and Sites sign-in.

## Implemented

- Separate city workspaces; owner/editor/publisher/viewer authorization on server operations.
- ZIP and loose image imports with CSV/TXT captions, aliases, multiline quoted Unicode fields, labelled TXT blocks, manual image matching, row edits and duplicate-caption indicators.
- Persistent asset library (images/PDFs), editable draft content, source evidence, prior text versions, approved-version tracking, and bulk caption edits.
- Template poster preview and browser-rendered 1080×1080 JPEG downloads; attach a rendered design as the publication asset. Existing imported posters are preserved.
- Grid/list views, search/category/status filtering, bulk approval, multi-city draft copying, delete protection for remote deliveries.
- Endpoint-inclusive schedule distribution in IST; calendar and agenda; local submission pause.
- CSV+ZIP export and re-import. CSV is our application's format, not a promised native Business Suite importer.
- Team role grants, workspace activity, brand settings, workflow analytics.
- Facebook Page-token connection with AES-GCM encryption; native photo scheduling, explicit immediate publishing, cancellation, readback and outcome-unknown handling. No blind retries.
- Provider-neutral AI service adapter for extraction and caption drafting; unverified output always enters editorial review.

## Integration boundaries

Live Facebook actions require a valid app/Page configuration and server secrets; no live API verification has been performed without credentials. The release includes Page-token onboarding and Facebook OAuth with expiring single-use state and Page selection. Both require live validation against the configured app. Native scheduling executes on Meta once accepted; saved local plans do not automatically submit themselves.

The built-in Gemini adapter needs GEMINI_API_KEY and a supported GEMINI_MODEL. The optional alternative AI_SERVICE_URL must implement the contract in public/api-requirements.txt; it is a bridge, not an arbitrary vendor API URL. See [the official generateContent reference](https://ai.google.dev/api/generate-content). Live quality has not been verified without credentials.

Reach/impression metrics, automatic best-time optimization, Instagram/Reels, comment replies, billing, push/email notifications, and a full Canva-style freeform editor are outside this implementation. The research report marked these as later-phase features; they are not simulated in the product.

## Verification

- `node --test tests/domain.test.mjs`: parser, scheduling, timezone and export invariants.
- `node node_modules/typescript/bin/tsc --noEmit`: strict TypeScript check.
- Build and browser/API integration checks are recorded after execution.

## Data handling

All primary records live in D1; files live in R2. Local storage is not the database. Access is authenticated and workspace-scoped. Writes carry optimistic revision checks. Members need both site access and a workspace role. Imported text and provider output never execute as HTML.

Secrets are server-only. Never commit .env files, Page tokens or service keys. The source source helper owns publishing and uses credentials through stdin only.

Facebook engagement counts (reactions, comments, shares) have a read-only API adapter. Missing values are not reported as zero.
