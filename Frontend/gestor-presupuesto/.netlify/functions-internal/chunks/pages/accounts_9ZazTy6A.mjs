import { e as createAstro, f as createComponent, r as renderTemplate, m as maybeRenderHead, h as renderComponent, g as addAttribute, l as renderTransition } from '../astro_6xIUeTXJ.mjs';
import 'kleur/colors';
import 'html-escaper';
import { A as AccountRepotory, $ as $$BackArrowIcon, a as $$Layout } from './account_qMjU1P5s.mjs';
import 'clsx';
/* empty css                             */
/* empty css                            */

const $$Astro$1 = createAstro();
const $$ListofAccounts = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$ListofAccounts;
  const accountRepository = new AccountRepotory();
  const accounts = await accountRepository.findAll();
  return renderTemplate`${maybeRenderHead()}<section data-astro-cid-ercfeevt> <h1 data-astro-cid-ercfeevt>Accounts</h1> <table data-astro-cid-ercfeevt> <thead data-astro-cid-ercfeevt> <tr data-astro-cid-ercfeevt> <th data-astro-cid-ercfeevt>Name</th> <th data-astro-cid-ercfeevt>Bank</th> <th data-astro-cid-ercfeevt>CurrentBalance</th> </tr> </thead> <tbody data-astro-cid-ercfeevt> ${accounts.map((a) => renderTemplate`<tr data-astro-cid-ercfeevt> <td data-astro-cid-ercfeevt>${a.AccountInfo.name}</td> <td data-astro-cid-ercfeevt>${a.AccountInfo.bank}</td> <td data-astro-cid-ercfeevt>${a.CurrentBalance}</td> </tr>`)} </tbody> </table> </section> `;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/components/ListofAccounts.astro", void 0);

const $$Astro = createAstro();
const prerender = false;
const $$Accounts = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Accounts;
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Accounts" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<a href="/"> ${renderComponent($$result2, "BackArrowIcon", $$BackArrowIcon, {})} </a> <section${addAttribute(renderTransition($$result2, "ic2uvpj7", "", "accounts"), "data-astro-transition-scope")}> ${renderComponent($$result2, "ListofAccounts", $$ListofAccounts, { "data-astro-transition-scope": renderTransition($$result2, "fpivjtza", "", "accounts") })} </section> ` })}`;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/accounts.astro", "self");

const $$file = "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/accounts.astro";
const $$url = "/accounts";

const accounts = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Accounts,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

export { $$ListofAccounts as $, accounts as a };
