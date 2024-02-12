import { c as createAstro, d as createComponent, r as renderTemplate, m as maybeRenderHead, e as addAttribute, f as renderComponent, j as renderTransition } from '../astro_bgnKWSTW.mjs';
import 'kleur/colors';
import 'html-escaper';
import { A as AccountRepotory, a as $$Layout } from './account_r5lQzPok.mjs';
import { $ as $$ListofAccounts } from './accounts_h88j9Kwq.mjs';
import 'clsx';
/* empty css                          */
/* empty css                          */
/* empty css                            */

class TrasactionRepotory {
  url = `${"http://localhost:8080"}/transaction`;
  config = {
    headers: {
      "content-Type": "application/json",
      Authorization: ""
    }
  };
  constructor(token) {
    this.config.headers.Authorization = `Bearer ${token}`;
  }
  async get(id) {
    const transactionUrl = id ? `${this.url}/${id}` : this.url;
    try {
      const response = await fetch(transactionUrl, this.config);
      const result = await response.json();
      return result;
    } catch (error) {
      return [];
    }
  }
  async create(transaction) {
    const options = {
      method: "POST",
      headers: {
        ...this.config.headers
      },
      body: JSON.stringify(transaction)
    };
    await fetch(this.url, options);
  }
  async delele(id) {
    const options = {
      method: "DELETE",
      headers: {
        ...this.config.headers
      }
    };
    fetch(`${this.url}/${id}`, options);
  }
}

const $$Astro$1 = createAstro();
const $$LastTransaction = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$LastTransaction;
  const token = Astro2.cookies.get("x-token")?.value;
  const accountRepository = new AccountRepotory(token);
  const accounts = await accountRepository.findAll();
  const transactionRepository = new TrasactionRepotory(token);
  let listOfTransaction = await transactionRepository.get();
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
  return renderTemplate`${maybeRenderHead()}<h1 data-astro-cid-4gqgu53s>Transactions</h1> <form method="POST" data-astro-cid-4gqgu53s> <select name="account" data-astro-cid-4gqgu53s> ${accounts && accounts.map((a) => renderTemplate`<option${addAttribute(a.AccountInfo.id, "value")} data-astro-cid-4gqgu53s> ${a.AccountInfo.bank}: ${a.AccountInfo.name} </option>`)} </select> <button type="submit" data-astro-cid-4gqgu53s>Filtrar</button> </form> <table data-astro-cid-4gqgu53s> <thead data-astro-cid-4gqgu53s> <tr data-astro-cid-4gqgu53s> <th data-astro-cid-4gqgu53s>Name</th> <th data-astro-cid-4gqgu53s>Description</th> <th data-astro-cid-4gqgu53s>Amount</th> <th data-astro-cid-4gqgu53s>Type Transaction</th> </tr> </thead> <tbody data-astro-cid-4gqgu53s> ${listOfTransaction && listOfTransaction.map((transaction) => renderTemplate`<tr data-astro-cid-4gqgu53s> <td data-astro-cid-4gqgu53s> ${transaction.name}</td> <td data-astro-cid-4gqgu53s>${transaction.description}</td> <td data-astro-cid-4gqgu53s>$${transaction.amount}</td> <td${addAttribute(
    transaction.type_transation == "bill" ? "expense" : "income",
    "class"
  )} data-astro-cid-4gqgu53s> ${transaction.type_transation} </td> </tr>`)} <!-- Agrega más filas según sea necesario --> </tbody> </table> `;
}, "/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/components/LastTransaction.astro", void 0);

const $$Astro = createAstro();
const prerender = false;
const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Index;
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Inicio", "data-astro-cid-j7pv25f6": true }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<main class="content-main" data-astro-cid-j7pv25f6> <section class="chart" data-astro-cid-j7pv25f6${addAttribute(renderTransition($$result2, "benpfmuv", "", "chart"), "data-astro-transition-scope")}> <h1 data-astro-cid-j7pv25f6> Charts Coming Soon...</h1> </section> <a href="/accounts" data-astro-cid-j7pv25f6> <section data-astro-cid-j7pv25f6${addAttribute(renderTransition($$result2, "czv44z6q", "", "accounts"), "data-astro-transition-scope")}> ${renderComponent($$result2, "ListofAccounts", $$ListofAccounts, { "data-astro-cid-j7pv25f6": true })} </section> </a> <a href="/transactions" data-astro-cid-j7pv25f6> <section data-astro-cid-j7pv25f6${addAttribute(renderTransition($$result2, "7ki7bcvh", "", "transaction"), "data-astro-transition-scope")}> ${renderComponent($$result2, "LastTransaction", $$LastTransaction, { "data-astro-cid-j7pv25f6": true })} </section> </a> <a href="/reminders" data-astro-cid-j7pv25f6> <section data-astro-cid-j7pv25f6${addAttribute(renderTransition($$result2, "mf7yhkup", "", "reminders"), "data-astro-transition-scope")}> <h1 data-astro-cid-j7pv25f6>Reminders Coming Soon</h1> <!-- <ListOfReminders/> --> </section> </a> </main> ` })} `;
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

export { $$LastTransaction as $, TrasactionRepotory as T, index as i };
