-- Deterministic perf seed for the budget app.
-- Valid for both `main` (migrations <= 000044) and the security-hardening
-- branch (extra 000045-000051): only columns present in both schemas are
-- written, plus recurring_transactions.next_execution_date when it exists.
--
-- Run as a superuser (RLS is bypassed for the bulk load; the app itself runs
-- as the non-superuser owner "perf", so FORCE RLS policies apply to it):
--   docker exec -i perf-be-pg-15441 psql -v ON_ERROR_STOP=1 -U postgres -d perf < seed.sql
--
-- Data set:
--   heavy@perf.test : 5 bank accounts (3 DOP, 2 USD) + 2 credit cards,
--                     30 categories, 12 budgets, 50,000 transactions over the
--                     last 3 years, 10 recurring rules, 36 card payments per
--                     card, 8 investments, 3 loans (+installments/payments),
--                     3 certificates (+monthly payments), 12 monthly plan
--                     items, 60 notifications
--   light001..light200@perf.test : 2 accounts, 8 categories, 3 budgets,
--                     200 transactions over the last year each (40,000 total)
-- Password for every user: the psql variable perf_user_password
-- (scripts/prepare.sh passes $PERF_USER_PASSWORD).
-- Text columns the app always writes as '' are seeded as '' (not NULL):
-- several repositories scan them into plain strings.
-- Pseudo-randomness is a pure function of the row number (md5), so both
-- databases get byte-identical data. All timestamps are relative to the day
-- the seed runs (date_trunc('day', now())).

\set ON_ERROR_STOP 1
SET client_min_messages = warning;
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- r(key) -> deterministic float in [0,1)
CREATE OR REPLACE FUNCTION pg_temp.r(t text) RETURNS float8 LANGUAGE sql IMMUTABLE AS $$
  SELECT ((('x' || substr(md5(t), 1, 8))::bit(32)::int)::bigint + 2147483648)::float8 / 4294967296.0
$$;
-- 27-char ids, same length as the ksuids the app generates (fits varchar(32) on main)
CREATE OR REPLACE FUNCTION pg_temp.pid(prefix text, n bigint) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT prefix || lpad(n::text, 27 - length(prefix), '0')
$$;

CREATE TEMP TABLE anchor AS SELECT date_trunc('day', now()) AS t0;

-- one bcrypt hash (cost 10 = bcrypt.DefaultCost) shared by all users
CREATE TEMP TABLE pw AS SELECT crypt(:'perf_user_password', gen_salt('bf', 10)) AS h;

-- ---------------------------------------------------------------- users
-- user 0 = heavy, users 1..200 = light
INSERT INTO users (id, name, last_name, email, password, confirmed, created_at, is_demo, role)
SELECT pg_temp.pid('pu', u),
       CASE WHEN u = 0 THEN 'Heavy' ELSE 'Light' || u END, 'Perf',
       CASE WHEN u = 0 THEN 'heavy@perf.test' ELSE 'light' || lpad(u::text, 3, '0') || '@perf.test' END,
       (SELECT h FROM pw), true, (SELECT t0 FROM anchor) - interval '4 years', false, 'USER'
FROM generate_series(0, 200) u;

-- ---------------------------------------------------------------- accounts
-- heavy: k=1..5 bank (4,5 USD), k=6,7 credit cards. light: k=1 DOP, k=2 USD
INSERT INTO account (id, name_account, bank, balance, user_id, created_at, account_type, currency)
SELECT pg_temp.pid('pa', 0 * 10 + k),
       (ARRAY['Nomina','Ahorros','Gastos','Dolares','Inversion USD','Visa Oro','Mastercard'])[k],
       (ARRAY['Popular','BHD','Banreservas','Popular','BHD','Popular','Scotiabank'])[k],
       CASE WHEN k <= 5 THEN 25000 ELSE 0 END,
       pg_temp.pid('pu', 0), (SELECT t0 FROM anchor) - interval '3 years 1 day',
       CASE WHEN k <= 5 THEN 'bank' ELSE 'credit_card' END,
       CASE WHEN k IN (4, 5) THEN 'USD' ELSE 'DOP' END
FROM generate_series(1, 7) k;

