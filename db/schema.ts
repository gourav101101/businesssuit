// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const workspaces = sqliteTable('workspaces', { id: text('id').primaryKey(), owner: text('owner').notNull(), name: text('name').notNull(), data: text('data').notNull(), revision: integer('revision').notNull().default(0) });
export const members = sqliteTable('members', { id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(), email: text('email').notNull(), role: text('role').notNull() });
export const assets = sqliteTable('assets', { id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(), name: text('name').notNull(), type: text('type').notNull(), size: integer('size').notNull(), createdAt: text('created_at').notNull() });
export const events = sqliteTable('events', { id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(), actor: text('actor').notNull(), action: text('action').notNull(), createdAt: text('created_at').notNull() });
export const connections = sqliteTable('connections', { workspaceId: text('workspace_id').primaryKey(), pageId: text('page_id').notNull(), pageName: text('page_name').notNull(), encryptedToken: text('encrypted_token').notNull() });
export const oauthSessions = sqliteTable('oauth_sessions', { id: text('id').primaryKey(), userId: text('user_id').notNull(), workspaceId: text('workspace_id').notNull(), payload: text('payload').notNull(), expiresAt: integer('expires_at').notNull() });
