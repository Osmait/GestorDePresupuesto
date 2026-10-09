'use client'

import { startAuthentication } from '@simplewebauthn/browser'
import { Fingerprint, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { passkeyRepository } from '@/app/repository/passkeyRepository'
import { Button } from '@/components/ui/button'
import { getCallbackUrlFromLocation } from '@/lib/auth/callback-url'

interface Props {
	className?: string
	disabled?: boolean
}

export function PasskeyLoginButton({ className, disabled }: Props) {
	const t = useTranslations('auth.passkey')
	const [loading, setLoading] = useState(false)
	const router = useRouter()

	const handleClick = async () => {
		if (loading) return
		setLoading(true)
		try {
			const begin = await passkeyRepository.beginLogin()
			// @simplewebauthn/browser expects the "publicKey" options object
			// directly; go-webauthn returns { publicKey: { ... } }.
			const options = (begin.options as any)?.publicKey ?? begin.options
			const assertion = await startAuthentication(options)
			const tokens = await passkeyRepository.finishLogin(begin.session_id, assertion)

			const result = await signIn('passkey', {
				accessToken: tokens.access_token,
				refreshToken: tokens.refresh_token,
				redirect: false,
			})

			if (result?.error) {
				toast.error(t('failed'))
				return
			}

			toast.success(t('success'))
			router.push(getCallbackUrlFromLocation())
			router.refresh()
		} catch (err) {
			const msg = err instanceof Error ? err.message : ''
			if (msg.toLowerCase().includes('abort') || msg.toLowerCase().includes('cancelled')) {
				// User cancelled — stay silent.
				return
			}
			toast.error(msg || t('failed'))
		} finally {
			setLoading(false)
		}
	}

	return (
		<Button type='button' variant='outline' className={className} onClick={handleClick} disabled={disabled || loading}>
			{loading ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <Fingerprint className='mr-2 h-4 w-4' />}
			{t('signIn')}
		</Button>
	)
}
