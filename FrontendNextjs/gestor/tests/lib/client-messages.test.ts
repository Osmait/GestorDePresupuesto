// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CLIENT_NAMESPACES, type ClientMessagesScope, pickMessages } from '@/lib/i18n/client-messages'
import en from '@/messages/en.json'
import es from '@/messages/es.json'
import { clientNamespaces } from '../utils/client-namespaces'

const ROOT = path.resolve(__dirname, '../..')
const APP_DIR = path.join(ROOT, 'app')
const SCOPE_RE = /<ScopedIntlMessages\s+scope=['"](\w+)['"]/g

function findPages(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name)
		if (entry.isDirectory()) return entry.name === 'api' ? [] : findPages(full)
		return entry.name === 'page.tsx' ? [full] : []
	})
}

/** Root layout, then layout/template of every segment down to the page, then the page. */
function renderChain(page: string): string[] {
	const chain: string[] = []
	let dir = APP_DIR
	const segments = path.relative(APP_DIR, path.dirname(page)).split(path.sep).filter(Boolean)
	for (let i = 0; i <= segments.length; i++) {
		if (i > 0) dir = path.join(dir, segments[i - 1])
		for (const file of ['layout.tsx', 'template.tsx']) {
			const full = path.join(dir, file)
			if (existsSync(full)) chain.push(full)
		}
	}
	chain.push(page)
	return chain.map((file) => path.relative(ROOT, file))
}

function scopesIn(files: string[]): ClientMessagesScope[] {
	return files.flatMap((file) =>
		Array.from(readFileSync(path.join(ROOT, file), 'utf8').matchAll(SCOPE_RE), (m) => m[1] as ClientMessagesScope),
	)
}

const pages = findPages(APP_DIR)

describe('client message scopes', () => {
	it('finds the pages', () => {
		expect(pages.length).toBeGreaterThan(10)
	})

	it.each(
		pages.map((page) => [path.relative(ROOT, page)]),
	)('%s: every namespace used by its client components is sent to the browser', (page) => {
		const chain = renderChain(path.join(ROOT, page))
		const { namespaces, byModule } = clientNamespaces(chain)
		const scopes = scopesIn(chain)
		for (const scope of scopes) expect(Object.keys(CLIENT_NAMESPACES)).toContain(scope)
		const provided = new Set<string>([...CLIENT_NAMESPACES.root, ...scopes.flatMap((s) => CLIENT_NAMESPACES[s])])

		const missing = Array.from(namespaces).filter((ns) => !provided.has(ns))
		const users = Array.from(byModule.entries())
			.filter(([, used]) => used.some((ns) => missing.includes(ns)))
			.map(([file, used]) => `${file}: ${used.join(', ')}`)
		expect({ missing, users }).toEqual({ missing: [], users: [] })
	})

	it('detects namespaces through the import graph (sanity check of the analysis)', () => {
		const { namespaces } = clientNamespaces(renderChain(path.join(APP_DIR, 'app/transactions/page.tsx')))
		for (const ns of ['ai', 'transactions', 'nav', 'datePicker']) expect(namespaces).toContain(ns)
		// server-only usage (getTranslations('dashboard')) is not sent to the client
		expect(clientNamespaces(['app/app/page.tsx']).namespaces).not.toContain('dashboard')
	})

	it('only names namespaces that exist in both catalogs', () => {
		for (const namespaces of Object.values(CLIENT_NAMESPACES)) {
			for (const ns of namespaces) {
				expect(es).toHaveProperty(ns)
				expect(en).toHaveProperty(ns)
			}
		}
	})

	it('never sends a namespace twice along a route', () => {
		for (const page of pages) {
			const scopes = scopesIn(renderChain(page))
			const all = [...CLIENT_NAMESPACES.root, ...scopes.flatMap((s) => CLIENT_NAMESPACES[s])]
			expect({ page: path.relative(ROOT, page), duplicates: all.filter((ns, i) => all.indexOf(ns) !== i) }).toEqual({
				page: path.relative(ROOT, page),
				duplicates: [],
			})
		}
	})

	it('sends much less than the full catalog', () => {
		const size = (value: unknown) => JSON.stringify(value).length
		const app = pickMessages(es, CLIENT_NAMESPACES.app)
		expect(size(pickMessages(es, CLIENT_NAMESPACES.root))).toBeLessThan(10)
		expect(size(app)).toBeLessThan(size(es) / 2)
	})
})

describe('pickMessages', () => {
	it('keeps only the requested top-level namespaces', () => {
		expect(pickMessages({ a: { x: 1 }, b: { y: 2 }, c: 'z' }, ['a', 'c', 'missing'])).toEqual({ a: { x: 1 }, c: 'z' })
	})
})
