import {sqliteTable, text, integer, index, primaryKey} from 'drizzle-orm/sqlite-core';

export const aiConnections = sqliteTable('ai_connections', {
  ownerId: text('owner_id').primaryKey().notNull(),
  encryptedApiKey: text('encrypted_api_key').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const aiDailyUsage = sqliteTable('ai_daily_usage', {
  ownerId: text('owner_id').notNull(),
  usageDay: text('usage_day').notNull(),
  requestCount: integer('request_count').notNull(),
}, table => [primaryKey({columns: [table.ownerId, table.usageDay]})]);

export const lifeState = sqliteTable('life_state', {
  ownerId: text('owner_id').primaryKey().notNull(),
  stateJson: text('state_json').notNull(),
  version: integer('version').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const mailboxAccounts = sqliteTable('mailbox_accounts', {
  ownerId: text('owner_id').primaryKey().notNull(),
  encryptedRefreshToken: text('encrypted_refresh_token').notNull(),
  email: text('email').notNull(),
  scopes: text('scopes').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const mailboxOauthClients = sqliteTable('mailbox_oauth_clients', {
  ownerId: text('owner_id').primaryKey().notNull(),
  encryptedClient: text('encrypted_client').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const oauthStates = sqliteTable('oauth_states', {
  stateHash: text('state_hash').primaryKey().notNull(),
  ownerId: text('owner_id').notNull(),
  redirectUri: text('redirect_uri').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, table => [index('oauth_states_owner').on(table.ownerId)]);

export const cleanupPreviews = sqliteTable('cleanup_previews', {
  tokenHash: text('token_hash').primaryKey().notNull(),
  ownerId: text('owner_id').notNull(),
  operation: text('operation').notNull(),
  messageIdsJson: text('message_ids_json').notNull(),
  expiresAt: integer('expires_at').notNull(),
  usedAt: text('used_at'),
}, table => [index('cleanup_previews_owner').on(table.ownerId)]);

export const mailboxAudit = sqliteTable('mailbox_audit', {
  id: integer('id').primaryKey({autoIncrement: true}).notNull(),
  ownerId: text('owner_id').notNull(),
  operation: text('operation').notNull(),
  count: integer('count').notNull(),
  createdAt: text('created_at').notNull(),
}, table => [index('mailbox_audit_owner').on(table.ownerId)]);
