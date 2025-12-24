"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageSwitcher() {
    const t = useTranslations("common.language");
    const locale = useLocale();

    const switchLocale = (newLocale: string) => {
        // Store preference in cookie (accessible on server)
        document.cookie = `locale=${newLocale}; path=/; max-age=31536000`; // 1 year
        // Reload to apply new locale
        window.location.reload();
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                    <Globe className="h-[1.2rem] w-[1.2rem]" />
                    <span className="sr-only">Switch language</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    onClick={() => switchLocale("es")}
                    className={locale === "es" ? "bg-accent" : ""}
                >
                    🇪🇸 {t("es")}
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => switchLocale("en")}
                    className={locale === "en" ? "bg-accent" : ""}
                >
                    🇺🇸 {t("en")}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
