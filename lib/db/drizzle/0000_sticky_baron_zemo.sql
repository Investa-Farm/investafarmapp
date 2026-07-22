CREATE TYPE "public"."user_role" AS ENUM('farmer', 'investor', 'cooperative', 'agribusiness', 'admin', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."farm_status" AS ENUM('pending', 'active', 'funded', 'harvested');--> statement-breakpoint
CREATE TYPE "public"."listing_type" AS ENUM('primary', 'secondary');--> statement-breakpoint
CREATE TYPE "public"."group_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."kyc_doc_type" AS ENUM('farm_report', 'national_id', 'national_id_back', 'selfie', 'land_title', 'group_certificate', 'financial_statement', 'business_registration', 'other');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."loan_purpose" AS ENUM('seeds', 'fertilizer', 'equipment', 'irrigation', 'labour', 'other');--> statement-breakpoint
CREATE TYPE "public"."loan_status" AS ENUM('draft', 'submitted', 'under_review', 'approved', 'rejected', 'disbursed');--> statement-breakpoint
CREATE TYPE "public"."wallet_tx_type" AS ENUM('deposit', 'withdrawal', 'investment', 'return', 'fee', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."escrow_status" AS ENUM('held', 'released', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."ticket_category" AS ENUM('payment', 'kyc', 'investment', 'withdrawal', 'technical', 'other');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"account_number" text,
	"totp_secret" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"phone" text,
	"county" text,
	"country" text,
	"credit_limit_kes" numeric(15, 2),
	"max_deposit_kes" numeric(15, 2),
	"max_withdrawal_kes" numeric(15, 2),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_account_number_unique" UNIQUE("account_number")
);
--> statement-breakpoint
CREATE TABLE "farms" (
	"id" serial PRIMARY KEY NOT NULL,
	"farmer_id" integer NOT NULL,
	"name" text NOT NULL,
	"crop_type" text NOT NULL,
	"location" text NOT NULL,
	"loan_amount" numeric(15, 2) NOT NULL,
	"total_shares" integer NOT NULL,
	"share_price" numeric(15, 2) NOT NULL,
	"shares_available" integer NOT NULL,
	"status" "farm_status" DEFAULT 'active' NOT NULL,
	"image_url" text,
	"description" text,
	"change_percent" numeric(8, 4) DEFAULT '0' NOT NULL,
	"trade_count" integer DEFAULT 0 NOT NULL,
	"current_price" numeric(15, 2) NOT NULL,
	"latitude" numeric(10, 6),
	"longitude" numeric(10, 6),
	"risk_score" numeric(5, 2) DEFAULT '5',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"top_factors" jsonb,
	"risk_score_source" text,
	"revenue_forecast_low" numeric(15, 2),
	"revenue_forecast_high" numeric(15, 2),
	"uncertainty_ratio" numeric(6, 4),
	"cold_start" boolean DEFAULT false NOT NULL,
	"review_flagged" boolean DEFAULT false NOT NULL,
	"review_reasons" jsonb
);
--> statement-breakpoint
CREATE TABLE "market_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"farm_id" integer NOT NULL,
	"seller_id" integer,
	"investment_id" integer,
	"listing_type" "listing_type" NOT NULL,
	"shares_available" integer NOT NULL,
	"price_per_share" numeric(15, 2) NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investments" (
	"id" serial PRIMARY KEY NOT NULL,
	"investor_id" integer NOT NULL,
	"farm_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"purchase_price" numeric(15, 2) NOT NULL,
	"exit_type" text NOT NULL,
	"exit_date" timestamp,
	"exit_requested_at" timestamp,
	"exit_status" text DEFAULT 'pending',
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"farm_id" integer NOT NULL,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"price_per_share" numeric(15, 2) NOT NULL,
	"total_amount" numeric(15, 2) NOT NULL,
	"exit_type" text,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "farm_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"farm_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farmer_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"registration_number" text NOT NULL,
	"location" text NOT NULL,
	"county" text NOT NULL,
	"member_count" integer DEFAULT 1 NOT NULL,
	"leader_id" integer NOT NULL,
	"status" "group_status" DEFAULT 'pending' NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "farmer_groups_registration_number_unique" UNIQUE("registration_number")
);
--> statement-breakpoint
CREATE TABLE "kyc_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"group_id" integer,
	"doc_type" "kyc_doc_type" NOT NULL,
	"title" text NOT NULL,
	"file_url" text NOT NULL,
	"notes" text,
	"status" "kyc_status" DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"farmer_id" integer NOT NULL,
	"group_id" integer,
	"farm_id" integer,
	"amount" numeric(15, 2) NOT NULL,
	"purpose" "loan_purpose" NOT NULL,
	"purpose_details" text NOT NULL,
	"repayment_period_months" integer NOT NULL,
	"status" "loan_status" DEFAULT 'draft' NOT NULL,
	"review_notes" text,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"crop_name" text,
	"acreage" text,
	"farm_location" text,
	"harvest_date" text,
	"cost_breakdown" jsonb,
	"expected_yield_kg" text,
	"expected_price_per_kg" text,
	"expected_revenue" numeric(15, 2),
	"farmer_share" numeric(15, 2),
	"ai_score" integer,
	"interest_rate" numeric(5, 3) DEFAULT '1.080' NOT NULL,
	"amount_repaid" numeric(15, 2) DEFAULT '0' NOT NULL,
	"next_repayment_due_at" timestamp,
	"last_reminder_at" timestamp,
	"status_history" jsonb
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"type" "wallet_tx_type" NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"balance_after" numeric(15, 2) NOT NULL,
	"description" text,
	"reference" text,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'KES' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"code" text NOT NULL,
	"purpose" text DEFAULT 'email_verify' NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "price_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"farm_id" integer NOT NULL,
	"target_price" numeric(14, 2) NOT NULL,
	"direction" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_fees" (
	"id" serial PRIMARY KEY NOT NULL,
	"investor_id" integer NOT NULL,
	"farm_id" integer,
	"fee_type" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" text DEFAULT 'KES' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" serial PRIMARY KEY NOT NULL,
	"manager_investor_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"strategy" text NOT NULL,
	"target_risk" integer NOT NULL,
	"management_fee_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"follower_count" integer DEFAULT 0 NOT NULL,
	"total_aum" numeric(18, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_rebalanced_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "portfolio_holdings" (
	"id" serial PRIMARY KEY NOT NULL,
	"portfolio_id" integer NOT NULL,
	"farm_id" integer NOT NULL,
	"weight_percent" numeric(5, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investor_portfolio_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"investor_id" integer NOT NULL,
	"portfolio_id" integer NOT NULL,
	"auto_rebalance_enabled" boolean DEFAULT false NOT NULL,
	"invested_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"subscribed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_fees" (
	"id" serial PRIMARY KEY NOT NULL,
	"portfolio_id" integer NOT NULL,
	"manager_id" integer NOT NULL,
	"follower_id" integer NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"type" text NOT NULL,
	"currency" text DEFAULT 'KES' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reinvestment_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"reinvest_percent" numeric(5, 2) DEFAULT '70' NOT NULL,
	"wallet_percent" numeric(5, 2) DEFAULT '30' NOT NULL,
	"crop_preference" text DEFAULT 'any',
	"min_amount" numeric(14, 2) DEFAULT '1000' NOT NULL,
	"max_farms" integer DEFAULT 3 NOT NULL,
	"risk_tolerance" text DEFAULT 'moderate' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reinvestment_rules_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "dividends" (
	"id" serial PRIMARY KEY NOT NULL,
	"farm_id" integer NOT NULL,
	"investor_id" integer NOT NULL,
	"investment_id" integer NOT NULL,
	"shares" integer NOT NULL,
	"harvest_revenue" numeric(15, 2) NOT NULL,
	"alpha_share" numeric(5, 4) DEFAULT '0.2' NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_book" (
	"id" serial PRIMARY KEY NOT NULL,
	"farm_id" integer NOT NULL,
	"investor_id" integer NOT NULL,
	"side" text NOT NULL,
	"limit_price" numeric(14, 2) NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"filled_quantity" numeric(14, 4) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"filled_at" timestamp,
	"cancelled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "watchlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"farm_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "watchlist_user_id_farm_id_unique" UNIQUE("user_id","farm_id")
);
--> statement-breakpoint
CREATE TABLE "stellar_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"account_number" text NOT NULL,
	"public_key" text NOT NULL,
	"encrypted_secret" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stellar_accounts_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "stellar_accounts_account_number_unique" UNIQUE("account_number"),
	CONSTRAINT "stellar_accounts_public_key_unique" UNIQUE("public_key")
);
--> statement-breakpoint
CREATE TABLE "voucher_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"agribusiness_id" integer NOT NULL,
	"farmer_id" integer NOT NULL,
	"voucher_code" varchar(100) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"items" text DEFAULT '[]' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"farmer_phone" varchar(30),
	"farmer_location" varchar(200),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "roi_projections" (
	"id" serial PRIMARY KEY NOT NULL,
	"investment_id" integer NOT NULL,
	"snapshot_date" date NOT NULL,
	"full_season_roi" numeric(10, 4),
	"full_season_annualized" numeric(10, 4),
	"full_season_payout" numeric(18, 2),
	"mid_season_roi" numeric(10, 4),
	"mid_season_annualized" numeric(10, 4),
	"mid_season_p_sell" numeric(18, 2),
	"rainfall_factor" numeric(6, 4),
	"recommendation" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sentiment_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"crop_type" text NOT NULL,
	"region" text DEFAULT 'Kenya',
	"score" numeric(6, 2) NOT NULL,
	"positive_pct" numeric(5, 2),
	"negative_pct" numeric(5, 2),
	"neutral_pct" numeric(5, 2),
	"volume" integer DEFAULT 0,
	"keyphrases" text[],
	"source" text DEFAULT 'combined',
	"snapshot_date" date DEFAULT CURRENT_DATE NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "escrow_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"investment_id" integer,
	"farm_id" integer,
	"amount" numeric(15, 2) NOT NULL,
	"status" "escrow_status" DEFAULT 'held' NOT NULL,
	"description" text,
	"release_at" timestamp,
	"released_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "harvest_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"farm_id" integer NOT NULL,
	"offtaker_id" integer,
	"offtaker_name" text,
	"total_revenue" numeric(15, 2) NOT NULL,
	"farmer_share" numeric(15, 2) NOT NULL,
	"investor_pool_share" numeric(15, 2) NOT NULL,
	"platform_share" numeric(15, 2) NOT NULL,
	"farmer_pct" numeric(5, 2) DEFAULT '55' NOT NULL,
	"investor_pct" numeric(5, 2) DEFAULT '20' NOT NULL,
	"platform_pct" numeric(5, 2) DEFAULT '25' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"triggered_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "platform_revenue" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"farm_id" integer,
	"related_user_id" integer,
	"reference" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" integer,
	"metadata" text,
	"ip_address" text,
	"user_agent" text,
	"request_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"rating" integer NOT NULL,
	"review" text,
	"context" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer,
	"user_id" integer NOT NULL,
	"subject" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"reply" text,
	"replied_at" timestamp,
	"is_read_by_user" boolean DEFAULT false NOT NULL,
	"is_read_by_admin" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"category" "ticket_category" DEFAULT 'other' NOT NULL,
	"subject" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"mpesa_ref" varchar(100),
	"amount_claimed" varchar(50),
	"payment_method" varchar(50),
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"admin_reply" text,
	"admin_replied_at" timestamp,
	"wallet_credited" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bet_stakes" (
	"id" serial PRIMARY KEY NOT NULL,
	"bet_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"amount_kes" numeric(15, 2) NOT NULL,
	"position" varchar(5) NOT NULL,
	"payout" numeric(15, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crop_bets" (
	"id" serial PRIMARY KEY NOT NULL,
	"creator_id" integer NOT NULL,
	"farm_id" integer NOT NULL,
	"question" text NOT NULL,
	"description" text,
	"target_metric" varchar(50) DEFAULT 'roi' NOT NULL,
	"target_value" numeric(10, 2) NOT NULL,
	"total_pool_kes" numeric(15, 2) DEFAULT '0' NOT NULL,
	"yes_pool_kes" numeric(15, 2) DEFAULT '0' NOT NULL,
	"no_pool_kes" numeric(15, 2) DEFAULT '0' NOT NULL,
	"min_stake_kes" numeric(10, 2) DEFAULT '1000' NOT NULL,
	"max_stake_kes" numeric(10, 2) DEFAULT '100000' NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"outcome" boolean,
	"resolved_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "syndicate_investments" (
	"id" serial PRIMARY KEY NOT NULL,
	"syndicate_id" integer NOT NULL,
	"investor_id" integer NOT NULL,
	"amount_kes" numeric(15, 2) NOT NULL,
	"shares_equivalent" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "syndicate_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"syndicate_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"contribution" numeric(15, 2) DEFAULT '0',
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "syndicates" (
	"id" serial PRIMARY KEY NOT NULL,
	"leader_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"location" text NOT NULL,
	"county" varchar(100) NOT NULL,
	"crop_focus" text NOT NULL,
	"member_count" integer DEFAULT 1 NOT NULL,
	"min_members" integer DEFAULT 5 NOT NULL,
	"max_members" integer DEFAULT 20 NOT NULL,
	"funding_goal_kes" numeric(15, 2) NOT NULL,
	"raised_kes" numeric(15, 2) DEFAULT '0' NOT NULL,
	"risk_score" numeric(5, 2) DEFAULT '4',
	"is_open" boolean DEFAULT true NOT NULL,
	"status" varchar(20) DEFAULT 'forming' NOT NULL,
	"image_url" text,
	"agro_dealer" text,
	"discount_pct" numeric(5, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farmer_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"farmer_id" integer NOT NULL,
	"label" varchar(200) NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"category" varchar(50) DEFAULT 'General' NOT NULL,
	"icon" varchar(20) DEFAULT '📋' NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "farms" ADD CONSTRAINT "farms_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_investor_id_users_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_updates" ADD CONSTRAINT "farm_updates_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farmer_groups" ADD CONSTRAINT "farmer_groups_leader_id_users_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_fees" ADD CONSTRAINT "transaction_fees_investor_id_users_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_fees" ADD CONSTRAINT "transaction_fees_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_manager_investor_id_users_id_fk" FOREIGN KEY ("manager_investor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_holdings" ADD CONSTRAINT "portfolio_holdings_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_holdings" ADD CONSTRAINT "portfolio_holdings_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investor_portfolio_subscriptions" ADD CONSTRAINT "investor_portfolio_subscriptions_investor_id_users_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investor_portfolio_subscriptions" ADD CONSTRAINT "investor_portfolio_subscriptions_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_fees" ADD CONSTRAINT "portfolio_fees_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_fees" ADD CONSTRAINT "portfolio_fees_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_fees" ADD CONSTRAINT "portfolio_fees_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reinvestment_rules" ADD CONSTRAINT "reinvestment_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dividends" ADD CONSTRAINT "dividends_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dividends" ADD CONSTRAINT "dividends_investor_id_users_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dividends" ADD CONSTRAINT "dividends_investment_id_investments_id_fk" FOREIGN KEY ("investment_id") REFERENCES "public"."investments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_book" ADD CONSTRAINT "order_book_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_book" ADD CONSTRAINT "order_book_investor_id_users_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stellar_accounts" ADD CONSTRAINT "stellar_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD CONSTRAINT "voucher_orders_agribusiness_id_users_id_fk" FOREIGN KEY ("agribusiness_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD CONSTRAINT "voucher_orders_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roi_projections" ADD CONSTRAINT "roi_projections_investment_id_investments_id_fk" FOREIGN KEY ("investment_id") REFERENCES "public"."investments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_wallets" ADD CONSTRAINT "escrow_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvest_payments" ADD CONSTRAINT "harvest_payments_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvest_payments" ADD CONSTRAINT "harvest_payments_offtaker_id_users_id_fk" FOREIGN KEY ("offtaker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvest_payments" ADD CONSTRAINT "harvest_payments_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_revenue" ADD CONSTRAINT "platform_revenue_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_revenue" ADD CONSTRAINT "platform_revenue_related_user_id_users_id_fk" FOREIGN KEY ("related_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_reviews" ADD CONSTRAINT "app_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_messages" ADD CONSTRAINT "admin_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet_stakes" ADD CONSTRAINT "bet_stakes_bet_id_crop_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."crop_bets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet_stakes" ADD CONSTRAINT "bet_stakes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crop_bets" ADD CONSTRAINT "crop_bets_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crop_bets" ADD CONSTRAINT "crop_bets_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syndicate_investments" ADD CONSTRAINT "syndicate_investments_syndicate_id_syndicates_id_fk" FOREIGN KEY ("syndicate_id") REFERENCES "public"."syndicates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syndicate_investments" ADD CONSTRAINT "syndicate_investments_investor_id_users_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syndicate_members" ADD CONSTRAINT "syndicate_members_syndicate_id_syndicates_id_fk" FOREIGN KEY ("syndicate_id") REFERENCES "public"."syndicates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syndicate_members" ADD CONSTRAINT "syndicate_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syndicates" ADD CONSTRAINT "syndicates_leader_id_users_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farmer_tasks" ADD CONSTRAINT "farmer_tasks_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "roi_proj_inv_date_uidx" ON "roi_projections" USING btree ("investment_id","snapshot_date");