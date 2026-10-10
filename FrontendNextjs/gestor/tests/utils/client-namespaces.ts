import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * Static analysis of the import graph: which next-intl namespaces the CLIENT
 * components reachable from an entry file (page, layout, template) use.
 *
 * A module is a client module when it starts with 'use client' or is imported
 * by a client module. Only `useTranslations('<namespace>')` calls in client
 * modules count: server components read the full catalog on the server.
 * Type-only imports are ignored; dynamic `import()` is followed.
 */

const ROOT = path.resolve(__dirname, '../..')
const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.js']
const IMPORT_RE =
	/(?:^|[\s;])(?:import|export)\s+(type\s+)?(?:[^'"`;]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g
const NAMESPACE_RE = /useTranslations\(\s*(?:(['"])([^'"]*)\1)?\s*\)/g

export interface NamespaceUsage {
	/** Top-level namespaces used by client modules. '*' = a call without (static) namespace. */
	namespaces: Set<string>
	/** module (relative path) -> namespaces it uses, client modules only */
	byModule: Map<string, string[]>
}

function resolveImport(from: string, specifier: string): string | null {
	let base: string
	if (specifier.startsWith('@/')) base = path.join(ROOT, specifier.slice(2))
	else if (specifier.startsWith('.')) base = path.resolve(path.dirname(from), specifier)
	else return null
	if (existsSync(base) && statSync(base).isFile()) return base
	for (const ext of EXTENSIONS) {
		if (existsSync(base + ext)) return base + ext
	}
	return null
}

const sourceCache = new Map<string, string>()
function source(file: string): string {
	let text = sourceCache.get(file)
	if (text === undefined) {
		text = readFileSync(file, 'utf8')
		sourceCache.set(file, text)
	}
	return text
}

function hasUseClient(text: string): boolean {
	return /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*['"]use client['"]/.test(text)
}

export function clientNamespaces(entries: string[]): NamespaceUsage {
	const namespaces = new Set<string>()
	const byModule = new Map<string, string[]>()
	const visited = new Set<string>()
	const stack: [string, boolean][] = entries.map((entry) => {
		const file = path.join(ROOT, entry)
		return [file, hasUseClient(source(file))]
	})

	while (stack.length > 0) {
		const [file, isClient] = stack.pop() as [string, boolean]
		const key = `${isClient ? 'c' : 's'}:${file}`
		if (visited.has(key)) continue
		visited.add(key)
		const text = source(file)

		if (isClient) {
			const used: string[] = []
			for (const match of Array.from(text.matchAll(NAMESPACE_RE))) {
				const ns = match[2] ? match[2].split('.')[0] : '*'
				used.push(ns)
				namespaces.add(ns)
			}
			if (used.length > 0) byModule.set(path.relative(ROOT, file), used)
		}

		for (const match of Array.from(text.matchAll(IMPORT_RE))) {
			if (match[1]) continue // import type
			const specifier = match[2] ?? match[3]
			const resolved = resolveImport(file, specifier)
			if (!resolved || !/\.(tsx?|jsx?)$/.test(resolved)) continue
			stack.push([resolved, isClient || hasUseClient(source(resolved))])
		}
	}
	return { namespaces, byModule }
}
