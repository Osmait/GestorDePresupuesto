import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SectionCardProps {
	/** id of the h2 (the section is labelled by it). */
	id: string
	title: ReactNode
	/** One muted line under the title. */
	description?: ReactNode
	/** Optional text link on the right of the title ("Ver presupuestos"). */
	link?: { href: string; label: ReactNode }
	className?: string
	children: ReactNode
}

/** One report card: a labelled `<section>` with the Card surface, h2 title, optional link. */
export function SectionCard({ id, title, description, link, className, children }: SectionCardProps) {
	return (
		<section
			aria-labelledby={id}
			className={cn(
				'flex min-w-0 flex-col gap-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm sm:p-5',
				className,
			)}
		>
			<div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
				<div className='min-w-0'>
					<h2 id={id} className='text-base font-semibold'>
						{title}
					</h2>
					{description ? <p className='mt-1 text-sm text-muted-foreground'>{description}</p> : null}
				</div>
				{link ? (
					<Link
						href={link.href}
						className='inline-flex min-h-10 items-center text-sm font-medium underline-offset-4 hover:underline focus-visible:underline'
					>
						{link.label}
					</Link>
				) : null}
			</div>
			{children}
		</section>
	)
}

/** Small round swatch in a category's own color (user data, used as-is). */
export function CategoryDot({ color }: { color?: string | null }) {
	return (
		<span
			aria-hidden='true'
			className='inline-block h-2 w-2 shrink-0 rounded-full bg-muted-foreground'
			style={color ? { backgroundColor: color } : undefined}
		/>
	)
}
