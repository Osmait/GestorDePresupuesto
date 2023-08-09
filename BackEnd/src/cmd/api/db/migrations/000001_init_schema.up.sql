CREATE TABLE account  (
  id VARCHAR(32) PRIMARY KEY,
  name_account VARCHAR(255),
  bank VARCHAR(255),
  balance float,
  created_at timestamptz NOT NULL DEFAULT (now())
);

