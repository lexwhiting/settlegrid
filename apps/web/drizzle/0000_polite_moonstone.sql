CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consumer_id" uuid NOT NULL,
	"tool_id" uuid NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_test_key" boolean DEFAULT false NOT NULL,
	"ip_allowlist" jsonb,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"developer_id" uuid,
	"consumer_id" uuid,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"details" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consumer_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consumer_id" uuid NOT NULL,
	"tool_id" uuid NOT NULL,
	"alert_type" text NOT NULL,
	"threshold" integer NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consumer_tool_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consumer_id" uuid NOT NULL,
	"tool_id" uuid NOT NULL,
	"balance_cents" integer DEFAULT 0 NOT NULL,
	"auto_refill" boolean DEFAULT false NOT NULL,
	"auto_refill_amount_cents" integer DEFAULT 2000 NOT NULL,
	"auto_refill_threshold_cents" integer DEFAULT 500 NOT NULL,
	"spending_limit_cents" integer,
	"spending_limit_period" text,
	"current_period_spend_cents" integer DEFAULT 0 NOT NULL,
	"period_reset_at" timestamp with time zone,
	"alert_at_pct" integer
);
--> statement-breakpoint
CREATE TABLE "consumers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"clerk_user_id" text,
	"password_hash" text,
	"stripe_customer_id" text,
	"default_payment_method_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consumers_email_unique" UNIQUE("email"),
	CONSTRAINT "consumers_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "conversion_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"consumer_id" uuid NOT NULL,
	"event" text NOT NULL,
	"from_tier" text,
	"to_tier" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_reputation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"developer_id" uuid NOT NULL,
	"score" integer DEFAULT 50 NOT NULL,
	"response_time_pct" integer DEFAULT 0 NOT NULL,
	"uptime_pct" integer DEFAULT 100 NOT NULL,
	"review_avg" integer DEFAULT 0 NOT NULL,
	"total_tools" integer DEFAULT 0 NOT NULL,
	"total_consumers" integer DEFAULT 0 NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"clerk_user_id" text,
	"password_hash" text,
	"tier" text DEFAULT 'standard' NOT NULL,
	"revenue_share_pct" integer DEFAULT 85 NOT NULL,
	"stripe_connect_id" text,
	"stripe_connect_status" text DEFAULT 'not_started' NOT NULL,
	"stripe_subscription_id" text,
	"api_key_hash" text,
	"balance_cents" integer DEFAULT 0 NOT NULL,
	"payout_schedule" text DEFAULT 'monthly' NOT NULL,
	"payout_minimum_cents" integer DEFAULT 2500 NOT NULL,
	"public_profile" boolean DEFAULT false NOT NULL,
	"public_bio" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "developers_email_unique" UNIQUE("email"),
	CONSTRAINT "developers_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "invocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"consumer_id" uuid NOT NULL,
	"api_key_id" uuid NOT NULL,
	"method" text NOT NULL,
	"cost_cents" integer NOT NULL,
	"latency_ms" integer,
	"status" text DEFAULT 'success' NOT NULL,
	"is_test" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"session_id" text,
	"referral_code" text,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"developer_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"platform_fee_cents" integer NOT NULL,
	"stripe_transfer_id" text,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consumer_id" uuid NOT NULL,
	"tool_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"stripe_session_id" text,
	"stripe_payment_intent_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referred_tool_id" uuid NOT NULL,
	"referral_code" text NOT NULL,
	"commission_pct" integer DEFAULT 10 NOT NULL,
	"total_earned_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referrals_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "tool_changelogs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"version" text NOT NULL,
	"change_type" text NOT NULL,
	"summary" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_health_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"status" text NOT NULL,
	"response_time_ms" integer,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"consumer_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"developer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"pricing_config" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_invocations" integer DEFAULT 0 NOT NULL,
	"total_revenue_cents" integer DEFAULT 0 NOT NULL,
	"category" text,
	"tags" jsonb DEFAULT '[]',
	"current_version" text DEFAULT '1.0.0' NOT NULL,
	"health_endpoint" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tools_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "waitlist_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"feature" text DEFAULT 'marketplace' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"http_status" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"next_retry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"developer_id" uuid NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" jsonb DEFAULT '["invocation.completed","payout.initiated","tool.status_changed"]' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_consumer_id_consumers_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "public"."consumers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_developer_id_developers_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."developers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_consumer_id_consumers_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "public"."consumers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumer_alerts" ADD CONSTRAINT "consumer_alerts_consumer_id_consumers_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "public"."consumers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumer_alerts" ADD CONSTRAINT "consumer_alerts_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumer_tool_balances" ADD CONSTRAINT "consumer_tool_balances_consumer_id_consumers_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "public"."consumers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumer_tool_balances" ADD CONSTRAINT "consumer_tool_balances_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversion_events" ADD CONSTRAINT "conversion_events_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversion_events" ADD CONSTRAINT "conversion_events_consumer_id_consumers_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "public"."consumers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_reputation" ADD CONSTRAINT "developer_reputation_developer_id_developers_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."developers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invocations" ADD CONSTRAINT "invocations_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invocations" ADD CONSTRAINT "invocations_consumer_id_consumers_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "public"."consumers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invocations" ADD CONSTRAINT "invocations_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_developer_id_developers_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."developers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_consumer_id_consumers_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "public"."consumers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_developers_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."developers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_tool_id_tools_id_fk" FOREIGN KEY ("referred_tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_changelogs" ADD CONSTRAINT "tool_changelogs_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_health_checks" ADD CONSTRAINT "tool_health_checks_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_reviews" ADD CONSTRAINT "tool_reviews_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_reviews" ADD CONSTRAINT "tool_reviews_consumer_id_consumers_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "public"."consumers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_developer_id_developers_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."developers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_developer_id_developers_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."developers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_consumer_id_idx" ON "api_keys" USING btree ("consumer_id");--> statement-breakpoint
