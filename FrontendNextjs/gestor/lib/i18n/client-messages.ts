/**
 * next-intl namespaces serialized to the browser, per route scope.
 *
 * The root layout only passes `root` to NextIntlClientProvider; each route
 * segment adds the namespaces its client components need with
 * `<ScopedIntlMessages scope='…'>` (merged on top of the parent's on the
 * client, so a namespace is never sent twice). Server components keep using
 * the full catalog (`getTranslations`). Each scope lists only what its parent
 * scopes do not already provide.
 *
 * tests/lib/client-messages.test.ts walks the import graph of every page and
 * fails when a client component uses a namespace its route does not provide.
 */
export const CLIENT_NAMESPACES = {
	/** Root layout + landing page. */
	root: [],
	/** /login and /register */
	auth: ['auth', 'common'],
	/** /app layout: sidebar, global actions (forms, modals), settings, search. */
	app: [
		'accounts',
		'auth',
		'budgets',
		'categories',
		'common',
		'forms',
		'investments',
		'nav',
		'search',
		'settingsModal',
		'transactions',
	],
	/** /admin layout (same shell as /app) + its only page. */
	admin: [
		'accounts',
		'admin',
		'auth',
		'budgets',
		'categories',
		'common',
		'forms',
		'investments',
		'nav',
		'search',
		'settingsModal',
		'transactions',
	],
	dashboard: ['charts', 'dateFilter', 'datePicker'],
	accounts: ['analysis'],
	analysis: ['analysis', 'datePicker'],
	certificates: ['certificates'],
	creditCards: ['creditCards'],
	loans: ['loans'],
	monthly: ['monthlyPlan'],
	transactions: ['ai', 'datePicker', 'recurring'],
} as const satisfies Record<string, readonly string[]>

export type ClientMessagesScope = keyof typeof CLIENT_NAMESPACES

type Messages = Record<string, unknown>

/** The given top-level namespaces of a message catalog. */
export function pickMessages(messages: Messages, namespaces: readonly string[]): Messages {
	const picked: Messages = {}
	for (const namespace of namespaces) {
		if (namespace in messages) picked[namespace] = messages[namespace]
	}
	return picked
}
