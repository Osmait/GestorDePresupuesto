"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthRepository } from "@/lib/repositoryConfig";

export default function LoginPage() {
  const [email, setEmail] = useState("juan.perez@example.com");
  const [password, setPassword] = useState("password123");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsLoading(true);
      setError(null);
      
      console.log("🔐 Login page - Starting login...");
      const authRepository = await getAuthRepository();
      const user = await authRepository.login(email, password);
      
      console.log("✅ Login page - Login successful:", user);
      
      // Redirigir al dashboard principal
      router.push("/app");
    } catch (err) {
      console.error("❌ Login page - Login failed:", err);
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Iniciar Sesión
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Usando datos mock para desarrollo
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Email"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Password"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <div className="space-y-4">
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
            >
              {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </button>
            
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setEmail("juan.perez@example.com");
                  setPassword("password123");
                }}
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                Usar Juan Pérez
              </button>
              {" | "}
              <button
                type="button"
                onClick={() => {
                  setEmail("maria.gonzalez@example.com");
                  setPassword("password456");
                }}
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                Usar María González
              </button>
            </div>
          </div>
        </form>

        <div className="mt-6 text-center">
          <div className="text-sm text-gray-600">
            <p className="font-medium">Páginas de test disponibles:</p>
            <div className="mt-2 space-x-2">
              <a href="/simple-test" className="text-indigo-600 hover:text-indigo-500">
                Simple Test
              </a>
              <span>|</span>
              <a href="/debug" className="text-indigo-600 hover:text-indigo-500">
                Debug
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
