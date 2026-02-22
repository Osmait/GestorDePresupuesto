DELETE FROM feature_flags
WHERE key IN (
	'module_investments',
    'module_loans',
    'module_credit_cards',
    'module_certificates'
);
