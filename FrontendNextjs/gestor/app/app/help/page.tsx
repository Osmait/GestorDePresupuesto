import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
	HelpCircle,
	Search,
	BookOpen,
	MessageCircle,
	Video,
	Mail,
	Phone,
	ExternalLink,
	ChevronRight,
	Star,
	Users,
	Clock,
	CheckCircle2
} from 'lucide-react'

export default function HelpPage() {
	const faqs = [
		{
			question: '¿Cómo agregar una nueva cuenta bancaria?',
			answer: 'Ve a la sección de Cuentas y presiona el botón "Agregar cuenta". Ingresa los detalles de tu banco y sigue las instrucciones.',
			category: 'Cuentas'
		},
		{
			question: '¿Puedo categorizar mis transacciones automáticamente?',
			answer: 'Sí, la aplicación aprende de tus categorizaciones manuales y puede sugerir categorías para transacciones similares.',
			category: 'Transacciones'
		},
		{
			question: '¿Cómo configurar un presupuesto mensual?',
			answer: 'En la sección de Presupuestos, presiona "Crear presupuesto" y establece límites para cada categoría de gastos.',
			category: 'Presupuestos'
		},
		{
			question: '¿La aplicación es segura para mis datos financieros?',
			answer: 'Sí, utilizamos encriptación de grado bancario y nunca almacenamos credenciales de acceso a tus cuentas.',
			category: 'Seguridad'
		},
		{
			question: '¿Puedo exportar mis datos?',
			answer: 'Sí, puedes exportar todos tus datos en formato CSV desde la sección de Configuración.',
			category: 'Datos'
		}
	]

	const supportOptions = [
		{
			icon: MessageCircle,
			title: 'Chat en vivo',
			description: 'Habla con nuestro equipo de soporte',
			badge: 'Disponible 24/7',
			action: 'Iniciar chat'
		},
		{
			icon: Mail,
			title: 'Email',
			description: 'Envíanos un correo detallado',
			badge: 'Respuesta en 2h',
			action: 'Enviar email'
		},
		{
			icon: Phone,
			title: 'Teléfono',
			description: 'Llama a nuestro centro de soporte',
			badge: 'Lun-Vie 9-18h',
			action: 'Llamar'
		},
		{
			icon: Video,
			title: 'Video llamada',
			description: 'Sesión personalizada con un experto',
			badge: 'Con cita previa',
			action: 'Agendar'
		}
	]

	const resources = [
		{
			icon: BookOpen,
			title: 'Documentación',
			description: 'Guías detalladas y tutoriales',
			link: '/docs'
		},
		{
			icon: Video,
			title: 'Video tutoriales',
			description: 'Aprende con ejemplos visuales',
			link: '/tutorials'
		},
		{
			icon: Users,
			title: 'Comunidad',
			description: 'Foro de usuarios y expertos',
			link: '/community'
		},
		{
			icon: ExternalLink,
			title: 'Blog',
			description: 'Consejos y mejores prácticas',
			link: '/blog'
		}
	]

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Centro de Ayuda</h1>
					<p className="text-muted-foreground">
						Encuentra respuestas rápidas y obtén soporte personalizado
					</p>
				</div>
				<Badge variant="outline" className="gap-1">
					<CheckCircle2 className="h-3 w-3" />
					Todo funcionando
				</Badge>
			</div>

			{/* Search */}
			<Card>
				<CardContent className="p-6">
					<div className="relative">
						<Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Buscar en la base de conocimiento..."
							className="pl-10"
						/>
					</div>
				</CardContent>
			</Card>

			<div className="grid gap-6 lg:grid-cols-3">
				{/* FAQ */}
				<div className="lg:col-span-2">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<HelpCircle className="h-5 w-5" />
								Preguntas Frecuentes
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							{faqs.map((faq, index) => (
								<div key={index} className="border-b last:border-b-0 pb-4 last:pb-0">
									<div className="flex items-start justify-between gap-4">
										<div className="space-y-2">
											<div className="flex items-center gap-2">
												<h3 className="font-medium">{faq.question}</h3>
												<Badge variant="secondary" className="text-xs">
													{faq.category}
												</Badge>
											</div>
											<p className="text-sm text-muted-foreground">
												{faq.answer}
											</p>
										</div>
										<ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
									</div>
								</div>
							))}
							<div className="pt-4">
								<Button variant="outline" className="w-full">
									Ver todas las preguntas
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Support Options */}
				<div className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<MessageCircle className="h-5 w-5" />
								Contactar Soporte
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							{supportOptions.map((option, index) => (
								<div key={index} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
									<option.icon className="h-4 w-4 text-primary" />
									<div className="flex-1">
										<div className="flex items-center gap-2">
											<p className="font-medium text-sm">{option.title}</p>
											<Badge variant="outline" className="text-xs">
												{option.badge}
											</Badge>
										</div>
										<p className="text-xs text-muted-foreground">
											{option.description}
										</p>
									</div>
								</div>
							))}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<BookOpen className="h-5 w-5" />
								Recursos
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							{resources.map((resource, index) => (
								<div key={index} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
									<resource.icon className="h-4 w-4 text-primary" />
									<div className="flex-1">
										<p className="font-medium text-sm">{resource.title}</p>
										<p className="text-xs text-muted-foreground">
											{resource.description}
										</p>
									</div>
									<ExternalLink className="h-3 w-3 text-muted-foreground" />
								</div>
							))}
						</CardContent>
					</Card>
				</div>
			</div>

			{/* Stats */}
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardContent className="p-6">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-primary/10 rounded-lg">
								<Clock className="h-4 w-4 text-primary" />
							</div>
							<div>
								<p className="text-2xl font-bold">&lt; 2min</p>
								<p className="text-sm text-muted-foreground">Tiempo promedio de respuesta</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-6">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-green-500/10 rounded-lg">
								<Star className="h-4 w-4 text-green-500" />
							</div>
							<div>
								<p className="text-2xl font-bold">4.9/5</p>
								<p className="text-sm text-muted-foreground">Satisfacción del cliente</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-6">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-blue-500/10 rounded-lg">
								<Users className="h-4 w-4 text-blue-500" />
							</div>
							<div>
								<p className="text-2xl font-bold">50K+</p>
								<p className="text-sm text-muted-foreground">Usuarios activos</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	)
} 