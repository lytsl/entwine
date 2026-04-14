CREATE TABLE `issue` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`rank` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync` (
	`id` integer PRIMARY KEY,
	`model_name` text NOT NULL,
	`model_id` text NOT NULL,
	`action` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sync_model_idx` ON `sync` (`model_name`,`model_id`);