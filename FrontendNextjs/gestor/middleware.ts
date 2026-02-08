import { auth } from "@/auth"

export default auth((req) => {
  if (req.auth) {
    console.log("🔐 Auth middleware - Usuario autenticado en:", req.nextUrl.pathname);
  } else {
    console.log("🔐 Auth middleware - Usuario NO autenticado en:", req.nextUrl.pathname);
  }
})

export const config = {
  matcher: "/app/:path*",
};
