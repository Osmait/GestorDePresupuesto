'use client'

import { AlertCircle, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type MouseEvent, type ReactNode, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
	return typeof (value as PromiseLike<unknown> | undefined)?.then === 'function'
}

export interface ConfirmDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	/** The question, naming the object: "Delete the account “Ahorros”?" */
	title: ReactNode
	/** Consequence of confirming, e.g. what else is removed and that it can't be undone. */
	description?: ReactNode
	/** Defaults to `common.actions.delete` when `destructive`, else `common.actions.confirm`. */
	confirmLabel?: ReactNode
	/** Defaults to `common.actions.cancel`. */
	cancelLabel?: ReactNode
	/** Red confirm button. Use for deletes and other irreversible actions. */
	destructive?: boolean
	/** External busy state (e.g. `mutation.isPending`). */
	loading?: boolean
	/**
	 * Runs on confirm. Sync: the dialog closes right after. Async (return the
	 * promise, e.g. `mutateAsync`): the dialog stays open with a spinner and
	 * closes when it resolves; if it rejects the dialog stays open and shows
	 * `errorMessage` inline (a toast from the mutation's onError is still fine).
	 */
	onConfirm: () => unknown
	/** Inline message when `onConfirm` rejects. Defaults to `common.error.actionFailed`. */
	errorMessage?: ReactNode
	/** Optional extra content between the description and the buttons. */
	children?: ReactNode
}

/**
 * Confirmation for destructive or irreversible actions. Replaces native
 * `confirm()` and hand-rolled delete dialogs. Focus starts on Cancel; Escape
 * and Cancel are disabled while the action runs, and Confirm turns
 * `aria-disabled` (not `disabled`) so keyboard focus stays on it.
 *
 * @example
 * const [toDelete, setToDelete] = useState<Account | null>(null)
 * <ConfirmDialog
 *   open={toDelete !== null}
 *   onOpenChange={(open) => !open && setToDelete(null)}
 *   title={t('deleteTitle', { name: toDelete?.name })}
 *   description={t('deleteDescription')}
 *   destructive
 *   onConfirm={() => deleteAccount.mutateAsync(toDelete!.id)}
 * />
 */
export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel,
	cancelLabel,
	destructive = false,
	loading = false,
	onConfirm,
	errorMessage,
	children,
}: ConfirmDialogProps) {
	const t = useTranslations('common.actions')
	const tError = useTranslations('common.error')
	const [pending, setPending] = useState(false)
	const [failed, setFailed] = useState(false)
	// A closed dialog forgets the last failure.
	if (!open && failed) setFailed(false)
	const busy = loading || pending

	function handleOpenChange(next: boolean) {
		if (!next && busy) return
		onOpenChange(next)
	}

	async function handleConfirm(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault()
		if (busy) return
		setFailed(false)
		const result = onConfirm()
		if (!isPromiseLike(result)) {
			onOpenChange(false)
			return
		}
		setPending(true)
		try {
			await result
			onOpenChange(false)
		} catch {
			// Stay open and say so; the caller may also toast the details.
			setFailed(true)
		} finally {
			setPending(false)
		}
	}

	return (
		<AlertDialog open={open} onOpenChange={handleOpenChange}>
			{/* Without a description, opt out of aria-describedby (Radix warns otherwise). */}
			<AlertDialogContent {...(description ? {} : { 'aria-describedby': undefined })}>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					{description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
				</AlertDialogHeader>
				{children}
				{failed ? (
					<Alert variant='destructive'>
						<AlertCircle className='h-4 w-4' aria-hidden='true' />
						<AlertDescription>{errorMessage ?? tError('actionFailed')}</AlertDescription>
					</Alert>
				) : null}
				<AlertDialogFooter>
					<AlertDialogCancel disabled={busy}>{cancelLabel ?? t('cancel')}</AlertDialogCancel>
					<Button
						type='button'
						variant={destructive ? 'destructive' : 'default'}
						onClick={handleConfirm}
						// aria-disabled keeps focus on the button while busy (disabled would drop it to <body>).
						aria-disabled={busy || undefined}
						aria-busy={busy || undefined}
						className={busy ? 'cursor-not-allowed opacity-50' : undefined}
					>
						{busy ? <Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden='true' /> : null}
						{confirmLabel ?? (destructive ? t('delete') : t('confirm'))}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
