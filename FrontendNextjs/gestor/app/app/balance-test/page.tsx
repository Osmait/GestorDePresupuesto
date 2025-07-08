"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { accountRepository } from "@/lib/repositories"
import { Account } from "@/types/account"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, DollarSign, PiggyBank, TrendingUp } from "lucide-react"
import { UserNav } from "@/components/auth/user-nav"

export default function BalanceTestPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)

  const loadAccounts = async () => {
    setLoading(true)
    try {
      console.log("🔄 Loading accounts...")
      const data = await accountRepository.findAll()
      console.log("📊 Loaded accounts:", data)
      setAccounts(data)
    } catch (error) {
      console.error("❌ Error loading accounts:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      loadAccounts()
    }
  }, [isAuthenticated])

  const totalInitialBalance = accounts.reduce((sum, account) => sum + (account.initial_balance || 0), 0)
  const totalCurrentBalance = accounts.reduce((sum, account) => sum + (account.current_balance || account.initial_balance || 0), 0)
  const totalDifference = totalCurrentBalance - totalInitialBalance

  if (isLoading) {
    return <div className="p-8">Cargando autenticación...</div>
  }

  if (!isAuthenticated) {
    return <div className="p-8">No autenticado. Redirecciona al login...</div>
  }

  return (
    <div className="container mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Test de Balance - Accounts</h1>
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAccounts}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Recargar
          </Button>
          <UserNav />
        </div>
      </div>

      {/* Resumen financiero */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Inicial Total</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${totalInitialBalance.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Suma de todos los saldos iniciales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Actual Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${totalCurrentBalance.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Suma de todos los saldos actuales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Diferencia</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalDifference >= 0 ? '+' : ''}${totalDifference.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Diferencia entre inicial y actual
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista detallada de cuentas */}
      <Card>
        <CardHeader>
          <CardTitle>Cuentas - Análisis de Balance</CardTitle>
          <CardDescription>
            Comparación detallada entre saldo inicial y actual
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Cargando...</p>
          ) : accounts.length === 0 ? (
            <p className="text-muted-foreground">No hay cuentas creadas</p>
          ) : (
            <div className="space-y-4">
              {accounts.map((account, index) => {
                const initialBalance = account.initial_balance || 0
                const currentBalance = account.current_balance !== undefined ? account.current_balance : initialBalance
                const difference = currentBalance - initialBalance
                
                return (
                  <div key={account.id || index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div>
                          <h3 className="font-semibold text-lg">{account.name}</h3>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">{account.bank}</Badge>
                            <Badge variant="secondary">ID: {account.id}</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          ${initialBalance.toLocaleString()}
                        </div>
                        <p className="text-sm text-muted-foreground">Saldo Inicial</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          ${currentBalance.toLocaleString()}
                        </div>
                        <p className="text-sm text-muted-foreground">Saldo Actual</p>
                        {account.current_balance === undefined && (
                          <p className="text-xs text-yellow-600">⚠️ Usando inicial</p>
                        )}
                      </div>
                      
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {difference >= 0 ? '+' : ''}${difference.toLocaleString()}
                        </div>
                        <p className="text-sm text-muted-foreground">Diferencia</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-sm space-y-1">
                          <p><strong>Tipo balance:</strong> {account.current_balance !== undefined ? 'Calculado' : 'Por defecto'}</p>
                          <p><strong>Valor raw:</strong> {JSON.stringify(account.current_balance)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Debug info */}
      <Card>
        <CardHeader>
          <CardTitle>Debug - Estructura de Datos</CardTitle>
          <CardDescription>
            Información técnica para diagnosticar problemas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 border rounded-lg p-4">
            <pre className="text-sm overflow-x-auto">
              {JSON.stringify(accounts, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}