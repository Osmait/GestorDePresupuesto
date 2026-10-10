-- ============================================================
-- Migration 000052: stored account balances
--
-- account_balances holds, per (user, account, currency), the net total of the
-- account's transactions (split over up to 32 "slots", see below):
-- income-like types (income, loan_collection,
-- loan_cancellation_refund) add, every other type subtracts. It is exactly what
-- the ledger query
--
--   SELECT SUM(CASE WHEN type_transation IN ('income','loan_collection',
--          'loan_cancellation_refund') THEN amount ELSE -amount END)
--   FROM transactions WHERE user_id = $u AND account_id = $a [AND currency ...]
--
-- returns, so reads become an index lookup instead of a scan of the ledger.
-- A NULL transaction currency is stored as 'DOP' (the ledger query already
-- treats it as DOP). The account's initial balance (account.balance) is NOT
-- included: it stays on the account row, and the API keeps reporting
-- current_balance = account.balance + SUM(account_balances.balance), so an
-- initial balance change needs no balance maintenance at all.
--
-- Write contention: a single counter row per account would serialise every
-- request that writes a transaction on that account from its INSERT until its
-- COMMIT (measured: inserts queueing on the row lock at ~25-50 req/s for one
-- busy account). The counter is therefore striped: each writer adds its delta
-- to the slot of its own server process (pg_backend_pid() % 32), so concurrent
-- requests on different connections touch different rows, and the balance of
-- an (account, currency) is the SUM of its slots (at most 32 small rows, read
-- through the primary key). Any slot may receive any delta; only the sum has a
-- meaning.
--
-- The table is maintained by the triggers below, in the same transaction as
-- the transactions write, so a reader never sees a ledger row without its
-- balance effect (or vice versa).
--
-- RLS: same isolation policy as every other user-owned table. The trigger
-- functions are SECURITY INVOKER: a balance row always carries the user_id of
-- the transaction row being written, and that write already passed the
-- identical transactions_isolation policy (same session, same settings), so the
-- balance write passes account_balances_isolation for exactly the same callers
-- (request transactions, the recurring scheduler with its RLS settings, admin
-- context and BYPASSRLS roles) whether or not the role bypasses RLS.
-- ============================================================

CREATE TABLE account_balances (
    user_id    VARCHAR       NOT NULL,
    account_id VARCHAR       NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    currency   VARCHAR(3)    NOT NULL,
    slot       SMALLINT      NOT NULL DEFAULT 0 CHECK (slot BETWEEN 0 AND 31),
    balance    NUMERIC(19,4) NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, account_id, currency, slot)
);

-- ON DELETE CASCADE lookups from account.
CREATE INDEX idx_account_balances_account ON account_balances(account_id);

ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_balances FORCE ROW LEVEL SECURITY;
CREATE POLICY account_balances_isolation ON account_balances
    USING (user_id = (SELECT current_setting('app.current_user_id', true))
        OR (SELECT current_setting('app.is_admin', true)) = 'true');

