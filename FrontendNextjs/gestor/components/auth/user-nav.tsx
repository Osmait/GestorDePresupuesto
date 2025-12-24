"use client"

import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LogOut, User, Settings, Globe } from "lucide-react"
import { ModeToggle } from "@/components/common/ToggleMode"
import { useLocale } from "next-intl"
import { useState } from "react"
import { SettingsModal } from "@/components/settings/SettingsModal"

/**
 * UserNav displays the user's avatar and a dropdown menu with profile actions.
 * It provides access to Profile, Settings, Theme toggle, Language switcher, and Logout.
 * 
 * @returns The UserNav component.
 */
export function UserNav() {
  const { data: session, status } = useSession()
  const locale = useLocale()
  const [showSettings, setShowSettings] = useState(false)

  if (status === "loading") {
    return <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
  }

  if (status === "unauthenticated" || !session) {
    return null
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" })
  }

  const getInitials = (name: string, lastName?: string) => {
    const initials = `${name?.charAt(0) || ""}${lastName?.charAt(0) || ""}`
    return initials.toUpperCase() || "U"
  }

  const switchLocale = (newLocale: string) => {
    document.cookie = `locale=${newLocale}; path=/; max-age=31536000`
    window.location.reload()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={session.user.image || ""} alt={session.user.name || ""} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(session.user.name || "", session.user.lastName)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {session.user.name} {session.user.lastName}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {session.user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm">Tema</span>
              <ModeToggle />
            </div>
          </div>
          <div className="px-2 py-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Idioma
              </span>
              <div className="flex gap-1">
                <Button
                  variant={locale === "es" ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => switchLocale("es")}
                >
                  ES
                </Button>
                <Button
                  variant={locale === "en" ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => switchLocale("en")}
                >
                  EN
                </Button>
              </div>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />
            <span>Perfil</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowSettings(true)}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Configuración</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Cerrar sesión</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
    </>
  )
}