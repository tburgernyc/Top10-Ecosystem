CREATE TYPE "public"."appointment_status" AS ENUM('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."bridal_party_role" AS ENUM('lead', 'bridesmaid', 'groomsman', 'flower_girl', 'guest');--> statement-breakpoint
CREATE TYPE "public"."dress_occasion" AS ENUM('prom', 'wedding', 'bridesmaid', 'homecoming', 'pageant', 'cocktail');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'sms', 'both');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('queued', 'sent', 'delivered', 'failed', 'bounced');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('appointment_confirmation', 'appointment_reminder', 'appointment_cancelled', 'appointment_rescheduled', 'reservation_created', 'reservation_confirmed', 'reservation_expired', 'walk_in_called', 'guardian_portal_invite', 'payment_receipt');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('super_admin', 'owner', 'manager', 'stylist', 'receptionist');--> statement-breakpoint
CREATE TYPE "public"."vote_type" AS ENUM('love', 'like', 'maybe', 'pass');--> statement-breakpoint
CREATE TYPE "public"."vto_status" AS ENUM('queued', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."walk_in_status" AS ENUM('waiting', 'called', 'with_stylist', 'completed', 'left');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"stylist_id" uuid,
	"appointment_date" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"service_type" varchar(100) NOT NULL,
	"status" "appointment_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"original_tenant_id" uuid,
	"rerouted_reason" text,
	"geospatial_distance_km" numeric(8, 3),
	"confirmation_code" varchar(20) NOT NULL,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boutique_staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid,
	"role" "staff_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"hire_date" timestamp with time zone,
	"specialties" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bridal_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_customer_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"occasion" text NOT NULL,
	"event_date" timestamp with time zone,
	"school_name" varchar(200),
	"invite_code" varchar(32) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"max_members" integer DEFAULT 12 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bridal_parties_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "bridal_party_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"role" "bridal_party_role" DEFAULT 'bridesmaid' NOT NULL,
	"is_confirmed" boolean DEFAULT false NOT NULL,
	"shortlisted_dress_ids" jsonb DEFAULT '[]'::jsonb,
	"joined_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_style_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"preferred_designers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_colors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_silhouettes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_occasions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"avoided_styles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"budget_min" numeric(10, 2),
	"budget_max" numeric(10, 2),
	"size_top" varchar(20),
	"size_bottom" varchar(20),
	"embedding_vector" jsonb,
	"last_interaction_at" timestamp with time zone,
	"interaction_count" integer DEFAULT 0 NOT NULL,
	"raw_conversation_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"preferred_sizes" jsonb,
	"style_notes" text,
	"prom_year" integer,
	"school_name" varchar(255),
	"guardian_name" varchar(255),
	"guardian_phone" varchar(30),
	"guardian_email" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dress_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dress_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"color_name" varchar(100) NOT NULL,
	"size" varchar(20) NOT NULL,
	"quantity_on_hand" integer DEFAULT 0 NOT NULL,
	"quantity_reserved" integer DEFAULT 0 NOT NULL,
	"in_stock" boolean DEFAULT true NOT NULL,
	"reorder_threshold" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dress_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"dress_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"color_name" varchar(100) NOT NULL,
	"size" varchar(20) NOT NULL,
	"reservation_status" varchar(50) DEFAULT 'active' NOT NULL,
	"reserved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"school_name" varchar(255),
	"prom_date" timestamp with time zone,
	"deposit_amount" numeric(10, 2),
	"deposit_paid_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dress_vote_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"share_token" varchar(64) NOT NULL,
	"title" varchar(120),
	"dress_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dress_vote_sessions_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "dress_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"dress_id" uuid NOT NULL,
	"vote_type" "vote_type" NOT NULL,
	"voter_fingerprint" varchar(64) NOT NULL,
	"voter_display_name" varchar(60),
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"designer" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"occasion" "dress_occasion" NOT NULL,
	"silhouette" varchar(100),
	"neckline" varchar(100),
	"fabric" varchar(255),
	"embellishments" jsonb,
	"available_colors" jsonb NOT NULL,
	"available_sizes" jsonb NOT NULL,
	"base_price" numeric(10, 2) NOT NULL,
	"retail_price" numeric(10, 2) NOT NULL,
	"image_urls" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_exclusive" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guardian_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guardian_profile_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"notification_type" "notification_type" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"status" "notification_status" DEFAULT 'queued' NOT NULL,
	"subject" varchar(255),
	"body_preview" text,
	"provider_message_id" varchar(255),
	"delivered_at" timestamp with time zone,
	"failed_reason" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"reference_id" uuid,
	"reference_type" varchar(60),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guardian_portal_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guardian_profile_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guardian_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"first_name" varchar(80) NOT NULL,
	"last_name" varchar(80) NOT NULL,
	"relationship" varchar(60) NOT NULL,
	"email" varchar(320),
	"phone" varchar(30),
	"preferred_channel" "notification_channel" DEFAULT 'both' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_consent_given" boolean DEFAULT false NOT NULL,
	"consent_given_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"subdomain" varchar(100) NOT NULL,
	"address" text NOT NULL,
	"city" varchar(100) NOT NULL,
	"state" varchar(50) NOT NULL,
	"zip" varchar(20) NOT NULL,
	"phone" varchar(30) NOT NULL,
	"email" varchar(255) NOT NULL,
	"location_data" jsonb,
	"business_hours" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"max_daily_appointments" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"avatar_url" text,
	"phone" varchar(30),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vto_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid,
	"dress_id" uuid NOT NULL,
	"color_name" varchar(100) NOT NULL,
	"fal_request_id" varchar(255),
	"realtime_channel_id" varchar(255) NOT NULL,
	"status" "vto_status" DEFAULT 'queued' NOT NULL,
	"input_image_url" text NOT NULL,
	"output_image_url" text,
	"output_thumbnail_url" text,
	"processing_started_at" timestamp with time zone,
	"processing_completed_at" timestamp with time zone,
	"processing_duration_ms" integer,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "walk_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_name" varchar(255) NOT NULL,
	"phone_number" varchar(30) NOT NULL,
	"party_size" integer DEFAULT 1 NOT NULL,
	"occasion" "dress_occasion",
	"notes" text,
	"status" "walk_in_status" DEFAULT 'waiting' NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"called_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"assigned_stylist_id" uuid,
	"queue_position" integer NOT NULL,
	"estimated_wait_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_stylist_id_boutique_staff_id_fk" FOREIGN KEY ("stylist_id") REFERENCES "public"."boutique_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_original_tenant_id_tenants_id_fk" FOREIGN KEY ("original_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boutique_staff" ADD CONSTRAINT "boutique_staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boutique_staff" ADD CONSTRAINT "boutique_staff_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bridal_parties" ADD CONSTRAINT "bridal_parties_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bridal_parties" ADD CONSTRAINT "bridal_parties_lead_customer_id_customers_id_fk" FOREIGN KEY ("lead_customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bridal_party_members" ADD CONSTRAINT "bridal_party_members_party_id_bridal_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."bridal_parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bridal_party_members" ADD CONSTRAINT "bridal_party_members_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_style_profiles" ADD CONSTRAINT "client_style_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dress_inventory" ADD CONSTRAINT "dress_inventory_dress_id_dresses_id_fk" FOREIGN KEY ("dress_id") REFERENCES "public"."dresses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dress_inventory" ADD CONSTRAINT "dress_inventory_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dress_reservations" ADD CONSTRAINT "dress_reservations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dress_reservations" ADD CONSTRAINT "dress_reservations_dress_id_dresses_id_fk" FOREIGN KEY ("dress_id") REFERENCES "public"."dresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dress_reservations" ADD CONSTRAINT "dress_reservations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dress_vote_sessions" ADD CONSTRAINT "dress_vote_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dress_vote_sessions" ADD CONSTRAINT "dress_vote_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dress_votes" ADD CONSTRAINT "dress_votes_session_id_dress_vote_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."dress_vote_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dress_votes" ADD CONSTRAINT "dress_votes_dress_id_dresses_id_fk" FOREIGN KEY ("dress_id") REFERENCES "public"."dresses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_notifications" ADD CONSTRAINT "guardian_notifications_guardian_profile_id_guardian_profiles_id_fk" FOREIGN KEY ("guardian_profile_id") REFERENCES "public"."guardian_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_notifications" ADD CONSTRAINT "guardian_notifications_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_notifications" ADD CONSTRAINT "guardian_notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_portal_tokens" ADD CONSTRAINT "guardian_portal_tokens_guardian_profile_id_guardian_profiles_id_fk" FOREIGN KEY ("guardian_profile_id") REFERENCES "public"."guardian_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_portal_tokens" ADD CONSTRAINT "guardian_portal_tokens_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_profiles" ADD CONSTRAINT "guardian_profiles_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vto_sessions" ADD CONSTRAINT "vto_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vto_sessions" ADD CONSTRAINT "vto_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vto_sessions" ADD CONSTRAINT "vto_sessions_dress_id_dresses_id_fk" FOREIGN KEY ("dress_id") REFERENCES "public"."dresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walk_ins" ADD CONSTRAINT "walk_ins_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walk_ins" ADD CONSTRAINT "walk_ins_assigned_stylist_id_boutique_staff_id_fk" FOREIGN KEY ("assigned_stylist_id") REFERENCES "public"."boutique_staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_tenant_date_idx" ON "appointments" USING btree ("tenant_id","appointment_date");--> statement-breakpoint
CREATE INDEX "appointments_customer_idx" ON "appointments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "appointments_stylist_idx" ON "appointments" USING btree ("stylist_id");--> statement-breakpoint
CREATE INDEX "appointments_status_idx" ON "appointments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_confirmation_idx" ON "appointments" USING btree ("confirmation_code");--> statement-breakpoint
CREATE UNIQUE INDEX "boutique_staff_user_tenant_idx" ON "boutique_staff" USING btree ("user_id","tenant_id");--> statement-breakpoint
CREATE INDEX "boutique_staff_tenant_idx" ON "boutique_staff" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "boutique_staff_role_idx" ON "boutique_staff" USING btree ("role");--> statement-breakpoint
CREATE INDEX "bridal_parties_tenant_idx" ON "bridal_parties" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "bridal_parties_lead_customer_idx" ON "bridal_parties" USING btree ("lead_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bridal_parties_invite_code_unique" ON "bridal_parties" USING btree ("invite_code");--> statement-breakpoint
CREATE UNIQUE INDEX "bridal_party_members_party_customer_unique" ON "bridal_party_members" USING btree ("party_id","customer_id");--> statement-breakpoint
CREATE INDEX "bridal_party_members_party_idx" ON "bridal_party_members" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "bridal_party_members_customer_idx" ON "bridal_party_members" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "client_style_profiles_user_idx" ON "client_style_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_user_id_idx" ON "customers" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dress_inventory_unique_idx" ON "dress_inventory" USING btree ("dress_id","tenant_id","color_name","size");--> statement-breakpoint
CREATE INDEX "dress_inventory_tenant_idx" ON "dress_inventory" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "dress_inventory_in_stock_idx" ON "dress_inventory" USING btree ("in_stock");--> statement-breakpoint
CREATE UNIQUE INDEX "dress_reservations_unique_idx" ON "dress_reservations" USING btree ("dress_id","tenant_id","color_name","size","reservation_status");--> statement-breakpoint
CREATE INDEX "dress_reservations_customer_idx" ON "dress_reservations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "dress_reservations_tenant_idx" ON "dress_reservations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "dress_reservations_dress_idx" ON "dress_reservations" USING btree ("dress_id");--> statement-breakpoint
CREATE INDEX "dress_vote_sessions_customer_idx" ON "dress_vote_sessions" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dress_vote_sessions_share_token_unique" ON "dress_vote_sessions" USING btree ("share_token");--> statement-breakpoint
CREATE UNIQUE INDEX "dress_votes_session_dress_voter_unique" ON "dress_votes" USING btree ("session_id","dress_id","voter_fingerprint");--> statement-breakpoint
CREATE INDEX "dress_votes_session_idx" ON "dress_votes" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "dress_votes_dress_idx" ON "dress_votes" USING btree ("dress_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dresses_sku_idx" ON "dresses" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "dresses_designer_idx" ON "dresses" USING btree ("designer");--> statement-breakpoint
CREATE INDEX "dresses_occasion_idx" ON "dresses" USING btree ("occasion");--> statement-breakpoint
CREATE INDEX "guardian_notifications_guardian_idx" ON "guardian_notifications" USING btree ("guardian_profile_id");--> statement-breakpoint
CREATE INDEX "guardian_notifications_customer_idx" ON "guardian_notifications" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "guardian_notifications_tenant_idx" ON "guardian_notifications" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "guardian_notifications_status_idx" ON "guardian_notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "guardian_notifications_type_idx" ON "guardian_notifications" USING btree ("notification_type");--> statement-breakpoint
CREATE INDEX "guardian_portal_tokens_guardian_idx" ON "guardian_portal_tokens" USING btree ("guardian_profile_id");--> statement-breakpoint
CREATE INDEX "guardian_portal_tokens_customer_idx" ON "guardian_portal_tokens" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "guardian_profiles_customer_idx" ON "guardian_profiles" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_subdomain_idx" ON "tenants" USING btree ("subdomain");--> statement-breakpoint
CREATE INDEX "tenants_active_idx" ON "tenants" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "vto_sessions_user_idx" ON "vto_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vto_sessions_tenant_idx" ON "vto_sessions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "vto_sessions_fal_request_idx" ON "vto_sessions" USING btree ("fal_request_id");--> statement-breakpoint
CREATE INDEX "vto_sessions_status_idx" ON "vto_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "walk_ins_tenant_status_idx" ON "walk_ins" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "walk_ins_tenant_date_idx" ON "walk_ins" USING btree ("tenant_id","checked_in_at");