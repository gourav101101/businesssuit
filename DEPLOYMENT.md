# Newsdesk: accounts and online deployment

## Use locally now

Open http://127.0.0.1:5173/setup in your existing preview session. Create your owner account with a unique password of at least 12 characters. Existing local workspaces, connections and scheduled posts transfer to this account. Once created, temporary preview identity no longer bypasses login. `/account` changes your password and invalidates other sessions. There is no public registration.

Run `npm run dev` and, in a separate terminal, `npm run queue`. The runner uses CRON_SECRET independently of browser login. Keep both running for locally queued submissions and monitoring. Posts already confirmed as scheduled on Facebook are handled by Meta.

## Before launching on a domain

This app uses Cloudflare Workers, D1 and R2; it is not a static website. Public hosting has not been deployed or verified.

1. Back up and migrate the local D1 database AND R2 objects. Copying code alone does not transfer posts or media. Preserve TOKEN_ENCRYPTION_KEY exactly so existing Page tokens remain decryptable. Store backups and encryption keys securely.
2. Set AUTH_MODE=password (also the production default). Never expose the development server. AUTH_MODE=sites is only for the trusted Sites authentication proxy, not ordinary hosting.
3. Store META_APP_ID, META_APP_SECRET, META_LOGIN_CONFIG_ID, META_API_VERSION, TOKEN_ENCRYPTION_KEY and CRON_SECRET as server secrets. Generate separate random 32-byte secrets for CRON_SECRET and BOOTSTRAP_TOKEN. Never put secrets in client-visible variables.
4. Use HTTPS. On a fresh database `/setup` requires BOOTSTRAP_TOKEN; remove that secret after creating the first owner. Prefer creating the owner locally and migrating the database so existing workspace ownership travels with it.
5. Apply the SQL migrations in drizzle/ in order to a fresh database. Existing databases must apply only missing migrations. Auxiliary auth/monitoring tables are also created idempotently by the app.
6. Bind production D1 as DB and R2 as BUCKET. Run `npm run build`; use the generated Worker configuration as a starting point, replacing placeholder resource bindings before deployment.
7. In Meta, register https://YOUR-DOMAIN/api/facebook/callback as a valid OAuth redirect URI, configure the app domain, and check app mode, roles and permissions for the intended users. Reconnect each Page on the final domain.
8. Configure a trusted scheduler to POST https://YOUR-DOMAIN/api/jobs at least every minute with Authorization: Bearer <CRON_SECRET>. Store this as a protected header, never in the URL. Alternatively run `npm run queue` on an always-on server with NEWSDESK_URL and CRON_SECRET environment variables. A closed browser cannot run the local queue.
9. Verify login, rejected anonymous API access, media, reconnect, timezone and one reviewed future test post in both Facebook and Business Suite before bulk use. Monitor scheduler failures and configure recurring database/media backups.

## Facebook access

Integrations displays connection health and available token/data-access expiry. The runner checks connected Pages, caches checks for up to six hours and skips confirmed invalid connections. Tokens with no fixed expiry can still be revoked by Meta or permission/account changes. Reconnection requires the owner's Facebook consent; permanent automatic renewal cannot be promised. OAuth exchanges the user token and stores encrypted Page tokens. Never share tokens in chat or source files.

## Password recovery and team access

There is no email reset provider configured. Keep the owner password in a password manager. An administrator can run `node scripts/password-recovery.mjs owner@example.com` to generate an ignored recovery SQL file after a hidden password prompt. Apply work/password-recovery.sql to the intended D1 database using Wrangler, then delete it. The script does not connect to production or change any database itself. Resetting invalidates that account's sessions.

Password login currently provisions the first owner only. Workspace role checks remain enforced; self-hosted team invitations and additional account provisioning are not implemented yet. Do not enable public registration as a workaround.

## Preserved data

Four QA workspaces were archived in workspace_archives, not permanently deleted. Their assets were retained for recovery. The four real connected workspaces and existing scheduled content were preserved. New owners on an empty database start with an empty newsroom instead of sample Pages.
