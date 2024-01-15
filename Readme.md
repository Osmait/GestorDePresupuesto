---
id: "2023-12-31"
aliases:
  - Project Name
  - Tracker Finances app
  - Tracker Finances App
tags: []
---

# Tracker Finances App

# Description

Finances Tracker that will allow you to follow your income, bills, investment (Crypto, stock market )

# Technologies

## BackEnd

- Golang
- Postgres
- Crypto and stock api

## FrontEnd

- Nextsj
- shadcn/ui
- reacharts/charts

## Mobile

- flutter
- provider(state manager)
- fl charts(charts)

## Model Data

### User

| Field      | Type        |
| ---------- | ----------- |
| id         | Varchar     |
| name       | Varchar     |
| last_name  | Varchar     |
| email      | Varchar     |
| password   | Varchar     |
| token      | Varchar     |
| confirmed  | Boolean     |
| Created_at | Timestamptz |

### Account

| Field       | Type        |
| ----------- | ----------- |
| id          | Varchar     |
| name_accout | Varchar     |
| bank        | Varchar     |
| email       | Varchar     |
| balance     | float       |
| token       | Varchar     |
| user_id     | Varchar     |
| Created_at  | Timestamptz |

### Category

| Field      | Type        |
| ---------- | ----------- |
| id         | Varchar     |
| name       | Varchar     |
| icon       | Varchar     |
| Created_at | Timestamptz |
| user_id    | Varchar     |

### Crypto Or Stock

| Field         | Type        |
| ------------- | ----------- |
| id            | Varchar     |
| name          | Varchar     |
| price         | float       |
| current_price | float       |
| quantity      | int         |
| Created_at    | Timestamptz |
| user_id       | Varchar     |

### Budget

| Field       | Type        |
| ----------- | ----------- |
| id          | Varchar     |
| category_id | Varchar     |
| amount      | float       |
| Created_at  | Timestamptz |
| user_id     | Varchar     |

### Transactions

| Field                   | Type                 |
| ----------------------- | -------------------- |
| id                      | Varchar              |
| transaction_name        | Varchar              |
| transaction_description | Varchar              |
| amount                  | float                |
| type_transaction        | enum(bill or income) |
| account_id              | Varchar              |
| category_id             | Varchar              |
| budget_id               | Varchar Optinal      |
| user_id                 | Varchar              |
| Created_at              | Timestamptz          |

![image](https://github.com/Osmait/Personal/assets/108156933/7bfc55e5-4a47-4358-93a2-cf59c0451523)
