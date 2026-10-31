'use client'

import { domAnimation, type HTMLMotionProps, LazyMotion, m } from 'motion/react'

/**
 * m + LazyMotion(domAnimation) instead of motion: the landing only uses
 * animate/whileInView/whileHover and motion values, not layout or drag.
 */
export function LandingMotion({ children }: { children: React.ReactNode }) {
	return <LazyMotion features={domAnimation}>{children}</LazyMotion>
}

/**
 * An animated div the server-rendered landing sections can use: its children stay
 * server components, only the wrapper (with serializable motion props) is client code.
 */
export function MotionDiv(props: HTMLMotionProps<'div'>) {
	return <m.div {...props} />
}
