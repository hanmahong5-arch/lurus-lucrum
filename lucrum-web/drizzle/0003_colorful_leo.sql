CREATE TABLE "marketplace_strategies" (
	"id" serial PRIMARY KEY NOT NULL,
	"strategy_history_id" integer NOT NULL,
	"author_user_id" uuid,
	"title" varchar(100) NOT NULL,
	"description" text,
	"price_type" varchar(20) NOT NULL,
	"price_per_run" real DEFAULT 0,
	"price_monthly" real DEFAULT 0,
	"author_identity_account_id" varchar(32),
	"grade_score" varchar(2),
	"total_runs" integer DEFAULT 0,
	"total_subscribers" integer DEFAULT 0,
	"staked_lb" real DEFAULT 10,
	"status" varchar(20) DEFAULT 'active',
	"published_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" integer,
	"type" varchar(30) NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text,
	"metadata" jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"marketplace_strategy_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"user_name" varchar(100),
	"content" text NOT NULL,
	"parent_id" integer,
	"deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"marketplace_strategy_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscriber_identity_account_id" varchar(32),
	"marketplace_strategy_id" integer,
	"type" varchar(20) NOT NULL,
	"lb_paid" real NOT NULL,
	"platform_fee_rate" real DEFAULT 0.3,
	"author_revenue_lb" real NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"actor_name" varchar(100) NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"resource_type" varchar(30) NOT NULL,
	"resource_id" varchar(100),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"token" varchar(64) NOT NULL,
	"invited_by" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "marketplace_strategies" ADD CONSTRAINT "marketplace_strategies_strategy_history_id_strategy_history_id_fk" FOREIGN KEY ("strategy_history_id") REFERENCES "public"."strategy_history"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_strategies" ADD CONSTRAINT "marketplace_strategies_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_comments" ADD CONSTRAINT "strategy_comments_marketplace_strategy_id_marketplace_strategies_id_fk" FOREIGN KEY ("marketplace_strategy_id") REFERENCES "public"."marketplace_strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_likes" ADD CONSTRAINT "strategy_likes_marketplace_strategy_id_marketplace_strategies_id_fk" FOREIGN KEY ("marketplace_strategy_id") REFERENCES "public"."marketplace_strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_subscriptions" ADD CONSTRAINT "strategy_subscriptions_marketplace_strategy_id_marketplace_strategies_id_fk" FOREIGN KEY ("marketplace_strategy_id") REFERENCES "public"."marketplace_strategies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_activity" ADD CONSTRAINT "team_activity_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_activity" ADD CONSTRAINT "team_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_marketplace_author" ON "marketplace_strategies" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "idx_marketplace_status" ON "marketplace_strategies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_marketplace_price_type" ON "marketplace_strategies" USING btree ("price_type");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_read" ON "notifications" USING btree ("user_id","is_read","created_at");--> statement-breakpoint
CREATE INDEX "idx_strategy_comments_strategy" ON "strategy_comments" USING btree ("marketplace_strategy_id");--> statement-breakpoint
CREATE INDEX "idx_strategy_comments_user" ON "strategy_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_strategy_comments_parent" ON "strategy_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_strategy_likes_unique" ON "strategy_likes" USING btree ("marketplace_strategy_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_strategy_likes_strategy" ON "strategy_likes" USING btree ("marketplace_strategy_id");--> statement-breakpoint
CREATE INDEX "idx_strategy_subs_subscriber" ON "strategy_subscriptions" USING btree ("subscriber_identity_account_id");--> statement-breakpoint
CREATE INDEX "idx_strategy_subs_strategy" ON "strategy_subscriptions" USING btree ("marketplace_strategy_id");--> statement-breakpoint
CREATE INDEX "idx_strategy_subs_created" ON "strategy_subscriptions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_team_activity_tenant_created" ON "team_activity" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_team_activity_user" ON "team_activity" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tenant_invitations_tenant" ON "tenant_invitations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tenant_invitations_email" ON "tenant_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_tenant_invitations_token" ON "tenant_invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_tenant_invitations_status" ON "tenant_invitations" USING btree ("status");