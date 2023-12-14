import { e as createAstro, f as createComponent, r as renderTemplate, h as renderComponent, m as maybeRenderHead, g as addAttribute, l as renderTransition } from '../astro_6xIUeTXJ.mjs';
import 'kleur/colors';
import 'html-escaper';
import { a as $$LastTransaction } from './index_ptEZJhqR.mjs';
import { $ as $$BackArrowIcon, a as $$Layout } from './account_qMjU1P5s.mjs';
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
