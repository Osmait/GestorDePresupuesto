-- Recurring transactions are now scheduled by an explicit next_execution_date
-- (a calendar DATE in the application time zone, APP_TIMEZONE) instead of
-- matching day_of_month against "today". The scheduler claims rows whose
-- next_execution_date <= today, executes that occurrence and advances the date
-- to the next month, clamping day_of_month to the month length (31 -> Feb 28/29).
ALTER TABLE recurring_transactions ADD COLUMN IF NOT EXISTS next_execution_date DATE;

-- Backfill existing rules. To avoid creating surprise historical transactions
-- on deploy, the first scheduled occurrence is never earlier than the first
-- day of the current month:
--   * already executed  -> first occurrence in the month after the last run
--   * never executed    -> first occurrence on/after the creation date
UPDATE recurring_transactions rt
SET next_execution_date = CASE WHEN c.candidate >= c.floor_date THEN c.candidate ELSE c.candidate_next END
FROM (
    SELECT f.id,
           f.floor_date,
           make_date(EXTRACT(YEAR FROM f.floor_date)::int,
                     EXTRACT(MONTH FROM f.floor_date)::int,
                     LEAST(f.day_of_month,
                           EXTRACT(DAY FROM (date_trunc('month', f.floor_date) + INTERVAL '1 month - 1 day'))::int)) AS candidate,
           make_date(EXTRACT(YEAR FROM f.next_month)::int,
                     EXTRACT(MONTH FROM f.next_month)::int,
                     LEAST(f.day_of_month,
                           EXTRACT(DAY FROM (f.next_month + INTERVAL '1 month - 1 day'))::int)) AS candidate_next
    FROM (
        SELECT b.id,
               b.day_of_month,
               b.floor_date,
               (date_trunc('month', b.floor_date) + INTERVAL '1 month')::date AS next_month
        FROM (
            SELECT id,
                   day_of_month,
                   GREATEST(
                       COALESCE((date_trunc('month', last_execution_date) + INTERVAL '1 month')::date,
                                created_at::date),
                       date_trunc('month', CURRENT_DATE)::date
                   ) AS floor_date
            FROM recurring_transactions
        ) b
    ) f
) c
WHERE rt.id = c.id;

ALTER TABLE recurring_transactions ALTER COLUMN next_execution_date SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recurring_transactions_next_execution_date
    ON recurring_transactions(next_execution_date);
