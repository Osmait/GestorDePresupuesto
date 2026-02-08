'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useTheme } from 'next-themes'

interface SettingsContextType {
	sidebarHoverEnabled: boolean
	setSidebarHoverEnabled: (enabled: boolean) => void
	theme: 'light' | 'dark' | 'system'
	setTheme: (theme: 'light' | 'dark' | 'system') => void
	language: 'es' | 'en'
	setLanguage: (language: 'es' | 'en') => void
	currency: 'USD' | 'EUR' | 'MXN'
	setCurrency: (currency: 'USD' | 'EUR' | 'MXN') => void
	notifications: {
		email: boolean
		push: boolean
		sms: boolean
	}
	setNotifications: (notifications: { email: boolean; push: boolean; sms: boolean }) => void
}

const defaultSettings = {
	sidebarHoverEnabled: true,
	theme: 'system' as const,
	language: 'es' as const,
	currency: 'USD' as const,
	notifications: {
		email: true,
		push: false,
		sms: true
	}
}

const SettingsContext = createContext<SettingsContextType | null>(null)

export const useSettings = () => {
	const context = useContext(SettingsContext)
	if (!context) {
		console.error('Settings context is null. Make sure useSettings is called within a SettingsProvider')
		throw new Error('useSettings must be used within a SettingsProvider')
	}
	return context
}

interface SettingsProviderProps {
	children: ReactNode
}

export const SettingsProvider = ({ children }: SettingsProviderProps) => {
	// Initialize with default values
	const [sidebarHoverEnabled, setSidebarHoverEnabled] = useState(defaultSettings.sidebarHoverEnabled)
	
	// Use next-themes for theme management
	const { theme: nextTheme, setTheme: setNextTheme } = useTheme()
	
	// Adapt next-themes to our context type
	// If nextTheme is undefined (during SSR or initial mount), fallback to default
	const theme = (nextTheme as 'light' | 'dark' | 'system') || defaultSettings.theme
	const setTheme = (t: 'light' | 'dark' | 'system') => setNextTheme(t)

	const [language, setLanguage] = useState<'es' | 'en'>(defaultSettings.language)
	const [currency, setCurrency] = useState<'USD' | 'EUR' | 'MXN'>(defaultSettings.currency)
	const [notifications, setNotifications] = useState(defaultSettings.notifications)

	// Load settings from localStorage on mount (client-side only)
	useEffect(() => {
		if (typeof window === 'undefined') return

		try {
			const savedSettings = localStorage.getItem('app-settings')
			if (savedSettings) {
				const parsed = JSON.parse(savedSettings)
				
				setSidebarHoverEnabled(parsed.sidebarHoverEnabled ?? defaultSettings.sidebarHoverEnabled)
				// We don't set theme here because next-themes handles it independently
				// and is the source of truth based on its own storage/detection
				setLanguage(parsed.language ?? defaultSettings.language)
				setCurrency(parsed.currency ?? defaultSettings.currency)
				setNotifications(parsed.notifications ?? defaultSettings.notifications)
			}
		} catch (error) {
			console.error('Error loading settings from localStorage:', error)
		}
	}, [])

	// Save settings to localStorage whenever they change (client-side only)
	useEffect(() => {
		if (typeof window === 'undefined') return

		try {
			const settings = {
				sidebarHoverEnabled,
				theme, // Save current theme to app-settings for consistency/backup
				language,
				currency,
				notifications
			}
			localStorage.setItem('app-settings', JSON.stringify(settings))
		} catch (error) {
			console.error('Error saving settings to localStorage:', error)
		}
	}, [sidebarHoverEnabled, theme, language, currency, notifications])

	const value: SettingsContextType = {
		sidebarHoverEnabled,
		setSidebarHoverEnabled,
		theme,
		setTheme,
		language,
		setLanguage,
		currency,
		setCurrency,
		notifications,
		setNotifications
	}

	return (
		<SettingsContext.Provider value={value}>
			{children}
		</SettingsContext.Provider>
	)
} 