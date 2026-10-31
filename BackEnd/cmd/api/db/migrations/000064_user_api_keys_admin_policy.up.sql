-- ============================================================
-- Migration 000064: user_api_keys policy on app.is_admin
--
-- 000039 moved every policy from the '__admin__' user id sentinel to the
-- app.is_admin setting, but user_api_keys (000040, recreated in 000051) kept
-- the sentinel, which nothing sets any more. API key authentication looks the
-- key up before the user is known, in a system transaction with
-- app.is_admin = true (txhelper.WithAdminTx): with a database role subject to
-- row level security (NOBYPASSRLS) it found no key at all.
-- ============================================================

DROP POLICY IF EXISTS user_api_keys_isolation ON user_api_keys;
CREATE POLICY user_api_keys_isolation ON user_api_keys
    USING (user_id = (SELECT current_setting('app.current_user_id', true))
        OR (SELECT current_setting('app.is_admin', true)) = 'true');
