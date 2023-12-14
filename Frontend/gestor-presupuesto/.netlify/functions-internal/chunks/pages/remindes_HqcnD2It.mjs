import { e as createAstro, f as createComponent, r as renderTemplate, m as maybeRenderHead, g as addAttribute, l as renderTransition, h as renderComponent } from '../astro_6xIUeTXJ.mjs';
import 'kleur/colors';
import 'html-escaper';
import 'clsx';
import { $ as $$BackArrowIcon, b as $$LinksofCreate, a as $$Layout } from './account_qMjU1P5s.mjs';
/* empty css                             */
/* empty css                            */

const $$Astro$1 = createAstro();
const $$RemindersForm = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$RemindersForm;
  return renderTemplate`${maybeRenderHead()}<div class="login-box" data-astro-cid-eeqph3mp> <form data-astro-cid-eeqph3mp> <div class="user-box" data-astro-cid-eeqph3mp${addAttribute(renderTransition($$result, "wvucg5k3", "", "name-label"), "data-astro-transition-scope")}> <input type="text" name="" required="" data-astro-cid-eeqph3mp> <label data-astro-cid-eeqph3mp>Name</label> </div> <div class="user-box" data-astro-cid-eeqph3mp${addAttribute(renderTransition($$result, "bk6mfsh7", "", "descrition-label"), "data-astro-transition-scope")}> <textarea required="" data-astro-cid-eeqph3mp></textarea> <label data-astro-cid-eeqph3mp>Description</label> </div> <div class="user-box" data-astro-cid-eeqph3mp> <input type="date" name="" required="" data-astro-cid-eeqph3mp> </div><center data-astro-cid-eeqph3mp> <a href="#" data-astro-cid-eeqph3mp${addAttribute(renderTransition($$result, "om5s262w", "", "button-submit"), "data-astro-transition-scope")}>
Save
<span data-astro-cid-eeqph3mp></span> </a></center> </form> </div> `;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/components/RemindersForm.astro", "self");

const $$Astro = createAstro();
const prerender = false;
const $$Remindes = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Remindes;
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Create Reminders" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<a href="/register"> ${renderComponent($$result2, "BackArrowIcon", $$BackArrowIcon, {})} </a> <h1>Reminders</h1> ${renderComponent($$result2, "LinksofCreate", $$LinksofCreate, {})} ${renderComponent($$result2, "RemindersForm", $$RemindersForm, {})} ` })}`;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/create/remindes.astro", void 0);

const $$file = "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/create/remindes.astro";
const $$url = "/create/remindes";

export { $$Remindes as default, $$file as file, prerender, $$url as url };
