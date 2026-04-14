CREATE TRIGGER IF NOT EXISTS issue_sync_insert
    AFTER INSERT ON issue
    BEGIN
        INSERT INTO sync (model_name, model_id, action)
        VALUES ('issue',NEW.id,'insert');
    END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS issue_sync_update
    AFTER UPDATE ON issue
    BEGIN
        INSERT INTO sync (model_name, model_id, action)
        VALUES ('issue',NEW.id,'update');
    END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS issue_sync_delete
    AFTER DELETE ON issue
    BEGIN
        INSERT INTO sync (model_name, model_id, action)
        VALUES ('issue',NEW.id,'delete');
    END;
