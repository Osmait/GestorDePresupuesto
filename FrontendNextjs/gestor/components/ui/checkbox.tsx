'use client'

import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * shadcn/ui Checkbox (Radix). Renders `role="checkbox"`; pair it with a
 * `<Label htmlFor>` or give it an `aria-label`. The 16px box sits inside a
 * transparent 40px hit area (`before:` pseudo-element) so touch targets stay
 * usable without changing the visual size.
 */
const Checkbox = React.forwardRef<
	React.ElementRef<typeof CheckboxPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
	<CheckboxPrimitive.Root
		ref={ref}
		className={cn(
			'peer relative h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background before:absolute before:-inset-3 before:content-[""] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
			className,
		)}
		{...props}
	>
		<CheckboxPrimitive.Indicator className='flex items-center justify-center text-current'>
			<Check className='h-3.5 w-3.5' aria-hidden='true' />
		</CheckboxPrimitive.Indicator>
	</CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
