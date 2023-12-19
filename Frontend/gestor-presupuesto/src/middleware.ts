import { PUBLIC_ROUTES } from "./constans";
import { defineMiddleware } from "astro/middleware";
export const onRequest = defineMiddleware(async (context, next) => {
  // Ignore auth validation for public routes
  if (PUBLIC_ROUTES.includes(context.url.pathname)) {
    return next();
  }

  const token = context.cookies.get("x-token")?.value;
  if (!token) {
    context.redirect("/login");
    return Response.redirect(new URL("/login", context.url));
  }
  const config = {
    headers: {
      "content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  const data = await fetch(`${import.meta.env.HOST}/profile`, config);

  const result = await data.json();
  if (!result.id) {
    context.redirect("/login");
    return Response.redirect(new URL("/login", context.url));
  }

  context.locals["userId"] = result.id;

  return next();
});
