import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { AuthRepository } from "./app/repository/authRepository";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("x-token");

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const authRepository = new AuthRepository();
  const user = await authRepository.getProfile(token?.value);

  if (!user.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}
export const config = {
  matcher: "/app/:path*",
};
