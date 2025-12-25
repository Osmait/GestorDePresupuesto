'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion, useScroll, useTransform } from 'framer-motion'
import {
	ArrowRight,
	BarChart3,
	Github,
	Linkedin,
	ExternalLink,
	Code2,
	Database,
	Server,
	Moon,
	Sun,
	Play,
	ChevronDown,
	Terminal,
	Layers,
	Zap,
	Shield,
	FolderTree,
	GitBranch,
	Boxes,
	ArrowDownUp,
	Cpu,
	FileCode,
	Box
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'

// ============================================
// CONFIGURACIÓN DEL PROYECTO
// ============================================
const PROJECT_CONFIG = {
	name: 'Gestor de Presupuesto',
	tagline: 'Full-Stack Personal Finance Application',
	description: 'A production-ready financial management system demonstrating Clean Architecture, SOLID principles, and modern full-stack development patterns. Built with Next.js 14, Go, and PostgreSQL.',
	repository: 'https://github.com/Osmait/GestorDePresupuesto',
	liveDemo: '/login',
	developer: {
		name: 'Jose Saul Burgos',
		role: 'Full-Stack Developer',
		linkedin: 'https://www.linkedin.com/in/jos%C3%A9-sa%C3%BAl-burgos-35680b244/',
		github: 'https://github.com/Osmait',
	}
}

// ============================================
// ANIMACIONES
// ============================================
const _fadeInUp = {
	initial: { opacity: 0, y: 60 },
	animate: { opacity: 1, y: 0 },
	transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
}

// ============================================
// COMPONENTE: NAVEGACIÓN
// ============================================
function Navigation() {
	const [isScrolled, setIsScrolled] = useState(false)
	const { theme, setTheme } = useTheme()
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
		<motion.nav
			initial={{ y: -100 }}
			animate={{ y: 0 }}
			transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
			className={`fixed top-0 w-full z-50 transition-all duration-500 ${isScrolled
				? 'bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-lg'
				: 'bg-transparent'
				}`}
		>
			<div className="container mx-auto px-4">
				<div className="flex items-center justify-between h-16">
					<Link href="/" className="flex items-center gap-3 group">
						<motion.div
							whileHover={{ scale: 1.1, rotate: 5 }}
							className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg"
						>
							<BarChart3 className="h-5 w-5 text-primary-foreground" />
						</motion.div>
						<span className="font-bold text-xl">FinanceApp</span>
					</Link>

					<div className="hidden md:flex items-center gap-8">
						{['architecture', 'patterns', 'tech-stack', 'highlights'].map((section) => (
							<button
								key={section}
								onClick={() => scrollToSection(section)}
								className="text-muted-foreground hover:text-foreground transition-colors relative group capitalize"
							>
								{section.replace('-', ' ')}
								<span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
							</button>
						))}
					</div>

					<div className="flex items-center gap-3">
						{mounted && (
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
								className="rounded-full"
							>
								{theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
							</Button>
						)}
						<Button variant="outline" asChild className="hidden sm:flex gap-2 rounded-full">
							<a href={PROJECT_CONFIG.repository} target="_blank" rel="noopener noreferrer">
								<Github className="h-4 w-4" />
								GitHub
							</a>
						</Button>
						<Button asChild className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 rounded-full shadow-lg shadow-primary/25">
							<Link href={PROJECT_CONFIG.liveDemo}>
								<Play className="h-4 w-4 mr-2" />
								Live Demo
							</Link>
						</Button>
					</div>
				</div>
			</div>
		</motion.nav>
	)
}

// ============================================
// COMPONENTE: HERO SECTION
// ============================================
function HeroSection() {
	const ref = useRef(null)
	const { scrollYProgress } = useScroll({
		target: ref,
		offset: ["start start", "end start"]
	})
	const y = useTransform(scrollYProgress, [0, 1], [0, 200])
	const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])

	const techBadges = [
		{ name: 'Clean Architecture', icon: Layers },
		{ name: 'SOLID Principles', icon: Boxes },
		{ name: 'Repository Pattern', icon: Database },
		{ name: 'Dependency Injection', icon: GitBranch },
	]

	return (
		<section ref={ref} className="relative min-h-screen flex items-center justify-center overflow-hidden">
			<div className="absolute inset-0">
				<div className="absolute inset-0 bg-gradient-to-br from-muted/30 via-background to-muted/30" />
				<div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
				<div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
			</div>

			<motion.div
				style={{ y, opacity }}
				className="container mx-auto px-4 relative z-10"
			>
				<div className="text-center max-w-5xl mx-auto">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6 }}
						className="inline-flex items-center gap-2 bg-secondary border border-border rounded-full px-4 py-2 mb-8"
					>
						<Terminal className="w-4 h-4 text-primary" />
						<span className="text-sm font-medium">Technical Portfolio Project</span>
					</motion.div>

					<motion.h1
						initial={{ opacity: 0, y: 30 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, delay: 0.2 }}
						className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight"
					>
						<span className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
							{PROJECT_CONFIG.name}
						</span>
					</motion.h1>

					<motion.p
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, delay: 0.4 }}
						className="text-xl md:text-2xl text-muted-foreground mb-6 font-medium"
					>
						{PROJECT_CONFIG.tagline}
					</motion.p>

					<motion.p
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, delay: 0.5 }}
						className="text-lg text-muted-foreground/80 mb-10 max-w-3xl mx-auto leading-relaxed"
					>
						{PROJECT_CONFIG.description}
					</motion.p>

					{/* Architecture Badges */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, delay: 0.6 }}
						className="flex flex-wrap justify-center gap-3 mb-12"
					>
						{techBadges.map((tech, i) => (
							<motion.div
								key={tech.name}
								initial={{ opacity: 0, scale: 0.8 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ duration: 0.4, delay: 0.7 + i * 0.1 }}
								whileHover={{ scale: 1.05, y: -3 }}
								className="bg-secondary border border-border px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2"
							>
								<tech.icon className="w-4 h-4 text-primary" />
								{tech.name}
							</motion.div>
						))}
					</motion.div>

					{/* CTA Buttons */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, delay: 1 }}
						className="flex flex-col sm:flex-row gap-4 justify-center items-center"
					>
						<Button
							size="lg"
							asChild
							className="text-lg px-8 py-7 rounded-full shadow-lg group"
						>
							<Link href={PROJECT_CONFIG.liveDemo}>
								<Play className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
								Try Live Demo
								<ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
							</Link>
						</Button>
						<Button
							variant="outline"
							size="lg"
							asChild
							className="text-lg px-8 py-7 rounded-full border-2 hover:bg-foreground/5 group"
						>
							<a href={PROJECT_CONFIG.repository} target="_blank" rel="noopener noreferrer">
								<Github className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
								View Source Code
							</a>
						</Button>
					</motion.div>
				</div>
			</motion.div>

			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 1.5 }}
				className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
			>
				<motion.div
					animate={{ y: [0, 10, 0] }}
					transition={{ repeat: Infinity, duration: 2 }}
					className="flex flex-col items-center gap-2 text-muted-foreground"
				>
					<span className="text-sm">Scroll to explore architecture</span>
					<ChevronDown className="h-5 w-5" />
				</motion.div>
			</motion.div>
		</section>
	)
}

