'use client'

import { useState } from 'react'
import { authRepository, isMockMode } from '@/lib/repositoryConfig'

export default function LoginDebug() {
	const [email, setEmail] = useState('juan.perez@example.com')
	const [password, setPassword] = useState('password123')
	const [isLoading, setIsLoading] = useState(false)
	const [result, setResult] = useState<any>(null)
	const [error, setError] = useState<string | null>(null)

	const handleLogin = async () => {
		console.log('🔍 Iniciando login debug...')
		console.log('📧 Email:', email)
		console.log('🔑 Password:', password)
		console.log('🎭 Mock mode:', isMockMode())
		console.log('📦 Auth repository:', authRepository)

		try {
			setIsLoading(true)
			setError(null)
			setResult(null)

			console.log('⏳ Llamando a authRepository.login...')
			const user = await authRepository.login(email, password)
			console.log('✅ Login exitoso:', user)
			
			setResult(user)
		} catch (err) {
			console.error('❌ Error en login:', err)
			setError(err instanceof Error ? err.message : 'Error desconocido')
		} finally {
			setIsLoading(false)
			console.log('🏁 Login terminado')
		}
	}

	const handleTestMock = async () => {
		console.log('🧪 Probando mock directamente...')
		try {
			const { AuthRepositoryMock } = await import('@/mocks/authRepositoryMock')
			const mockRepo = new AuthRepositoryMock()
			console.log('📦 Mock creado:', mockRepo)
			
			const user = await mockRepo.login(email, password)
			console.log('✅ Mock directo exitoso:', user)
			setResult({ type: 'direct_mock', user })
			setError(null)
		} catch (err) {
			console.error('❌ Error en mock directo:', err)
			setError(`Mock directo falló: ${err instanceof Error ? err.message : 'Error desconocido'}`)
			setResult(null)
		}
	}

	return (
		<div className="p-8 max-w-2xl mx-auto">
			<div className="bg-white rounded-lg shadow-lg p-6">
				<h1 className="text-2xl font-bold mb-6 text-gray-800">
					🔍 Login Debug Tool
				</h1>
				
				{/* Información del estado */}
				<div className="mb-6 p-4 bg-blue-50 rounded-lg">
					<p className="text-blue-800">
						<strong>Modo Mock:</strong> {isMockMode() ? '✅ Activado' : '❌ Desactivado'}
					</p>
					<p className="text-blue-800">
						<strong>Repositorio:</strong> {authRepository?.constructor?.name || 'No detectado'}
					</p>
				</div>

				{/* Formulario */}
				<div className="space-y-4 mb-6">
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Email:
						</label>
						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="juan.perez@example.com"
						/>
					</div>
					
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Password:
						</label>
						<input
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="Cualquier contraseña"
						/>
					</div>
				</div>

				{/* Botones */}
				<div className="space-y-3 mb-6">
					<button
						onClick={handleLogin}
						disabled={isLoading}
						className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
					>
						{isLoading ? '🔄 Logueando...' : '🔐 Login Normal'}
					</button>
					
					<button
						onClick={handleTestMock}
						disabled={isLoading}
						className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
					>
						🧪 Probar Mock Directo
					</button>
				</div>

				{/* Usuarios disponibles */}
				<div className="mb-6 p-4 bg-gray-50 rounded-lg">
					<h3 className="font-semibold mb-2">👥 Usuarios Disponibles:</h3>
					<div className="space-y-2 text-sm">
						<button
							onClick={() => {
								setEmail('juan.perez@example.com')
								setPassword('password123')
							}}
							className="block w-full text-left px-3 py-2 bg-white border rounded hover:bg-gray-50"
						>
							📧 juan.perez@example.com (Juan Pérez)
						</button>
						<button
							onClick={() => {
								setEmail('maria.gonzalez@example.com')
								setPassword('password456')
							}}
							className="block w-full text-left px-3 py-2 bg-white border rounded hover:bg-gray-50"
						>
							📧 maria.gonzalez@example.com (María González)
						</button>
					</div>
				</div>

				{/* Resultado */}
				{result && (
					<div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
						<h3 className="font-semibold text-green-800 mb-2">✅ Resultado:</h3>
						<pre className="text-sm text-green-700 whitespace-pre-wrap overflow-auto">
							{JSON.stringify(result, null, 2)}
						</pre>
					</div>
				)}

				{/* Error */}
				{error && (
					<div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
						<h3 className="font-semibold text-red-800 mb-2">❌ Error:</h3>
						<p className="text-red-700">{error}</p>
					</div>
				)}

				{/* Instrucciones */}
				<div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
					<h3 className="font-semibold text-yellow-800 mb-2">📋 Instrucciones:</h3>
					<ol className="text-sm text-yellow-700 space-y-1">
						<li>1. Abre las herramientas de desarrollador (F12)</li>
						<li>2. Ve a la pestaña &quot;Console&quot;</li>
						<li>3. Haz clic en &quot;Login Normal&quot; o &quot;Probar Mock Directo&quot;</li>
						<li>4. Revisa los logs en la consola para ver qué está pasando</li>
					</ol>
				</div>
			</div>
		</div>
	)
}