'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/ui/card'
import { Button } from '@/components/common/ui/button'
import { Badge } from '@/components/common/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/common/ui/tabs'
import { Switch } from '@/components/common/ui/switch'
import { Label } from '@/components/common/ui/label'
import { useSettings } from '../../../contexts'
import {
	Settings,
	User,
	Shield,
	Palette,
	Bell,
	Globe,
	CreditCard,
	Smartphone,
	Mail,
	Lock,
	Database,
	Download,
	Mouse,
	Layout
} from 'lucide-react'

export default function SettingsPage() {
	const { 
		sidebarHoverEnabled, 
		setSidebarHoverEnabled, 
		theme, 
		setTheme, 
		language, 
		setLanguage, 
		currency, 
		setCurrency, 
		notifications, 
		setNotifications 
	} = useSettings()

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
					<p className="text-muted-foreground">
						Administra tus preferencias y configuraciones de la aplicación
					</p>
				</div>
				<Badge variant="outline">En desarrollo</Badge>
			</div>

			<Tabs defaultValue="general" className="space-y-4">
				<TabsList className="grid w-full grid-cols-4">
					<TabsTrigger value="general">General</TabsTrigger>
					<TabsTrigger value="security">Seguridad</TabsTrigger>
					<TabsTrigger value="notifications">Notificaciones</TabsTrigger>
					<TabsTrigger value="data">Datos</TabsTrigger>
				</TabsList>

				<TabsContent value="general" className="space-y-4">
					<div className="grid gap-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<User className="h-5 w-5" />
									Perfil de Usuario
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium">Nombre completo</p>
										<p className="text-sm text-muted-foreground">Juan Pérez</p>
									</div>
									<Button variant="outline" size="sm">Editar</Button>
								</div>
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium">Email</p>
										<p className="text-sm text-muted-foreground">juan.perez@email.com</p>
									</div>
									<Button variant="outline" size="sm">Cambiar</Button>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Palette className="h-5 w-5" />
									Apariencia
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium">Tema</p>
										<p className="text-sm text-muted-foreground">
											{theme === 'light' ? 'Claro' : theme === 'dark' ? 'Oscuro' : 'Sistema'}
										</p>
									</div>
									<Button variant="outline" size="sm">Cambiar</Button>
								</div>
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium">Idioma</p>
										<p className="text-sm text-muted-foreground">
											{language === 'es' ? 'Español' : 'English'}
										</p>
									</div>
									<Button variant="outline" size="sm">Cambiar</Button>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Layout className="h-5 w-5" />
									Navegación
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex items-center justify-between">
									<div>
										<Label htmlFor="sidebar-hover" className="font-medium">
											Expandir sidebar al pasar el mouse
										</Label>
										<p className="text-sm text-muted-foreground">
											El sidebar se expandirá automáticamente cuando esté contraído y pases el mouse sobre él
										</p>
									</div>
									<Switch
										id="sidebar-hover"
										checked={sidebarHoverEnabled}
										onCheckedChange={setSidebarHoverEnabled}
									/>
								</div>
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium">Posición del sidebar</p>
										<p className="text-sm text-muted-foreground">Izquierda</p>
									</div>
									<Button variant="outline" size="sm" disabled>
										Cambiar
									</Button>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Globe className="h-5 w-5" />
									Región
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium">Moneda</p>
										<p className="text-sm text-muted-foreground">{currency} ({currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '$'})</p>
									</div>
									<Button variant="outline" size="sm">Cambiar</Button>
								</div>
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium">Zona horaria</p>
										<p className="text-sm text-muted-foreground">GMT-5</p>
									</div>
									<Button variant="outline" size="sm">Cambiar</Button>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="security" className="space-y-4">
					<div className="grid gap-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Shield className="h-5 w-5" />
									Seguridad de la Cuenta
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium">Cambiar contraseña</p>
										<p className="text-sm text-muted-foreground">Actualizada hace 3 meses</p>
									</div>
									<Button variant="outline" size="sm">Cambiar</Button>
								</div>
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium">Autenticación de dos factores</p>
										<p className="text-sm text-muted-foreground">Activada</p>
									</div>
									<Button variant="outline" size="sm">Configurar</Button>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Smartphone className="h-5 w-5" />
									Dispositivos
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium">Dispositivos activos</p>
										<p className="text-sm text-muted-foreground">3 dispositivos conectados</p>
									</div>
									<Button variant="outline" size="sm">Gestionar</Button>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="notifications" className="space-y-4">
					<div className="grid gap-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Bell className="h-5 w-5" />
									Notificaciones
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex items-center justify-between">
									<div>
										<Label htmlFor="email-notifications" className="font-medium">
											Email
										</Label>
										<p className="text-sm text-muted-foreground">Recibir notificaciones por email</p>
									</div>
									<Switch
										id="email-notifications"
										checked={notifications.email}
										onCheckedChange={(checked) => 
											setNotifications({ ...notifications, email: checked })
										}
									/>
								</div>
								<div className="flex items-center justify-between">
									<div>
										<Label htmlFor="push-notifications" className="font-medium">
											Push
										</Label>
										<p className="text-sm text-muted-foreground">Notificaciones push del navegador</p>
									</div>
									<Switch
										id="push-notifications"
										checked={notifications.push}
										onCheckedChange={(checked) => 
											setNotifications({ ...notifications, push: checked })
										}
									/>
								</div>
								<div className="flex items-center justify-between">
									<div>
										<Label htmlFor="sms-notifications" className="font-medium">
											SMS
										</Label>
										<p className="text-sm text-muted-foreground">Alertas importantes por SMS</p>
									</div>
									<Switch
										id="sms-notifications"
										checked={notifications.sms}
										onCheckedChange={(checked) => 
											setNotifications({ ...notifications, sms: checked })
										}
									/>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="data" className="space-y-4">
					<div className="grid gap-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Database className="h-5 w-5" />
									Gestión de Datos
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium">Exportar datos</p>
										<p className="text-sm text-muted-foreground">Descargar todos tus datos</p>
									</div>
									<Button variant="outline" size="sm">
										<Download className="h-4 w-4 mr-2" />
										Exportar
									</Button>
								</div>
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium">Eliminar cuenta</p>
										<p className="text-sm text-muted-foreground">Eliminar permanentemente tu cuenta</p>
									</div>
									<Button variant="destructive" size="sm">Eliminar</Button>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Lock className="h-5 w-5" />
									Privacidad
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium">Compartir datos de uso</p>
										<p className="text-sm text-muted-foreground">Ayuda a mejorar la aplicación</p>
									</div>
									<Button variant="outline" size="sm">Activado</Button>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	)
} 