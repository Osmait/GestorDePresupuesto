'use client'

import Atropos from 'atropos/react'
import 'atropos/css'

interface CreditCardTiltProps {
	onClick: () => void
	children: React.ReactNode
}

/**
 * The desktop 3D tilt of a card's front face. Kept in its own module so Atropos (and its
 * CSS) is only downloaded where the tilt runs: CreditCardAtroposVisual lazy-loads it for
 * fine pointers with hover on large screens.
 */
export default function CreditCardTilt({ onClick, children }: CreditCardTiltProps) {
	return (
		<Atropos
			onClick={onClick}
			activeOffset={16}
			shadowScale={0.98}
			rotateXMax={5}
			rotateYMax={6}
			duration={220}
			highlight={false}
			className='h-full w-full'
		>
			{children}
		</Atropos>
	)
}
