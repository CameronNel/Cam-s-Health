CREATE TABLE `ai_connections` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`encrypted_api_key` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_daily_usage` (
	`owner_id` text NOT NULL,
	`usage_day` text NOT NULL,
	`request_count` integer NOT NULL,
	PRIMARY KEY(`owner_id`, `usage_day`)
);
