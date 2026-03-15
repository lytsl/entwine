CREATE TABLE `issue` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`rank` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync` (
	`id` integer,
	`model_name` text NOT NULL,
	`model_id` text NOT NULL,
	`action` text NOT NULL,
	`organization_id` text NOT NULL,
	CONSTRAINT `sync_pk` PRIMARY KEY(`id`, `organization_id`),
	CONSTRAINT `fk_sync_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE CASCADE,
	CONSTRAINT `sync_model_name_model_id_unique` UNIQUE(`model_name`,`model_id`)
);
