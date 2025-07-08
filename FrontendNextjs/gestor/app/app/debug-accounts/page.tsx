"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { accountRepository } from "@/lib/repositories"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { UserNav } from "@/components/auth/user-nav"

export default function DebugAccountsPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const [rawData, setRawData] = useState<any>(null)
  const [processedData, setProcessedData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const debugFetch = async () => {
    setLoading(true)
    try {
      // Obtener datos raw del backend usando getSession directamente
      const { getSession } = await import("next-auth/react")
      const session = await getSession()
      const token = (session as any)?.accessToken

      const response = await fetch("http://127.0.0.1:8080/account", {
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      })
      const raw = await response.json()
      setRawData(raw)

      // Obtener datos procesados por el repositorio
      const processed = await accountRepository.findAll()
      setProcessedData(processed)

      console.log("🔍 Raw data from backend:", raw)
      console.log("🔍 Processed data from repository:", processed)
    } catch (error) {
      console.error("Debug fetch error:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      debugFetch()
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
        <h1 className="text-3xl font-bold">Debug - Datos de Accounts</h1>
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={debugFetch}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <UserNav />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Datos Raw del Backend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">Datos RAW del Backend</CardTitle>
            <CardDescription>
              Respuesta directa de http://127.0.0.1:8080/account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Cargando...</p>
            ) : rawData ? (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <pre className="text-sm text-blue-800 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(rawData, null, 2)}
                  </pre>
                </div>
                <div className="text-sm text-muted-foreground">
                  <strong>Estructura detectada:</strong>
                  <ul className="mt-2 space-y-1">
                    {rawData[0] && (
                      <>
                        <li>• Tipo: {Array.isArray(rawData) ? 'Array' : 'Object'}</li>
                        <li>• Elementos: {rawData.length}</li>
                        <li>• Propiedades del primer elemento:</li>
                        <ul className="ml-4 space-y-1">
                          {Object.keys(rawData[0]).map((key) => (
                            <li key={key}>- {key}: {typeof rawData[0][key]}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No hay datos</p>
            )}
          </CardContent>
        </Card>

        {/* Datos Procesados */}
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Datos Procesados por Repository</CardTitle>
            <CardDescription>
              Después del mapeo en AccountRepository.findAll()
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Cargando...</p>
            ) : processedData ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <pre className="text-sm text-green-800 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(processedData, null, 2)}
                  </pre>
                </div>
                <div className="text-sm text-muted-foreground">
                  <strong>Estructura resultante:</strong>
                  <ul className="mt-2 space-y-1">
                    {processedData[0] && (
                      <>
                        <li>• Tipo: {Array.isArray(processedData) ? 'Array' : 'Object'}</li>
                        <li>• Elementos: {processedData.length}</li>
                        <li>• Propiedades del primer elemento:</li>
                        <ul className="ml-4 space-y-1">
                          {Object.keys(processedData[0]).map((key) => (
                            <li key={key}>
                              - {key}: {typeof processedData[0][key]} 
                              {key.includes('balance') && (
                                <span className="font-semibold text-green-600">
                                  (valor: {processedData[0][key]})
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No hay datos</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Análisis de Balance */}
      {rawData && processedData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-purple-600">Análisis de Balance</CardTitle>
            <CardDescription>
              Comparación de balance entre datos raw y procesados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <h4 className="font-semibold mb-2">Datos Raw</h4>
                {rawData.map((item: any, index: number) => (
                  <div key={index} className="text-sm border rounded p-2 mb-2">
                    <div><strong>Item {index + 1}:</strong></div>
                    <div>• current_balance: {item.current_balance}</div>
                    <div>• account_info?.initial_balance: {item.account_info?.initial_balance}</div>
                  </div>
                ))}
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Datos Procesados</h4>
                {processedData.map((item: any, index: number) => (
                  <div key={index} className="text-sm border rounded p-2 mb-2">
                    <div><strong>Account {index + 1}:</strong></div>
                    <div>• current_balance: {item.current_balance}</div>
                    <div>• initial_balance: {item.initial_balance}</div>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="font-semibold mb-2">Posibles Problemas</h4>
                <div className="text-sm space-y-2">
                  {!rawData[0]?.current_balance && (
                    <div className="text-red-600">❌ current_balance no existe en raw data</div>
                  )}
                  {rawData[0]?.current_balance === null && (
                    <div className="text-yellow-600">⚠️ current_balance es null</div>
                  )}
                  {rawData[0]?.current_balance === undefined && (
                    <div className="text-yellow-600">⚠️ current_balance es undefined</div>
                  )}
                  {typeof rawData[0]?.current_balance === 'string' && (
                    <div className="text-yellow-600">⚠️ current_balance es string, debería ser number</div>
                  )}
                  {!processedData[0]?.current_balance && processedData[0]?.current_balance !== 0 && (
                    <div className="text-red-600">❌ current_balance se perdió en el procesamiento</div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}