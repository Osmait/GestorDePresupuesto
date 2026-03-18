-- WARNING: Only safe to run before any new transactions are created
-- under the new convention.
-- Restores negative sign to expense-type transactions.
UPDATE transactions
SET amount = amount * -1
WHERE type_transation IN (
    'bill',
    'card_payment',
    'investment_purchase',
    'investment_funding',
    'loan_disbursement'
)
AND amount > 0;
