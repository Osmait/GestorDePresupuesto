import { e as createAstro, f as createComponent, r as renderTemplate, h as renderComponent, m as maybeRenderHead } from '../astro_6xIUeTXJ.mjs';
import 'kleur/colors';
import 'html-escaper';
import 'clsx';
import { $ as $$BackArrowIcon, b as $$LinksofCreate, a as $$Layout } from './account_qMjU1P5s.mjs';

const $$Astro = createAstro();
const prerender = false;
const $$Register = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Register;
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Register" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<a href="/"> ${renderComponent($$result2, "BackArrowIcon", $$BackArrowIcon, {})} </a> <h1>Register</h1> <section> ${renderComponent($$result2, "LinksofCreate", $$LinksofCreate, {})} </section> ` })}`;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/register.astro", void 0);

const $$file = "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/register.astro";
const $$url = "/register";

export { $$Register as default, $$file as file, prerender, $$url as url };
