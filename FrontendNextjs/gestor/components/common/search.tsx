"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, CreditCard, ArrowUpDown, Tags, PiggyBank, Search as SearchIcon, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useSearchQuery } from "@/hooks/queries/useSearchQuery"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// Component for search results (shared between mobile and desktop)
function SearchResults({
  data,
  isLoading,
  onSelect
}: {
  data: any;
  isLoading: boolean;
  onSelect: (path: string) => void;
}) {
  const hasResults = data && (
    (data.transactions && data.transactions.length > 0) ||
    (data.categories && data.categories.length > 0) ||
    (data.accounts && data.accounts.length > 0) ||
    (data.budgets && data.budgets.length > 0)
  )

  if (isLoading) {
    return (
      <div className="p-4 flex justify-center items-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Buscando...
      </div>
    )
  }

  if (!hasResults) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No se encontraron resultados.
      </div>
    )
  }

  return (
    <div className="py-2">
      {/* Transactions */}
      {data?.transactions && data.transactions.length > 0 && (
        <div className="px-2 py-1">
          <h4 className="flex items-center text-xs font-semibold text-muted-foreground mb-1 px-2">
            <ArrowUpDown className="mr-2 h-3 w-3" /> Transacciones
          </h4>
          {data.transactions.map((tx: any) => (
            <div
              key={tx.id}
              className="flex items-center justify-between gap-3 px-2 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
              onClick={() => onSelect('/app/transactions')}
            >
              <span className="truncate min-w-0 flex-1">{tx.name || tx.description}</span>
              {tx.amount !== undefined && tx.amount !== null && (
                <span className={cn("text-xs font-mono flex-shrink-0", tx.type_transation === "income" ? "text-green-500" : "text-red-500")}>
                  {tx.type_transation === "income" ? "+" : "-"}${Math.abs(tx.amount).toLocaleString()}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Accounts */}
      {data?.accounts && data.accounts.length > 0 && (
        <>
          {data.transactions && data.transactions.length > 0 && <div className="h-px bg-border my-1 mx-2" />}
          <div className="px-2 py-1">
            <h4 className="flex items-center text-xs font-semibold text-muted-foreground mb-1 px-2">
              <CreditCard className="mr-2 h-3 w-3" /> Cuentas
            </h4>
            {data.accounts.map((acc: any) => (
              <div
                key={acc.id}
                className="flex items-center px-2 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
                onClick={() => onSelect(`/app/accounts/${acc.id}`)}
              >
                <span>{acc.name}</span>
                <Badge variant="outline" className="ml-auto text-[10px] h-5">{acc.bank}</Badge>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Categories */}
      {data?.categories && data.categories.length > 0 && (
        <>
          {(data.transactions?.length > 0 || data.accounts?.length > 0) && <div className="h-px bg-border my-1 mx-2" />}
          <div className="px-2 py-1">
            <h4 className="flex items-center text-xs font-semibold text-muted-foreground mb-1 px-2">
              <Tags className="mr-2 h-3 w-3" /> Categorías
            </h4>
            {data.categories.map((cat: any) => (
              <div
                key={cat.id}
                className="flex items-center px-2 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
                onClick={() => onSelect(`/app/transactions?category=${cat.id}`)}
              >
                <span className="mr-2">{cat.icon}</span>
                <span>{cat.name}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Budgets */}
      {data?.budgets && data.budgets.length > 0 && (
        <>
          {(data.transactions?.length > 0 || data.accounts?.length > 0 || data.categories?.length > 0) && <div className="h-px bg-border my-1 mx-2" />}
          <div className="px-2 py-1">
            <h4 className="flex items-center text-xs font-semibold text-muted-foreground mb-1 px-2">
              <PiggyBank className="mr-2 h-3 w-3" /> Presupuestos
            </h4>
            {data.budgets.map((bud: any) => (
              <div
                key={bud.id}
                className="flex items-center justify-between px-2 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
                onClick={() => onSelect('/app/budget')}
              >
                <span>{bud.category_name || "Presupuesto"}</span>
                <span className="font-mono text-xs">${bud.amount}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function Search() {
  const [query, setQuery] = React.useState("")
  const [debouncedQuery, setDebouncedQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const router = useRouter()
  const searchRef = React.useRef<HTMLDivElement>(null)
  const mobileInputRef = React.useRef<HTMLInputElement>(null)

  // Debounce logic
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 500)
    return () => clearTimeout(timer)
  }, [query])

  // Fetch data
  const { data, isLoading } = useSearchQuery(debouncedQuery)

  // Close on click outside (desktop only)
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [searchRef])

  // Focus mobile input when modal opens
  React.useEffect(() => {
    if (mobileOpen && mobileInputRef.current) {
      setTimeout(() => mobileInputRef.current?.focus(), 100)
    }
  }, [mobileOpen])

  const handleSelect = (path: string) => {
    setOpen(false)
    setMobileOpen(false)
    setQuery("")
    router.push(path)
  }

  const handleMobileClose = () => {
    setMobileOpen(false)
    setQuery("")
  }

  return (
    <>
      {/* Mobile: Icon button that opens fullscreen modal */}
      <Button
        variant="ghost"
        size="sm"
        className="md:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <SearchIcon className="h-4 w-4" />
      </Button>

      {/* Mobile: Fullscreen Search Modal */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="sm:max-w-full h-[100dvh] max-h-[100dvh] w-full p-0 gap-0 [&>button]:hidden">
          <div className="flex flex-col h-full">
            {/* Header with search input */}
            <div className="flex items-center gap-2 p-3 border-b bg-background/95 backdrop-blur-sm sticky top-0">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={mobileInputRef}
                  type="search"
                  placeholder="Buscar transacciones, cuentas..."
                  className="pl-9 h-10"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMobileClose}
                className="flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Results area */}
            <div className="flex-1 overflow-y-auto">
              {debouncedQuery.length > 0 ? (
                <SearchResults
                  data={data}
                  isLoading={isLoading}
                  onSelect={handleSelect}
                />
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <SearchIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="text-sm">Escribe para buscar en tus transacciones, cuentas, categorías y presupuestos.</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Desktop: Inline search with dropdown */}
      <div ref={searchRef} className="relative hidden md:block w-[100px] lg:w-[300px]">
        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Buscar..."
          className="w-full pl-8 pr-4"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            if (query.length > 0) setOpen(true)
          }}
        />

        {open && debouncedQuery.length > 0 && (
          <div className="absolute top-full right-0 w-[320px] mt-2 bg-popover text-popover-foreground rounded-md border shadow-lg z-[100] overflow-hidden max-h-[400px] overflow-y-auto">
            <SearchResults
              data={data}
              isLoading={isLoading}
              onSelect={handleSelect}
            />
          </div>
        )}
      </div>
    </>
  );
}
