-- ── PHASE 10: RLS for guardian tables ───────────────────────────────────────

ALTER TABLE guardian_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_portal_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_notifications ENABLE ROW LEVEL SECURITY;

-- guardian_profiles: customer sees own guardians; staff sees tenant customers' guardians; super_admin sees all
CREATE POLICY "guardian_profiles_isolation" ON guardian_profiles
  FOR ALL USING (
    current_user_role() = 'super_admin'
    OR customer_id IN (SELECT id FROM customers WHERE user_id = current_user_id())
    OR current_user_role() IN ('owner', 'manager', 'stylist', 'receptionist')
  );

-- guardian_portal_tokens: heavily restricted — only super_admin and the owning customer
CREATE POLICY "guardian_portal_tokens_isolation" ON guardian_portal_tokens
  FOR ALL USING (
    current_user_role() = 'super_admin'
    OR customer_id IN (SELECT id FROM customers WHERE user_id = current_user_id())
  );

-- guardian_notifications: customer sees own; staff sees tenant notifications; super_admin sees all
CREATE POLICY "guardian_notifications_isolation" ON guardian_notifications
  FOR ALL USING (
    current_user_role() = 'super_admin'
    OR tenant_id = current_tenant_id()
    OR customer_id IN (SELECT id FROM customers WHERE user_id = current_user_id())
  );
