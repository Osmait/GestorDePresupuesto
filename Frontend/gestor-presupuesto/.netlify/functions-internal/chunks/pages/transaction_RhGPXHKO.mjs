import { c as createAstro, d as createComponent, r as renderTemplate, m as maybeRenderHead, e as addAttribute, j as renderTransition, f as renderComponent } from '../astro_bgnKWSTW.mjs';
import 'kleur/colors';
import 'html-escaper';
import 'clsx';
import { A as AccountRepotory, $ as $$BackArrowIcon, c as $$LinksofCreate, a as $$Layout } from './account_r5lQzPok.mjs';
import { T as TrasactionRepotory } from './index_DrG9yJrb.mjs';
/* empty css                                */
/* empty css                            */

const $$Astro$1 = createAstro();
const $$TransactionFrom = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$TransactionFrom;
  const token = Astro2.cookies.get("x-token")?.value;
  const accountRepository = new AccountRepotory(token);
  const accounts = await accountRepository.findAll();
  if (Astro2.request.method === "POST") {
    try {
      const data = await Astro2.request.formData();
      const name = data.get("name");
      const description = data.get("description");
      const amount = data.get("amount");
      const typeTransaction = data.get("type");
      const accountId = data.get("account");
      const transaction = {
        name,
        description,
        amount: Number(amount),
        type_transation: typeTransaction,
        account_id: accountId
      };
      const transactionRepository = new TrasactionRepotory(token);
      await transactionRepository.create(transaction);
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      }
    }
  }
  return renderTemplate`${maybeRenderHead()}<div class="login-box" data-astro-cid-bkmp7m4p> <form method="POST" data-astro-cid-bkmp7m4p> <div class="user-box" data-astro-cid-bkmp7m4p${addAttribute(renderTransition($$result, "ndzgpkmj", "", "name-label"), "data-astro-transition-scope")}> <input type="text" name="name" required="" data-astro-cid-bkmp7m4p> <label data-astro-cid-bkmp7m4p>Name</label> </div> <div class="user-box" data-astro-cid-bkmp7m4p${addAttribute(renderTransition($$result, "p4luzea2", "", "descrition-label"), "data-astro-transition-scope")}> <textarea name="description" required="" data-astro-cid-bkmp7m4p></textarea> <label data-astro-cid-bkmp7m4p>Description</label> </div> <div class="user-box" data-astro-cid-bkmp7m4p> <select name="type" data-astro-cid-bkmp7m4p> <option value="bill" data-astro-cid-bkmp7m4p>Bill</option> <option value="income" data-astro-cid-bkmp7m4p>Income</option> </select> </div> <div class="user-box" data-astro-cid-bkmp7m4p> <select name="account" data-astro-cid-bkmp7m4p> ${accounts && accounts.map((a) => renderTemplate`<option${addAttribute(a.AccountInfo.id, "value")} data-astro-cid-bkmp7m4p>${a.AccountInfo.bank}: ${a.AccountInfo.name}</option>`)} </select> </div> <div class="user-box" data-astro-cid-bkmp7m4p> <input type="text" name="amount" required="" data-astro-cid-bkmp7m4p> <label data-astro-cid-bkmp7m4p>Amount</label> </div><center data-astro-cid-bkmp7m4p> <button type="submit" data-astro-cid-bkmp7m4p${addAttribute(renderTransition($$result, "slphqihc", "", "button-submit"), "data-astro-transition-scope")}>
Save
<span data-astro-cid-bkmp7m4p></span> </button></center> </form> </div> `;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/components/transactionFrom.astro", "self");

const $$Astro = createAstro();
const prerender = false;
const $$Transaction = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Transaction;
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Create Transaction" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<a href="/register"> ${renderComponent($$result2, "BackArrowIcon", $$BackArrowIcon, {})} </a> <h1>Transaction</h1> ${renderComponent($$result2, "LinksofCreate", $$LinksofCreate, {})} ${renderComponent($$result2, "TransactionFrom", $$TransactionFrom, {})} ` })}`;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/create/transaction.astro", void 0);

const $$file = "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/create/transaction.astro";
const $$url = "/create/transaction";

export { $$Transaction as default, $$file as file, prerender, $$url as url };
