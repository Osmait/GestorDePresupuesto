-- Moves the rows written by 000060 back into card_balances.current_balance.
-- Payments and adjustments written by the application after 000060 stay in
-- the ledger: with the old code a card's real balance is still
-- current_balance + ledger, so they keep counting.
SELECT set_config('app.is_admin', 'true', true);

UPDATE card_balances cb SET current_balance = cb.current_balance + m.total, updated_at = NOW()
FROM (
    SELECT t.account_id, COALESCE(t.currency, 'DOP') AS currency,
           SUM(fn_transaction_balance_effect(t.type_transation, t.amount)) AS total
    FROM transactions t
    WHERE LEFT(t.id, 5) IN ('m60p_', 'm60r_', 'm60o_')
    GROUP BY 1, 2
) m
WHERE cb.card_id = m.account_id AND cb.currency = m.currency;

DELETE FROM transactions WHERE LEFT(id, 5) IN ('m60p_', 'm60r_', 'm60o_');