INSERT INTO account (id, name_account, bank, balance, user_id, created_at, account_type, currency)
SELECT pg_temp.pid('pa', u * 10 + k), CASE WHEN k = 1 THEN 'Cuenta' ELSE 'USD' END, 'Popular',
       5000, pg_temp.pid('pu', u), (SELECT t0 FROM anchor) - interval '1 year 1 day', 'bank',
       CASE WHEN k = 1 THEN 'DOP' ELSE 'USD' END
FROM generate_series(1, 200) u, generate_series(1, 2) k;

-- ---------------------------------------------------------------- categories
-- heavy: 30 (1..3 income, 4..30 expense). light: 8 (1 income, 2..8 expense)
INSERT INTO categorys (id, name, icon, color, created_at, user_id)
SELECT pg_temp.pid('pc', u * 100 + c),
       (ARRAY['Salario','Freelance','Otros ingresos','Supermercado','Restaurantes','Gasolina','Luz','Agua',
              'Internet','Telefono','Alquiler','Seguro','Salud','Farmacia','Educacion','Gimnasio','Ropa',
              'Entretenimiento','Viajes','Regalos','Mascotas','Hogar','Mantenimiento auto','Taxi/Uber',
              'Suscripciones','Impuestos','Donaciones','Cafe','Electronica','Varios'])[c],
       'tag', '#' || substr(md5(c::text), 1, 6),
       (SELECT t0 FROM anchor) - interval '3 years 2 days' + c * interval '1 minute', pg_temp.pid('pu', u)
FROM generate_series(0, 200) u, generate_series(1, 30) c
WHERE u = 0 OR c <= 8;

-- ---------------------------------------------------------------- budgets
-- heavy: categories 4..15. light: categories 2..4
INSERT INTO budgets (id, category_id, amount, created_at, user_id)
SELECT pg_temp.pid('pb', u * 100 + c), pg_temp.pid('pc', u * 100 + c),
       round((5000 + pg_temp.r('b' || u || '-' || c) * 25000)::numeric, 2),
       (SELECT t0 FROM anchor) - interval '2 years', pg_temp.pid('pu', u)
FROM generate_series(0, 200) u, generate_series(2, 15) c
WHERE (u = 0 AND c BETWEEN 4 AND 15) OR (u > 0 AND c BETWEEN 2 AND 4);

-- ---------------------------------------------------------------- transactions (heavy)
CREATE TEMP TABLE merchants AS
SELECT ARRAY['Supermercado Nacional','Jumbo','La Sirena','Bravo','Shell','Texaco','Edesur','CAASD','Claro',
             'Altice','Netflix','Spotify','Uber','Farmacia Carol','Pizza Hut','Burger King','Starbucks',
             'Amazon','Zara','Home Depot','Ferreteria Americana','Plaza Lama','Ikea','Cinema Centro',
             'Gimnasio Body Shop','Colegio','Universidad','Seguros Universal','Humano ARS','Veterinaria',
             'Apple','Steam','Airbnb','JetBlue','Taller Mecanico','Peaje','Parqueo','Panaderia','Colmado',
             'Mercado Libre'] AS m;

INSERT INTO transactions (id, transaction_name, transaction_description, amount, type_transation,
                          account_id, user_id, category_id, budget_id, created_at, transaction_type, currency)
SELECT pg_temp.pid('pt', i), x.name, x.descr, x.amount, x.typ::typetransaction, x.acct,
       pg_temp.pid('pu', 0), x.cat,
       CASE WHEN x.typ = 'bill' AND x.catn BETWEEN 4 AND 15 AND pg_temp.r('g' || i) < 0.7
            THEN pg_temp.pid('pb', x.catn) END,
       x.ts, 'bill', x.cur
