-- Widen every column that stores an account, user or transaction id.
--
-- Ids are generated in several formats: KSUIDs (27 chars), faker/hex ids
-- (32 chars) and UUIDs (36 chars, e.g. the demo account/user/transactions in
-- services/auth/authServices.go). The referenced primary keys (account.id,
-- users.id, transactions.id, categorys.id) are unbounded VARCHAR, but several
-- referencing columns were declared VARCHAR(32)/(36)/(50). Paying a card from
-- the demo account failed with
--   pq: value too long for type character varying(32)
-- because card_payments.from_account_id could not hold a UUID.
--
-- Every such column becomes unbounded VARCHAR, matching the referenced keys.
-- Bounded id columns left as they are only ever hold ids the server mints
-- itself for that entity (KSUIDs, 27 chars): the primary keys of card_*,
-- certificate*, loan*, reconciliation_*, savings_goals, passkeys and
-- feature_flag_* tables plus their internal links (balance_id,
-- certificate_id, loan_id, session_id); refresh_tokens (27), webauthn_sessions
-- (64) and user_api_keys.id (UUID, 50).
-- varchar(n) -> varchar is binary coercible: no table rewrite and indexes are
-- kept. PostgreSQL refuses to change the type of a column used by a row-level
-- security policy, so the policies that reference these columns are dropped
-- and recreated verbatim (same definitions as 000039/000040/000041).

DROP POLICY IF EXISTS credit_cards_isolation ON credit_cards;
DROP POLICY IF EXISTS card_balances_isolation ON card_balances;
DROP POLICY IF EXISTS card_payments_isolation ON card_payments;
DROP POLICY IF EXISTS card_balance_resets_isolation ON card_balance_resets;
DROP POLICY IF EXISTS certificates_isolation ON certificates;
DROP POLICY IF EXISTS certificate_payments_isolation ON certificate_payments;
DROP POLICY IF EXISTS user_api_keys_isolation ON user_api_keys;

-- Account ids
ALTER TABLE credit_cards        ALTER COLUMN account_id TYPE VARCHAR;
ALTER TABLE card_balances       ALTER COLUMN card_id TYPE VARCHAR;
ALTER TABLE card_balance_resets ALTER COLUMN card_id TYPE VARCHAR;
ALTER TABLE card_payments
    ALTER COLUMN card_id         TYPE VARCHAR,
    ALTER COLUMN from_account_id TYPE VARCHAR;
ALTER TABLE certificates        ALTER COLUMN payout_account_id TYPE VARCHAR;
ALTER TABLE loans               ALTER COLUMN source_account_id TYPE VARCHAR;
ALTER TABLE loan_payments       ALTER COLUMN destination_account_id TYPE VARCHAR;

-- Account, transaction and user ids on certificate payments
ALTER TABLE certificate_payments
    ALTER COLUMN payout_account_id TYPE VARCHAR,
    ALTER COLUMN transaction_id    TYPE VARCHAR,
    ALTER COLUMN user_id           TYPE VARCHAR;

-- User ids
ALTER TABLE certificates  ALTER COLUMN user_id TYPE VARCHAR;
ALTER TABLE user_api_keys ALTER COLUMN user_id TYPE VARCHAR;

-- Transaction ids
ALTER TABLE reconciliation_items
    ALTER COLUMN extracted_transaction_id TYPE VARCHAR,
    ALTER COLUMN linked_transaction_id    TYPE VARCHAR,
    ALTER COLUMN created_transaction_id   TYPE VARCHAR;

-- Recreate the policies exactly as they were.
CREATE POLICY credit_cards_isolation ON credit_cards
    USING (current_setting('app.is_admin', true) = 'true'
        OR EXISTS (
            SELECT 1 FROM account
            WHERE account.id = credit_cards.account_id
              AND account.user_id = current_setting('app.current_user_id', true)
        ));

CREATE POLICY card_balances_isolation ON card_balances
    USING (current_setting('app.is_admin', true) = 'true'
        OR EXISTS (
            SELECT 1 FROM account
            JOIN credit_cards ON credit_cards.account_id = account.id
            WHERE credit_cards.account_id = card_balances.card_id
              AND account.user_id = current_setting('app.current_user_id', true)
        ));

CREATE POLICY card_payments_isolation ON card_payments
    USING (current_setting('app.is_admin', true) = 'true'
        OR EXISTS (
            SELECT 1 FROM account
            JOIN credit_cards ON credit_cards.account_id = account.id
            WHERE credit_cards.account_id = card_payments.card_id
              AND account.user_id = current_setting('app.current_user_id', true)
        ));

CREATE POLICY card_balance_resets_isolation ON card_balance_resets
    USING (current_setting('app.is_admin', true) = 'true'
        OR EXISTS (
            SELECT 1 FROM account
            JOIN credit_cards ON credit_cards.account_id = account.id
            WHERE credit_cards.account_id = card_balance_resets.card_id
              AND account.user_id = current_setting('app.current_user_id', true)
        ));

CREATE POLICY certificates_isolation ON certificates
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.is_admin', true) = 'true');

CREATE POLICY certificate_payments_isolation ON certificate_payments
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.is_admin', true) = 'true');

CREATE POLICY user_api_keys_isolation ON user_api_keys
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '__admin__');
