CREATE TABLE users(
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  token VARCHAR(32) ,
  confirmed BOOLEAN  DEFAULT (false),
  created_at timestamptz NOT NULL DEFAULT (now())
);
