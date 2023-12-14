DROP TABLE IF EXISTS account;
DROP TABLE IF EXISTS transactions;
CREATE TYPE TypeTransaction AS ENUM (
  'bill',
  'income'
);



CREATE TABLE account  (
  id VARCHAR(32) PRIMARY KEY,
  name_account VARCHAR(255),
  bank VARCHAR(255),
  balance float,
  created_at timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE transactions (
  id varchar PRIMARY KEY,
  transaction_name varchar NOT NULL,
  transaction_description text,
  amount float NOT NULL,
  type_transation TypeTransaction NOT NULL,
  account_id varchar NOT NULL,
  created_at timestamptz NOT NULL DEFAULT (now())
);


ALTER TABLE transactions ADD FOREIGN KEY (account_id) REFERENCES account (id);
