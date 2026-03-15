PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sync` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`model_name` text NOT NULL,
	`model_id` text NOT NULL,
	`action` text NOT NULL,
	CONSTRAINT `sync_model_name_model_id_unique` UNIQUE(`model_name`,`model_id`)
);
--> statement-breakpoint
INSERT INTO `__new_sync`(`id`, `model_name`, `model_id`, `action`) SELECT `id`, `model_name`, `model_id`, `action` FROM `sync`;--> statement-breakpoint
DROP TABLE `sync`;--> statement-breakpoint
ALTER TABLE `__new_sync` RENAME TO `sync`;--> statement-breakpoint
PRAGMA foreign_keys=ON;