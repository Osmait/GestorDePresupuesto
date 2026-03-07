WITH payment_base AS (
    SELECT
        p.id AS payment_id,
        p.card_id,
        p.from_account_id,
        a.user_id,
        COALESCE(NULLIF(p.source_currency, ''), NULLIF(a.currency, ''), 'DOP') AS tx_currency,
        CASE
            WHEN COALESCE(p.source_amount, 0) > 0 THEN p.source_amount
            ELSE p.amount
        END AS debit_amount,
        COALESCE(p.payment_date, p.created_at) AS tx_created_at
    FROM card_payments p
    JOIN account a ON a.id = p.from_account_id
    WHERE p.status = 'completed'
),
users_with_payments_without_categories AS (
    SELECT DISTINCT pb.user_id
    FROM payment_base pb
    WHERE NOT EXISTS (
        SELECT 1
        FROM categorys c
        WHERE c.user_id = pb.user_id
    )
)
INSERT INTO categorys (id, name, icon, color, created_at, user_id)
SELECT
    'cpcat_' || SUBSTRING(MD5(u.user_id) FROM 1 FOR 26),
    'Pago de tarjeta',
    'credit-card',
    '#64748b',
    NOW(),
    u.user_id
FROM users_with_payments_without_categories u
ON CONFLICT (id) DO NOTHING;

WITH payment_base AS (
    SELECT
        p.id AS payment_id,
        p.card_id,
        p.from_account_id,
        a.user_id,
        COALESCE(NULLIF(p.source_currency, ''), NULLIF(a.currency, ''), 'DOP') AS tx_currency,
        CASE
            WHEN COALESCE(p.source_amount, 0) > 0 THEN p.source_amount
            ELSE p.amount
        END AS debit_amount,
        COALESCE(p.payment_date, p.created_at) AS tx_created_at
    FROM card_payments p
    JOIN account a ON a.id = p.from_account_id
    WHERE p.status = 'completed'
)
UPDATE transactions t
SET type_transation = 'card_payment'
FROM payment_base pb
WHERE t.user_id = pb.user_id
  AND t.account_id = pb.from_account_id
  AND COALESCE(t.currency, 'DOP') = pb.tx_currency
  AND t.type_transation = 'bill'
  AND ABS(ABS(t.amount) - pb.debit_amount) < 0.01
  AND t.created_at BETWEEN pb.tx_created_at - INTERVAL '5 minutes' AND pb.tx_created_at + INTERVAL '5 minutes'
  AND (
      t.transaction_name = 'Card Payment'
      OR t.transaction_description ILIKE '%payment to % card%'
      OR t.transaction_description ILIKE '%card payment%'
  );

WITH payment_base AS (
    SELECT
        p.id AS payment_id,
        p.card_id,
        p.from_account_id,
        a.user_id,
        COALESCE(NULLIF(p.source_currency, ''), NULLIF(a.currency, ''), 'DOP') AS tx_currency,
        CASE
            WHEN COALESCE(p.source_amount, 0) > 0 THEN p.source_amount
            ELSE p.amount
        END AS debit_amount,
        COALESCE(p.payment_date, p.created_at) AS tx_created_at
    FROM card_payments p
    JOIN account a ON a.id = p.from_account_id
    WHERE p.status = 'completed'
)
INSERT INTO transactions (
    id,
    transaction_name,
    transaction_description,
    amount,
    type_transation,
    account_id,
    user_id,
    category_id,
    budget_id,
    currency,
    created_at
)
SELECT
    'cpmt_' || SUBSTRING(MD5(pb.payment_id) FROM 1 FOR 27),
    'Card Payment',
    'Card payment settlement [card_payment_id=' || pb.payment_id || ']',
    -pb.debit_amount,
    'card_payment',
    pb.from_account_id,
    pb.user_id,
    (
        SELECT c.id
        FROM categorys c
        WHERE c.user_id = pb.user_id
        ORDER BY c.created_at ASC
        LIMIT 1
    ),
    NULL,
    pb.tx_currency,
    pb.tx_created_at
FROM payment_base pb
WHERE NOT EXISTS (
    SELECT 1
    FROM transactions t
    WHERE t.user_id = pb.user_id
      AND t.account_id = pb.from_account_id
      AND COALESCE(t.currency, 'DOP') = pb.tx_currency
      AND t.type_transation IN ('bill', 'card_payment')
      AND ABS(ABS(t.amount) - pb.debit_amount) < 0.01
      AND t.created_at BETWEEN pb.tx_created_at - INTERVAL '5 minutes' AND pb.tx_created_at + INTERVAL '5 minutes'
)
AND EXISTS (
    SELECT 1
    FROM categorys c
    WHERE c.user_id = pb.user_id
);
