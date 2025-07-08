"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { accountRepository } from "@/lib/repositories"
import { Account } from "@/types/account"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, RefreshCw, Bug } from "lucide-react"
import Link from "next/link"
import { UserNav } from "@/components/auth/user-nav"

export default function AccountsTestPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newAccount, setNewAccount] = useState({
    name: "",
    bank: "",
    initial_balance: 0,
  })

  // accountRepository ya está importado como singleton

  const loadAccounts = async () => {
    setLoading(true)
    try {
      const data = await accountRepository.findAll()
      setAccounts(data)
    } catch (error) {
      console.error("Error loading accounts:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      await accountRepository.create(
        newAccount.name,
        newAccount.bank,
        newAccount.initial_balance
      )
      setNewAccount({ name: "", bank: "", initial_balance: 0 })
      await loadAccounts() // Recargar la lista
    } catch (error) {
      console.error("Error creating account:", error)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteAccount = async (id: string) => {
    try {
      await accountRepository.delete(id)
      await loadAccounts() // Recargar la lista
    } catch (error) {
      console.error("Error deleting account:", error)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      loadAccounts()
    }
  }, [isAuthenticated])

  if (isLoading) {
    return <div className="p-8">Cargando autenticación...</div>
  }

  if (!isAuthenticated) {
    return <div className="p-8">No autenticado. Redirecciona al login...</div>
  }

  return (
    <div className="container mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Test de Accounts Repository</h1>
        <div className="flex items-center space-x-4">
          <Link href="/app/balance-test">
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Balance Test
            </Button>
          </Link>
          <Link href="/app/debug-accounts">
            <Button variant="outline" size="sm">
              <Bug className="h-4 w-4 mr-2" />
              Debug Raw
            </Button>
          </Link>
          <UserNav />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Formulario para crear cuenta */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Plus className="h-5 w-5" />
              <span>Crear Nueva Cuenta</span>
            </CardTitle>
            <CardDescription>
              Prueba la creación de cuentas usando NextAuth token
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre de la cuenta</Label>
                <Input
                  id="name"
                  value={newAccount.name}
                  onChange={(e) => setNewAccount(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Cuenta principal"
                  required
                />
              </div>
              <div>
                <Label htmlFor="bank">Banco</Label>
                <Input
                  id="bank"
                  value={newAccount.bank}
                  onChange={(e) => setNewAccount(prev => ({ ...prev, bank: e.target.value }))}
                  placeholder="Banco de Chile"
                  required
                />
              </div>
              <div>
                <Label htmlFor="balance">Saldo inicial</Label>
                <Input
                  id="balance"
                  type="number"
                  value={newAccount.initial_balance}
                  onChange={(e) => setNewAccount(prev => ({ ...prev, initial_balance: parseFloat(e.target.value) || 0 }))}
                  placeholder="100000"
                  required
                />
              </div>
              <Button type="submit" disabled={creating} className="w-full">
                {creating ? "Creando..." : "Crear Cuenta"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Lista de cuentas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Cuentas</span>
              <Button
                variant="outline"
                size="sm"
                onClick={loadAccounts}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </CardTitle>
            <CardDescription>
              Lista de cuentas desde el backend con token JWT
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Cargando...</p>
            ) : accounts.length === 0 ? (
              <p className="text-muted-foreground">No hay cuentas creadas</p>
            ) : (
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{account.name}</span>
                        <Badge variant="outline">{account.bank}</Badge>
                      </div>
                      <div className="text-sm space-y-1">
                        <p className="text-muted-foreground">
                          <span className="font-medium">Saldo inicial:</span> ${account.initial_balance?.toLocaleString() || "0"}
                        </p>
                        <p className="text-foreground font-medium">
                          <span className="text-muted-foreground font-normal">Saldo actual:</span> ${account.current_balance?.toLocaleString() || account.initial_balance?.toLocaleString() || "0"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteAccount(account.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Estado técnico */}
      <Card>
        <CardHeader>
          <CardTitle>Estado Técnico</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <h4 className="font-semibold mb-2 text-green-600">✅ Repository Actualizado</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Token desde NextAuth session</li>
                <li>• Headers automáticos</li>
                <li>• Error handling mejorado</li>
                <li>• BaseRepository pattern</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">🔐 Autenticación</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• JWT token del backend</li>
                <li>• Sesión NextAuth activa</li>
                <li>• Authorization header</li>
                <li>• Middleware protection</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">📊 Operaciones</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• CRUD completo</li>
                <li>• Error handling</li>
                <li>• Loading states</li>
                <li>• Real-time updates</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}