// ============================================
// COMPONENTE: ARCHITECTURE SECTION
// ============================================
function ArchitectureSection() {
	const layers = [
		{
			name: 'Framework & Drivers',
			description: 'External interfaces (HTTP, Database, Logger)',
			components: ['Gin HTTP Server', 'PostgreSQL', 'Zerolog'],
			color: 'from-slate-500 to-slate-600',
			icon: Server
		},
		{
			name: 'Interface Adapters',
			description: 'Convert data between layers',
			components: ['Handlers', 'Repositories', 'DTOs'],
			color: 'from-blue-500 to-blue-600',
			icon: ArrowDownUp
		},
		{
			name: 'Application Layer',
			description: 'Business logic and use cases',
			components: ['Services', 'Use Cases', 'Validation'],
			color: 'from-purple-500 to-purple-600',
			icon: Cpu
		},
		{
			name: 'Domain Layer',
			description: 'Core business entities and rules',
			components: ['User', 'Account', 'Transaction', 'Budget'],
			color: 'from-emerald-500 to-emerald-600',
			icon: Box
		},
	]

	return (
		<section id="architecture" className="py-32 relative overflow-hidden">
			<div className="absolute inset-0 bg-gradient-to-b from-transparent via-muted/30 to-transparent" />

			<div className="container mx-auto px-4 relative">
				<motion.div
					initial={{ opacity: 0, y: 30 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.8 }}
					className="text-center mb-20"
				>
					<Badge variant="outline" className="mb-4 px-4 py-1.5">
						<Layers className="w-3 h-3 mr-2" />
						System Architecture
					</Badge>
					<h2 className="text-4xl md:text-6xl font-bold mb-6">
						Clean Architecture
					</h2>
					<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
						The backend follows Clean Architecture principles with clear separation of concerns.
						Dependencies point inward, keeping the core domain independent of frameworks.
					</p>
				</motion.div>

				{/* Architecture Diagram */}
				<div className="max-w-4xl mx-auto mb-16">
					<div className="space-y-4">
						{layers.map((layer, i) => (
							<motion.div
								key={layer.name}
								initial={{ opacity: 0, x: -50 }}
								whileInView={{ opacity: 1, x: 0 }}
								viewport={{ once: true }}
								transition={{ duration: 0.5, delay: i * 0.15 }}
							>
								<Card className="overflow-hidden border-border/50 hover:border-primary/30 transition-colors">
									<CardContent className="p-0">
										<div className={`bg-gradient-to-r ${layer.color} p-4 flex items-center gap-4`}>
											<layer.icon className="w-6 h-6 text-white" />
											<div>
												<h3 className="font-bold text-white">{layer.name}</h3>
												<p className="text-white/80 text-sm">{layer.description}</p>
											</div>
										</div>
										<div className="p-4 flex flex-wrap gap-2">
											{layer.components.map((comp) => (
												<Badge key={comp} variant="secondary" className="font-mono text-xs">
													{comp}
												</Badge>
											))}
										</div>
									</CardContent>
								</Card>
							</motion.div>
						))}
					</div>
				</div>

				{/* Dependency Rule */}
				<motion.div
					initial={{ opacity: 0, y: 30 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.8 }}
					className="text-center"
				>
					<div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-6 py-3">
						<ArrowDownUp className="w-5 h-5 text-primary" />
						<span className="font-medium">Dependencies always point inward → Domain never depends on outer layers</span>
					</div>
				</motion.div>
			</div>
		</section>
	)
}

