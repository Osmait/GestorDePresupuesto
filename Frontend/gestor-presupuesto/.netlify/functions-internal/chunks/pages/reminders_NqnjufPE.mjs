import { c as createAstro, d as createComponent, r as renderTemplate, m as maybeRenderHead, f as renderComponent, e as addAttribute, j as renderTransition } from '../astro_bgnKWSTW.mjs';
import 'kleur/colors';
import 'html-escaper';
import { $ as $$BackArrowIcon, a as $$Layout } from './account_r5lQzPok.mjs';
import 'clsx';
/* empty css                              */
/* empty css                            */

const $$Astro$1 = createAstro();
const $$ListOfReminders = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$ListOfReminders;
  return renderTemplate`${maybeRenderHead()}<h2 data-astro-cid-gui4j4yi>Reminders</h2> <div class="content-reminders" data-astro-cid-gui4j4yi> <div data-astro-cid-gui4j4yi> <h3 data-astro-cid-gui4j4yi>Name</h3> <p data-astro-cid-gui4j4yi>Description</p> <p data-astro-cid-gui4j4yi>Date</p> </div> <div data-astro-cid-gui4j4yi> <h3 data-astro-cid-gui4j4yi>Name</h3> <p data-astro-cid-gui4j4yi>Description</p> <p data-astro-cid-gui4j4yi>Date</p> </div> <div data-astro-cid-gui4j4yi></div> </div>`;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/components/ListOfReminders.astro", void 0);

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
