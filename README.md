# Newsdesk

A persistent editorial workspace for local Hindi news. Designed around the files you already receive from Meta AI: **images in ZIP, captions and schedule in CSV or TXT**.

## Use the application

1. Select your city workspace.
2. Open Import content; add the ZIP and CSV/TXT or paste the caption text.
3. Match images, check the parsed rows, and import drafts.
4. Edit stories and evidence in the library. Keep existing posters or render a template in the poster studio.
5. A publisher approves each current version. Any edit resets approval.
6. Plan approved posts in IST. Connect a Page and submit native schedules for unattended Facebook delivery.
7. Verify outcomes and export portable content packs whenever needed.

## Start locally

Requires Node 22.13+ and npm. Install with `npm install`, then generate/apply local D1 migrations using the Sites workflow. Start with `npm run dev` and visit the printed local URL (normally http://127.0.0.1:5173).

The portable development server provides local sign-in at `/signin-with-chatgpt?return_to=/`. Hosted access uses Sites authentication; the local mock is not part of the production build.

## API setup

See [the API checklist](public/api-requirements.txt) and [.env.example](.env.example). Do not put keys in source code or browser settings.

- Existing Meta AI ZIP/CSV/TXT imports need no AI API.
- Facebook publishing needs a supported Graph API version, encryption key, and Page authorization. For OAuth, also configure a Meta App ID/secret and exact callback URL.
- AI extraction has a built-in Google Gemini adapter: configure GEMINI_API_KEY and an enabled GEMINI_MODEL with image/PDF and JSON support. A custom provider endpoint is also supported as an alternative.
- Sites supplies D1, R2 and authentication for the hosted version.

## Development checks

```sh
node --test tests/domain.test.mjs
node node_modules/typescript/bin/tsc --noEmit
npm run build
```

`tests/browser-check.mjs` uses installed Windows Chrome against a local development server. It creates isolated QA workspaces and exercises the ZIP import, authorization, persistence, approval, scheduling, city copies, export and responsive screens. These tests never post to Facebook.

See [IMPLEMENTATION.md](IMPLEMENTATION.md) for integration boundaries and verification notes. Live Meta/AI behavior requires credentials and a controlled integration test.
