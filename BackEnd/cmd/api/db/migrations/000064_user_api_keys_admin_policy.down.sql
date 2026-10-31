DROP POLICY IF EXISTS user_api_keys_isolation ON user_api_keys;
CREATE POLICY user_api_keys_isolation ON user_api_keys
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '__admin__');
