export interface UniqueCategoryNameLabels {
	/** Name used when the suggestion is blank ("New category"). */
	fallback: string
	/** Marks a name taken from an AI suggestion ("AI"). */
	suffix: string
}

/**
 * A category name for an AI suggestion that does not clash (case-insensitively) with the
 * existing ones: "Food", then "Food (AI)", "Food (AI 2)"... A name that is already unique
 * comes back unchanged, so applying it twice is harmless.
 */
export function buildUniqueCategoryName(
	baseName: string,
	existingNames: string[],
	labels: UniqueCategoryNameLabels,
): string {
	const taken = new Set(existingNames.map((name) => name.trim().toLowerCase()))
	const base = baseName.trim() || labels.fallback

	if (!taken.has(base.toLowerCase())) {
		return base
	}

	let candidate = `${base} (${labels.suffix})`
	for (let index = 2; taken.has(candidate.toLowerCase()); index++) {
		candidate = `${base} (${labels.suffix} ${index})`
	}
	return candidate
}