FROM generate_series(1, 50000) i
CROSS JOIN LATERAL (
  SELECT k, typ, catn, ts, acct, cur,
         pg_temp.pid('pc', catn) AS cat,
         (SELECT m FROM merchants)[1 + floor(pg_temp.r('n' || i) * 40)::int] AS name,
         CASE WHEN pg_temp.r('d' || i) < 0.3 THEN '' ELSE 'seed tx ' || i END AS descr,
         round((CASE
           WHEN typ = 'income' THEN 2000 + pg_temp.r('v' || i) * 60000
           WHEN typ = 'bill'   THEN 50 + pow(pg_temp.r('v' || i), 2) * 8000
           ELSE 500 + pg_temp.r('v' || i) * 5000 END
           / CASE WHEN cur = 'USD' THEN 60 ELSE 1 END)::numeric, 2) AS amount
  FROM (
    SELECT k,
           CASE WHEN acctn >= 6 THEN 'bill'
                WHEN ty < 0.80 THEN 'bill'
                WHEN ty < 0.98 THEN 'income'
                WHEN ty < 0.99 THEN 'investment_purchase'
                ELSE 'card_payment' END AS typ,
           ty, acctn,
           pg_temp.pid('pa', acctn) AS acct,
           CASE WHEN acctn IN (4, 5) THEN 'USD'
                WHEN acctn = 7 AND pg_temp.r('c' || i) < 0.3 THEN 'USD'
                ELSE 'DOP' END AS cur,
           (SELECT t0 FROM anchor) - (pg_temp.r('t' || i) * interval '1095 days') AS ts,
           k2
    FROM (SELECT pg_temp.r('a' || i) AS k, pg_temp.r('y' || i) AS ty, pg_temp.r('k' || i) AS k2) s
    CROSS JOIN LATERAL (SELECT CASE WHEN k < 0.35 THEN 1 WHEN k < 0.55 THEN 2 WHEN k < 0.65 THEN 3
                                    WHEN k < 0.80 THEN 4 WHEN k < 0.85 THEN 5 WHEN k < 0.93 THEN 6
                                    ELSE 7 END AS acctn) a
  ) b
  CROSS JOIN LATERAL (SELECT CASE WHEN typ = 'income' THEN 1 + floor(k2 * 3)::int
                                  ELSE 4 + floor(pow(k2, 1.5) * 27)::int END AS catn) c
) x;

-- ---------------------------------------------------------------- transactions (light)
INSERT INTO transactions (id, transaction_name, transaction_description, amount, type_transation,
                          account_id, user_id, category_id, budget_id, created_at, transaction_type, currency)
SELECT pg_temp.pid('pt', 100000 + u * 1000 + j), 'Compra ' || j, '',
       round(CASE WHEN inc THEN 3000 + pg_temp.r('lv' || u || '-' || j) * 30000
                  ELSE 50 + pg_temp.r('lv' || u || '-' || j) * 3000 END::numeric
             / CASE WHEN usd THEN 60 ELSE 1 END, 2),
       (CASE WHEN inc THEN 'income' ELSE 'bill' END)::typetransaction,
       pg_temp.pid('pa', u * 10 + CASE WHEN usd THEN 2 ELSE 1 END), pg_temp.pid('pu', u),
       pg_temp.pid('pc', u * 100 + catn),
       CASE WHEN NOT inc AND catn BETWEEN 2 AND 4 THEN pg_temp.pid('pb', u * 100 + catn) END,
       (SELECT t0 FROM anchor) - (pg_temp.r('lt' || u || '-' || j) * interval '365 days'), 'bill',
       CASE WHEN usd THEN 'USD' ELSE 'DOP' END
FROM generate_series(1, 200) u, generate_series(1, 200) j
CROSS JOIN LATERAL (SELECT pg_temp.r('li' || u || '-' || j) < 0.15 AS inc,
                           pg_temp.r('lu' || u || '-' || j) < 0.2 AS usd) f
CROSS JOIN LATERAL (SELECT CASE WHEN inc THEN 1 ELSE 2 + floor(pg_temp.r('lc' || u || '-' || j) * 7)::int END AS catn) c;

-- ---------------------------------------------------------------- credit cards (heavy)
INSERT INTO credit_cards (account_id, bank, last_four_digits, cut_day, due_day, created_at, updated_at)
VALUES (pg_temp.pid('pa', 6), 'Popular', '4242', 5, 25, now() - interval '3 years', now()),
       (pg_temp.pid('pa', 7), 'Scotiabank', '5555', 15, 5, now() - interval '3 years', now());

INSERT INTO card_balances (id, card_id, currency, current_balance, credit_limit, created_at, updated_at)
SELECT pg_temp.pid('pk', k * 10 + cur_i), pg_temp.pid('pa', k), (ARRAY['DOP','USD'])[cur_i],
       CASE WHEN cur_i = 1 THEN 45000 ELSE 800 END, CASE WHEN cur_i = 1 THEN 250000 ELSE 5000 END,
       now() - interval '3 years', now()