CREATE INDEX "api_keys_tool_id_idx" ON "api_keys" USING btree ("tool_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "audit_logs_developer_id_idx" ON "audit_logs" USING btree ("developer_id");--> statement-breakpoint
CREATE INDEX "audit_logs_consumer_id_idx" ON "audit_logs" USING btree ("consumer_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "consumer_alerts_consumer_id_idx" ON "consumer_alerts" USING btree ("consumer_id");--> statement-breakpoint
CREATE INDEX "consumer_alerts_status_idx" ON "consumer_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ctb_consumer_id_idx" ON "consumer_tool_balances" USING btree ("consumer_id");--> statement-breakpoint
CREATE INDEX "ctb_tool_id_idx" ON "consumer_tool_balances" USING btree ("tool_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ctb_consumer_tool_idx" ON "consumer_tool_balances" USING btree ("consumer_id","tool_id");--> statement-breakpoint
CREATE INDEX "conversion_events_tool_id_idx" ON "conversion_events" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "conversion_events_consumer_id_idx" ON "conversion_events" USING btree ("consumer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "developer_reputation_developer_id_idx" ON "developer_reputation" USING btree ("developer_id");--> statement-breakpoint
CREATE INDEX "invocations_tool_id_idx" ON "invocations" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "invocations_consumer_id_idx" ON "invocations" USING btree ("consumer_id");--> statement-breakpoint
CREATE INDEX "invocations_api_key_id_idx" ON "invocations" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "invocations_created_at_idx" ON "invocations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "invocations_tool_created_idx" ON "invocations" USING btree ("tool_id","created_at");--> statement-breakpoint
CREATE INDEX "payouts_developer_id_idx" ON "payouts" USING btree ("developer_id");--> statement-breakpoint
CREATE INDEX "payouts_status_idx" ON "payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "purchases_consumer_id_idx" ON "purchases" USING btree ("consumer_id");--> statement-breakpoint
CREATE INDEX "purchases_tool_id_idx" ON "purchases" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "purchases_stripe_session_idx" ON "purchases" USING btree ("stripe_session_id");--> statement-breakpoint
CREATE INDEX "referrals_referrer_id_idx" ON "referrals" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX "tool_changelogs_tool_id_idx" ON "tool_changelogs" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "tool_health_checks_tool_id_idx" ON "tool_health_checks" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "tool_health_checks_checked_at_idx" ON "tool_health_checks" USING btree ("checked_at");--> statement-breakpoint
CREATE INDEX "tool_reviews_tool_id_idx" ON "tool_reviews" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "tool_reviews_consumer_id_idx" ON "tool_reviews" USING btree ("consumer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_reviews_tool_consumer_idx" ON "tool_reviews" USING btree ("tool_id","consumer_id");--> statement-breakpoint
CREATE INDEX "tools_developer_id_idx" ON "tools" USING btree ("developer_id");--> statement-breakpoint
CREATE INDEX "tools_status_idx" ON "tools" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tools_category_idx" ON "tools" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_email_feature_idx" ON "waitlist_signups" USING btree ("email","feature");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_endpoint_id_idx" ON "webhook_deliveries" USING btree ("endpoint_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_status_idx" ON "webhook_deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_next_retry_idx" ON "webhook_deliveries" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_developer_id_idx" ON "webhook_endpoints" USING btree ("developer_id");