export interface APIKey {
	id: string
	user_id: string
	name: string
	key_prefix: string
	last_used_at: string | null
	expires_at: string | null
	created_at: string
	is_active: boolean
}

export interface CreateAPIKeyResponse {
	id: string
	name: string
	token: string
	key_prefix: string
	created_at: string
}
