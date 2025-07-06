'use client'

import { useState } from 'react'

export default function SimpleLoginTest() {
	const [status, setStatus] = useState('listo')
	const [result, setResult] = useState<any>(null)

	const testLogin = async () => {
		try {
			setStatus('cargando...')
			console.log('🔍 Iniciando test de login')
			
			// Importar dinámicamente para evitar problemas
			const { getAuthRepository } = await import('@/lib/repositoryConfig')
			const authRepository = await getAuthRepository()
			console.log('📦 Repository importado:', authRepository)
			
			const user = await authRepository.login('juan.perez@example.com', 'test123')
			console.log('✅ Login exitoso:', user)
			
			setResult(user)
			setStatus('éxito')
		} catch (error) {
			console.error('❌ Error:', error)
			setStatus(`error: ${error instanceof Error ? error.message : 'desconocido'}`)
			setResult(null)
		}
	}

	return (
		<div className="p-4 max-w-md mx-auto bg-white rounded-lg shadow">
			<h2 className="text-xl font-bold mb-4">🧪 Test Simple Login</h2>
			
			<div className="mb-4">
				<p><strong>Estado:</strong> {status}</p>
			</div>
			
			<button 
				onClick={testLogin}
				className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
			>
				Probar Login
			</button>
			
			{result && (
				<div className="mt-4 p-3 bg-green-100 rounded">
					<p className="font-semibold">Usuario logueado:</p>
					<p>{result.name} {result.last_name}</p>
					<p className="text-sm text-gray-600">{result.email}</p>
				</div>
			)}
		</div>
	)
}