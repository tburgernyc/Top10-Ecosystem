-- Enable Row Level Security on sensitive tables
ALTER TABLE vto_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_style_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dress_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE walk_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE dress_inventory ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
  SELECT current_setting('request.tenant_id', true)::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_id() RETURNS uuid AS $$
  SELECT current_setting('request.user_id', true)::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_role() RETURNS text AS $$
  SELECT current_setting('request.role', true);
$$ LANGUAGE sql STABLE;

-- vto_sessions: Owner sees own sessions; staff sees tenant sessions
CREATE POLICY "vto_sessions_user_isolation" ON vto_sessions
  FOR ALL USING (
    user_id = current_user_id()
    OR (tenant_id = current_tenant_id() AND current_user_role() IN ('super_admin', 'owner', 'manager', 'stylist'))
  );

-- client_style_profiles: Owner sees own profile; staff sees tenant customer profiles
CREATE POLICY "client_style_profiles_isolation" ON client_style_profiles
  FOR ALL USING (
    user_id = current_user_id()
    OR current_user_role() IN ('super_admin', 'owner', 'manager', 'stylist')
  );

-- appointments: Tenant-scoped; super_admin sees all
CREATE POLICY "appointments_tenant_isolation" ON appointments
  FOR ALL USING (
    current_user_role() = 'super_admin'
    OR tenant_id = current_tenant_id()
  );

-- walk_ins: Tenant-scoped
CREATE POLICY "walk_ins_tenant_isolation" ON walk_ins
  FOR ALL USING (
    current_user_role() = 'super_admin'
    OR tenant_id = current_tenant_id()
  );

-- dress_inventory: Tenant-scoped
CREATE POLICY "dress_inventory_tenant_isolation" ON dress_inventory
  FOR ALL USING (
    current_user_role() = 'super_admin'
    OR tenant_id = current_tenant_id()
  );

-- dress_reservations: Customer sees own; staff sees tenant's
CREATE POLICY "dress_reservations_isolation" ON dress_reservations
  FOR ALL USING (
    current_user_role() = 'super_admin'
    OR tenant_id = current_tenant_id()
    OR customer_id IN (
      SELECT id FROM customers WHERE user_id = current_user_id()
    )
  );
