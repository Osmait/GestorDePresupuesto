-- SQLite compatible migration for testing
DROP TABLE IF EXISTS account;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS budgets;
DROP TABLE IF EXISTS categorys;
DROP TABLE IF EXISTS cryptos;

CREATE TABLE users(
  id VARCHAR PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  token VARCHAR(32),
  confirmed BOOLEAN DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE account (
  id VARCHAR(32) PRIMARY KEY,
  name_account VARCHAR(255),
  bank VARCHAR(255),
  balance REAL,
  user_id VARCHAR NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE categorys(
  id VARCHAR PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  icon VARCHAR(255) NOT NULL,
  color VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  user_id VARCHAR NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE budgets (
  id VARCHAR PRIMARY KEY,
  category_id VARCHAR NOT NULL,
  amount REAL NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  user_id VARCHAR NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categorys (id),
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE transactions (
  id VARCHAR PRIMARY KEY,
  transaction_name VARCHAR NOT NULL,
  transaction_description TEXT,
  amount REAL NOT NULL,
  type_transation VARCHAR NOT NULL CHECK (type_transation IN ('bill', 'income')),
  account_id VARCHAR NOT NULL,
  user_id VARCHAR NOT NULL,
  category_id VARCHAR NOT NULL,
  budget_id VARCHAR,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES account (id),
  FOREIGN KEY (user_id) REFERENCES users (id),
  FOREIGN KEY (category_id) REFERENCES categorys (id),
  FOREIGN KEY (budget_id) REFERENCES budgets (id)
);

CREATE TABLE cryptos(
  id VARCHAR PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price REAL NOT NULL,
  current_price REAL NOT NULL,
  quantity REAL NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  user_id VARCHAR NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
); 