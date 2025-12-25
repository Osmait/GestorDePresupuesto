ALTER TABLE users ADD COLUMN ip_address VARCHAR(45);
CREATE INDEX idx_users_ip_address ON users(ip_address);
