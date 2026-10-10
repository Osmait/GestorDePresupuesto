import { BaseRepository } from '@/lib/base-repository'
import { CreateUserRequest, UserResponse } from '@/types/user'

export interface AdminFeatureItem {
	key: string
	name: string
	description: string
	scope: string
	default_enabled: boolean
	enabled: boolean
	has_override: boolean
	has_global_override: boolean
	global_enabled?: boolean
	user_override_enabled?: boolean
	source?: 'global' | 'user' | 'default'
	blocked_by_global?: boolean
}

export interface FeatureOverride {
	feature_key: string
	enabled: boolean
	reason: string
}

const segment = (value: string) => encodeURIComponent(value)

/** Backoffice endpoints (the backend enforces the ADMIN role on all of them). */
export class AdminRepository extends BaseRepository {
	async listUsers(params?: { limit?: number; q?: string }): Promise<UserResponse[]> {
		const query = new URLSearchParams()
		if (params?.limit) query.set('limit', String(params.limit))
		if (params?.q) query.set('q', params.q)
		const suffix = query.toString() ? `?${query.toString()}` : ''
		return (await this.get<UserResponse[]>(`/users${suffix}`)) ?? []
	}

	async createUser(user: CreateUserRequest): Promise<void> {
		await this.post('/users', user)
	}

	async updateUsers(users: UserResponse[]): Promise<void> {
		await this.put('/users', users)
	}

	async deleteUser(userId: string): Promise<void> {
		await this.deleteRequest(`/users/${segment(userId)}`)
	}

	async cleanupDemoUsers(): Promise<void> {
		await this.deleteRequest('/users/demos')
	}

	async getFeatureCatalog(): Promise<AdminFeatureItem[]> {
		const data = await this.get<{ data?: AdminFeatureItem[] }>('/admin/features')
		return data?.data ?? []
	}

	async getUserFeatures(userId: string): Promise<AdminFeatureItem[]> {
		const data = await this.get<{ data?: AdminFeatureItem[] }>(`/admin/users/${segment(userId)}/features`)
		return data?.data ?? []
	}

	async updateUserFeatures(userId: string, overrides: FeatureOverride[]): Promise<void> {
		await this.put(`/admin/users/${segment(userId)}/features`, { overrides })
	}

	async resetUserFeature(userId: string, featureKey: string): Promise<void> {
		await this.deleteRequest(`/admin/users/${segment(userId)}/features/${segment(featureKey)}`)
	}

	async setGlobalFeature(featureKey: string, enabled: boolean, reason: string): Promise<void> {
		await this.patch(`/admin/features/${segment(featureKey)}/global`, { enabled, reason })
	}

	async resetGlobalFeature(featureKey: string): Promise<void> {
		await this.deleteRequest(`/admin/features/${segment(featureKey)}/global`)
	}
}
