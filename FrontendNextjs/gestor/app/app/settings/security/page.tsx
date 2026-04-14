import { PasskeyManager } from '@/components/settings/PasskeyManager'

export default function SecuritySettingsPage() {
	return (
		<div className='container mx-auto max-w-3xl p-6 space-y-6'>
			<div>
				<h1 className='text-3xl font-bold tracking-tight'>Security</h1>
				<p className='text-muted-foreground mt-1'>Manage how you sign in to your account.</p>
			</div>
			<PasskeyManager />
		</div>
	)
}
