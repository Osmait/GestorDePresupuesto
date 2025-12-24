"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useSettings } from "@/contexts"
import { useSession } from "next-auth/react"
import { ModeToggle } from "@/components/common/ToggleMode"
import { useLocale } from "next-intl"
import {
    User,
    Shield,
    Bell,
    Database,
    Palette,
    Globe,
    Layout,
    Lock,
    Smartphone,
    Download,
    Mail,
    CreditCard
} from "lucide-react"

/**
 * Props for the SettingsModal component.
 */
interface SettingsModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

type SettingsTab = "general" | "security" | "notifications" | "data"

const sidebarNavItems = [
    {
        title: "General",
        id: "general",
        icon: User,
    },
    {
        title: "Seguridad",
        id: "security",
        icon: Shield,
    },
    {
        title: "Notificaciones",
        id: "notifications",
        icon: Bell,
    },
    {
        title: "Datos y Privacidad",
        id: "data",
        icon: Database,
    },
]

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
    const [activeTab, setActiveTab] = useState<SettingsTab>("general")
    const { data: session } = useSession()
    const locale = useLocale()
    const {
        sidebarHoverEnabled,
        setSidebarHoverEnabled,
        notifications,
        setNotifications,
        currency,
    } = useSettings()

    const getInitials = (name: string, lastName?: string) => {
        const initials = `${name?.charAt(0) || ""}${lastName?.charAt(0) || ""}`
        return initials.toUpperCase() || "U"
    }

    const switchLocale = (newLocale: string) => {
        document.cookie = `locale=${newLocale}; path=/; max-age=31536000`
        window.location.reload()
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[80vh] p-0 gap-0 overflow-hidden">
                <div className="flex h-full">
                    {/* Sidebar */}
                    <div className="w-64 border-r bg-muted/30 flex flex-col">
                        <DialogHeader className="p-6 pb-4 border-b">
                            <DialogTitle>Configuración</DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="flex-1 py-4">
                            <nav className="grid gap-1 px-4">
                                {sidebarNavItems.map((item) => (
                                    <Button
                                        key={item.id}
                                        variant={activeTab === item.id ? "secondary" : "ghost"}
                                        className={cn(
                                            "justify-start gap-3",
                                            activeTab === item.id && "bg-muted"
                                        )}
                                        onClick={() => setActiveTab(item.id as SettingsTab)}
                                    >
                                        <item.icon className="h-4 w-4" />
                                        {item.title}
                                    </Button>
                                ))}
                            </nav>
                        </ScrollArea>
                        <div className="p-4 border-t">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={session?.user.image || ""} />
                                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                        {getInitials(session?.user.name || "", session?.user.lastName)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="grid gap-0.5 text-xs">
                                    <span className="font-medium truncate max-w-[120px]">
                                        {session?.user.name}
                                    </span>
                                    <span className="text-muted-foreground truncate max-w-[120px]">
                                        {session?.user.email}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
                        <ScrollArea className="flex-1">
                            <div className="p-8 max-w-2xl mx-auto space-y-8 pb-20">
                                {activeTab === "general" && (
                                    <div className="space-y-8 animate-in fade-in-50 duration-300">
                                        <div>
                                            <h3 className="text-lg font-medium">Perfil</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Información personal y de contacto
                                            </p>
                                            <Separator className="my-4" />
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                                    <div className="space-y-1">
                                                        <Label>Nombre completo</Label>
                                                        <p className="text-sm text-muted-foreground">
                                                            {session?.user.name} {session?.user.lastName}
                                                        </p>
                                                    </div>
                                                    <Button variant="outline" size="sm">Editar</Button>
                                                </div>
                                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                                    <div className="space-y-1">
                                                        <Label>Email</Label>
                                                        <p className="text-sm text-muted-foreground">
                                                            {session?.user.email}
                                                        </p>
                                                    </div>
                                                    <Button variant="outline" size="sm">Cambiar</Button>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="text-lg font-medium">Apariencia</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Personaliza cómo se ve la aplicación
                                            </p>
                                            <Separator className="my-4" />
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <Palette className="h-4 w-4" />
                                                            <Label>Tema</Label>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">
                                                            Cambiar entre modo claro y oscuro
                                                        </p>
                                                    </div>
                                                    <ModeToggle />
                                                </div>
                                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <Globe className="h-4 w-4" />
                                                            <Label>Idioma</Label>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">
                                                            Selecciona tu idioma preferido
                                                        </p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant={locale === 'es' ? 'default' : 'outline'}
                                                            size="sm"
                                                            onClick={() => switchLocale('es')}
                                                        >
                                                            Español
                                                        </Button>
                                                        <Button
                                                            variant={locale === 'en' ? 'default' : 'outline'}
                                                            size="sm"
                                                            onClick={() => switchLocale('en')}
                                                        >
                                                            English
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="text-lg font-medium">Navegación</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Preferencias de la interfaz de usuario
                                            </p>
                                            <Separator className="my-4" />
                                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <Layout className="h-4 w-4" />
                                                        <Label htmlFor="sidebar-hover">Sidebar expandible</Label>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground max-w-[300px]">
                                                        Expandir automáticamente el menú lateral al pasar el mouse por encima
                                                    </p>
                                                </div>
                                                <Switch
                                                    id="sidebar-hover"
                                                    checked={sidebarHoverEnabled}
                                                    onCheckedChange={setSidebarHoverEnabled}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === "security" && (
                                    <div className="space-y-8 animate-in fade-in-50 duration-300">
                                        <div>
                                            <h3 className="text-lg font-medium">Seguridad</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Protección de tu cuenta y dispositivos
                                            </p>
                                            <Separator className="my-4" />
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <Lock className="h-4 w-4" />
                                                            <Label>Contraseña</Label>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">
                                                            Actualizada hace 3 meses
                                                        </p>
                                                    </div>
                                                    <Button variant="outline" size="sm">Cambiar</Button>
                                                </div>
                                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <Shield className="h-4 w-4" />
                                                            <Label>Autenticación de dos pasos</Label>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">
                                                            Añade una capa extra de seguridad
                                                        </p>
                                                    </div>
                                                    <Badge variant="outline" className="text-green-500 border-green-500">Activada</Badge>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="text-lg font-medium">Dispositivos</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Gestiona dónde has iniciado sesión
                                            </p>
                                            <Separator className="my-4" />
                                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <Smartphone className="h-4 w-4" />
                                                        <Label>Sesiones activas</Label>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        3 dispositivos conectados actualmente
                                                    </p>
                                                </div>
                                                <Button variant="outline" size="sm">Gestionar</Button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === "notifications" && (
                                    <div className="space-y-8 animate-in fade-in-50 duration-300">
                                        <div>
                                            <h3 className="text-lg font-medium">Notificaciones</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Elige cómo quieres recibir las alertas
                                            </p>
                                            <Separator className="my-4" />
                                            <div className="grid gap-4">
                                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <Mail className="h-4 w-4" />
                                                            <Label htmlFor="email-notif">Email</Label>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">
                                                            Resumen semanal y alertas de seguridad
                                                        </p>
                                                    </div>
                                                    <Switch
                                                        id="email-notif"
                                                        checked={notifications.email}
                                                        onCheckedChange={(c) => setNotifications({ ...notifications, email: c })}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <Bell className="h-4 w-4" />
                                                            <Label htmlFor="push-notif">Push</Label>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">
                                                            Notificaciones en tiempo real en el navegador
                                                        </p>
                                                    </div>
                                                    <Switch
                                                        id="push-notif"
                                                        checked={notifications.push}
                                                        onCheckedChange={(c) => setNotifications({ ...notifications, push: c })}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <Smartphone className="h-4 w-4" />
                                                            <Label htmlFor="sms-notif">SMS</Label>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">
                                                            Alertas críticas de seguridad
                                                        </p>
                                                    </div>
                                                    <Switch
                                                        id="sms-notif"
                                                        checked={notifications.sms}
                                                        onCheckedChange={(c) => setNotifications({ ...notifications, sms: c })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === "data" && (
                                    <div className="space-y-8 animate-in fade-in-50 duration-300">
                                        <div>
                                            <h3 className="text-lg font-medium">Gestión de Datos</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Controla tus datos y privacidad
                                            </p>
                                            <Separator className="my-4" />
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <Download className="h-4 w-4" />
                                                            <Label>Exportar datos</Label>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">
                                                            Descarga una copia de todas tus transacciones
                                                        </p>
                                                    </div>
                                                    <Button variant="outline" size="sm">
                                                        Exportar CSV
                                                    </Button>
                                                </div>
                                                <div className="flex items-center justify-between p-4 border rounded-lg border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/50">
                                                    <div className="space-y-1">
                                                        <Label className="text-red-600 dark:text-red-400">Zona de Peligro</Label>
                                                        <p className="text-sm text-red-600/80 dark:text-red-400/80">
                                                            Eliminar permanentemente tu cuenta y datos
                                                        </p>
                                                    </div>
                                                    <Button variant="destructive" size="sm">
                                                        Eliminar Cuenta
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