-- Signed effect of one transaction row on its account balance.
CREATE FUNCTION fn_transaction_balance_effect(t_type TypeTransaction, t_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT CASE
        WHEN t_type::text IN ('income', 'loan_collection', 'loan_cancellation_refund') THEN t_amount
        ELSE -t_amount
    END
$$;

-- Adds delta to the caller's slot of one balance, creating the row on first use.
CREATE FUNCTION fn_account_balance_add(p_user_id VARCHAR, p_account_id VARCHAR, p_currency VARCHAR, p_delta NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_delta = 0 THEN
        RETURN;
    END IF;
    INSERT INTO account_balances AS b (user_id, account_id, currency, slot, balance)
    VALUES (p_user_id, p_account_id, p_currency, (pg_backend_pid() % 32)::SMALLINT, p_delta)
    ON CONFLICT (user_id, account_id, currency, slot)
    DO UPDATE SET balance = b.balance + EXCLUDED.balance;
END;
$$;

CREATE FUNCTION fn_transactions_maintain_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    old_key TEXT;
    new_key TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM fn_account_balance_add(NEW.user_id, NEW.account_id, COALESCE(NEW.currency, 'DOP'),
            fn_transaction_balance_effect(NEW.type_transation, NEW.amount));
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM fn_account_balance_add(OLD.user_id, OLD.account_id, COALESCE(OLD.currency, 'DOP'),
            -fn_transaction_balance_effect(OLD.type_transation, OLD.amount));
    ELSE
        old_key := OLD.user_id || chr(31) || OLD.account_id || chr(31) || COALESCE(OLD.currency, 'DOP');
        new_key := NEW.user_id || chr(31) || NEW.account_id || chr(31) || COALESCE(NEW.currency, 'DOP');
        IF old_key = new_key THEN
            PERFORM fn_account_balance_add(NEW.user_id, NEW.account_id, COALESCE(NEW.currency, 'DOP'),
                fn_transaction_balance_effect(NEW.type_transation, NEW.amount)
                - fn_transaction_balance_effect(OLD.type_transation, OLD.amount));
        ELSIF old_key < new_key THEN
            -- Moved to another account/currency: touch both rows in key order so
            -- two opposite moves cannot deadlock.
            PERFORM fn_account_balance_add(OLD.user_id, OLD.account_id, COALESCE(OLD.currency, 'DOP'),
                -fn_transaction_balance_effect(OLD.type_transation, OLD.amount));
            PERFORM fn_account_balance_add(NEW.user_id, NEW.account_id, COALESCE(NEW.currency, 'DOP'),
                fn_transaction_balance_effect(NEW.type_transation, NEW.amount));
        ELSE
            PERFORM fn_account_balance_add(NEW.user_id, NEW.account_id, COALESCE(NEW.currency, 'DOP'),
                fn_transaction_balance_effect(NEW.type_transation, NEW.amount));
            PERFORM fn_account_balance_add(OLD.user_id, OLD.account_id, COALESCE(OLD.currency, 'DOP'),
                -fn_transaction_balance_effect(OLD.type_transation, OLD.amount));
        END IF;
    END IF;
    RETURN NULL; -- AFTER trigger
END;
$$;

-- TRUNCATE fires no row triggers: empty the derived table with it.
CREATE FUNCTION fn_transactions_truncate_balances()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM account_balances;
    RETURN NULL;
END;
$$;

-- Creating the triggers takes a SHARE ROW EXCLUSIVE lock on transactions that
-- is held until this migration commits, so no write can slip in between the
-- trigger creation and the backfill below.
CREATE TRIGGER transactions_maintain_balance_ins_del
    AFTER INSERT OR DELETE ON transactions
    FOR EACH ROW EXECUTE FUNCTION fn_transactions_maintain_balance();

CREATE TRIGGER transactions_maintain_balance_upd
    AFTER UPDATE OF amount, type_transation, account_id, currency, user_id ON transactions
    FOR EACH ROW
    WHEN (OLD.amount IS DISTINCT FROM NEW.amount
       OR OLD.type_transation IS DISTINCT FROM NEW.type_transation
       OR OLD.account_id IS DISTINCT FROM NEW.account_id
       OR OLD.currency IS DISTINCT FROM NEW.currency
       OR OLD.user_id IS DISTINCT FROM NEW.user_id)
    EXECUTE FUNCTION fn_transactions_maintain_balance();

CREATE TRIGGER transactions_truncate_balances
    AFTER TRUNCATE ON transactions
    FOR EACH STATEMENT EXECUTE FUNCTION fn_transactions_truncate_balances();

-- Backfill. The migration role may be subject to FORCE ROW LEVEL SECURITY
-- (it is not necessarily BYPASSRLS); the admin setting makes every row visible
-- to the policies of both tables for the rest of this migration transaction.
SELECT set_config('app.is_admin', 'true', true);

INSERT INTO account_balances (user_id, account_id, currency, slot, balance)
SELECT user_id, account_id, COALESCE(currency, 'DOP'), 0,
       SUM(fn_transaction_balance_effect(type_transation, amount))
FROM transactions
GROUP BY user_id, account_id, COALESCE(currency, 'DOP');

SELECT set_config('app.is_admin', '', true);