FROM generate_series(6, 7) k, generate_series(1, 2) cur_i;

INSERT INTO card_payments (id, card_id, from_account_id, currency, amount, includes_interest, interest_amount,
                           payment_date, status, notes, created_at)
SELECT pg_temp.pid('pp', k * 100 + m), pg_temp.pid('pa', k), pg_temp.pid('pa', 1), 'DOP',
       round((8000 + pg_temp.r('cp' || k || m) * 30000)::numeric, 2), false, 0,
       (SELECT t0 FROM anchor) - m * interval '1 month', 'completed', '',
       (SELECT t0 FROM anchor) - m * interval '1 month'
FROM generate_series(6, 7) k, generate_series(1, 36) m;

-- ---------------------------------------------------------------- recurring rules (heavy)
DO $$
DECLARE has_next boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'recurring_transactions' AND column_name = 'next_execution_date')
    INTO has_next;
  -- next run is next month, last run this month: the scheduler has nothing to do at startup
  EXECUTE format($f$
    INSERT INTO recurring_transactions (id, user_id, name, description, amount, type, account_id,
                                        category_id, budget_id, day_of_month, last_execution_date,
                                        created_at, updated_at %s)
    SELECT pg_temp.pid('pr', n), pg_temp.pid('pu', 0), 'Recurrente ' || n, '',
           round((500 + pg_temp.r('rr' || n) * 20000)::numeric, 2),
           CASE WHEN n <= 2 THEN 'income' ELSE 'bill' END,
           pg_temp.pid('pa', 1),
           pg_temp.pid('pc', CASE WHEN n <= 2 THEN n ELSE 3 + n END),
           NULL, 1 + (n * 2), date_trunc('month', now())::timestamp + ((n * 2) * interval '1 day'),
           now() - interval '1 year', now() %s
    FROM generate_series(1, 10) n
  $f$,
  CASE WHEN has_next THEN ', next_execution_date' ELSE '' END,
  CASE WHEN has_next THEN ', (date_trunc(''month'', now()) + interval ''1 month'' + ((n * 2) * interval ''1 day''))::date' ELSE '' END);
END $$;

-- ---------------------------------------------------------------- investments (heavy)
INSERT INTO investments (id, user_id, investment_type, name, symbol, quantity, purchase_price, current_price,
                         created_at, updated_at, source_amount)
SELECT pg_temp.pid('pi', n), pg_temp.pid('pu', 0),
       (ARRAY['stock','stock','stock','crypto','crypto','fixed_income','stock','crypto'])[n]::investmenttype,
       (ARRAY['Apple','Microsoft','Vanguard S&P','Bitcoin','Ethereum','Bono Hacienda','Nvidia','Solana'])[n],
       (ARRAY['AAPL','MSFT','VOO','BTC','ETH','BHD26','NVDA','SOL'])[n],
       round((1 + pg_temp.r('iq' || n) * 50)::numeric, 4),
       round((50 + pg_temp.r('ip' || n) * 400)::numeric, 4),
       round((60 + pg_temp.r('ic' || n) * 450)::numeric, 4),
       now() - n * interval '30 days', now(), 0
FROM generate_series(1, 8) n;

-- ---------------------------------------------------------------- loans (heavy)
INSERT INTO loans (id, user_id, borrower_name, borrower_contact, notes, disbursement_transaction_id, principal_amount, currency, interest_mode, annual_rate, term_months,
                   start_date, source_account_id, total_interest, total_amount, paid_principal, paid_interest,
                   status, created_at, updated_at)
SELECT pg_temp.pid('pl', n), pg_temp.pid('pu', 0), 'Prestatario ' || n, '', '', '', 60000 * n, 'DOP', 'fixed_total', 12,
       12, ((SELECT t0 FROM anchor) - n * interval '3 months')::date, pg_temp.pid('pa', 2),
       7200 * n, 67200 * n, 15000 * n, 1800 * n, 'active', now() - n * interval '3 months', now()
FROM generate_series(1, 3) n;

