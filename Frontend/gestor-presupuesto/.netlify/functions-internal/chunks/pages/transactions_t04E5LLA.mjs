import { c as createAstro, d as createComponent, r as renderTemplate, f as renderComponent, m as maybeRenderHead, e as addAttribute, j as renderTransition } from '../astro_bgnKWSTW.mjs';
import 'kleur/colors';
import 'html-escaper';
import { $ as $$LastTransaction } from './index_DrG9yJrb.mjs';
import { $ as $$BackArrowIcon, a as $$Layout } from './account_r5lQzPok.mjs';
/* empty css                            */

const $$Astro = createAstro();
const prerender = false;
const $$Transactions = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Transactions;
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Transactions" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<a href="/"> ${renderComponent($$result2, "BackArrowIcon", $$BackArrowIcon, {})} </a> <section${addAttribute(renderTransition($$result2, "fsfj3ots", "", "transaction"), "data-astro-transition-scope")}> ${renderComponent($$result2, "LastTransaction", $$LastTransaction, {})} </section> ` })}`;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/transactions.astro", "self");

const $$file = "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/transactions.astro";
const $$url = "/transactions";

export { $$Transactions as default, $$file as file, prerender, $$url as url };
