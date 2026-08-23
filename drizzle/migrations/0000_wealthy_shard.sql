-- Postgres rejects to_tsvector()/array_to_string() directly inside a
-- GENERATED ALWAYS AS (...) STORED expression ("generation expression is
-- not immutable") because both are only STABLE in its catalog. Each
-- function below does that work inside its own body instead, where
-- Postgres trusts the declared IMMUTABLE label rather than inspecting it
-- — the standard fix. See src/modules/db/schema.ts.
CREATE FUNCTION "deskbuz_company_search_vector"(name text, industry text, description text) RETURNS tsvector AS $$
	SELECT setweight(to_tsvector('english', coalesce(name, '')), 'A')
		|| setweight(to_tsvector('english', coalesce(industry, '')), 'B')
		|| setweight(to_tsvector('english', coalesce(description, '')), 'C')
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;--> statement-breakpoint
CREATE FUNCTION "deskbuz_occupation_search_vector"(title text, aliases text[]) RETURNS tsvector AS $$
	SELECT setweight(to_tsvector('english', coalesce(title, '')), 'A')
		|| setweight(to_tsvector('english', array_to_string(coalesce(aliases, '{}'), ' ')), 'B')
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;--> statement-breakpoint
CREATE TYPE "public"."app_role" AS ENUM('admin', 'moderator', 'user');--> statement-breakpoint
CREATE TYPE "public"."confidence_level" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."employment_status" AS ENUM('current', 'former', 'intern', 'contract');--> statement-breakpoint
CREATE TYPE "public"."ingestion_job_status" AS ENUM('running', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."percentile_point" AS ENUM('p10', 'p25', 'p50', 'p75', 'p90');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected', 'redacted');--> statement-breakpoint
CREATE TYPE "public"."salary_report_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."submission_source" AS ENUM('self_submitted', 'admin_on_behalf', 'imported');--> statement-breakpoint
CREATE TYPE "public"."ingestion_triggered_by" AS ENUM('cron', 'manual');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_table" text NOT NULL,
	"target_id" uuid NOT NULL,
	"justification" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"industry" text,
	"description" text,
	"website" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (deskbuz_company_search_vector(name, industry, description)) STORED,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"licence" text NOT NULL,
	"url" text NOT NULL,
	"last_ingested_at" timestamp with time zone,
	CONSTRAINT "data_sources_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "email_verification_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "ingestion_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "ingestion_job_status" DEFAULT 'running' NOT NULL,
	"rows_ingested" integer,
	"rows_skipped" integer,
	"error_message" text,
	"triggered_by" "ingestion_triggered_by" DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occupations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"soc_code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (deskbuz_occupation_search_vector(title, aliases)) STORED,
	CONSTRAINT "occupations_soc_code_unique" UNIQUE("soc_code")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "rate_limit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"endpoint" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "rate_limit_events_key_endpoint_window_start_unique" UNIQUE("key","endpoint","window_start")
);
--> statement-breakpoint
CREATE TABLE "review_disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"raised_by_contact" text NOT NULL,
	"reason" text NOT NULL,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid,
	"job_title" text NOT NULL,
	"location" text,
	"employment_status" "employment_status" NOT NULL,
	"employment_tenure" text,
	"rating_overall" numeric(2, 1) NOT NULL,
	"rating_compensation" numeric(2, 1),
	"rating_management" numeric(2, 1),
	"rating_work_life" numeric(2, 1),
	"rating_culture" numeric(2, 1),
	"rating_career_growth" numeric(2, 1),
	"pros" text NOT NULL,
	"cons" text NOT NULL,
	"submission_source" "submission_source" DEFAULT 'self_submitted' NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"original_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edit_window_expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "salary_benchmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"country" text NOT NULL,
	"region" text,
	"city" text,
	"occupation_id" uuid NOT NULL,
	"employer_id" uuid,
	"employer_name" text,
	"percentile" "percentile_point" NOT NULL,
	"pay_amount" numeric(12, 2) NOT NULL,
	"pay_currency" text NOT NULL,
	"sample_size" integer,
	"confidence" "confidence_level" NOT NULL,
	"dedupe_key" text NOT NULL,
	CONSTRAINT "salary_benchmarks_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "salary_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid,
	"occupation_id" uuid,
	"job_title" text NOT NULL,
	"experience_years" numeric(4, 1),
	"country" text DEFAULT 'US' NOT NULL,
	"region" text,
	"city" text,
	"pay_amount" numeric(12, 2) NOT NULL,
	"pay_currency" text NOT NULL,
	"pay_period" text DEFAULT 'annual' NOT NULL,
	"annual_pay_normalized" numeric(12, 2) NOT NULL,
	"status" "salary_report_status" DEFAULT 'approved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"ip" text,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "app_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_unique" UNIQUE("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"password_hash" text NOT NULL,
	"password_algo" text DEFAULT 'argon2id' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_disputes" ADD CONSTRAINT "review_disputes_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_disputes" ADD CONSTRAINT "review_disputes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_disputes" ADD CONSTRAINT "review_disputes_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_benchmarks" ADD CONSTRAINT "salary_benchmarks_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_benchmarks" ADD CONSTRAINT "salary_benchmarks_occupation_id_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."occupations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_benchmarks" ADD CONSTRAINT "salary_benchmarks_employer_id_companies_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_reports" ADD CONSTRAINT "salary_reports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_reports" ADD CONSTRAINT "salary_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_reports" ADD CONSTRAINT "salary_reports_occupation_id_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."occupations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_search_idx" ON "companies" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "occupations_search_idx" ON "occupations" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "reviews_company_id_idx" ON "reviews" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "reviews_user_id_idx" ON "reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reviews_status_idx" ON "reviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "salary_benchmarks_occupation_country_idx" ON "salary_benchmarks" USING btree ("occupation_id","country");--> statement-breakpoint
CREATE INDEX "salary_benchmarks_employer_id_idx" ON "salary_benchmarks" USING btree ("employer_id");--> statement-breakpoint
CREATE INDEX "salary_reports_company_id_idx" ON "salary_reports" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "salary_reports_occupation_id_idx" ON "salary_reports" USING btree ("occupation_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");