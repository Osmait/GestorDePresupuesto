CREATE TYPE InvestmentType AS ENUM (
  'stock',
  'crypto',
  'fixed_income'
);

CREATE TABLE investments (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  type InvestmentType NOT NULL,
  name VARCHAR(255) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  quantity float NOT NULL,
  purchase_price float NOT NULL,
  current_price float NOT NULL,
  created_at timestamptz NOT NULL DEFAULT (now()),
  updated_at timestamptz NOT NULL DEFAULT (now())
);

ALTER TABLE investments ADD FOREIGN KEY (user_id) REFERENCES users (id);
