'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
	ArrowRight, 
	BarChart3, 
	Shield, 
	Smartphone, 
	Zap, 
	Users, 
	TrendingUp, 
	DollarSign,
	PieChart,
	Target,
	Clock,
	Star,
	CheckCircle,
	Play,
	Github,
	Twitter,
	Linkedin,
	Mail,
	Phone,
	MapPin,
	ChevronUp
} from 'lucide-react'
import { useState, useEffect } from 'react'

// Componente de navegación
function Navigation() {
	const [isScrolled, setIsScrolled] = useState(false)
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

	useEffect(() => {
		const handleScroll = () => {
			setIsScrolled(window.scrollY > 50)
		}
		window.addEventListener('scroll', handleScroll)
		return () => window.removeEventListener('scroll', handleScroll)
	}, [])

	const scrollToSection = (id: string) => {
		const element = document.getElementById(id)
		if (element) {
			element.scrollIntoView({ behavior: 'smooth' })
		}
		setIsMobileMenuOpen(false)
	}

	return (
		<nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
			isScrolled 
				? 'bg-background/80 backdrop-blur-md border-b border-border/50 shadow-lg' 
				: 'bg-transparent'
		}`}>
			<div className="container mx-auto px-4">
				<div className="flex items-center justify-between h-16">
					{/* Logo */}
					<Link href="/" className="flex items-center gap-2 group">
						<div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
							<BarChart3 className="h-4 w-4 text-primary-foreground" />
						</div>
						<span className="font-bold text-xl bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
							FinanceApp
						</span>
					</Link>

					{/* Desktop Navigation */}
					<div className="hidden md:flex items-center gap-8">
						<button
							onClick={() => scrollToSection('features')}
							className="text-muted-foreground hover:text-foreground transition-colors"
						>
							Características
						</button>
						<button
							onClick={() => scrollToSection('benefits')}
							className="text-muted-foreground hover:text-foreground transition-colors"
						>
							Beneficios
						</button>
						<button
							onClick={() => scrollToSection('testimonials')}
							className="text-muted-foreground hover:text-foreground transition-colors"
						>
							Testimonios
						</button>
						<button
							onClick={() => scrollToSection('pricing')}
							className="text-muted-foreground hover:text-foreground transition-colors"
						>
							Precios
						</button>
					</div>

					{/* CTA Buttons */}
					<div className="hidden md:flex items-center gap-3">
						<Button variant="ghost" asChild>
							<Link href="/login">Iniciar Sesión</Link>
						</Button>
						<Button asChild className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
							<Link href="/register">
								Comenzar Gratis
								<ArrowRight className="ml-2 h-4 w-4" />
							</Link>
						</Button>
					</div>

					{/* Mobile Menu Button */}
					<Button
						variant="ghost"
						size="sm"
						className="md:hidden"
						onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
					>
						<div className="w-4 h-4 flex flex-col justify-between">
							<span className={`block h-0.5 w-full bg-current transition-transform ${isMobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
							<span className={`block h-0.5 w-full bg-current transition-opacity ${isMobileMenuOpen ? 'opacity-0' : ''}`} />
							<span className={`block h-0.5 w-full bg-current transition-transform ${isMobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
						</div>
					</Button>
				</div>

				{/* Mobile Menu */}
				{isMobileMenuOpen && (
					<div className="md:hidden bg-background/95 backdrop-blur-md border-t border-border/50 py-4">
						<div className="flex flex-col gap-4">
							<button
								onClick={() => scrollToSection('features')}
								className="text-left text-muted-foreground hover:text-foreground transition-colors"
							>
								Características
							</button>
							<button
								onClick={() => scrollToSection('benefits')}
								className="text-left text-muted-foreground hover:text-foreground transition-colors"
							>
								Beneficios
							</button>
							<button
								onClick={() => scrollToSection('testimonials')}
								className="text-left text-muted-foreground hover:text-foreground transition-colors"
							>
								Testimonios
							</button>
							<div className="flex gap-2 pt-2">
								<Button variant="outline" asChild className="flex-1">
									<Link href="/login">Iniciar Sesión</Link>
								</Button>
								<Button asChild className="flex-1">
									<Link href="/register">Comenzar</Link>
								</Button>
							</div>
						</div>
					</div>
				)}
			</div>
		</nav>
	)
}

// Sección Hero
function HeroSection() {
	const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			setMousePosition({
				x: (e.clientX / window.innerWidth) * 100,
				y: (e.clientY / window.innerHeight) * 100,
			})
		}

		window.addEventListener('mousemove', handleMouseMove)
		return () => window.removeEventListener('mousemove', handleMouseMove)
	}, [])

	return (
		<section className="relative min-h-screen flex items-center justify-center overflow-hidden">
			{/* Gradient Background */}
			<div 
				className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-secondary/20 transition-all duration-1000"
				style={{
					background: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, 
						hsl(var(--primary) / 0.3) 0%, 
						hsl(var(--primary) / 0.1) 30%, 
						hsl(var(--background)) 70%)`
				}}
			/>
			
			{/* Floating Elements */}
			<div className="absolute inset-0 overflow-hidden">
				{[...Array(6)].map((_, i) => (
					<div
						key={i}
						className={`absolute w-2 h-2 bg-primary/30 rounded-full animate-bounce`}
						style={{
							left: `${20 + i * 15}%`,
							top: `${30 + (i % 2) * 40}%`,
							animationDelay: `${i * 0.5}s`,
							animationDuration: `${3 + i * 0.5}s`,
						}}
					/>
				))}
			</div>

			<div className="container mx-auto px-4 relative z-10">
				<div className="text-center max-w-5xl mx-auto">
					{/* Badge */}
					<div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-8 animate-pulse">
						<Star className="w-4 h-4 text-primary" />
						<span className="text-sm font-medium">La plataforma #1 en gestión financiera</span>
					</div>

					{/* Main Heading */}
					<h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent leading-tight animate-fade-in">
						Domina tus 
						<span className="block bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
							Finanzas Personales
						</span>
					</h1>

					{/* Subtitle */}
					<p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed animate-fade-in-delay">
						La plataforma más inteligente para controlar gastos, crear presupuestos 
						y alcanzar tus metas financieras. Todo en un solo lugar.
					</p>

					{/* CTA Buttons */}
					<div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12 animate-fade-in-delay-2">
						<Button 
							size="lg" 
							asChild
							className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group"
						>
							<Link href="/register">
								Comenzar Gratis
								<ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
							</Link>
						</Button>
						<Button 
							variant="outline" 
							size="lg"
							asChild
							className="text-lg px-8 py-6 rounded-full border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 group"
						>
							<Link href="/app">
								<Play className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
								Ver Demo
							</Link>
						</Button>
					</div>

					{/* Stats */}
					<div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-2xl mx-auto animate-fade-in-delay-3">
						<div className="text-center">
							<div className="text-2xl md:text-3xl font-bold text-primary">50K+</div>
							<div className="text-sm text-muted-foreground">Usuarios Activos</div>
						</div>
						<div className="text-center">
							<div className="text-2xl md:text-3xl font-bold text-primary">$2M+</div>
							<div className="text-sm text-muted-foreground">Dinero Gestionado</div>
						</div>
						<div className="text-center">
							<div className="text-2xl md:text-3xl font-bold text-primary">99.9%</div>
							<div className="text-sm text-muted-foreground">Tiempo Activo</div>
						</div>
						<div className="text-center">
							<div className="text-2xl md:text-3xl font-bold text-primary">4.9★</div>
							<div className="text-sm text-muted-foreground">Calificación</div>
						</div>
					</div>
				</div>
			</div>

			{/* Scroll Indicator */}
			<div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
				<div className="w-6 h-10 border-2 border-muted-foreground/30 rounded-full p-1">
					<div className="w-1 h-3 bg-muted-foreground/50 rounded-full mx-auto animate-pulse"></div>
				</div>
			</div>
		</section>
	)
}

