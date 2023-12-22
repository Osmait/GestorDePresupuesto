import { c as createAstro, d as createComponent, r as renderTemplate, f as renderComponent, m as maybeRenderHead, e as addAttribute, j as renderTransition } from '../astro_bgnKWSTW.mjs';
import 'kleur/colors';
import 'html-escaper';
import { $ as $$BackArrowIcon, a as $$Layout } from './account_r5lQzPok.mjs';
/* empty css                            */

const $$Astro = createAstro();
const prerender = false;
const $$Charts = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Charts;
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Charst" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<a href="/"> ${renderComponent($$result2, "BackArrowIcon", $$BackArrowIcon, {})} </a> <h1>Charst</h1> <section class="chart"${addAttribute(renderTransition($$result2, "6h6ksh2h", "", "chart"), "data-astro-transition-scope")}></section> ` })}`;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/charts.astro", "self");

const $$file = "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/charts.astro";
const $$url = "/charts";

export { $$Charts as default, $$file as file, prerender, $$url as url };
