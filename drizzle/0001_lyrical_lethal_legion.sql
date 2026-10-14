CREATE TABLE `mailbox_oauth_clients` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`encrypted_client` text NOT NULL,
	`updated_at` text NOT NULL
);
