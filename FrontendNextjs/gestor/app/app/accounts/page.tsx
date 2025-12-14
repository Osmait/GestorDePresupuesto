import { AccountActions } from '@/components/accounts/AccountActions'
import AccountsClient from '@/components/accounts/AccountsClient'
import { AccountProvider } from '@/components/accounts/AccountContext'

export default function AccountsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <AccountProvider>
          {/* Header Estático - Server Side */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-foreground">
                  Gestión de Cuentas
                </h1>
                <p className="text-muted-foreground mt-2 text-lg">
                  Administra y supervisa todas tus cuentas financieras
                </p>
              </div>
              {/* Acciones */}
              <AccountActions />
            </div>
          </div>

          {/* Contenido Client Side */}
          <AccountsClient />
        </AccountProvider>
      </div>
    </div>
  )
}
