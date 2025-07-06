import type { Metadata } from "next";

import { Inter as FontSans } from "next/font/google";
import "../../styles/globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SettingsProvider } from "../../contexts";
import { Sidebar } from "@/components/sidebar";
import { cn } from "../../lib/utils";

export const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "FinanceApp - Gestor Personal",
  description: "Aplicación para gestión de finanzas personales",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable,
        )}
      >
        				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<SettingsProvider>
						<Sidebar>
							{children}
						</Sidebar>
					</SettingsProvider>
				</ThemeProvider>
      </body>
    </html>
  );
}
