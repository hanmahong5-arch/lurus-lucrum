CREATE TABLE "popular_strategies" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(50) NOT NULL,
	"source_id" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"author" varchar(100),
	"strategy_type" varchar(50),
	"markets" jsonb,
	"indicators" jsonb,
	"annual_return" numeric(10, 4),
	"max_drawdown" numeric(10, 4),
	"sharpe_ratio" numeric(10, 4),
	"views" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"popularity_score" numeric(10, 2),
	"original_code" text,
	"veighna_code" text,
	"conversion_status" varchar(20) DEFAULT 'pending',
	"conversion_error" text,
	"original_url" text,
	"tags" jsonb,
	"is_featured" boolean DEFAULT false,
	"crawled_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_crawl_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(50) NOT NULL,
	"crawl_type" varchar(20) NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"status" varchar(20) NOT NULL,
	"strategies_found" integer DEFAULT 0 NOT NULL,
	"strategies_new" integer DEFAULT 0 NOT NULL,
	"strategies_updated" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_workflow_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workflow_type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"total_steps" integer NOT NULL,
	"step_data" jsonb,
	"context" jsonb,
	"title" varchar(200),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_step_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"step_number" integer NOT NULL,
	"step_type" varchar(50) NOT NULL,
	"input_data" jsonb,
	"output_data" jsonb,
	"cached_result" jsonb,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_workflow_sessions" ADD CONSTRAINT "user_workflow_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_step_cache" ADD CONSTRAINT "workflow_step_cache_session_id_user_workflow_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."user_workflow_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_popular_strategies_source" ON "popular_strategies" USING btree ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_popular_strategies_source_id" ON "popular_strategies" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "idx_popular_strategies_type" ON "popular_strategies" USING btree ("strategy_type");--> statement-breakpoint
CREATE INDEX "idx_popular_strategies_popularity" ON "popular_strategies" USING btree ("popularity_score");--> statement-breakpoint
CREATE INDEX "idx_popular_strategies_featured" ON "popular_strategies" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "idx_strategy_crawl_log_source" ON "strategy_crawl_log" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_strategy_crawl_log_status" ON "strategy_crawl_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_strategy_crawl_log_start_time" ON "strategy_crawl_log" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "idx_workflow_sessions_user" ON "user_workflow_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_sessions_type" ON "user_workflow_sessions" USING btree ("workflow_type");--> statement-breakpoint
CREATE INDEX "idx_workflow_sessions_status" ON "user_workflow_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workflow_sessions_expires" ON "user_workflow_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_workflow_step_cache_session" ON "workflow_step_cache" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_step_cache_step" ON "workflow_step_cache" USING btree ("session_id","step_number");--> statement-breakpoint
CREATE INDEX "idx_workflow_step_cache_status" ON "workflow_step_cache" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_workflow_session_step" ON "workflow_step_cache" USING btree ("session_id","step_number");