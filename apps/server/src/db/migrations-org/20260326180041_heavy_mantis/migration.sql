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
	`action` text NOT NULL,
	CONSTRAINT `sync_model_name_model_id_unique` UNIQUE(`model_name`,`model_id`)
);

CREATE TRIGGER IF NOT EXISTS issue_sync_insert
      AFTER INSERT ON issue
      BEGIN
        INSERT INTO sync (model_name, model_id, action)
        VALUES (
          'issue',
          NEW.id,
          'insert'
        );
      END;

-- CREATE TRIGGER IF NOT EXISTS issue_sync_update
--       AFTER UPDATE ON issue
--       BEGIN
--         INSERT INTO sync ( model_name, model_id, action)
--         VALUES ('issue',NEW.id,'update')
-- 		on conflict (sync.model_name, sync.model_id)
-- 		do update
-- 		set id = (SELECT seq + 1 FROM sqlite_sequence WHERE name = 'sync'), action = 'update';
--       END;

CREATE TRIGGER IF NOT EXISTS issue_sync_update
      AFTER UPDATE ON issue
      BEGIN
        UPDATE sync
		SET
		    id = (SELECT IFNULL(MAX(id), 0) + 1 FROM sync),
		    action = 'update'
		WHERE model_name = 'issue' AND model_id = NEW.id;
      END;

CREATE TRIGGER IF NOT EXISTS issue_sync_delete
      AFTER DELETE  ON issue
      BEGIN
        UPDATE sync
		SET
		    id = (SELECT IFNULL(MAX(id), 0) + 1 FROM sync),
		    action = 'delete'
		WHERE model_name = 'issue' AND model_id = NEW.id;
      END;
