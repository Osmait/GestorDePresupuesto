DROP TABLE IF EXISTS account;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS budgets;
DROP TABLE IF EXISTS categorys;
DROP TABLE IF EXISTS cryptos;

CREATE TYPE TypeTransaction AS ENUM (
  'bill',
  'income'
);

CREATE TABLE account  (
  id VARCHAR(32) PRIMARY KEY,
  name_account VARCHAR(255),
  bank VARCHAR(255),
  balance float,
  user_id VARCHAR NOT NULL,
  created_at timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE transactions (
  id varchar PRIMARY KEY,
  transaction_name varchar NOT NULL,
  transaction_description text,
  amount float NOT NULL,
  type_transation TypeTransaction NOT NULL,
  account_id varchar NOT NULL,
  user_id VARCHAR NOT NULL,
  category_id varchar NOT NULL,
  budget_id VARCHAR,  
  created_at timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE users(
  id VARCHAR PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  token VARCHAR(32) ,
  confirmed BOOLEAN DEFAULT (false),
  created_at timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE categorys(
  id VARCHAR PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  icon VARCHAR(255) NOT NULL,
  color VARCHAR(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT (now()),
  user_id VARCHAR NOT NULL
);

CREATE TABLE cryptos(
  id VARCHAR PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price float NOT NULL,
  current_price float NOT NULL,
  quantity float NOT NULL ,
  created_at timestamptz NOT NULL DEFAULT (now()),
  user_id VARCHAR NOT NULL
);

CREATE TABLE budgets (
  id VARCHAR PRIMARY KEY,
  category_id varchar NOT NULL,
  amount float NOT NULL ,
  created_at timestamptz NOT NULL DEFAULT (now()),
  user_id VARCHAR NOT NULL
);

ALTER TABLE cryptos ADD FOREIGN KEY (user_id) REFERENCES users (id);
ALTER TABLE transactions ADD FOREIGN KEY (category_id) REFERENCES categorys (id);
ALTER TABLE budgets ADD FOREIGN KEY (category_id) REFERENCES categorys (id);
ALTER TABLE transactions ADD FOREIGN KEY (account_id) REFERENCES account (id);
ALTER TABLE transactions ADD FOREIGN KEY (user_id) REFERENCES users (id);
ALTER TABLE account ADD FOREIGN KEY (user_id) REFERENCES users (id);
