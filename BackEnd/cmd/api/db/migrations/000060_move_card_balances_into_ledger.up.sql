-- ============================================================
-- Migration 000060: a credit card's debt is the ledger balance of its account
--
-- Until now a card balance was split in two: charges were transactions on the
-- card account (in account_balances), while the initial debt, payments and
-- resets lived in card_balances.current_balance. GET /account only saw the
-- first part, so a card showed every charge ever made as negative balance.
--
-- This migration writes the second part into the ledger of the card account,
-- per (card, currency), and zeroes current_balance:
--   * every completed card payment   -> card_payment_received (debt down) at
--                                       its payment date
--   * every balance reset            -> one adjustment that undid the debt at
--                                       the time (-previous_balance)
--   * whatever is left (the initial  -> one opening adjustment at the date the
--     debt typed at creation)           card balance was created
-- so each card's real balance (current_balance + ledger) is unchanged; the
-- check at the end aborts the migration otherwise. The rows use ids prefixed
-- m60p_/m60r_/m60o_ (ksuids never contain '_'), which the down migration
-- relies on. Categories: the user's "Pago de tarjeta" and "Ajuste de saldo"
-- system categories (deterministic ids of domain/category.System, adopting a
-- legacy row with a known name like EnsureSystem does).
--
-- current_balance stays (always 0) and is no longer read or written.
-- ============================================================

SELECT set_config('app.is_admin', 'true', true);
SELECT set_config('lock_timeout', '10s', true);

CREATE TEMP TABLE m60_before ON COMMIT DROP AS
SELECT cb.id AS balance_id,
       cb.card_id,
       cb.currency,
       cb.created_at,
       a.user_id,
       cb.current_balance,
       cb.current_balance + COALESCE((
           SELECT SUM(ab.balance) FROM account_balances ab
           WHERE ab.user_id = a.user_id AND ab.account_id = cb.card_id AND ab.currency = cb.currency
       ), 0) AS real_balance
FROM card_balances cb
JOIN account a ON a.id = cb.card_id;

CREATE TEMP TABLE m60_users ON COMMIT DROP AS
SELECT DISTINCT user_id,
       'cpcat_' || substr(md5(user_id), 1, 26) AS payment_cat_id,
       'syscat_' || substr(md5('balance_adjustment:' || user_id), 1, 26) AS adjustment_cat_id
FROM m60_before;

-- Adopt a legacy category with a known name when the deterministic one is missing.
UPDATE m60_users u SET payment_cat_id = c.id
FROM (
    SELECT DISTINCT ON (user_id) user_id, id FROM categorys
    WHERE LOWER(TRIM(name)) IN ('pago de tarjeta', 'card payment')
    ORDER BY user_id, created_at
) c
WHERE c.user_id = u.user_id
  AND NOT EXISTS (SELECT 1 FROM categorys d WHERE d.id = u.payment_cat_id);

UPDATE m60_users u SET adjustment_cat_id = c.id
FROM (
    SELECT DISTINCT ON (user_id) user_id, id FROM categorys
    WHERE LOWER(TRIM(name)) IN ('ajuste de saldo', 'balance adjustment')
    ORDER BY user_id, created_at
) c
WHERE c.user_id = u.user_id
  AND NOT EXISTS (SELECT 1 FROM categorys d WHERE d.id = u.adjustment_cat_id);

INSERT INTO categorys (id, name, icon, color, created_at, user_id)
SELECT payment_cat_id, 'Pago de tarjeta', '💳', '#64748b', NOW(), user_id FROM m60_users
ON CONFLICT (id) DO NOTHING;

INSERT INTO categorys (id, name, icon, color, created_at, user_id)
SELECT adjustment_cat_id, 'Ajuste de saldo', '⚖️', '#8b5cf6', NOW(), user_id FROM m60_users
ON CONFLICT (id) DO NOTHING;

-- Payments: the debt went down by the payment amount.
INSERT INTO transactions (id, transaction_name, transaction_description, amount, type_transation, account_id, user_id, category_id, currency, created_at)
SELECT 'm60p_' || p.id, 'Pago recibido', COALESCE(NULLIF(TRIM(p.notes), ''), 'Pago de tarjeta'),
       p.amount, 'card_payment_received', p.card_id, b.user_id, u.payment_cat_id, p.currency, p.payment_date
FROM card_payments p
JOIN m60_before b ON b.card_id = p.card_id AND b.currency = p.currency
JOIN m60_users u ON u.user_id = b.user_id
WHERE p.status = 'completed' AND p.amount <> 0;

-- Resets: the reset moved the stored balance by -previous_balance.
INSERT INTO transactions (id, transaction_name, transaction_description, amount, type_transation, account_id, user_id, category_id, currency, created_at)
SELECT 'm60r_' || r.id, 'Ajuste de saldo', COALESCE(NULLIF(TRIM(r.notes), ''), 'Reinicio del saldo de la tarjeta'),
       ABS(r.previous_balance),
       (CASE WHEN r.previous_balance < 0 THEN 'adjustment_in' ELSE 'adjustment_out' END)::TypeTransaction,
       r.card_id, b.user_id, u.adjustment_cat_id, r.currency, r.created_at
FROM card_balance_resets r
JOIN m60_before b ON b.balance_id = r.balance_id
JOIN m60_users u ON u.user_id = b.user_id
WHERE r.previous_balance <> 0;

-- Opening balance: what current_balance holds beyond payments and resets.
INSERT INTO transactions (id, transaction_name, transaction_description, amount, type_transation, account_id, user_id, category_id, currency, created_at)
SELECT 'm60o_' || o.balance_id, 'Ajuste de saldo', 'Saldo inicial de la tarjeta',
       ABS(o.opening),
       (CASE WHEN o.opening > 0 THEN 'adjustment_in' ELSE 'adjustment_out' END)::TypeTransaction,
       o.card_id, o.user_id, u.adjustment_cat_id, o.currency, o.created_at
FROM (
    SELECT b.*,
           b.current_balance
             - COALESCE((SELECT SUM(p.amount) FROM card_payments p
                         WHERE p.card_id = b.card_id AND p.currency = b.currency AND p.status = 'completed'), 0)
             + COALESCE((SELECT SUM(r.previous_balance) FROM card_balance_resets r
                         WHERE r.balance_id = b.balance_id), 0) AS opening
    FROM m60_before b
) o
JOIN m60_users u ON u.user_id = o.user_id
WHERE o.opening <> 0;

UPDATE card_balances SET current_balance = 0, updated_at = NOW() WHERE current_balance <> 0;

DO $$
DECLARE
    mismatches INTEGER;
BEGIN
    SELECT COUNT(*) INTO mismatches
    FROM m60_before b
    JOIN card_balances cb ON cb.id = b.balance_id
    WHERE b.real_balance <> cb.current_balance + COALESCE((
        SELECT SUM(ab.balance) FROM account_balances ab
        WHERE ab.user_id = b.user_id AND ab.account_id = b.card_id AND ab.currency = b.currency
    ), 0);
    IF mismatches > 0 THEN
        RAISE EXCEPTION 'migration 000060: % card balances would change', mismatches;
    END IF;
END $$;
