import { BaseRepository } from '@/lib/base-repository'
import { APIKey, CreateAPIKeyResponse } from '@/types/apikey'

export class APIKeyRepository extends BaseRepository {
	async findAll(): Promise<APIKey[]> {
		try {
			const keys = await this.get<APIKey[]>('/api-keys')
			return keys ?? []
		} catch (error) {
			console.error('Error fetching API keys:', error)
			return []
		}
	}

	async create(name: string): Promise<CreateAPIKeyResponse> {
		try {
			const result = await this.post<CreateAPIKeyResponse>('/api-keys', { name })
			if (!result) {
				throw new Error('No response from server when creating API key')
			}
			return result
		} catch (error) {
			console.error('Error creating API key:', error)
			throw error
		}
	}

	async revoke(id: string): Promise<void> {
		try {
			await this.deleteRequest(`/api-keys/${id}`)
		} catch (error) {
			console.error('Error revoking API key:', error)
			throw error
		}
	}
}
