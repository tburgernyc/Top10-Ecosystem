-- ── 0004: Fix remaining RLS gaps flagged by Supabase advisor ─────────────────
-- Covers three problems:
--   1. Current-schema tables missing RLS (tenants, users, boutique_staff, dresses, customers)
--   2. Legacy tables still in DB that need RLS locked down (deny-all default)
--   3. Mutable search_path on public functions (security warning)

-- ─── 1. FIX MUTABLE SEARCH_PATH ON ALL PUBLIC FUNCTIONS ─────────────────────
-- These were defined in 0001 without SET search_path, making them mutable.
ALTER FUNCTION public.current_tenant_id() SET search_path = pg_catalog, public;
ALTER FUNCTION public.current_user_id()   SET search_path = pg_catalog, public;
ALTER FUNCTION public.current_user_role() SET search_path = pg_catalog, public;

-- Supabase-native trigger functions (created outside migrations).
-- ALTER FUNCTION does not support IF EXISTS, so use a DO block to guard.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE 'ALTER FUNCTION public.handle_new_user() SET search_path = pg_catalog, public';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_updated_at'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE 'ALTER FUNCTION public.update_updated_at() SET search_path = pg_catalog, public';
  END IF;
END $$;

-- ─── 2. ENABLE RLS ON ACTIVE-SCHEMA TABLES MISSING FROM 0001 ────────────────

-- tenants: Public SELECT needed for subdomain routing (no auth required).
--          All writes restricted to super_admin only.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_public_read" ON tenants
  FOR SELECT USING (true);

CREATE POLICY "tenants_admin_write" ON tenants
  FOR INSERT WITH CHECK (current_user_role() = 'super_admin');

CREATE POLICY "tenants_admin_update" ON tenants
  FOR UPDATE USING (current_user_role() = 'super_admin');

CREATE POLICY "tenants_admin_delete" ON tenants
  FOR DELETE USING (current_user_role() = 'super_admin');

-- users: Auth mirror. Own record or any staff can SELECT.
--        Inserts happen via Supabase auth trigger (service role bypasses RLS).
--        Only the owner of the record can UPDATE.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read" ON users
  FOR SELECT USING (
    id = current_user_id()
    OR current_user_role() IN ('super_admin', 'owner', 'manager', 'stylist', 'receptionist')
  );

CREATE POLICY "users_insert_service" ON users
  FOR INSERT WITH CHECK (true);  -- Auth trigger runs as service role; policy is belt-and-suspenders

CREATE POLICY "users_self_update" ON users
  FOR UPDATE USING (id = current_user_id());

-- boutique_staff: super_admin sees all; others see their own tenant or own record.
--                 Writes: super_admin or owner.
ALTER TABLE boutique_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boutique_staff_read" ON boutique_staff
  FOR SELECT USING (
    current_user_role() = 'super_admin'
    OR tenant_id = current_tenant_id()
    OR user_id = current_user_id()
  );

CREATE POLICY "boutique_staff_write" ON boutique_staff
  FOR INSERT WITH CHECK (current_user_role() IN ('super_admin', 'owner'));

CREATE POLICY "boutique_staff_update" ON boutique_staff
  FOR UPDATE USING (current_user_role() IN ('super_admin', 'owner'));

CREATE POLICY "boutique_staff_delete" ON boutique_staff
  FOR DELETE USING (current_user_role() = 'super_admin');

-- dresses: Global catalog. Active dresses are public. Super_admin manages catalog.
ALTER TABLE dresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dresses_public_read" ON dresses
  FOR SELECT USING (is_active = true OR current_user_role() = 'super_admin');

CREATE POLICY "dresses_admin_write" ON dresses
  FOR INSERT WITH CHECK (current_user_role() = 'super_admin');

CREATE POLICY "dresses_admin_update" ON dresses
  FOR UPDATE USING (current_user_role() = 'super_admin');

CREATE POLICY "dresses_admin_delete" ON dresses
  FOR DELETE USING (current_user_role() = 'super_admin');

-- customers: Customer sees own record; any authenticated staff can read.
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_read" ON customers
  FOR SELECT USING (
    user_id = current_user_id()
    OR current_user_role() IN ('super_admin', 'owner', 'manager', 'stylist', 'receptionist')
  );

CREATE POLICY "customers_self_insert" ON customers
  FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY "customers_self_update" ON customers
  FOR UPDATE USING (
    user_id = current_user_id()
    OR current_user_role() IN ('super_admin', 'owner', 'manager')
  );

-- ─── 3. LOCK DOWN LEGACY TABLES (old schema, deny-all by default) ────────────
-- These tables exist in the DB from earlier development but are no longer used
-- by the app. Enabling RLS with no policies creates an implicit deny-all.
ALTER TABLE IF EXISTS public.audit_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.locations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.categories             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_line_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mobile_sync_queue      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bookings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_variants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.services               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.boutiques              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.availability_inquiries ENABLE ROW LEVEL SECURITY;
