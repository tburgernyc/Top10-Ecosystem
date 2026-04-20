ALTER TABLE "tenants" ADD COLUMN "store_code" varchar(50);
ALTER TABLE "tenants" ADD COLUMN "mobile_sync_secret" varchar(255);
ALTER TABLE "appointments" ALTER COLUMN "customer_id" DROP NOT NULL;
