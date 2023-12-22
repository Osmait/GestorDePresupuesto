import { c as createAstro, d as createComponent, r as renderTemplate, e as addAttribute, f as renderComponent, g as renderHead, j as renderTransition } from '../astro_bgnKWSTW.mjs';
import 'kleur/colors';
import 'html-escaper';
import { b as $$ViewTransitions } from './account_r5lQzPok.mjs';
/* empty css                          */
/* empty css                            */

const $$Astro = createAstro();
const prerender = false;
const $$Login = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Login;
  const errors = { resp: "", email: "", password: "" };
  if (Astro2.request.method === "POST") {
    try {
      const data = await Astro2.request.formData();
      const email = data.get("email");
      const password = data.get("password");
      if (typeof email !== "string") {
        errors.email += "Email is not valid. ";
      }
      if (typeof password !== "string" || password.length < 6) {
        errors.password += "Password must be at least 6 characters. ";
      }
      const loginRequest = {
        email,
        password
      };
      const hasErrors = Object.values(errors).some((msg) => msg);
      if (!hasErrors) {
        const options = {
          method: "POST",
          headers: {
            "content-Type": "application/json"
          },
          body: JSON.stringify(loginRequest)
        };
        const response = await fetch(`${"http://localhost:8080"}/login`, options);
        const result = await response.json();
        if (response.status === 200) {
          Astro2.cookies.set("x-token", result);
          return Astro2.redirect("/");
        }
        errors.resp += result.error;
        console.log(errors);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      }
    }
  }
  return renderTemplate`<html data-astro-cid-sgpqyurt> <head><meta charset="UTF-8"><meta name="description" content="Astro description"><meta name="viewport" content="width=device-width"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><meta name="generator"${addAttribute(Astro2.generator, "content")}><title>Login</title>${renderComponent($$result, "ViewTransitions", $$ViewTransitions, { "data-astro-cid-sgpqyurt": true })}${renderHead()}</head> <div class="login-box" data-astro-cid-sgpqyurt> <form method="POST" data-astro-cid-sgpqyurt> <div class="demo" data-astro-cid-sgpqyurt> <h2 data-astro-cid-sgpqyurt>Demo Account </h2> <p data-astro-cid-sgpqyurt>Email: demo@demo.com</p> <p data-astro-cid-sgpqyurt>Password: 12345678</p> </div> <div class="user-box" data-astro-cid-sgpqyurt${addAttribute(renderTransition($$result, "ezbbofcd", "", "name-label"), "data-astro-transition-scope")}> <input data-testid="email" type="email" name="email" required data-astro-cid-sgpqyurt> <label data-astro-cid-sgpqyurt>Email</label> </div> <div class="user-box" data-astro-cid-sgpqyurt> <input data-testid="password" type="password" name="password" required data-astro-cid-sgpqyurt> <label data-astro-cid-sgpqyurt>Password</label> ${errors.password && renderTemplate`<p class="error" data-astro-cid-sgpqyurt>${errors.password}</p>`} ${errors.email && renderTemplate`<p class="error" data-astro-cid-sgpqyurt>${errors.email}</p>`} ${errors.resp && renderTemplate`<p class="error" data-astro-cid-sgpqyurt>${errors.resp}</p>`} </div> <center data-astro-cid-sgpqyurt> <button type="submit" class="button-submit" data-astro-cid-sgpqyurt${addAttribute(renderTransition($$result, "gtxj44dy", "", "button-submit"), "data-astro-transition-scope")}>
Login
<span data-astro-cid-sgpqyurt></span> </button></center> </form> </div>  </html>`;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/login.astro", "self");

const $$file = "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/login.astro";
const $$url = "/login";

export { $$Login as default, $$file as file, prerender, $$url as url };
