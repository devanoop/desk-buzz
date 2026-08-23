CREATE TYPE "public"."confidence_level" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."ingestion_job_status" AS ENUM('running', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."percentile_point" AS ENUM('p10', 'p25', 'p50', 'p75', 'p90');--> statement-breakpoint
CREATE TYPE "public"."ingestion_triggered_by" AS ENUM('cron', 'manual');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"industry" text,
	"description" text,
	"website" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
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
	CONSTRAINT "occupations_soc_code_unique" UNIQUE("soc_code")
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
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_benchmarks" ADD CONSTRAINT "salary_benchmarks_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_benchmarks" ADD CONSTRAINT "salary_benchmarks_occupation_id_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."occupations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_benchmarks" ADD CONSTRAINT "salary_benchmarks_employer_id_companies_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;