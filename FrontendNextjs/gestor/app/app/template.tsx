"use client"

import PageTransition from "@/components/common/page-transition"

export default function Template({ children }: { children: React.ReactNode }) {
    return <PageTransition>{children}</PageTransition>
}
