'use client'

import { Moon, Play, Sun } from 'lucide-react'
import { m } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { GithubIcon } from './BrandIcons'
import { PROJECT_CONFIG } from './project'

/** In-page sections linked from the bar (`anchor` is the section id). */
const SECTIONS = [
	{ id: 'architecture', anchor: 'architecture' },
	{ id: 'patterns', anchor: 'patterns' },
	{ id: 'techStack', anchor: 'tech-stack' },
	{ id: 'highlights', anchor: 'highlights' },
] as const

export interface LandingNavigationLabels {
	sections: Record<(typeof SECTIONS)[number]['id'], string>
	github: string
	liveDemo: string
	switchToLight: string
	switchToDark: string
	logoAlt: string
}

/** Fixed top bar: logo, section links, theme toggle and the demo/repository links. */
export function LandingNavigation({ labels }: { labels: LandingNavigationLabels }) {
	const [isScrolled, setIsScrolled] = useState(false)
	const { resolvedTheme, setTheme } = useTheme()
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setMounted(true)
		const handleScroll = () => setIsScrolled(window.scrollY > 50)
		window.addEventListener('scroll', handleScroll)
		return () => window.removeEventListener('scroll', handleScroll)
	}, [])

	const scrollToSection = (id: string) => {
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
	}

	return (
		<m.nav
			initial={{ y: -100 }}
			animate={{ y: 0 }}
			transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
			className={`fixed top-0 w-full z-50 transition-all duration-500 ${
				isScrolled ? 'bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-lg' : 'bg-transparent'
			}`}
		>
			<div className='container mx-auto px-4'>
				<div className='flex items-center justify-between h-16'>
					<Link href='/' className='flex items-center gap-3 group'>
						<m.div
							whileHover={{ scale: 1.1, rotate: 5 }}
							className='w-10 h-10 rounded-xl overflow-hidden border border-border/40 bg-background flex items-center justify-center shadow-lg'
						>
							<Image
								src='/sbfinance-logo.webp'
								alt={labels.logoAlt}
								width={40}
								height={40}
								className='w-full h-full object-cover'
							/>
						</m.div>
						<span className='font-bold text-xl'>SBFinance</span>
					</Link>

					<div className='hidden md:flex items-center gap-8'>
						{SECTIONS.map((section) => (
							<button
								type='button'
								key={section.id}
								onClick={() => scrollToSection(section.anchor)}
								className='text-muted-foreground hover:text-foreground transition-colors relative group capitalize'
							>
								{labels.sections[section.id]}
								<span className='absolute -bottom-1 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300' />
							</button>
						))}
					</div>

					<div className='flex items-center gap-3'>
						{mounted && (
							<Button
								variant='ghost'
								size='icon'
								onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
								className='rounded-full'
								aria-label={resolvedTheme === 'dark' ? labels.switchToLight : labels.switchToDark}
							>
								{resolvedTheme === 'dark' ? (
									<Sun className='h-4 w-4' aria-hidden='true' />
								) : (
									<Moon className='h-4 w-4' aria-hidden='true' />
								)}
							</Button>
						)}
						<Button variant='outline' asChild className='hidden sm:flex gap-2 rounded-full'>
							<a href={PROJECT_CONFIG.repository} target='_blank' rel='noopener noreferrer'>
								<GithubIcon className='h-4 w-4' />
								{labels.github}
							</a>
						</Button>
						<Button
							asChild
							className='bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 rounded-full shadow-lg shadow-primary/25'
						>
							<Link href={PROJECT_CONFIG.liveDemo}>
								<Play className='h-4 w-4 mr-2' />
								{labels.liveDemo}
							</Link>
						</Button>
					</div>
				</div>
			</div>
		</m.nav>
	)
}
