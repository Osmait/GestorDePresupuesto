"use client"

import { signIn, useSession, signOut } from "next-auth/react"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

export default function LoginTestPage() {
  const { data: session, status } = useSession()
  const [email, setEmail] = useState("juan.perez@example.com")
  const [password, setPassword] = useState("password123")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage("")

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setMessage("❌ Error: Credenciales inválidas")
      } else {
        setMessage("✅ Login exitoso!")
      }
    } catch (error) {
      setMessage("❌ Error de conexión")
    } finally {
      setIsLoading(false)
    }
  }

  if (status === "loading") {
    return <div className="p-8">Cargando...</div>
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Test de Autenticación NextAuth v4</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* Formulario de Login */}
        <Card>
          <CardHeader>
            <CardTitle>Login de Prueba</CardTitle>
            <CardDescription>
              Probar autenticación con el backend
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@ejemplo.com"
                />
              </div>
              <div>
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
              </Button>
            </form>
            {message && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm">{message}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Estado de la Sesión */}
        <Card>
          <CardHeader>
            <CardTitle>Estado de la Sesión</CardTitle>
            <CardDescription>
              Información actual de NextAuth
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <strong>Status:</strong>
              <Badge variant={status === "authenticated" ? "default" : "secondary"}>
                {status}
              </Badge>
            </div>
            
            {session?.user && (
              <div className="space-y-2">
                <div><strong>ID:</strong> {session.user.id}</div>
                <div><strong>Nombre:</strong> {session.user.name}</div>
                <div><strong>Apellido:</strong> {(session.user as any).lastName}</div>
                <div><strong>Email:</strong> {session.user.email}</div>
                <div className="break-all">
                  <strong>Token:</strong> 
                  <code className="text-xs bg-muted p-1 rounded">
                    {(session as any).accessToken?.substring(0, 50)}...
                  </code>
                </div>
              </div>
            )}
            
            {session && (
              <Button onClick={() => signOut()} variant="destructive" className="w-full">
                Cerrar Sesión
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Información técnica */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Información Técnica</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-semibold mb-2">NextAuth v4 Configurado ✅</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Provider: Credentials</li>
                <li>• Session: JWT Strategy</li>
                <li>• Backend: http://127.0.0.1:8080</li>
                <li>• Middleware activo en /app/*</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Credenciales de Prueba</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Email: juan.perez@example.com</li>
                <li>• Password: password123</li>
                <li>• Email: maria.gonzalez@example.com</li>
                <li>• Password: password456</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}