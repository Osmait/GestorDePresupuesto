import { e as createAstro, f as createComponent, r as renderTemplate, h as renderComponent, m as maybeRenderHead, g as addAttribute, l as renderTransition } from '../astro_6xIUeTXJ.mjs';
import 'kleur/colors';
import 'html-escaper';
import { $ as $$BackArrowIcon, a as $$Layout } from './account_qMjU1P5s.mjs';
import { $ as $$ListOfReminders } from './index_ptEZJhqR.mjs';
/* empty css                            */

const $$Astro = createAstro();
const prerender = false;
const $$Reminders = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Reminders;
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Reminders" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<a href="/"> ${renderComponent($$result2, "BackArrowIcon", $$BackArrowIcon, {})} </a> <section${addAttribute(renderTransition($$result2, "k7oqnnm4", "", "reminders"), "data-astro-transition-scope")}> ${renderComponent($$result2, "ListOfReminders", $$ListOfReminders, {})} </section> ` })}`;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/reminders.astro", "self");

const $$file = "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/reminders.astro";
const $$url = "/reminders";

export { $$Reminders as default, $$file as file, prerender, $$url as url };
