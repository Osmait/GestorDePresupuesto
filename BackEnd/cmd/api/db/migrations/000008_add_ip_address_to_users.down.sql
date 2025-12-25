DROP INDEX IF EXISTS idx_users_ip_address;
ALTER TABLE users DROP COLUMN ip_address;