// ============================================
// COMPONENTE: DESIGN PATTERNS SECTION
// ============================================
function DesignPatternsSection() {
	const patterns = [
		{
			name: 'Repository Pattern',
			description: 'Abstract data access behind interfaces, enabling easy testing with mocks and database swapping.',
			example: `type UserRepository interface {
  Save(ctx, user) error
  FindById(ctx, id) (*User, error)
}`,
			icon: Database
		},
		{
			name: 'Dependency Injection',
			description: 'Services receive dependencies via constructors, promoting loose coupling and testability.',
			example: `func NewUserService(
  repo UserRepository,
) *UserService {
  return &UserService{repo}
}`,
			icon: GitBranch
		},
		{
			name: 'DTO Pattern',
			description: 'Separate request/response objects from domain entities to control API contracts.',
			example: `type UserRequest struct {
  Name  string \`validate:"required"\`
  Email string \`validate:"email"\`
}`,
			icon: ArrowDownUp
		},
		{
			name: 'Factory Pattern',
			description: 'Constructor functions create domain entities with proper initialization.',
			example: `func NewUser(id, name, email string) *User {
  return &User{
    Id: id, Name: name, Email: email,
  }
}`,
			icon: Boxes
		},
	]

	return (
		<section id="patterns" className="py-32 relative">
			<div className="container mx-auto px-4">
				<motion.div
					initial={{ opacity: 0, y: 30 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.8 }}
					className="text-center mb-20"
				>
					<Badge variant="outline" className="mb-4 px-4 py-1.5">
						<Code2 className="w-3 h-3 mr-2" />
						Design Patterns
					</Badge>
					<h2 className="text-4xl md:text-6xl font-bold mb-6">
						Patterns Implemented
					</h2>
					<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
						Industry-standard design patterns ensuring maintainability, testability, and clean code.
					</p>
				</motion.div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{patterns.map((pattern, i) => (
						<motion.div
							key={pattern.name}
							initial={{ opacity: 0, y: 30 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.5, delay: i * 0.1 }}
							whileHover={{ y: -5 }}
						>
							<Card className="h-full border-border/50 bg-card hover:border-primary/30 hover:shadow-xl transition-all duration-300">
								<CardContent className="p-6">
									<div className="flex items-center gap-3 mb-4">
										<div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
											<pattern.icon className="h-6 w-6 text-primary" />
										</div>
										<h3 className="text-xl font-bold">{pattern.name}</h3>
									</div>
									<p className="text-muted-foreground mb-4">{pattern.description}</p>
									<div className="bg-muted/50 rounded-lg p-4 font-mono text-xs overflow-x-auto">
										<pre className="text-foreground/80">{pattern.example}</pre>
									</div>
								</CardContent>
							</Card>
						</motion.div>
					))}
				</div>
			</div>
		</section>
	)
}

