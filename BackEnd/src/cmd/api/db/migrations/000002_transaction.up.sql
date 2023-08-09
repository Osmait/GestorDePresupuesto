
CREATE TYPE TypeTransaction AS ENUM (
  'bill',
  'income'
);


CREATE TABLE transactions (
  id varchar PRIMARY KEY,
  transaction_name varchar NOT NULL,
  transaction_description text,
  amount float NOT NULL,
  type_transation TypeTransaction NOT NULL,
  user_id varchar NOT NULL,
  account_id varchar NOT NULL,
  created_at timestamptz NOT NULL DEFAULT (now())
);


ALTER TABLE transactions ADD FOREIGN KEY (account_id) REFERENCES account (id);