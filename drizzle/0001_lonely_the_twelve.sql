CREATE TABLE `oauth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL
);
