CREATE TABLE "custom_agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" text NOT NULL,
	"config_snapshot" jsonb,
	"result_summary" jsonb,
	"stock_results" jsonb,
	"insights" text,
	"total_token_cost" integer DEFAULT 0,
	"token_breakdown" jsonb,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"targets" jsonb NOT NULL,
	"strategies" jsonb NOT NULL,
	"analysis_depth" text DEFAULT 'standard' NOT NULL,
	"backtest_config" jsonb,
	"icon" text DEFAULT 'bot',
	"color" text DEFAULT '#6366f1',
	"is_pinned" boolean DEFAULT false,
	"run_count" integer DEFAULT 0,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"strategy_history_id" integer,
	"code" text NOT NULL,
	"params" jsonb NOT NULL,
	"description" varchar(500),
	"score" jsonb,
	"version_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"session_id" text,
	"event_type" varchar(50) NOT NULL,
	"metadata" jsonb,
	"token_cost" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "popular_strategies" ADD COLUMN "cache_key" varchar(64);--> statement-breakpoint
ALTER TABLE "popular_strategies" ADD COLUMN "author_id" uuid;--> statement-breakpoint
ALTER TABLE "popular_strategies" ADD COLUMN "avg_return" numeric(10, 4);--> statement-breakpoint
ALTER TABLE "popular_strategies" ADD COLUMN "usage_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_agent_runs" ADD CONSTRAINT "custom_agent_runs_agent_id_custom_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."custom_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_versions" ADD CONSTRAINT "strategy_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_versions" ADD CONSTRAINT "strategy_versions_strategy_history_id_strategy_history_id_fk" FOREIGN KEY ("strategy_history_id") REFERENCES "public"."strategy_history"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_custom_agent_runs_user_created" ON "custom_agent_runs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_custom_agent_runs_agent_created" ON "custom_agent_runs" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_custom_agents_user" ON "custom_agents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_custom_agents_user_pinned" ON "custom_agents" USING btree ("user_id","is_pinned");--> statement-breakpoint
CREATE INDEX "idx_strategy_versions_user" ON "strategy_versions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_strategy_versions_strategy" ON "strategy_versions" USING btree ("strategy_history_id");--> statement-breakpoint
CREATE INDEX "idx_strategy_versions_created" ON "strategy_versions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_user_events_user" ON "user_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_events_type" ON "user_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_user_events_created" ON "user_events" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "popular_strategies" ADD CONSTRAINT "popular_strategies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_popular_strategies_cache_key" ON "popular_strategies" USING btree ("cache_key");--> statement-breakpoint
ALTER TABLE "popular_strategies" ADD CONSTRAINT "popular_strategies_cache_key_unique" UNIQUE("cache_key");