// Sección de Características
function FeaturesSection() {
	const features = [
		{
			icon: BarChart3,
			title: 'Dashboard Inteligente',
			description: 'Visualiza todos tus datos financieros en un dashboard moderno y fácil de entender.',
			color: 'from-blue-500 to-cyan-500'
		},
		{
			icon: Shield,
			title: 'Seguridad Máxima',
			description: 'Protección bancaria con encriptación de extremo a extremo para tus datos.',
			color: 'from-green-500 to-emerald-500'
		},
		{
			icon: Smartphone,
			title: 'Multiplataforma',
			description: 'Accede desde cualquier dispositivo: web, móvil, tablet. Siempre sincronizado.',
			color: 'from-purple-500 to-violet-500'
		},
		{
			icon: Zap,
			title: 'Análisis Automático',
			description: 'IA que analiza tus gastos y te sugiere optimizaciones para ahorrar más.',
			color: 'from-orange-500 to-red-500'
		},
		{
			icon: PieChart,
			title: 'Presupuestos Inteligentes',
			description: 'Crea presupuestos que se adaptan a tus hábitos y te alertan en tiempo real.',
			color: 'from-pink-500 to-rose-500'
		},
		{
			icon: TrendingUp,
			title: 'Inversiones Crypto',
			description: 'Monitorea tu portfolio de criptomonedas con datos en tiempo real.',
			color: 'from-indigo-500 to-blue-500'
		}
	]

	return (
		<section id="features" className="py-20 bg-muted/30">
			<div className="container mx-auto px-4">
				<div className="text-center mb-16">
					<Badge variant="outline" className="mb-4">Características</Badge>
					<h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
						Todo lo que necesitas para
						<span className="block">gestionar tu dinero</span>
					</h2>
					<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
						Herramientas poderosas diseñadas para simplificar tu vida financiera
						y ayudarte a tomar mejores decisiones.
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
					{features.map((feature, index) => (
						<Card 
							key={index}
							className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/20 bg-background/50 backdrop-blur-sm"
						>
							<CardContent className="p-6">
								<div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
									<feature.icon className="h-6 w-6 text-white" />
								</div>
								<h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">
									{feature.title}
								</h3>
								<p className="text-muted-foreground leading-relaxed">
									{feature.description}
								</p>
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		</section>
	)
}

// Sección de Beneficios
function BenefitsSection() {
	const benefits = [
		{
			title: 'Ahorra tiempo',
			description: 'Automatiza el seguimiento de gastos y genera reportes en segundos.',
			icon: Clock,
			stat: '85%',
			statLabel: 'menos tiempo en finanzas'
		},
		{
			title: 'Aumenta tus ahorros',
			description: 'Usuarios ahorran en promedio 30% más después del primer mes.',
			icon: Target,
			stat: '30%',
			statLabel: 'más ahorros mensuales'
		},
		{
			title: 'Control total',
			description: 'Visualiza exactamente dónde va tu dinero con análisis detallados.',
			icon: BarChart3,
			stat: '100%',
			statLabel: 'visibilidad financiera'
		}
	]

	return (
		<section id="benefits" className="py-20">
			<div className="container mx-auto px-4">
				<div className="text-center mb-16">
					<Badge variant="outline" className="mb-4">Beneficios</Badge>
					<h2 className="text-4xl md:text-5xl font-bold mb-6">
						Resultados que verás desde el primer día
					</h2>
					<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
						Nuestros usuarios experimentan mejoras significativas en su gestión 
						financiera desde la primera semana.
					</p>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
					{benefits.map((benefit, index) => (
						<Card key={index} className="text-center group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/20">
							<CardContent className="p-8">
								<div className="w-16 h-16 rounded-full bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
									<benefit.icon className="h-8 w-8 text-primary-foreground" />
								</div>
								<div className="text-3xl font-bold text-primary mb-2">{benefit.stat}</div>
								<div className="text-sm text-muted-foreground mb-4">{benefit.statLabel}</div>
								<h3 className="text-xl font-semibold mb-3">{benefit.title}</h3>
								<p className="text-muted-foreground">{benefit.description}</p>
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		</section>
	)
}

// Sección de Testimonios
function TestimonialsSection() {
	const testimonials = [
		{
			name: 'María González',
			role: 'Freelancer',
			content: 'FinanceApp cambió completamente mi relación con el dinero. Ahora sé exactamente dónde va cada peso y he logrado ahorrar el 40% de mis ingresos.',
			rating: 5,
			avatar: 'M'
		},
		{
			name: 'Carlos Rodríguez',
			role: 'Empresario',
			content: 'La función de presupuestos inteligentes es increíble. Me ayuda a mantener mis gastos empresariales bajo control sin esfuerzo adicional.',
			rating: 5,
			avatar: 'C'
		},
		{
			name: 'Ana Martínez',
			role: 'Estudiante',
			content: 'Como estudiante, necesitaba algo simple pero poderoso. FinanceApp es perfecto: fácil de usar y me ayuda a estirar mi presupuesto mensual.',
			rating: 5,
			avatar: 'A'
		}
	]

	return (
		<section id="testimonials" className="py-20 bg-muted/30">
			<div className="container mx-auto px-4">
				<div className="text-center mb-16">
					<Badge variant="outline" className="mb-4">Testimonios</Badge>
					<h2 className="text-4xl md:text-5xl font-bold mb-6">
						Lo que dicen nuestros usuarios
					</h2>
					<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
						Miles de personas ya transformaron su vida financiera con FinanceApp.
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
					{testimonials.map((testimonial, index) => (
						<Card key={index} className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/20">
							<CardContent className="p-6">
								<div className="flex items-center gap-1 mb-4">
									{[...Array(testimonial.rating)].map((_, i) => (
										<Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
									))}
								</div>
								<p className="text-muted-foreground mb-6 leading-relaxed italic">
									"{testimonial.content}"
								</p>
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center text-primary-foreground font-semibold">
										{testimonial.avatar}
									</div>
									<div>
										<div className="font-semibold">{testimonial.name}</div>
										<div className="text-sm text-muted-foreground">{testimonial.role}</div>
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		</section>
	)
}

// Sección de Precios
function PricingSection() {
	return (
		<section id="pricing" className="py-20">
			<div className="container mx-auto px-4">
				<div className="text-center mb-16">
					<Badge variant="outline" className="mb-4">Precios</Badge>
					<h2 className="text-4xl md:text-5xl font-bold mb-6">
						Comienza gratis, crece cuando quieras
					</h2>
					<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
						Plan gratuito completo. Actualiza solo cuando necesites funciones avanzadas.
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
					{/* Plan Gratuito */}
					<Card className="border-border/50">
						<CardContent className="p-6">
							<div className="text-center mb-6">
								<h3 className="text-xl font-semibold mb-2">Básico</h3>
								<div className="text-3xl font-bold">Gratis</div>
								<div className="text-muted-foreground">Para siempre</div>
							</div>
							<ul className="space-y-3 mb-6">
								<li className="flex items-center gap-2">
									<CheckCircle className="h-4 w-4 text-green-500" />
									<span className="text-sm">Hasta 3 cuentas bancarias</span>
								</li>
								<li className="flex items-center gap-2">
									<CheckCircle className="h-4 w-4 text-green-500" />
									<span className="text-sm">Seguimiento de gastos</span>
								</li>
								<li className="flex items-center gap-2">
									<CheckCircle className="h-4 w-4 text-green-500" />
									<span className="text-sm">Presupuestos básicos</span>
								</li>
								<li className="flex items-center gap-2">
									<CheckCircle className="h-4 w-4 text-green-500" />
									<span className="text-sm">Reportes mensuales</span>
								</li>
							</ul>
							<Button className="w-full" variant="outline" asChild>
								<Link href="/register">Comenzar Gratis</Link>
							</Button>
						</CardContent>
					</Card>

					{/* Plan Pro */}
					<Card className="border-primary/50 relative overflow-hidden">
						<div className="absolute top-0 right-0 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-3 py-1 text-xs font-medium">
							Más Popular
						</div>
						<CardContent className="p-6">
							<div className="text-center mb-6">
								<h3 className="text-xl font-semibold mb-2">Pro</h3>
								<div className="text-3xl font-bold">$9.99</div>
								<div className="text-muted-foreground">por mes</div>
							</div>
							<ul className="space-y-3 mb-6">
								<li className="flex items-center gap-2">
									<CheckCircle className="h-4 w-4 text-green-500" />
									<span className="text-sm">Cuentas ilimitadas</span>
								</li>
								<li className="flex items-center gap-2">
									<CheckCircle className="h-4 w-4 text-green-500" />
									<span className="text-sm">IA para análisis automático</span>
								</li>
								<li className="flex items-center gap-2">
									<CheckCircle className="h-4 w-4 text-green-500" />
									<span className="text-sm">Presupuestos inteligentes</span>
								</li>
								<li className="flex items-center gap-2">
									<CheckCircle className="h-4 w-4 text-green-500" />
									<span className="text-sm">Portfolio de crypto</span>
								</li>
								<li className="flex items-center gap-2">
									<CheckCircle className="h-4 w-4 text-green-500" />
									<span className="text-sm">Reportes avanzados</span>
								</li>
							</ul>
							<Button className="w-full bg-gradient-to-r from-primary to-primary/80" asChild>
								<Link href="/register">Elegir Pro</Link>
							</Button>
						</CardContent>
					</Card>

					{/* Plan Enterprise */}
					<Card className="border-border/50">
						<CardContent className="p-6">
							<div className="text-center mb-6">
								<h3 className="text-xl font-semibold mb-2">Enterprise</h3>
								<div className="text-3xl font-bold">$29.99</div>
								<div className="text-muted-foreground">por mes</div>
							</div>
							<ul className="space-y-3 mb-6">
								<li className="flex items-center gap-2">
									<CheckCircle className="h-4 w-4 text-green-500" />
									<span className="text-sm">Todo de Pro +</span>
								</li>
								<li className="flex items-center gap-2">
									<CheckCircle className="h-4 w-4 text-green-500" />
									<span className="text-sm">Múltiples usuarios</span>
								</li>
								<li className="flex items-center gap-2">
									<CheckCircle className="h-4 w-4 text-green-500" />
									<span className="text-sm">API personalizada</span>
								</li>
								<li className="flex items-center gap-2">
									<CheckCircle className="h-4 w-4 text-green-500" />
									<span className="text-sm">Soporte prioritario</span>
								</li>
							</ul>
							<Button className="w-full" variant="outline" asChild>
								<Link href="/register">Contactar Ventas</Link>
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		</section>
	)
}

// Sección CTA Final
function CTASection() {
	return (
		<section className="py-20 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10">
			<div className="container mx-auto px-4 text-center">
				<h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
					¿Listo para transformar tus finanzas?
				</h2>
				<p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
					Únete a más de 50,000 usuarios que ya están en control de su dinero.
					Comienza gratis hoy mismo.
				</p>
				<div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
					<Button 
						size="lg" 
						asChild
						className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-lg px-8 py-6 rounded-full"
					>
						<Link href="/register">
							Comenzar Gratis Ahora
							<ArrowRight className="ml-2 h-5 w-5" />
						</Link>
					</Button>
					<Button 
						variant="outline" 
						size="lg"
						asChild
						className="text-lg px-8 py-6 rounded-full"
					>
						<Link href="/app">
							Ver Demo en Vivo
						</Link>
					</Button>
				</div>
			</div>
		</section>
	)
}

// Footer
function Footer() {
	const scrollToTop = () => {
		window.scrollTo({ top: 0, behavior: 'smooth' })
	}

	return (
		<footer className="bg-muted/50 border-t border-border/50">
			<div className="container mx-auto px-4 py-12">
				<div className="grid grid-cols-1 md:grid-cols-4 gap-8">
					{/* Brand */}
					<div className="col-span-1 md:col-span-2">
						<Link href="/" className="flex items-center gap-2 mb-4">
							<div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
								<BarChart3 className="h-4 w-4 text-primary-foreground" />
							</div>
							<span className="font-bold text-xl">FinanceApp</span>
						</Link>
						<p className="text-muted-foreground mb-4 max-w-md">
							La plataforma más completa para gestionar tus finanzas personales. 
							Toma control de tu dinero y alcanza tus metas financieras.
						</p>
						<div className="flex gap-4">
							<Button variant="ghost" size="sm">
								<Twitter className="h-4 w-4" />
							</Button>
							<Button variant="ghost" size="sm">
								<Linkedin className="h-4 w-4" />
							</Button>
							<Button variant="ghost" size="sm">
								<Github className="h-4 w-4" />
							</Button>
						</div>
					</div>

					{/* Links */}
					<div>
						<h4 className="font-semibold mb-4">Producto</h4>
						<ul className="space-y-2 text-sm text-muted-foreground">
							<li><Link href="#features" className="hover:text-foreground transition-colors">Características</Link></li>
							<li><Link href="#pricing" className="hover:text-foreground transition-colors">Precios</Link></li>
							<li><Link href="/app" className="hover:text-foreground transition-colors">Demo</Link></li>
							<li><Link href="#" className="hover:text-foreground transition-colors">API</Link></li>
						</ul>
					</div>

					{/* Support */}
					<div>
						<h4 className="font-semibold mb-4">Soporte</h4>
						<ul className="space-y-2 text-sm text-muted-foreground">
							<li className="flex items-center gap-2">
								<Mail className="h-3 w-3" />
								<span>support@financeapp.com</span>
							</li>
							<li className="flex items-center gap-2">
								<Phone className="h-3 w-3" />
								<span>+1 (555) 123-4567</span>
							</li>
							<li className="flex items-center gap-2">
								<MapPin className="h-3 w-3" />
								<span>San Francisco, CA</span>
							</li>
						</ul>
					</div>
				</div>

				<div className="border-t border-border/50 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
					<p className="text-sm text-muted-foreground">
						© 2024 FinanceApp. Todos los derechos reservados.
					</p>
					<Button
						variant="ghost"
						size="sm"
						onClick={scrollToTop}
						className="mt-4 md:mt-0"
					>
						<ChevronUp className="h-4 w-4 mr-2" />
						Volver arriba
					</Button>
				</div>
			</div>
		</footer>
	)
}

// Página principal
export default function LandingPage() {
	return (
		<main className="min-h-screen">
			<Navigation />
			<HeroSection />
			<FeaturesSection />
			<BenefitsSection />
			<TestimonialsSection />
			<PricingSection />
			<CTASection />
			<Footer />
		</main>
	)
} 
