-- P5.K1 — Kernel telemetry backing store.
--
-- Populated via POST to /api/telemetry/kernel from the SDK kernel's
-- emitter (the spec'd /api/internal/... path was relocated under D2
-- because internal/ is gitignored repo-wide). Source of truth for
-- /admin/kernel-health when PostHog is unreachable; PostHog
-- forwarding from the same endpoint is a parallel sink.
--
-- Indices match the three dashboard query shapes: top-level by
-- occurred_at desc, per-adapter by (adapter, occurred_at desc),
-- rails by (rail, occurred_at desc). Composite indices avoid
-- table-scan hot paths under deep history. Old rows are reclaimed
-- by a future data-retention job (out of scope for P5.K1).

CREATE TABLE IF NOT EXISTS "kernel_telemetry" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_name" text NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "adapter" text NOT NULL,
  "rail" text,
  "dev_id" uuid,
  "props" jsonb NOT NULL,
  CONSTRAINT "kernel_telemetry_event_name_check" CHECK (
    "event_name" IN (
      'kernel.request_received',
      'kernel.routing_decision',
      'kernel.adapter_latency_ms',
      'kernel.adapter_error',
      'kernel.invocation_settled'
    )
  )
);

CREATE INDEX IF NOT EXISTS "kernel_telemetry_occurred_at_idx"
  ON "kernel_telemetry" ("occurred_at" DESC);

CREATE INDEX IF NOT EXISTS "kernel_telemetry_adapter_idx"
  ON "kernel_telemetry" ("adapter", "occurred_at" DESC);

CREATE INDEX IF NOT EXISTS "kernel_telemetry_rail_idx"
  ON "kernel_telemetry" ("rail", "occurred_at" DESC);

CREATE INDEX IF NOT EXISTS "kernel_telemetry_event_name_idx"
  ON "kernel_telemetry" ("event_name", "occurred_at" DESC);

CREATE INDEX IF NOT EXISTS "kernel_telemetry_dev_id_idx"
  ON "kernel_telemetry" ("dev_id");

-- ─── Down (manual rollback) ────────────────────────────────────────
-- DROP INDEX IF EXISTS "kernel_telemetry_dev_id_idx";
-- DROP INDEX IF EXISTS "kernel_telemetry_event_name_idx";
-- DROP INDEX IF EXISTS "kernel_telemetry_rail_idx";
-- DROP INDEX IF EXISTS "kernel_telemetry_adapter_idx";
-- DROP INDEX IF EXISTS "kernel_telemetry_occurred_at_idx";
-- DROP TABLE IF EXISTS "kernel_telemetry";
