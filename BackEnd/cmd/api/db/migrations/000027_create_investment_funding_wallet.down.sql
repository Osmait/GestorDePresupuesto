DROP INDEX IF EXISTS idx_investment_funding_movements_user_created_at;

DROP TABLE IF EXISTS investment_funding_movements;
DROP TABLE IF EXISTS investment_funding_balances;

-- PostgreSQL enum values cannot be safely removed in reversible down migrations.
