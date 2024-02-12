import 'html-escaper';
import { c as createAstro, d as createComponent, r as renderTemplate, m as maybeRenderHead, e as addAttribute, f as renderComponent, g as renderHead, h as createTransitionScope, i as renderSlot, j as renderTransition } from '../astro_bgnKWSTW.mjs';
import 'kleur/colors';
import 'clsx';
/* empty css                             */
/* empty css                             */
/* empty css                            */
/* empty css                            */
/* empty css                            */

const $$Astro$9 = createAstro();
const $$HomeIcon = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$9, $$props, $$slots);
  Astro2.self = $$HomeIcon;
  return renderTemplate`${maybeRenderHead()}<div> <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-home" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M5 12l-2 0l9 -9l9 9l-2 0"></path><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7"></path><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6"></path></svg> </div>`;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/components/HomeIcon.astro", void 0);

const $$Astro$8 = createAstro();
const $$Add = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$8, $$props, $$slots);
  Astro2.self = $$Add;
  return renderTemplate`${maybeRenderHead()}<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-pencil-plus" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"></path><path d="M13.5 6.5l4 4"></path><path d="M16 19h6"></path><path d="M19 16v6"></path></svg>`;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/components/Add.astro", void 0);

const $$Astro$7 = createAstro();
const $$Wallet = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$7, $$props, $$slots);
  Astro2.self = $$Wallet;
  return renderTemplate`${maybeRenderHead()}<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-wallet" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1 -1 1h-12a2 2 0 0 1 -2 -2v-12"></path><path d="M20 12v4h-4a2 2 0 0 1 0 -4h4"></path></svg>`;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/components/Wallet.astro", void 0);

const $$Astro$6 = createAstro();
const $$AccountIcon = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$6, $$props, $$slots);
  Astro2.self = $$AccountIcon;
  return renderTemplate`${maybeRenderHead()}<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-building-bank" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M3 21l18 0"></path><path d="M3 10l18 0"></path><path d="M5 6l7 -3l7 3"></path><path d="M4 10l0 11"></path><path d="M20 10l0 11"></path><path d="M8 14l0 3"></path><path d="M12 14l0 3"></path><path d="M16 14l0 3"></path></svg>`;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/components/AccountIcon.astro", void 0);

const $$Astro$5 = createAstro();
const $$ViewTransitions = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$5, $$props, $$slots);
  Astro2.self = $$ViewTransitions;
  const { fallback = "animate" } = Astro2.props;
  return renderTemplate`<meta name="astro-view-transitions-enabled" content="true"><meta name="astro-view-transitions-fallback"${addAttribute(fallback, "content")}>`;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/node_modules/astro/components/ViewTransitions.astro", void 0);

const $$Astro$4 = createAstro();
const $$Layout = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$4, $$props, $$slots);
  Astro2.self = $$Layout;
  const { title } = Astro2.props;
  return renderTemplate`<html lang="en"> <head><meta charset="UTF-8"><meta name="description" content="Astro description"><meta name="viewport" content="width=device-width"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><meta name="generator"${addAttribute(Astro2.generator, "content")}><title>${title}</title>${renderComponent($$result, "ViewTransitions", $$ViewTransitions, {})}${renderHead()}</head> <body id="body-WallPaper" class="container-body"> <div> <div class="nav-bar-animation"${addAttribute(createTransitionScope($$result, "mljbisf2"), "data-astro-transition-persist")}> <nav class="nav-bar"> <div class="icons-up"> <a href="/" class="nav-bar_link"> ${renderComponent($$result, "HomeIcon", $$HomeIcon, {})} </a> <a data-testid="register" href="/register" class="nav-bar_link"> ${renderComponent($$result, "Add", $$Add, {})} </a> <a data-testid="accounts" href="/accounts" class="nav-bar_link"> ${renderComponent($$result, "AccountIcons", $$AccountIcon, {})} </a> <a data-testid="transactions" href="/transactions" class="nav-bar_link"> ${renderComponent($$result, "Wallet", $$Wallet, {})} </a> <!-- <a href="/reminders"> --> <!--   <RemindersIcon/> --> <!----> <!-- </a> --> <!-- <a href="/charts"class="nav-bar_link"> --> <!--    <ChartIcon/> --> <!-- </a> --> </div> <!--           <div class="icons-down"> --> <!-- <SettingsIcon/> --> <!--           </div> --> </nav> </div> </div> <main class="container"> ${renderSlot($$result, $$slots["default"])} </main> </body></html>`;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/layouts/Layout.astro", "self");