INSERT INTO loan_installments (id, loan_id, installment_number, due_date, expected_amount, paid_amount, status,
                               created_at, updated_at)
SELECT pg_temp.pid('pn', n * 100 + m), pg_temp.pid('pl', n), m,
       (((SELECT t0 FROM anchor) - n * interval '3 months') + m * interval '1 month')::date,
       5600 * n, CASE WHEN m <= n * 3 THEN 5600 * n ELSE 0 END,
       (CASE WHEN m <= n * 3 THEN 'paid' ELSE 'pending' END)::loan_installment_status, now(), now()
FROM generate_series(1, 3) n, generate_series(1, 12) m;

INSERT INTO loan_payments (id, loan_id, destination_account_id, amount, principal_component, interest_component,
                           payment_date, income_transaction_id, notes, created_at)
SELECT pg_temp.pid('pm', n * 100 + m), pg_temp.pid('pl', n), pg_temp.pid('pa', 2), 5600 * n, 5000 * n, 600 * n,
       ((SELECT t0 FROM anchor) - n * interval '3 months') + m * interval '1 month', '', '', now()
FROM generate_series(1, 3) n, generate_series(1, 9) m
WHERE m <= n * 3;

-- ---------------------------------------------------------------- certificates (heavy)
INSERT INTO certificates (id, user_id, bank, base_capital, interest_type, current_interest_rate, current_tax_rate,
                          cut_day, reinvest_interest, payout_account_id, maturity_date, status, currency,
                          created_at, updated_at)
SELECT pg_temp.pid('pf', n), pg_temp.pid('pu', 0), (ARRAY['BHD','Popular','Banreservas'])[n], 100000 * n,
       'simple', 8.5 + n, 10, 5 * n, false, pg_temp.pid('pa', 2), now() + interval '1 year', 'active',
       CASE WHEN n = 3 THEN 'USD' ELSE 'DOP' END, now() - interval '2 years', now()
FROM generate_series(1, 3) n;

INSERT INTO certificate_payments (id, certificate_id, user_id, payment_date, period_start, period_end, gross_interest,
                                  tax_withheld, net_interest, applied_rate, applied_tax_rate, applied_capital,
                                  payout_account_id, created_at)
SELECT pg_temp.pid('pq', n * 100 + m), pg_temp.pid('pf', n), pg_temp.pid('pu', 0),
       (SELECT t0 FROM anchor) - m * interval '1 month',
       (SELECT t0 FROM anchor) - (m + 1) * interval '1 month', (SELECT t0 FROM anchor) - m * interval '1 month',
       700 * n, 70 * n, 630 * n, 8.5 + n, 10, 100000 * n, pg_temp.pid('pa', 2), now()
FROM generate_series(1, 3) n, generate_series(1, 24) m;

-- ---------------------------------------------------------------- monthly plan + notifications (heavy)
INSERT INTO monthly_plan_items (id, user_id, name, amount, currency, type, category_id, account_id, day_of_month)
SELECT pg_temp.pid('po', n), pg_temp.pid('pu', 0), 'Plan ' || n, 1000 * n, 'DOP',
       CASE WHEN n <= 2 THEN 'income' ELSE 'bill' END, pg_temp.pid('pc', CASE WHEN n <= 2 THEN n ELSE 3 + n END),
       pg_temp.pid('pa', 1), n * 2
FROM generate_series(1, 12) n;

INSERT INTO notifications (user_id, type, message, amount, is_read, created_at)
SELECT pg_temp.pid('pu', 0), 'transaction', 'Notificacion ' || n, 100 * n, n % 3 = 0,
       (SELECT t0 FROM anchor) - n * interval '1 day'
FROM generate_series(1, 60) n;

COMMIT;

ANALYZE;

SELECT 'users' AS t, count(*) FROM users
UNION ALL SELECT 'accounts', count(*) FROM account
UNION ALL SELECT 'categories', count(*) FROM categorys
UNION ALL SELECT 'budgets', count(*) FROM budgets
UNION ALL SELECT 'transactions', count(*) FROM transactions
UNION ALL SELECT 'heavy transactions', count(*) FROM transactions WHERE user_id = 'pu0000000000000000000000000'
UNION ALL SELECT 'audit rows', count(*) FROM financial_audit_log;
