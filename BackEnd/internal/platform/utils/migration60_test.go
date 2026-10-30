package utils

import (
	"database/sql"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/source/iofs"

	migrationsdb "github.com/osmait/gestorDePresupuesto/cmd/api/db"
)

// Migration 000060 moves card_balances.current_balance (initial debt,
// payments, resets) into the ledger of the card account. Every card balance
// must keep its real balance (current_balance + ledger), and the down
// migration must move it back.
func TestMigration60_MovesCardBalancesIntoLedger(t *testing.T) {
	dbURL := freshDatabase(t)
	if err := RunMigrationsFromFS(embeddedUpTo(t, 59), "m", dbURL); err != nil {
		t.Fatalf("apply migrations < 59: %v", err)
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = db.Close() }()

	mustExec := func(q string, args ...any) {
		t.Helper()
		if _, err := db.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}

	mustExec(`INSERT INTO users (id, name, last_name, email, password) VALUES ('u1','U','One','u1@example.com','x')`)
	mustExec(`INSERT INTO account (id, name_account, bank, balance, user_id) VALUES ('bank1','Principal','B',100000,'u1')`)
	mustExec(`INSERT INTO categorys (id, name, icon, color, user_id) VALUES ('food','Comida','i','#fff','u1')`)
	// A legacy "Pago de tarjeta" row (pre-deterministic id) must be adopted.
	mustExec(`INSERT INTO categorys (id, name, icon, color, user_id) VALUES ('legacy-pay','Pago de tarjeta','i','#fff','u1')`)

	// Card 1: initial debt 20,000 DOP and 100 USD, one 5,000 DOP payment
	// (stored balance -20,000 + 5,000), charges on the card account.
	mustExec(`INSERT INTO account (id, name_account, bank, balance, user_id, account_type, currency) VALUES ('card1','Visa','B',0,'u1','credit_card','DOP')`)
	mustExec(`INSERT INTO credit_cards (account_id, bank, cut_day, due_day) VALUES ('card1','B',5,20)`)
	mustExec(`INSERT INTO card_balances (id, card_id, currency, current_balance, credit_limit) VALUES ('c1dop','card1','DOP',-15000,50000), ('c1usd','card1','USD',-100,1000)`)
	mustExec(`INSERT INTO card_payments (id, card_id, from_account_id, currency, amount, status) VALUES ('p1','card1','bank1','DOP',5000,'completed')`)
	mustExec(`INSERT INTO transactions (id, transaction_name, amount, type_transation, account_id, user_id, category_id, currency) VALUES
		('t1','super',3000,'bill','card1','u1','food','DOP'),
		('t2','amazon',50,'bill','card1','u1','food','USD')`)

	// Card 2: 1,000 of charges, reset (stored balance set to +1,000), then 200 more.
	mustExec(`INSERT INTO account (id, name_account, bank, balance, user_id, account_type, currency) VALUES ('card2','Qik','B',0,'u1','credit_card','DOP')`)
	mustExec(`INSERT INTO credit_cards (account_id, bank, cut_day, due_day) VALUES ('card2','B',5,20)`)
	mustExec(`INSERT INTO card_balances (id, card_id, currency, current_balance, credit_limit) VALUES ('c2dop','card2','DOP',1000,35000)`)
	mustExec(`INSERT INTO transactions (id, transaction_name, amount, type_transation, account_id, user_id, category_id, currency) VALUES
		('t3','colmado',1000,'bill','card2','u1','food','DOP'),
		('t4','farmacia',200,'bill','card2','u1','food','DOP')`)
	mustExec(`INSERT INTO card_balance_resets (id, balance_id, card_id, currency, previous_balance) VALUES ('r1','c2dop','card2','DOP',-1000)`)

	ledger := func(account, currency string) string {
		t.Helper()
		var v string
		if err := db.QueryRow(`SELECT COALESCE(SUM(balance),0)::numeric(19,2)::text FROM account_balances WHERE account_id=$1 AND currency=$2`, account, currency).Scan(&v); err != nil {
			t.Fatal(err)
		}
		return v
	}
	stored := func(balanceID string) string {
		t.Helper()
		var v string
		if err := db.QueryRow(`SELECT current_balance::numeric(19,2)::text FROM card_balances WHERE id=$1`, balanceID).Scan(&v); err != nil {
			t.Fatal(err)
		}
		return v
	}

	if err := RunMigrationsFromFS(migrationsdb.Migrations, migrationsdb.MigrationsDir, dbURL); err != nil {
		t.Fatalf("apply remaining migrations: %v", err)
	}

	for _, c := range []struct{ balance, account, currency, want string }{
		{"c1dop", "card1", "DOP", "-18000.00"},
		{"c1usd", "card1", "USD", "-150.00"},
		{"c2dop", "card2", "DOP", "-200.00"},
	} {
		if got := stored(c.balance); got != "0.00" {
			t.Errorf("%s: current_balance = %s, want 0.00", c.balance, got)
		}
		if got := ledger(c.account, c.currency); got != c.want {
			t.Errorf("%s: ledger balance = %s, want %s", c.balance, got, c.want)
		}
	}

	type moved struct{ id, typ, amount, category string }
	rows, err := db.Query(`SELECT id, type_transation::text, amount::numeric(19,2)::text, category_id FROM transactions WHERE LEFT(id,5) IN ('m60p_','m60r_','m60o_') ORDER BY id`)
	if err != nil {
		t.Fatal(err)
	}
	var got []moved
	for rows.Next() {
		var m moved
		if err := rows.Scan(&m.id, &m.typ, &m.amount, &m.category); err != nil {
			t.Fatal(err)
		}
		got = append(got, m)
	}
	_ = rows.Close()
	adjustmentCat := "syscat_" + md5Prefix(t, db, "balance_adjustment:u1")
	want := []moved{
		{"m60o_c1dop", "adjustment_out", "20000.00", adjustmentCat},
		{"m60o_c1usd", "adjustment_out", "100.00", adjustmentCat},
		{"m60p_p1", "card_payment_received", "5000.00", "legacy-pay"},
		{"m60r_r1", "adjustment_in", "1000.00", adjustmentCat},
	}
	if len(got) != len(want) {
		t.Fatalf("moved rows = %+v, want %+v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("row %d = %+v, want %+v", i, got[i], want[i])
		}
	}

	// Down: the stored balances come back and the moved rows are gone.
	src, err := iofs.New(migrationsdb.Migrations, migrationsdb.MigrationsDir)
	if err != nil {
		t.Fatal(err)
	}
	m, err := migrate.NewWithSourceInstance("iofs", src, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _, _ = m.Close() }()
	if err := m.Migrate(59); err != nil {
		t.Fatalf("migrate down to 59: %v", err)
	}
	for _, c := range []struct{ balance, want string }{{"c1dop", "-15000.00"}, {"c1usd", "-100.00"}, {"c2dop", "1000.00"}} {
		if got := stored(c.balance); got != c.want {
			t.Errorf("after down %s: current_balance = %s, want %s", c.balance, got, c.want)
		}
	}
	var left int
	if err := db.QueryRow(`SELECT COUNT(*) FROM transactions WHERE LEFT(id,5) IN ('m60p_','m60r_','m60o_')`).Scan(&left); err != nil {
		t.Fatal(err)
	}
	if left != 0 {
		t.Errorf("after down %d moved rows remain", left)
	}
}

func md5Prefix(t *testing.T, db *sql.DB, s string) string {
	t.Helper()
	var v string
	if err := db.QueryRow(`SELECT substr(md5($1), 1, 26)`, s).Scan(&v); err != nil {
		t.Fatal(err)
	}
	return v
}
