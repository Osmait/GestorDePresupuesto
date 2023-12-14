import { e as createAstro, f as createComponent, r as renderTemplate, m as maybeRenderHead, g as addAttribute, h as renderComponent, l as renderTransition } from '../astro_6xIUeTXJ.mjs';
import 'kleur/colors';
import 'html-escaper';
import { A as AccountRepotory, a as $$Layout } from './account_qMjU1P5s.mjs';
import 'clsx';
/* empty css                          */
import { $ as $$ListofAccounts } from './accounts_9ZazTy6A.mjs';
/* empty css                          */
/* empty css                          */
/* empty css                            */

const $$Astro$2 = createAstro();
const $$ListOfReminders = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$2, $$props, $$slots);
  Astro2.self = $$ListOfReminders;
  return renderTemplate`${maybeRenderHead()}<h2 data-astro-cid-gui4j4yi>Reminders</h2> <div class="content-reminders" data-astro-cid-gui4j4yi> <div data-astro-cid-gui4j4yi> <h3 data-astro-cid-gui4j4yi>Name</h3> <p data-astro-cid-gui4j4yi>Description</p> <p data-astro-cid-gui4j4yi>Date</p> </div> <div data-astro-cid-gui4j4yi> <h3 data-astro-cid-gui4j4yi>Name</h3> <p data-astro-cid-gui4j4yi>Description</p> <p data-astro-cid-gui4j4yi>Date</p> </div> <div data-astro-cid-gui4j4yi></div> </div>`;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/components/ListOfReminders.astro", void 0);

class TrasactionRepotory {
  url = `${"http://localhost:8080"}/transaction`;
  headers = {
    "Content-Type": "application/json"
  };
  async get(id) {
    const response = await fetch(`${this.url}/${id}`, this.headers);
    const result = await response.json();
    return result;
  }
  async create(transaction) {
    const options = {
      method: "POST",
      headers: {
        ...this.headers
      },
      body: JSON.stringify(transaction)
    };
    console.log(options);
    const response = await fetch(this.url, options);
    console.log(response);
  }
  async delele(id) {
    const options = {
      method: "DELETE",
      headers: {
        ...this.headers
      }
    };
    fetch(`${this.url}/${id}`, options);
  }
}

const $$Astro$1 = createAstro();
const $$LastTransaction = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$LastTransaction;
  const accountRepository = new AccountRepotory();
  const accounts = await accountRepository.findAll();
  const transactionRepository = new TrasactionRepotory();
  let listOfTransaction = await transactionRepository.get("2ThgyKvy3k6Y9lrCbebLkRsDfcA");
  if (Astro2.request.method === "POST") {
    try {
      const data = await Astro2.request.formData();
      const id = data.get("account");
      listOfTransaction = await transactionRepository.get(id);
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      }
    }
  }
  return renderTemplate`${maybeRenderHead()}<h1 data-astro-cid-4gqgu53s>Transactions</h1> <form method="POST" data-astro-cid-4gqgu53s> <select name="account" data-astro-cid-4gqgu53s> ${accounts.map((a) => renderTemplate`<option${addAttribute(a.AccountInfo.id, "value")} data-astro-cid-4gqgu53s> ${a.AccountInfo.bank}: ${a.AccountInfo.name} </option>`)} </select> <button type="submit" data-astro-cid-4gqgu53s>Filtrar</button> </form> <table data-astro-cid-4gqgu53s> <thead data-astro-cid-4gqgu53s> <tr data-astro-cid-4gqgu53s> <th data-astro-cid-4gqgu53s>Name</th> <th data-astro-cid-4gqgu53s>Description</th> <th data-astro-cid-4gqgu53s>Amount</th> <th data-astro-cid-4gqgu53s>Type Transaction</th> </tr> </thead> <tbody data-astro-cid-4gqgu53s> ${listOfTransaction && listOfTransaction.map((transaction) => renderTemplate`<tr data-astro-cid-4gqgu53s> <td data-astro-cid-4gqgu53s> ${transaction.name}</td> <td data-astro-cid-4gqgu53s>${transaction.description}</td> <td data-astro-cid-4gqgu53s>$${transaction.amount}</td> <td${addAttribute(
    transaction.type_transation == "bill" ? "expense" : "income",
    "class"
  )} data-astro-cid-4gqgu53s> ${transaction.type_transation} </td> </tr>`)} <!-- Agrega más filas según sea necesario --> </tbody> </table> `;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/components/LastTransaction.astro", void 0);

const $$Astro = createAstro();
const prerender = false;
const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Index;
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Inicio", "data-astro-cid-j7pv25f6": true }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<main class="content-main" data-astro-cid-j7pv25f6> <section class="chart" data-astro-cid-j7pv25f6${addAttribute(renderTransition($$result2, "benpfmuv", "", "chart"), "data-astro-transition-scope")}></section> <a href="/accounts" data-astro-cid-j7pv25f6> <section data-astro-cid-j7pv25f6${addAttribute(renderTransition($$result2, "4xnpz4kg", "", "accounts"), "data-astro-transition-scope")}> ${renderComponent($$result2, "ListofAccounts", $$ListofAccounts, { "data-astro-cid-j7pv25f6": true })} </section> </a> <a href="/transactions" data-astro-cid-j7pv25f6> <section data-astro-cid-j7pv25f6${addAttribute(renderTransition($$result2, "doyjmnof", "", "transaction"), "data-astro-transition-scope")}> ${renderComponent($$result2, "LastTransaction", $$LastTransaction, { "data-astro-cid-j7pv25f6": true })} </section> </a> <a href="/reminders" data-astro-cid-j7pv25f6> <section data-astro-cid-j7pv25f6${addAttribute(renderTransition($$result2, "5bsqwlbb", "", "reminders"), "data-astro-transition-scope")}> ${renderComponent($$result2, "ListOfReminders", $$ListOfReminders, { "data-astro-cid-j7pv25f6": true })} </section> </a> </main> ` })} `;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/index.astro", "self");

const $$file = "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/index.astro";
const $$url = "";

const index = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

export { $$ListOfReminders as $, TrasactionRepotory as T, $$LastTransaction as a, index as i };
