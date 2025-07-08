"use client"

import { useAuth } from "@/hooks/useAuth"
import { UserNav } from "@/components/auth/user-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { signOut } from "next-auth/react"
import { Badge } from "@/components/ui/badge"

export default function AuthExamplePage() {
  const { user, accessToken, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <div className="p-8">Cargando...</div>
  }

  if (!isAuthenticated) {
    return <div className="p-8">No autenticado</div>
  }

  return (
    <div className="container mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Ejemplo de Autenticación</h1>
        <UserNav />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Información del Usuario</CardTitle>
            <CardDescription>Datos obtenidos de la sesión de Auth.js</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <strong>ID:</strong> {user?.id}
            </div>
            <div>
              <strong>Nombre:</strong> {user?.name}
            </div>
            <div>
              <strong>Apellido:</strong> {user?.lastName}
            </div>
            <div>
              <strong>Email:</strong> {user?.email}
            </div>
            <div className="flex items-center space-x-2">
              <strong>Estado:</strong>
              <Badge variant="default">Autenticado</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Token de Acceso</CardTitle>
            <CardDescription>JWT token del backend para hacer requests</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-3 rounded-md">
              <code className="text-sm break-all">
                {accessToken ? `${accessToken.substring(0, 50)}...` : "No token"}
              </code>
            </div>
            <p className="text-sm text-muted-foreground">
              Este token se usa automáticamente en todas las llamadas al backend a través de AuthRepository.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Acciones</CardTitle>
          <CardDescription>Prueba las funcionalidades de autenticación</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={() => signOut({ callbackUrl: "/login" })}
            variant="destructive"
          >
            Cerrar Sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}