class AccountRepotory {
  url = `${"http://localhost:8080"}/account`;
  config = {
    headers: {
      "content-Type": "application/json",
      Authorization: ""
    }
  };
  constructor(token) {
    this.config.headers.Authorization = `Bearer ${token}`;
  }
  async findAll() {
    try {
      const response = await fetch(this.url, this.config);
      const result = await response.json();
      return result;
    } catch (error) {
      return [];
    }
  }
  async create(account) {
    const options = {
      method: "POST",
      headers: {
        ...this.config.headers
      },
      body: JSON.stringify(account)
    };
    fetch(this.url, options);
  }
  async delete(accountId) {
    const options = {
      method: "DELETE",
      headers: {
        ...this.config.headers
      }
    };
    fetch(`${this.url}/${accountId}`, options);
  }
}

const $$Astro$3 = createAstro();
const $$BackArrowIcon = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$3, $$props, $$slots);
  Astro2.self = $$BackArrowIcon;
  return renderTemplate`${maybeRenderHead()}<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-arrow-left" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M5 12l14 0"></path><path d="M5 12l6 6"></path><path d="M5 12l6 -6"></path></svg>`;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/components/BackArrowIcon.astro", void 0);

const $$Astro$2 = createAstro();
const $$LinksofCreate = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$2, $$props, $$slots);
  Astro2.self = $$LinksofCreate;
  return renderTemplate`${maybeRenderHead()}<section class="login-box" data-astro-cid-cjlbecsr> <!-- <a href="/create/remindes"> Remindes</a> --> <!----> <!--      <span></span> --> <a href="/create/transaction" data-astro-cid-cjlbecsr>Transaction</a> <span data-astro-cid-cjlbecsr></span> <a href="/create/account" data-astro-cid-cjlbecsr>Account</a> <span data-astro-cid-cjlbecsr></span> <a href="" data-astro-cid-cjlbecsr></a> <span data-astro-cid-cjlbecsr></span> </section> `;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/components/LinksofCreate.astro", void 0);

const $$Astro$1 = createAstro();
const $$AccountFrom = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$AccountFrom;
  const token = Astro2.cookies.get("x-token")?.value;
  const accountRepository = new AccountRepotory(token);
  if (Astro2.request.method === "POST") {
    try {
      const data = await Astro2.request.formData();
      const name = data.get("name");
      const bank = data.get("bank");
      const initialBalance = data.get("balance");
      const account = {
        name,
        bank,
        initialBalance: Number(initialBalance)
      };
      await accountRepository.create(account);
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      }
    }
  }
  return renderTemplate`${maybeRenderHead()}<div class="login-box" data-astro-cid-vbj7ne7a> <form method="POST" data-astro-cid-vbj7ne7a> <div class="user-box" data-astro-cid-vbj7ne7a${addAttribute(renderTransition($$result, "vewiadvn", "", "name-label"), "data-astro-transition-scope")}> <input type="text" name="name" required="" data-astro-cid-vbj7ne7a> <label data-astro-cid-vbj7ne7a>Name</label> </div> <div class="user-box" data-astro-cid-vbj7ne7a> <input type="text" name="bank" required="" data-astro-cid-vbj7ne7a> <label data-astro-cid-vbj7ne7a>Bank</label> </div> <div class="user-box" data-astro-cid-vbj7ne7a> <input type="text" name="balance" required="" data-astro-cid-vbj7ne7a> <label data-astro-cid-vbj7ne7a>Initial Balance</label> </div> <center data-astro-cid-vbj7ne7a> <button type="submit" data-astro-cid-vbj7ne7a${addAttribute(renderTransition($$result, "zygx5fym", "", "button-submit"), "data-astro-transition-scope")}>
Save
<span data-astro-cid-vbj7ne7a></span> </button></center> </form> </div> `;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/components/AccountFrom.astro", "self");

const $$Astro = createAstro();
const prerender = false;
const $$Account = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Account;
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Create Account" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<a href="/register"> ${renderComponent($$result2, "BackArrowIcon", $$BackArrowIcon, {})} </a> <h1>Account</h1> ${renderComponent($$result2, "LinksofCreate", $$LinksofCreate, {})} ${renderComponent($$result2, "AccountFrom", $$AccountFrom, {})} ` })}`;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/create/account.astro", void 0);

const $$file = "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/create/account.astro";
const $$url = "/create/account";

const account = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	default: $$Account,
	file: $$file,
	prerender,
	url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

export { $$BackArrowIcon as $, AccountRepotory as A, $$Layout as a, $$ViewTransitions as b, $$LinksofCreate as c, account as d };
