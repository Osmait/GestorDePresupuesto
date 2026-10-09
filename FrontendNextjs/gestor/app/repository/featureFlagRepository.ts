import { BaseRepository } from '@/lib/base-repository'

export class FeatureFlagRepository extends BaseRepository {
	/** Feature flags resolved for the current user. */
	async getMyFeatures(): Promise<Record<string, boolean>> {
		const data = await this.get<{ map?: Record<string, boolean> } | null>('/me/features')
		return data?.map ?? {}
	}
}
