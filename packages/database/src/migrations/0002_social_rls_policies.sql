-- ── PHASE 9: RLS for social tables ──────────────────────────────────────────

ALTER TABLE bridal_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridal_party_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE dress_vote_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dress_votes ENABLE ROW LEVEL SECURITY;

-- bridal_parties: lead sees own parties; staff sees tenant parties; super_admin sees all
CREATE POLICY "bridal_parties_isolation" ON bridal_parties
  FOR ALL USING (
    current_user_role() = 'super_admin'
    OR tenant_id = current_tenant_id()
    OR lead_customer_id IN (
      SELECT id FROM customers WHERE user_id = current_user_id()
    )
  );

-- bridal_party_members: members see their own records; lead sees all in their party
CREATE POLICY "bridal_party_members_isolation" ON bridal_party_members
  FOR ALL USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = current_user_id())
    OR party_id IN (
      SELECT id FROM bridal_parties
      WHERE lead_customer_id IN (SELECT id FROM customers WHERE user_id = current_user_id())
    )
    OR current_user_role() IN ('super_admin', 'owner', 'manager')
  );

-- dress_vote_sessions: owner sees own; platform-wide read for active sessions (voting)
CREATE POLICY "dress_vote_sessions_owner" ON dress_vote_sessions
  FOR SELECT USING (is_active = true OR customer_id IN (
    SELECT id FROM customers WHERE user_id = current_user_id()
  ));

CREATE POLICY "dress_vote_sessions_write" ON dress_vote_sessions
  FOR INSERT WITH CHECK (
    customer_id IN (SELECT id FROM customers WHERE user_id = current_user_id())
  );

CREATE POLICY "dress_vote_sessions_update" ON dress_vote_sessions
  FOR UPDATE USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = current_user_id())
    OR current_user_role() = 'super_admin'
  );

-- dress_votes: public insert (no auth required for voting); owner and staff can read
CREATE POLICY "dress_votes_public_insert" ON dress_votes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "dress_votes_read" ON dress_votes
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM dress_vote_sessions WHERE is_active = true
    )
    OR current_user_role() IN ('super_admin', 'owner', 'manager')
  );
