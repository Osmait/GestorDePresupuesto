'use client'

import { ArrowRight, Boxes, ChevronDown, Database, GitBranch, Layers, Play, Terminal } from 'lucide-react'
import { m, useScroll, useTransform } from 'motion/react'
import Link from 'next/link'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { GithubIcon } from './BrandIcons'
import { PROJECT_CONFIG } from './project'

export interface LandingHeroText {
	badge: string
	tagline: string
	description: string
	badges: string[]
	tryDemo: string
	viewSource: string
	scroll: string
}

const BADGE_ICONS = [Layers, Boxes, Database, GitBranch]

/** Full-height intro with a parallax fade on scroll. */
export function LandingHero({ text }: { text: LandingHeroText }) {
	const ref = useRef(null)
	const { scrollYProgress } = useScroll({
		target: ref,
		offset: ['start start', 'end start'],
	})
	const y = useTransform(scrollYProgress, [0, 1], [0, 200])
	const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])

	const techBadges = text.badges.map((name, i) => ({ name, icon: BADGE_ICONS[i % BADGE_ICONS.length] }))

	return (
		<section ref={ref} className='relative min-h-screen flex items-center justify-center overflow-hidden'>
			<div className='absolute inset-0'>
				<div className='absolute inset-0 bg-gradient-to-br from-muted/30 via-background to-muted/30' />
				<div className='absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl' />
				<div className='absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl' />
			</div>

			<m.div style={{ y, opacity }} className='container mx-auto px-4 relative z-10'>
				<div className='text-center max-w-5xl mx-auto'>
					<m.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6 }}
						className='inline-flex items-center gap-2 bg-secondary border border-border rounded-full px-4 py-2 mb-8'
					>
						<Terminal className='w-4 h-4 text-primary' />
						<span className='text-sm font-medium'>{text.badge}</span>
					</m.div>

					<m.h1
						initial={{ opacity: 0, y: 30 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, delay: 0.2 }}
						className='text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight'
					>
						<span className='bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent'>
							{PROJECT_CONFIG.name}
						</span>
					</m.h1>

					<m.p
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, delay: 0.4 }}
						className='text-xl md:text-2xl text-muted-foreground mb-6 font-medium'
					>
						{text.tagline}
					</m.p>

					<m.p
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, delay: 0.5 }}
						className='text-lg text-muted-foreground/80 mb-10 max-w-3xl mx-auto leading-relaxed'
					>
						{text.description}
					</m.p>

					{/* Architecture Badges */}
					<m.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, delay: 0.6 }}
						className='flex flex-wrap justify-center gap-3 mb-12'
					>
						{techBadges.map((tech, i) => (
							<m.div
								key={tech.name}
								initial={{ opacity: 0, scale: 0.8 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ duration: 0.4, delay: 0.7 + i * 0.1 }}
								whileHover={{ scale: 1.05, y: -3 }}
								className='bg-secondary border border-border px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2'
							>
								<tech.icon className='w-4 h-4 text-primary' />
								{tech.name}
							</m.div>
						))}
					</m.div>

					{/* CTA Buttons */}
					<m.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, delay: 1 }}
						className='flex flex-col sm:flex-row gap-4 justify-center items-center'
					>
						<Button size='lg' asChild className='text-lg px-8 py-7 rounded-full shadow-lg group'>
							<Link href={PROJECT_CONFIG.liveDemo}>
								<Play className='mr-2 h-5 w-5 group-hover:scale-110 transition-transform' />
								{text.tryDemo}
								<ArrowRight className='ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform' />
							</Link>
						</Button>
						<Button
							variant='outline'
							size='lg'
							asChild
							className='text-lg px-8 py-7 rounded-full border-2 hover:bg-foreground/5 group'
						>
							<a href={PROJECT_CONFIG.repository} target='_blank' rel='noopener noreferrer'>
								<GithubIcon className='mr-2 h-5 w-5 group-hover:rotate-12 transition-transform' />
								{text.viewSource}
							</a>
						</Button>
					</m.div>
				</div>
			</m.div>

			<m.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 1.5 }}
				className='absolute bottom-8 left-1/2 transform -translate-x-1/2'
			>
				<m.div
					animate={{ y: [0, 10, 0] }}
					transition={{ repeat: Infinity, duration: 2 }}
					className='flex flex-col items-center gap-2 text-muted-foreground'
				>
					<span className='text-sm'>{text.scroll}</span>
					<ChevronDown className='h-5 w-5' />
				</m.div>
			</m.div>
		</section>
	)
}
