CREATE TABLE IF NOT EXISTS "mcp_shadow_index" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source" text NOT NULL,
  "owner" text NOT NULL,
  "repo" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text,
  "tags" jsonb,
  "stars" integer,
  "downloads" integer,
  "last_updated" timestamp with time zone,
  "source_url" text,
  "settlegrid_available" boolean NOT NULL DEFAULT true,
  "indexed_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "mcp_shadow_source_owner_repo_idx"
  ON "mcp_shadow_index" ("source", "owner", "repo");

CREATE INDEX IF NOT EXISTS "mcp_shadow_category_idx"
  ON "mcp_shadow_index" ("category");

CREATE INDEX IF NOT EXISTS "mcp_shadow_last_updated_idx"
  ON "mcp_shadow_index" ("last_updated");
