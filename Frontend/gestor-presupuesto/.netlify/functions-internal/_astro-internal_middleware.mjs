import 'kleur/colors';
import 'html-escaper';
import 'clsx';
import './chunks/astro_bgnKWSTW.mjs';
import 'cookie';
import '@astrojs/internal-helpers/path';

const PUBLIC_ROUTES = ["/login"];

function sequence(...handlers) {
  const filtered = handlers.filter((h) => !!h);
  const length = filtered.length;
  if (!length) {
    const handler = defineMiddleware((context, next) => {
      return next();
    });
    return handler;
  }
  return defineMiddleware((context, next) => {
    return applyHandle(0, context);
    function applyHandle(i, handleContext) {
      const handle = filtered[i];
      const result = handle(handleContext, async () => {
        if (i < length - 1) {
          return applyHandle(i + 1, handleContext);
        } else {
          return next();
        }
      });
      return result;
    }
  });
}

function defineMiddleware(fn) {
  return fn;
}

const onRequest$1 = defineMiddleware(async (context, next) => {
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
      Authorization: `Bearer ${token}`
    }
  };
  try {
    const data = await fetch(`http://localhost:8080/profile`, config);
    const result = await data.json();
    if (!result.id) {
      context.redirect("/login");
      return Response.redirect(new URL("/login", context.url));
    }
    context.locals["userId"] = result.id;
    return next();
  } catch (error) {
    console.error(error);
    return Response.redirect(new URL("/login", context.url));
  }
});

const onRequest = sequence(
	
	onRequest$1
	
);

export { onRequest };