// ============================================
// COMPONENTE: TECH STACK SECTION
// ============================================
function TechStackSection() {
	const frontend = [
		{ name: 'Next.js 14', description: 'App Router & Server Components', logo: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M11.572 0c-.176 0-.31.001-.358.007a19.76 19.76 0 0 0-.364.033C7.443.346 4.25 2.185 2.228 5.012a11.875 11.875 0 0 0-2.119 5.243c-.096.659-.108.854-.108 1.747s.012 1.089.108 1.748c.652 4.506 3.86 8.292 8.209 9.695.779.251 1.6.422 2.534.525.363.04 1.935.04 2.299 0 1.611-.178 2.977-.577 4.323-1.264.207-.106.247-.134.219-.158-.02-.013-.9-1.193-1.955-2.62l-1.919-2.592-2.404-3.558a338.739 338.739 0 0 0-2.422-3.556c-.009-.002-.018 1.579-.023 3.51-.007 3.38-.01 3.515-.052 3.595a.426.426 0 0 1-.206.214c-.075.037-.14.044-.495.044H7.81l-.108-.068a.438.438 0 0 1-.157-.171l-.05-.106.006-4.703.007-4.705.072-.092a.645.645 0 0 1 .174-.143c.096-.047.134-.051.54-.051.478 0 .558.018.682.154.035.038 1.337 1.999 2.895 4.361a10760.433 10760.433 0 0 0 4.735 7.17l1.9 2.879.096-.063a12.317 12.317 0 0 0 2.466-2.163 11.944 11.944 0 0 0 2.824-6.134c.096-.66.108-.854.108-1.748 0-.893-.012-1.088-.108-1.747-.652-4.506-3.859-8.292-8.208-9.695a12.597 12.597 0 0 0-2.499-.523A33.119 33.119 0 0 0 11.572 0zm4.069 7.217c.347 0 .408.005.486.047a.473.473 0 0 1 .237.277c.018.06.023 1.365.018 4.304l-.006 4.218-.744-1.14-.746-1.14v-3.066c0-1.982.01-3.097.023-3.15a.478.478 0 0 1 .233-.296c.096-.05.13-.054.5-.054z" /></svg> },
		{ name: 'React 18', description: 'Concurrent Features & Hooks', logo: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M14.23 12.004a2.236 2.236 0 0 1-2.235 2.236 2.236 2.236 0 0 1-2.236-2.236 2.236 2.236 0 0 1 2.235-2.236 2.236 2.236 0 0 1 2.236 2.236zm2.648-10.69c-1.346 0-3.107.96-4.888 2.622-1.78-1.653-3.542-2.602-4.887-2.602-.41 0-.783.093-1.106.278-1.375.793-1.683 3.264-.973 6.365C1.98 8.917 0 10.42 0 12.004c0 1.59 1.99 3.097 5.043 4.03-.704 3.113-.39 5.588.988 6.38.32.187.69.275 1.102.275 1.345 0 3.107-.96 4.888-2.624 1.78 1.654 3.542 2.603 4.887 2.603.41 0 .783-.09 1.106-.275 1.374-.792 1.683-3.263.973-6.365C22.02 15.096 24 13.59 24 12.004c0-1.59-1.99-3.097-5.043-4.032.704-3.11.39-5.587-.988-6.38-.318-.184-.688-.277-1.092-.278zm-.005 1.09v.006c.225 0 .406.044.558.127.666.382.955 1.835.73 3.704-.054.46-.142.945-.25 1.44-.96-.236-2.006-.417-3.107-.534-.66-.905-1.345-1.727-2.035-2.447 1.592-1.48 3.087-2.292 4.105-2.295zm-9.77.02c1.012 0 2.514.808 4.11 2.28-.686.72-1.37 1.537-2.02 2.442-1.107.117-2.154.298-3.113.538-.112-.49-.195-.964-.254-1.42-.23-1.868.054-3.32.714-3.707.19-.09.4-.127.563-.132zM12 8.1c.74 0 1.477.034 2.202.093.406.582.802 1.203 1.183 1.86.372.64.71 1.29 1.018 1.946-.308.655-.646 1.31-1.013 1.95-.38.66-.773 1.288-1.18 1.87-.728.063-1.466.098-2.21.098-.74 0-1.477-.035-2.202-.093-.406-.582-.802-1.204-1.183-1.86-.372-.64-.71-1.29-1.018-1.946.303-.657.646-1.313 1.013-1.954.38-.66.773-1.286 1.18-1.868.728-.064 1.466-.098 2.21-.098z" /></svg> },
		{ name: 'TypeScript', description: 'Full Type Safety', logo: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z" /></svg> },
		{ name: 'TanStack Query', description: 'Server State & Caching', logo: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg> },
		{ name: 'Tailwind CSS', description: 'Utility-First Styling', logo: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12.001,4.8c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624 C13.666,10.618,15.027,12,18.001,12c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624 C16.337,6.182,14.976,4.8,12.001,4.8z M6.001,12c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624 c1.177,1.194,2.538,2.576,5.512,2.576c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624 C10.337,13.382,8.976,12,6.001,12z" /></svg> },
		{ name: 'shadcn/ui', description: 'Radix UI Components', logo: <svg viewBox="0 0 25 25" fill="currentColor" className="w-6 h-6"><path d="M12 25C7.58173 25 4 21.4183 4 17C4 12.5817 7.58173 9 12 9V25Z" /><path d="M12 0H4V8H12V0Z" /><path d="M17 8C19.2091 8 21 6.20914 21 4C21 1.79086 19.2091 0 17 0C14.7909 0 13 1.79086 13 4C13 6.20914 14.7909 8 17 8Z" /></svg> },
	]

	const backend = [
		{ name: 'Go 1.24', description: 'High-Performance Backend', logo: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M1.811 10.231c-.047 0-.058-.023-.035-.059l.246-.315c.023-.035.081-.058.128-.058h4.172c.046 0 .058.035.035.07l-.199.303c-.023.036-.082.07-.117.07zM.047 11.306c-.047 0-.059-.023-.035-.058l.245-.316c.023-.035.082-.058.129-.058h5.328c.047 0 .07.035.058.07l-.093.28c-.012.047-.058.07-.105.07zm2.828 1.075c-.047 0-.059-.035-.035-.07l.163-.292c.023-.035.07-.07.117-.07h2.337c.047 0 .07.035.07.082l-.023.28c0 .047-.047.082-.082.082zm12.129-2.36c-.736.187-1.239.327-1.963.514-.176.046-.187.058-.34-.117-.174-.199-.303-.327-.548-.444-.737-.362-1.45-.257-2.115.175-.795.514-1.204 1.274-1.192 2.22.011.935.654 1.706 1.577 1.835.795.105 1.46-.175 1.987-.77.105-.13.198-.27.315-.434H10.47c-.245 0-.304-.152-.222-.35.152-.362.432-.97.596-1.274a.315.315 0 01.292-.187h4.253c-.023.316-.023.631-.07.947a4.983 4.983 0 01-.958 2.29c-.841 1.11-1.94 1.8-3.33 1.986-1.145.152-2.209-.07-3.143-.77-.865-.655-1.356-1.52-1.484-2.595-.152-1.274.222-2.419.993-3.424.83-1.086 1.928-1.776 3.272-2.02 1.098-.2 2.15-.07 3.096.571.62.41 1.063.97 1.356 1.648.07.105.023.164-.117.2m3.868 6.461c-1.064-.024-2.034-.328-2.852-1.029a3.665 3.665 0 01-1.262-2.255c-.21-1.32.152-2.489.947-3.529.853-1.122 1.881-1.706 3.272-1.95 1.192-.21 2.314-.095 3.33.595.923.63 1.496 1.484 1.648 2.605.198 1.578-.257 2.863-1.344 3.962-.771.783-1.718 1.273-2.805 1.495-.315.06-.63.07-.934.106zm2.78-4.72c-.011-.153-.011-.27-.034-.387-.21-1.157-1.274-1.81-2.384-1.554-1.087.245-1.788.935-2.045 2.033-.21.912.234 1.835 1.075 2.21.643.28 1.285.244 1.905-.07.923-.48 1.425-1.228 1.484-2.233z" /></svg> },
		{ name: 'Gin', description: 'HTTP Web Framework', logo: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M5.025 7.377c-.046-.287.092-.54.31-.56.218-.02.436.192.483.479.047.287-.092.54-.31.56-.218.02-.436-.193-.483-.479m4.406-.746c-.047-.287.092-.54.31-.56.218-.02.436.193.483.479.046.287-.093.54-.31.56-.219.02-.437-.192-.484-.479M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2m3.5 14.5c-2.333 1-4.667 1-7 0-.417-.167-.583-.5-.5-.917.167-.833.5-1.583 1-2.25.333-.417.75-.333 1.083 0 .667.667 1.417 1 2.417 1s1.75-.333 2.417-1c.333-.333.75-.417 1.083 0 .5.667.833 1.417 1 2.25.083.417-.083.75-.5.917" /></svg> },
		{ name: 'PostgreSQL', description: 'Relational Database', logo: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M23.5594 14.7228a.5269.5269 0 0 0-.0563-.1191c-.139-.2632-.4768-.3418-1.0074-.2321-1.6533.3411-2.2935.1312-2.5256-.0191 1.342-2.0482 2.445-4.522 3.0411-6.8297.2714-1.0507.7982-3.5237.1222-4.7316a1.5641 1.5641 0 0 0-.1509-.235C21.6931.9086 19.8007.0248 17.5099.0005c-1.4947-.0158-2.7705.3461-3.1161.4794a9.449 9.449 0 0 0-.5159-.0816 8.044 8.044 0 0 0-1.3114-.1278c-1.1822-.0184-2.2038.2642-3.0498.8406-.8573-.3211-4.7888-1.645-7.2219.0788C.9359 2.1526.3086 3.8733.4302 6.3043c.0409.818.5069 3.334 1.2423 5.7436.4598 1.5065.9387 2.7019 1.4334 3.582.553.9942 1.1259 1.5933 1.7143 1.7895.4474.1491 1.1327.1441 1.8581-.7279.8012-.9635 1.5903-1.8258 1.9446-2.2069.4351.2355.9064.3625 1.39.3772a.0569.0569 0 0 0 .0004.0041 11.0312 11.0312 0 0 0-.2472.3054c-.3389.4302-.4094.5197-1.5002.7443-.3102.064-1.1344.2339-1.1464.8115-.0025.1224.0329.2309.0919.3268.2269.4231.9216.6097 1.015.6331 1.3345.3335 2.5044.092 3.3714-.6787-.017 2.231.0775 4.4174.3454 5.0874.2212.5529.7618 1.9045 2.4692 1.9043.2505 0 .5263-.0291.8296-.0941 1.7819-.3821 2.5557-1.1696 2.855-2.9059.1503-.8707.4016-2.8753.5388-4.1012.0169-.0703.0357-.1207.057-.1362.0007-.0005.0697-.0471.4272.0307a.3673.3673 0 0 0 .0443.0068l.2539.0223.0149.001c.8468.0384 1.9114-.1426 2.5312-.4308.6438-.2988 1.8057-1.0323 1.5951-1.6698z" /></svg> },
		{ name: 'JWT', description: 'Secure Authentication', logo: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M10.2 0v6.456L12 8.928l1.8-2.472V0zm3.6 6.456v3.072l2.904-.96L20.52 3.36l-2.928-2.136zm2.904 2.112l-1.8 2.496 2.928.936 6.144-1.992-1.128-3.432zM17.832 12l-2.928.936 1.8 2.496 6.144 1.992 1.128-3.432zm-1.128 3.432l-2.904-.96v3.072l3.792 5.232 2.928-2.136zM13.8 17.544L12 15.072l-1.8 2.472V24h3.6zm-3.6 0v-3.072l-2.904.96L3.48 20.64l2.928 2.136zm-2.904-2.112l1.8-2.496L6.168 12 .024 13.992l1.128 3.432zM6.168 12l2.928-.936-1.8-2.496-6.144-1.992-1.128 3.432zm1.128-3.432l2.904.96V6.456L6.408 1.224 3.48 3.36z" /></svg> },
		{ name: 'Docker', description: 'Containerization', logo: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.186m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288z" /></svg> },
	]

	return (
		<section id="tech-stack" className="py-32 relative overflow-hidden">
			<div className="absolute inset-0 bg-gradient-to-b from-transparent via-muted/30 to-transparent" />

			<div className="container mx-auto px-4 relative">
				<motion.div
					initial={{ opacity: 0, y: 30 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.8 }}
					className="text-center mb-20"
				>
					<Badge variant="outline" className="mb-4 px-4 py-1.5">
						<Terminal className="w-3 h-3 mr-2" />
						Tech Stack
					</Badge>
					<h2 className="text-4xl md:text-6xl font-bold mb-6">
						Technologies Used
					</h2>
					<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
						A modern, production-ready stack optimized for performance, developer experience, and scalability.
					</p>
				</motion.div>

				{/* Frontend Stack */}
				<motion.div
					initial={{ opacity: 0, y: 30 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.8 }}
					className="mb-16"
				>
					<h3 className="text-2xl font-bold mb-8 flex items-center gap-3">
						<Code2 className="h-6 w-6 text-primary" />
						Frontend
					</h3>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{frontend.map((tech, i) => (
							<motion.div
								key={tech.name}
								initial={{ opacity: 0, y: 20 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true }}
								transition={{ duration: 0.5, delay: i * 0.1 }}
								whileHover={{ y: -5 }}
							>
								<Card className="h-full border-border/50 bg-card hover:border-primary/30 hover:shadow-xl transition-all duration-300">
									<CardContent className="p-6">
										<div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4 text-foreground">
											{tech.logo}
										</div>
										<h4 className="font-semibold text-lg mb-1">{tech.name}</h4>
										<p className="text-sm text-muted-foreground">{tech.description}</p>
									</CardContent>
								</Card>
							</motion.div>
						))}
					</div>
				</motion.div>

				{/* Backend Stack */}
				<motion.div
					initial={{ opacity: 0, y: 30 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.8, delay: 0.2 }}
				>
					<h3 className="text-2xl font-bold mb-8 flex items-center gap-3">
						<Server className="h-6 w-6 text-primary" />
						Backend
					</h3>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
						{backend.map((tech, i) => (
							<motion.div
								key={tech.name}
								initial={{ opacity: 0, y: 20 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true }}
								transition={{ duration: 0.5, delay: i * 0.1 }}
								whileHover={{ y: -5 }}
							>
								<Card className="h-full border-border/50 bg-card hover:border-primary/30 hover:shadow-xl transition-all duration-300">
									<CardContent className="p-6">
										<div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4 text-foreground">
											{tech.logo}
										</div>
										<h4 className="font-semibold text-lg mb-1">{tech.name}</h4>
										<p className="text-sm text-muted-foreground">{tech.description}</p>
									</CardContent>
								</Card>
							</motion.div>
						))}
					</div>
				</motion.div>
			</div>
		</section>
	)
}

// ============================================
// COMPONENTE: TECHNICAL HIGHLIGHTS SECTION
// ============================================
function TechnicalHighlightsSection() {
	const highlights = [
		{
			icon: Shield,
			title: 'JWT Authentication',
			description: 'Stateless token-based auth with bcrypt password hashing and configurable expiration.',
		},
		{
			icon: Database,
			title: 'Database Migrations',
			description: 'Version-controlled migrations with golang-migrate. Supports PostgreSQL (prod) and SQLite (tests).',
		},
		{
			icon: Zap,
			title: 'Background Workers',
			description: 'Scheduled jobs for recurring transactions with graceful shutdown handling.',
		},
		{
			icon: Layers,
			title: 'In-Memory Cache',
			description: 'Transaction caching layer with 5-minute TTL for improved read performance.',
		},
		{
			icon: FileCode,
			title: 'Structured Logging',
			description: 'Zerolog for JSON-formatted logs with configurable levels and correlation IDs.',
		},
		{
			icon: FolderTree,
			title: 'Internationalization',
			description: 'Full i18n support (ES/EN) using next-intl with type-safe translations.',
		},
	]

	return (
		<section id="highlights" className="py-32 relative">
			<div className="container mx-auto px-4">
				<motion.div
					initial={{ opacity: 0, y: 30 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.8 }}
					className="text-center mb-20"
				>
					<Badge variant="outline" className="mb-4 px-4 py-1.5">
						<Zap className="w-3 h-3 mr-2" />
						Technical Highlights
					</Badge>
					<h2 className="text-4xl md:text-6xl font-bold mb-6">
						Key Implementations
					</h2>
					<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
						Notable technical features and engineering decisions that make this project production-ready.
					</p>
				</motion.div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{highlights.map((item, i) => (
						<motion.div
							key={item.title}
							initial={{ opacity: 0, y: 30 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.5, delay: i * 0.1 }}
							whileHover={{ y: -5 }}
						>
							<Card className="h-full border-border/50 bg-card hover:border-primary/30 hover:shadow-xl transition-all duration-300">
								<CardContent className="p-6">
									<div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
										<item.icon className="h-6 w-6 text-primary" />
									</div>
									<h3 className="text-xl font-semibold mb-2">{item.title}</h3>
									<p className="text-muted-foreground">{item.description}</p>
								</CardContent>
							</Card>
						</motion.div>
					))}
				</div>
			</div>
		</section>
	)
}

// ============================================
// COMPONENTE: REPOSITORY SECTION
// ============================================
function RepositorySection() {
	return (
		<section id="repository" className="py-32 relative overflow-hidden">
			<div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-purple-500/5 to-primary/5" />

			<div className="container mx-auto px-4 relative">
				<motion.div
					initial={{ opacity: 0, y: 30 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.8 }}
					className="max-w-4xl mx-auto"
				>
					<Card className="border-border/50 bg-background/80 backdrop-blur-xl overflow-hidden">
						<CardContent className="p-0">
							{/* Terminal Header */}
							<div className="bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-900 p-4 flex items-center gap-4">
								<div className="flex gap-2">
									<div className="w-3 h-3 rounded-full bg-red-500" />
									<div className="w-3 h-3 rounded-full bg-yellow-500" />
									<div className="w-3 h-3 rounded-full bg-green-500" />
								</div>
								<div className="flex-1 text-center">
									<span className="text-gray-400 text-sm font-mono">terminal</span>
								</div>
							</div>

							{/* Content */}
							<div className="p-8 md:p-12">
								<div className="text-center mb-8">
									<motion.div
										whileHover={{ scale: 1.1, rotate: 5 }}
										className="w-20 h-20 bg-gradient-to-br from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl"
									>
										<Github className="h-10 w-10 text-white dark:text-black" />
									</motion.div>
									<h3 className="text-3xl font-bold mb-4">Open Source</h3>
									<p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
										Explore the code, learn from the implementation, or contribute to the project.
									</p>
								</div>

								{/* Clone Command */}
								<div className="bg-muted/50 rounded-xl p-4 mb-8 font-mono text-sm overflow-x-auto">
									<div className="flex items-center gap-2 text-muted-foreground mb-2">
										<Terminal className="h-4 w-4" />
										<span>Clone the repository</span>
									</div>
									<code className="text-primary">
										git clone {PROJECT_CONFIG.repository}.git
									</code>
								</div>

								{/* Buttons */}
								<div className="flex flex-col sm:flex-row gap-4 justify-center">
									<Button size="lg" asChild className="rounded-full shadow-lg">
										<a href={PROJECT_CONFIG.repository} target="_blank" rel="noopener noreferrer">
											<Github className="mr-2 h-5 w-5" />
											View Repository
											<ExternalLink className="ml-2 h-4 w-4" />
										</a>
									</Button>
									<Button size="lg" variant="outline" asChild className="rounded-full">
										<Link href={PROJECT_CONFIG.liveDemo}>
											<Play className="mr-2 h-5 w-5" />
											Try Live Demo
										</Link>
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>
				</motion.div>
			</div>
		</section>
	)
}

// ============================================
// COMPONENTE: FOOTER
// ============================================
function Footer() {
	return (
		<footer className="py-8 border-t border-border/50">
			<div className="container mx-auto px-4">
				<div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
					<p className="text-muted-foreground text-sm">
						© {new Date().getFullYear()} {PROJECT_CONFIG.name}. Built by {PROJECT_CONFIG.developer.name}.
					</p>
					<div className="flex items-center gap-4">
						<Button variant="ghost" size="sm" asChild>
							<a href={PROJECT_CONFIG.developer.github} target="_blank" rel="noopener noreferrer">
								<Github className="h-4 w-4" />
							</a>
						</Button>
						<Button variant="ghost" size="sm" asChild>
							<a href={PROJECT_CONFIG.developer.linkedin} target="_blank" rel="noopener noreferrer">
								<Linkedin className="h-4 w-4" />
							</a>
						</Button>
					</div>
				</div>
			</div>
		</footer>
	)
}

// ============================================
// PÁGINA PRINCIPAL
// ============================================
export default function TechnicalPortfolioPage() {
	return (
		<main className="min-h-screen bg-background">
			<Navigation />
			<HeroSection />
			<ArchitectureSection />
			<DesignPatternsSection />
			<TechStackSection />
			<TechnicalHighlightsSection />
			<RepositorySection />
			<Footer />
		</main>
	)
}
