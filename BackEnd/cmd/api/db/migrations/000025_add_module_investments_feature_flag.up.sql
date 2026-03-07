INSERT INTO feature_flags (key, name, description, default_enabled, scope)
VALUES ('module_investments', 'Investments Module', 'Enable investments module endpoints and UI.', true, 'both')
ON CONFLICT (key) DO NOTHING;
