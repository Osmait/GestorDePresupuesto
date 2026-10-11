'use client'

import NextTopLoader from 'nextjs-toploader'

export function ProgressBarProvider({ children }: { children: React.ReactNode }) {
	return (
		<>
			<NextTopLoader
				// Token color (ink in light, paper in dark); no glow (DESIGN.md > No-Gradient Rule).
				color='hsl(var(--primary))'
				initialPosition={0.08}
				crawlSpeed={200}
				height={3}
				crawl={true}
				showSpinner={false}
				easing='ease'
				speed={200}
				shadow={false}
				zIndex={1600}
				showAtBottom={false}
			/>
			{children}
		</>
	)
}
