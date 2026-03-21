'use client'

import { DriveStep, driver } from 'driver.js'
import { useEffect } from 'react'
import 'driver.js/dist/driver.css'
import { usePathname } from 'next/navigation'

interface DemoTourProps {
	user: {
		email?: string | null
		name?: string | null
	}
}

export function DemoTour({ user }: DemoTourProps) {
	const pathname = usePathname()

	useEffect(() => {
		console.log('DemoTour: Checking trigger...', { user, pathname })

		// Check if user is a demo user
		// Ensure case-insensitive check and trim
		const email = user?.email?.toLowerCase().trim()
		const isDemoUser = email?.startsWith('demo+')

		console.log('DemoTour: isDemoUser?', isDemoUser, 'Email:', email)

		if (!isDemoUser) return

		let steps: DriveStep[] = []
		let tourKey = ''

		// Define steps based on path
		if (pathname === '/app') {
			tourKey = 'hasSeenDemoTour_dashboard'
			steps = [
				{
					element: '#dashboard-header',
					popover: {
						title: '¡Bienvenido al Modo Demo! 👋',
						description:
							'Este es un entorno seguro con datos de prueba. Siéntete libre de explorar sin miedo a romper nada.',
						side: 'bottom',
						align: 'start',
					},
				},
				{
					element: '#stats-grid',
					popover: {
						title: 'Métricas Principales 📊',
						description:
							'Aquí verás un resumen rápido de tu estado financiero: balance total, ingresos y gastos del mes.',
						side: 'bottom',
					},
				},
				{
					element: '#dashboard-charts',
					popover: {
						title: 'Análisis Visual 📈',
						description:
							'Gráficas interactivas para entender mejor a dónde va tu dinero. ¡Pasa el ratón por encima para ver detalles!',
						side: 'top',
					},
				},
				{
					element: '#recent-transactions',
					popover: {
						title: 'Tus Movimientos 💸',
						description: 'Lista de tus últimas transacciones. Todo lo que registres aparecerá aquí automáticamente.',
						side: 'left',
					},
				},
			]
		} else if (pathname === '/app/accounts') {
			tourKey = 'hasSeenDemoTour_accounts'
			steps = [
				{
					element: '#accounts-header',
					popover: {
						title: 'Gestión de Cuentas 🏦',
						description: 'Aquí administras tus cuentas bancarias, efectivo o tarjetas.',
						side: 'bottom',
						align: 'start',
					},
				},
				{
					element: '#add-account-btn',
					popover: {
						title: 'Nueva Cuenta ➕',
						description: 'Crea una cuenta ficticia para probar. Puedes ponerle el saldo inicial que quieras.',
						side: 'left',
					},
				},
				{
					element: '#accounts-list',
					popover: {
						title: 'Tus Cuentas 📋',
						description: 'Aquí verás todas tus cuentas listadas con sus saldos actualizados.',
						side: 'top',
					},
				},
			]
		} else if (pathname === '/app/category') {
			tourKey = 'hasSeenDemoTour_categories'
			steps = [
				{
					element: '#categories-header',
					popover: {
						title: 'Categorías de Gastos 🏷️',
						description: 'Organiza tus transacciones en categorías personalizadas (Comida, Transporte, Ocio, etc.).',
						side: 'bottom',
						align: 'start',
					},
				},
				{
					element: '#add-category-btn',
					popover: {
						title: 'Crear Categoría ➕',
						description: 'Añade una categoría nueva. ¡Elige un icono y color divertidos!',
						side: 'left',
					},
				},
				{
					element: '#categories-list',
					popover: {
						title: 'Listado de Categorías 📋',
						description:
							'Gestiona tus categorías existentes. Puedes editarlas o eliminarlas si no tienen transacciones.',
						side: 'top',
					},
				},
			]
		} else if (pathname === '/app/budget') {
			tourKey = 'hasSeenDemoTour_budgets'
			steps = [
				{
					element: '#budgets-header',
					popover: {
						title: 'Presupuestos 💰',
						description: 'Establece límites de gasto para tus categorías y mantén tus finanzas bajo control.',
						side: 'bottom',
						align: 'start',
					},
				},
				{
					element: '#add-budget-btn',
					popover: {
						title: 'Nuevo Presupuesto ➕',
						description: 'Define un límite mensual para una categoría. Te avisaremos si te acercas al límite.',
						side: 'left',
					},
				},
				{
					element: '#budgets-list',
					popover: {
						title: 'Seguimiento 📊',
						description:
							'Visualiza el progreso de tus presupuestos. Las barras cambian de color según el porcentaje gastado.',
						side: 'top',
					},
				},
			]
		} else if (pathname === '/app/transactions') {
			tourKey = 'hasSeenDemoTour_transactions'
			steps = [
				{
					element: '#transactions-header',
					popover: {
						title: 'Historial de Transacciones 💸',
						description: 'El corazón de tu gestión. Revisa cada movimiento al detalle.',
						side: 'bottom',
						align: 'start',
					},
				},
				{
					element: '#add-transaction-btn',
					popover: {
						title: 'Registrar Movimiento ➕',
						description:
							'Añade un Gasto, Ingreso o Transferencia. Se reflejará instantáneamente en tus cuentas y presupuestos.',
						side: 'left',
					},
				},
				{
					element: '#transactions-tabs',
					popover: {
						title: 'Vistas Alternativas 📑',
						description:
							'Cambia entre el historial completo y tus transacciones recurrentes (suscripciones, alquiler, etc.).',
						side: 'bottom',
					},
				},
				{
					element: '#transactions-list',
					popover: {
						title: 'Detalles 🔍',
						description: 'Filtra, ordena y busca transacciones específicas en esta lista.',
						side: 'top',
					},
				},
			]
		}

		const hasSeenTour = sessionStorage.getItem(tourKey)
		console.log(`DemoTour: Path ${pathname}, TourKey ${tourKey}, HasSeen ${hasSeenTour}, Steps ${steps.length}`)

		if (steps.length > 0 && !hasSeenTour) {
			console.log('DemoTour: Starting driver...')
			const driverObj = driver({
				showProgress: true,
				animate: true,
				allowClose: true,
				doneBtnText: '¡Entendido!',
				nextBtnText: 'Siguiente',
				prevBtnText: 'Anterior',
				progressText: 'Paso {{current}} de {{total}}',
				steps: steps,
				onDestroyStarted: () => {
					if (tourKey) {
						sessionStorage.setItem(tourKey, 'true')
					}
					driverObj.destroy()
				},
			})

			// Small delay to ensure DOM is ready and transitions finished
			const timer = setTimeout(() => {
				driverObj.drive()
			}, 1000)

			return () => clearTimeout(timer)
		}
	}, [user, pathname])

	return null
}
