-- Remove triggers first, then function, then table

DROP TRIGGER IF EXISTS audit_transactions        ON transactions;
DROP TRIGGER IF EXISTS audit_account             ON account;
DROP TRIGGER IF EXISTS audit_budgets             ON budgets;
DROP TRIGGER IF EXISTS audit_investments         ON investments;
DROP TRIGGER IF EXISTS audit_loans               ON loans;
DROP TRIGGER IF EXISTS audit_loan_payments       ON loan_payments;
DROP TRIGGER IF EXISTS audit_certificates        ON certificates;
DROP TRIGGER IF EXISTS audit_certificate_payments ON certificate_payments;

DROP FUNCTION IF EXISTS fn_financial_audit();

DROP TABLE IF EXISTS financial_audit_log;
