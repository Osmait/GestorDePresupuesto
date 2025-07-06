import SimpleLoginTest from "@/components/SimpleLoginTest";
import LoginDebug from "@/components/LoginDebug";

export default function SimpleTestPage() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-4">
            🧪 Pruebas de Login
          </h1>
          <div className="text-center text-gray-600 mb-8">
            <p>Esta página está fuera del middleware para evitar interferencias</p>
            <p>Ruta: <code>/simple-test</code></p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-semibold mb-4">Test Simple</h2>
            <SimpleLoginTest />
          </div>
          
          <div>
            <h2 className="text-xl font-semibold mb-4">Test Completo</h2>
            <LoginDebug />
          </div>
        </div>
        
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">
            📝 Instrucciones:
          </h3>
          <ol className="text-blue-700 space-y-1">
            <li>1. Abre las herramientas de desarrollador (F12)</li>
            <li>2. Ve a la pestaña "Console" para ver los logs</li>
            <li>3. Prueba ambos componentes</li>
            <li>4. Revisa los logs para entender qué está pasando</li>
          </ol>
        </div>
      </div>
    </div>
  );
} 