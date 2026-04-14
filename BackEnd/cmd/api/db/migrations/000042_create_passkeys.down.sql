DELETE FROM feature_flags WHERE key = 'passkeys_enabled';
DROP TABLE IF EXISTS passkeys;
