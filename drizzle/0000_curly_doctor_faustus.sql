CREATE TABLE `cleanup_previews` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`operation` text NOT NULL,
	`message_ids_json` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` text
);
--> statement-breakpoint
CREATE INDEX `cleanup_previews_owner` ON `cleanup_previews` (`owner_id`);--> statement-breakpoint
CREATE TABLE `life_state` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`state_json` text NOT NULL,
	`version` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mailbox_accounts` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`encrypted_refresh_token` text NOT NULL,
	`email` text NOT NULL,
	`scopes` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mailbox_audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`operation` text NOT NULL,
	`count` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mailbox_audit_owner` ON `mailbox_audit` (`owner_id`);--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oauth_states_owner` ON `oauth_states` (`owner_id`);