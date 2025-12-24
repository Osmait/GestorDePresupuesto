"use client"

import { usePathname } from "next/navigation"

export default function PageTransition({
    children,
}: {
    children: React.ReactNode
}) {
    const _pathname = usePathname()

    // Simple wrapper without animation to avoid duplicate DOM elements
    // and page transition flashing issues
    return (
        <div className="w-full h-full">
            {children}
        </div>
    )
}
