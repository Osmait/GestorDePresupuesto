INSERT INTO feature_flags (key, name, description, default_enabled, scope)
VALUES
	('module_investments', 'Investments Module', 'Enable investments module endpoints and UI.', true, 'both'),
    ('module_loans', 'Loans Module', 'Enable loans module endpoints and UI.', true, 'both'),
    ('module_credit_cards', 'Credit Cards Module', 'Enable credit cards module endpoints and UI.', true, 'both'),
    ('module_certificates', 'Certificates Module', 'Enable certificates module endpoints and UI.', true, 'both')
ON CONFLICT (key) DO NOTHING;
