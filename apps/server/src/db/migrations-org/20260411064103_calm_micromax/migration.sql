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
CREATE TABLE `team` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`slug` text NOT NULL,
	`metadata` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team_member` (
	`id` text PRIMARY KEY,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer,
	CONSTRAINT `fk_team_member_team_id_team_id_fk` FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `sync_model_idx` ON `sync` (`model_name`,`model_id`);--> statement-breakpoint
CREATE INDEX `teamMember_teamId_idx` ON `team_member` (`team_id`);--> statement-breakpoint
CREATE INDEX `teamMember_userId_idx` ON `team_member` (`user_id`);