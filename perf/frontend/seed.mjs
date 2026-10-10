#!/usr/bin/env node
// Seeds a "heavy" password user directly through the backend API so lists and
// charts are realistic. Idempotent per email: if the user already has
// transactions, it only logs in.
//
//   node perf/frontend/seed.mjs <backend-url> [email] [transactions=3000]
//
// Creates 4 accounts (2 DOP, 2 USD), 12 categories, 8 budgets, a few
// investments and N transactions spread over the last 12 months (about
// N/12 in the current month), concurrency 16. Prints JSON with the ids.
const [backend, email = 'perf.heavy@example.com', txArg = '3000'] = process.argv.slice(2)
if (!backend) {
  console.error('usage: seed.mjs <backend-url> [email] [transactions]')
  process.exit(1)
}
const N = Number(txArg)
const PASSWORD = process.env.PERF_USER_PASSWORD
if (!PASSWORD) throw new Error('set PERF_USER_PASSWORD (see perf/frontend/README.md)')

async function call(method, path, body, token) {
  const res = await fetch(`${backend}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`)
  return json
}

async function pool(items, size, fn) {
  let i = 0
  let failures = 0
  const workers = Array.from({ length: size }, async () => {
    while (i < items.length) {
      const idx = i++
      try {
        await fn(items[idx], idx)
      } catch (e) {
        failures++
        if (failures < 5) console.error(String(e).slice(0, 300))
      }
    }
  })
  await Promise.all(workers)
  return failures
}

const list = (x) => (Array.isArray(x) ? x : x?.data ?? x?.items ?? []) ?? []
// GET /account wraps each account as { account_info, current_balance }.
const unwrapAccount = (a) => a?.account_info ?? a

async function main() {
  try {
    await call('POST', '/user', { name: 'Perf', last_name: 'Heavy', email, password: PASSWORD })
  } catch (e) {
    if (!/409|exist|duplicate|already/i.test(String(e))) console.error('create user:', String(e).slice(0, 200))
  }
  const login = await call('POST', '/auth/login', { email, password: PASSWORD })
  const token = login.access_token
  let accounts = list(await call('GET', '/account', null, token)).map(unwrapAccount)
  if (accounts.length === 0) {
    const defs = [
      ['Cuenta Nomina', 'Banco Popular', 250000, 'DOP'],
      ['Ahorros', 'BHD', 900000, 'DOP'],
      ['USD Savings', 'Scotiabank', 15000, 'USD'],
      ['USD Checking', 'Banreservas', 4000, 'USD'],
    ]
    for (const [name, bank, initial_balance, currency] of defs) {
      await call('POST', '/account', { name, bank, initial_balance, currency }, token)
    }
    accounts = list(await call('GET', '/account', null, token)).map(unwrapAccount)
  }
  let categories = list(await call('GET', '/category', null, token))
  if (categories.length < 12) {
    const defs = [
      ['Comida', '🍔', '#FF6B6B'], ['Transporte', '🚗', '#4ECDC4'], ['Vivienda', '🏠', '#45B7D1'],
      ['Salud', '💊', '#96CEB4'], ['Ocio', '🎮', '#FFEAA7'], ['Educacion', '📚', '#DDA0DD'],
      ['Servicios', '💡', '#98D8C8'], ['Ropa', '👕', '#F7DC6F'], ['Viajes', '✈️', '#BB8FCE'],
      ['Salario', '💼', '#58D68D'], ['Freelance', '💻', '#5DADE2'], ['Regalos', '🎁', '#EC7063'],
    ]
    for (const [name, icon, color] of defs) {
      try {
        await call('POST', '/category', { name, icon, color }, token)
      } catch (e) {
        console.error(String(e).slice(0, 200))
      }
    }
    categories = list(await call('GET', '/category', null, token))
  }
  const budgets = list(await call('GET', '/budget', null, token))
  if (budgets.length === 0) {
    for (const c of categories.slice(0, 8)) {
      try {
        await call('POST', '/budget', { category_id: c.id, amount: 15000 + Math.round(Math.random() * 20000) }, token)
      } catch (e) {
        console.error(String(e).slice(0, 200))
      }
    }
  }
  try {
    const inv = list(await call('GET', '/investments', null, token))
    if (inv.length === 0) {
      const usd = accounts[1] // accounts are created in DOP (the API ignores currency); fund USD via exchange rate
      if (usd) {
        try {
          await call('POST', '/investments/funding', { source_account_id: usd.id, source_amount: 480000, target_currency: 'USD', exchange_rate: 60 }, token)
        } catch (e) {
          console.error('funding:', String(e).slice(0, 200))
        }
      }
      for (const [type, name, symbol, q, p] of [
        ['stock', 'Apple', 'AAPL', 10, 150],
        ['stock', 'Microsoft', 'MSFT', 5, 300],
        ['crypto', 'Bitcoin', 'BTC', 0.1, 30000],
      ]) {
        try {
          await call('POST', '/investments', { type, name, symbol, quantity: q, purchase_price: p, current_price: p * 1.1, settlement_currency: 'USD' }, token)
        } catch (e) {
          console.error('investment:', String(e).slice(0, 200))
        }
      }
    }
  } catch (e) {
    console.error('investments list:', String(e).slice(0, 200))
  }

  // Transactions: skip if the user already has plenty.
  const existing = await call('GET', '/transaction?limit=1&page=1', null, token)
  const total = existing?.pagination?.total_records ?? existing?.pagination?.total ?? list(existing).length
  let failures = 0
  if (!total || total < N / 2) {
    const income = categories.filter((c) => ['Salario', 'Freelance', 'Regalos'].includes(c.name))
    const expense = categories.filter((c) => !income.includes(c))
    const now = Date.now()
    const items = Array.from({ length: N }, (_, i) => {
      const isIncome = i % 7 === 0
      const cat = isIncome ? income[i % income.length] : expense[i % expense.length]
      const acc = accounts[i % accounts.length]
      // Spread uniformly over the last 365 days.
      const created = new Date(now - Math.floor((i / N) * 365 * 24 * 3600 * 1000) - (i % 24) * 3600 * 1000)
      return {
        name: `${isIncome ? 'Ingreso' : 'Gasto'} #${i}`,
        description: `Perf seed transaction ${i} – ${cat?.name ?? ''}`,
        amount: Math.round((isIncome ? 20000 + Math.random() * 30000 : 50 + Math.random() * 4000) * 100) / 100,
        type_transation: isIncome ? 'income' : 'bill',
        account_id: acc.id,
        category_id: cat.id,
        currency: acc.currency || 'DOP',
        created_at: created.toISOString(),
      }
    })
    const t0 = Date.now()
    failures = await pool(items, 16, (body) => call('POST', '/transaction', body, token))
    console.error(`created ${N - failures}/${N} transactions in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  }
  console.log(
    JSON.stringify({
      email,
      password: PASSWORD,
      accounts: accounts.map((a) => a.id),
      categories: categories.length,
      failures,
    }),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
