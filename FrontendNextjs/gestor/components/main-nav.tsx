import Link from "next/link";

import { cn } from "@/lib/utils";

export function MainNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <nav
      className={cn(" items-center space-x-4 lg:space-x-6", className)}
      {...props}
    >
      <Link
        href="/app"
        className="text-sm font-medium transition-colors hover:text-primary"
      >
        Overview
      </Link>
      <Link
        href="/app/accounts"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        Accounts
      </Link>
      <Link
        href="/app/transactions"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        Transaction
      </Link>
      <Link
        href="/app/category"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        Category
      </Link>
      <Link
        href="/app/crypto"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        Crypto
      </Link>
      <Link
        href="/app/budget"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        Budget
      </Link>
    </nav>
  );
}
