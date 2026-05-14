CREATE TABLE `issue` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`team_id` text NOT NULL,
	`team_number` integer NOT NULL,
	`status_id` text NOT NULL,
	`assignee_id` text,
	`priority` integer NOT NULL,
	`labels` text,
	`project_id` text,
	`parent_id` text,
	`rank` text NOT NULL,
	`due_date` integer,
	CONSTRAINT `fk_issue_status_id_issue_status_id_fk` FOREIGN KEY (`status_id`) REFERENCES `issue_status`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_issue_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE SET NULL,
	CONSTRAINT `issue_parentId_fk` FOREIGN KEY (`parent_id`) REFERENCES `issue`(`id`) ON DELETE SET NULL,
	CONSTRAINT `issue_team_id_team_number_unique` UNIQUE(`team_id`,`team_number`)
);
--> statement-breakpoint
CREATE TABLE `issue_status` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`description` text,
	`type` text NOT NULL,
	`indefinite` integer DEFAULT false
);
--> statement-breakpoint
CREATE TABLE `project` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`description` text
);
--> statement-breakpoint
CREATE TABLE `entity_sequence` (
	`entity_name` text NOT NULL,
	`entity_id` text NOT NULL,
	`sequence` integer NOT NULL,
	CONSTRAINT `entity_sequence_pk` PRIMARY KEY(`entity_name`, `entity_id`)
);
--> statement-breakpoint
CREATE TABLE `sync` (
	`id` integer PRIMARY KEY,
	`model_name` text NOT NULL,
	`model_id` text NOT NULL,
	`action` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `issue_rank_idx` ON `issue` (`rank`);--> statement-breakpoint
CREATE INDEX `issue_assigneeId_idx` ON `issue` (`assignee_id`);--> statement-breakpoint
CREATE INDEX `issue_teamId_idx` ON `issue` (`team_id`);--> statement-breakpoint
CREATE INDEX `sync_model_idx` ON `sync` (`model_name`,`model_id`);
