CREATE TABLE profiles (user_id TEXT PRIMARY KEY, display_name TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE projects (owner_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, updated TEXT NOT NULL, revision INTEGER NOT NULL, document TEXT NOT NULL, PRIMARY KEY(owner_id,id));
--> statement-breakpoint
CREATE INDEX projects_by_owner_updated ON projects(owner_id,updated DESC);
