"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search as SearchIcon, Loader2, CreditCard, ArrowUpDown, Tags, PiggyBank } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useSearchQuery } from "@/hooks/queries/useSearchQuery"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function Search() {
  const [query, setQuery] = React.useState("")
  const [debouncedQuery, setDebouncedQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const router = useRouter()
  const searchRef = React.useRef<HTMLDivElement>(null)

  // Debounce logic
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 500)
    return () => clearTimeout(timer)
  }, [query])

  // Fetch data
  const { data, isLoading } = useSearchQuery(debouncedQuery)

  // Close on click outside
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

  const handleSelect = (path: string) => {
    setOpen(false)
    setQuery("") // Optional: clear search on navigation
    router.push(path)
  }

  const hasResults = data && (
    (data.transactions && data.transactions.length > 0) ||
    (data.categories && data.categories.length > 0) ||
    (data.accounts && data.accounts.length > 0) ||
    (data.budgets && data.budgets.length > 0)
  )

  return (
    <div ref={searchRef} className="relative w-full md:w-[100px] lg:w-[300px]">
      <Input
        type="search"
        placeholder="Buscar..."
        className="md:w-[100px] lg:w-[300px] pr-8"
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
        <div className="absolute top-full left-0 w-full mt-2 bg-popover text-popover-foreground rounded-md border shadow-md z-50 overflow-hidden max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="p-4 flex justify-center items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Buscando...
            </div>
          ) : hasResults ? (
            <div className="py-2">
              {/* Transactions */}
              {data?.transactions && data.transactions.length > 0 && (
                <div className="px-2 py-1">
                  <h4 className="flex items-center text-xs font-semibold text-muted-foreground mb-1 px-2">
                    <ArrowUpDown className="mr-2 h-3 w-3" /> Transacciones
                  </h4>
                  {data.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                      onClick={() => handleSelect('/app/transactions')}
                    >
                      <span className="truncate">{tx.name || tx.description}</span>
                      <span className={cn("text-xs font-mono", tx.type_transation === "income" ? "text-green-500" : "text-red-500")}>
                        {tx.type_transation === "income" ? "+" : "-"}${Math.abs(tx.amount)}
                      </span>
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
                    {data.accounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="flex items-center px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                        onClick={() => handleSelect('/app/accounts')}
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
                    {data.categories.map((cat) => (
                      <div
                        key={cat.id}
                        className="flex items-center px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                        onClick={() => handleSelect('/app/category')}
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
                    {data.budgets.map((bud) => (
                      <div
                        key={bud.id}
                        className="flex items-center justify-between px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                        onClick={() => handleSelect('/app/budget')}
                      >
                        <span>{bud.category_name || "Presupuesto"}</span>
                        <span className="font-mono text-xs">${bud.amount}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No se encontraron resultados.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
