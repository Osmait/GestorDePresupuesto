'use client'

import { AlertCircle, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type FormEvent, type ReactNode, useState, useSyncExternalStore } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { BREAKPOINTS, useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

const SIZE_CLASS = {
	sm: 'sm:max-w-md',
	md: 'sm:max-w-lg',
	lg: 'sm:max-w-2xl',
} as const

export type FormDialogSize = keyof typeof SIZE_CLASS

type SubmitHandler = (event: FormEvent<HTMLFormElement>) => unknown

/**
 * How the dialog submits. Without a custom `footer` one of `onSubmit` / `formId`
 * is required; with a `footer` (multi-step flows) both are optional.
 */
export type FormDialogSubmitProps =
	| {
			/**
			 * FormDialog renders the `<form>` around body + footer and calls this on
			 * submit (pass `form.handleSubmit(onValid)` for react-hook-form; wrap the
			 * fields in `<Form {...form}>`). Not called again while `loading`.
			 */
			onSubmit: SubmitHandler
			formId?: never
			/** Replaces the standard Cancel/Submit buttons. Only for multi-step flows. */
			footer?: ReactNode
	  }
	| {
			/** id of a `<form>` inside `children`; the submit button targets it. */
			formId: string
			onSubmit?: never
			footer?: ReactNode
	  }
	| {
			/**
			 * Custom buttons for multi-step flows. While `loading` the dialog still
			 * can't be dismissed, the form isn't resubmitted and every button in the
			 * footer is disabled (they sit in a disabled `<fieldset>`); show your own
			 * Loader2 on the busy button.
			 */
			footer: ReactNode
			onSubmit?: SubmitHandler
			formId?: never
	  }

interface FormDialogBaseProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	/** "New account" / "Edit account". */
	title: ReactNode
	/** Optional one-line helper under the title. */
	description?: ReactNode
	/** The fields. The body scrolls when taller than the viewport. */
	children: ReactNode
	/** Width on desktop: sm 448px, md 512px (default), lg 672px. */
	size?: FormDialogSize
	/** Defaults to `common.actions.save`. Name the action: "Create account". */
	submitLabel?: ReactNode
	/** Defaults to `common.actions.cancel`. */
	cancelLabel?: ReactNode
	/** Submit in flight: spinner on the submit button, buttons and the close X disabled, can't be dismissed. */
	loading?: boolean
	/** Disables submit (e.g. nothing changed yet). */
	submitDisabled?: boolean
	/** Inline server/validation error, shown above the footer in a destructive Alert. */
	error?: ReactNode
	className?: string
}

export type FormDialogProps = FormDialogBaseProps & FormDialogSubmitProps

function subscribeNever() {
	return () => {}
}

/** false during SSR and hydration, true afterwards (when media queries report real values). */
function useHydrated() {
	return useSyncExternalStore(
		subscribeNever,
		() => true,
		() => false,
	)
}

/**
 * The one modal for create/edit forms: a centered Dialog from `md` up and a
 * bottom Drawer on mobile, with a scrollable body, an inline error slot and
 * the standard footer (Cancel outline on the left, submit on the right with a
 * spinner while loading; stacked with submit on top on mobile).
 *
 * The Dialog/Drawer choice is taken when the dialog opens and kept until it
 * closes, so resizing across `md` (or rotating a tablet) doesn't remount the
 * fields and lose local state.
 *
 * @example
 * <FormDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   title={t('newAccount')}
 *   submitLabel={t('create')}
 *   loading={createAccount.isPending}
 *   error={serverError}
 *   onSubmit={form.handleSubmit(onValid)}
 * >
 *   <Form {...form}>…fields…</Form>
 * </FormDialog>
 */
export function FormDialog({
	open,
	onOpenChange,
	title,
	description,
	children,
	size = 'md',
	onSubmit,
	formId,
	submitLabel,
	cancelLabel,
	loading = false,
	submitDisabled = false,
	error,
	footer,
	className,
}: FormDialogProps) {
	const t = useTranslations('common.actions')
	const liveIsDesktop = useMediaQuery(BREAKPOINTS.md)
	const hydrated = useHydrated()
	const [lockedIsDesktop, setLockedIsDesktop] = useState<boolean | null>(null)
	if (open && hydrated && lockedIsDesktop === null) setLockedIsDesktop(liveIsDesktop)
	if (!open && lockedIsDesktop !== null) setLockedIsDesktop(null)
	const isDesktop = lockedIsDesktop ?? liveIsDesktop

	function handleOpenChange(next: boolean) {
		if (!next && loading) return
		onOpenChange(next)
	}

	const errorSlot = error ? (
		<Alert variant='destructive'>
			<AlertCircle className='h-4 w-4' aria-hidden='true' />
			<AlertDescription>{error}</AlertDescription>
		</Alert>
	) : null

	const buttons = footer ? (
		// Custom footers keep the loading guard: nothing in them is clickable while busy.
		<fieldset disabled={loading} className='contents'>
			{footer}
		</fieldset>
	) : (
		<>
			<Button type='button' variant='outline' onClick={() => handleOpenChange(false)} disabled={loading}>
				{cancelLabel ?? t('cancel')}
			</Button>
			<Button
				type='submit'
				form={onSubmit ? undefined : formId}
				disabled={loading || submitDisabled}
				aria-busy={loading || undefined}
			>
				{loading ? <Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden='true' /> : null}
				{submitLabel ?? t('save')}
			</Button>
		</>
	)

	const sections = (
		<>
			<div className={cn('min-h-0 flex-1 overflow-y-auto', isDesktop ? 'px-6 py-4' : 'px-4 py-2')}>{children}</div>
			{errorSlot ? <div className={isDesktop ? 'px-6 pb-2' : 'px-4 pb-2'}>{errorSlot}</div> : null}
			<div
				data-slot='form-dialog-footer'
				className={cn('flex flex-col-reverse gap-2 border-t', isDesktop ? 'flex-row justify-end px-6 py-4' : 'p-4')}
			>
				{buttons}
			</div>
		</>
	)

	const content = onSubmit ? (
		<form
			noValidate
			className='flex min-h-0 flex-1 flex-col'
			onSubmit={(event) => {
				event.preventDefault()
				if (!loading) void onSubmit(event)
			}}
		>
			{sections}
		</form>
	) : (
		sections
	)

	// DialogContent manages aria-describedby itself; vaul's content needs the explicit opt-out.
	const describedBy = description ? {} : { 'aria-describedby': undefined }

	if (isDesktop) {
		return (
			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogContent
					closeDisabled={loading}
					className={cn('flex max-h-[90vh] flex-col gap-0 p-0', SIZE_CLASS[size], className)}
				>
					<DialogHeader className='px-6 pt-6 pr-14 pb-2 text-left'>
						<DialogTitle>{title}</DialogTitle>
						{description ? <DialogDescription>{description}</DialogDescription> : null}
					</DialogHeader>
					{content}
				</DialogContent>
			</Dialog>
		)
	}

	return (
		<Drawer open={open} onOpenChange={handleOpenChange} shouldScaleBackground={false}>
			<DrawerContent {...describedBy} className={cn('max-h-[90dvh]', className)}>
				<DrawerHeader className='text-left'>
					<DrawerTitle>{title}</DrawerTitle>
					{description ? <DrawerDescription>{description}</DrawerDescription> : null}
				</DrawerHeader>
				{content}
			</DrawerContent>
		</Drawer>
	)
}
