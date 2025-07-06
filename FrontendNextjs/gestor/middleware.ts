import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getAuthRepository } from "./lib/repositoryConfig";

// 🚫 MIDDLEWARE DESACTIVADO TEMPORALMENTE PARA DESARROLLO
// Descomenta el código de abajo cuando quieras reactivar la protección de rutas

export async function middleware(request: NextRequest) {
  // Permitir acceso a todas las rutas sin autenticación
  console.log("🔓 Middleware desactivado - Permitiendo acceso libre a:", request.nextUrl.pathname);
  return NextResponse.next();
}

// CÓDIGO ORIGINAL DEL MIDDLEWARE (comentado temporalmente)
/*
export async function middleware(request: NextRequest) {
  const token = request.cookies.get("x-token");
  
  console.log("🔍 Middleware - Token cookie:", token);
  console.log("🔍 Middleware - Token value:", token?.value);

  if (!token) {
    console.log("❌ Middleware - No token found, redirecting to login");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const authRepository = await getAuthRepository();
    const tokenValue = token.value;
    console.log("🔍 Middleware - About to call getProfile with:", tokenValue);
    
    const user = await authRepository.getProfile(tokenValue);
    console.log("✅ Middleware - User found:", user);
    
    if (!user || !user.id) {
      console.log("❌ Middleware - Invalid user, redirecting to login");
      return NextResponse.redirect(new URL("/login", request.url));
    }
    
    console.log("✅ Middleware - Authentication successful");
  } catch (error) {
    console.error("❌ Error en middleware:", error);
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}
*/

export const config = {
  matcher: "/app/:path*",
};
