import * as adapter from '@astrojs/netlify/netlify-functions.js';
import { renderers } from './renderers.mjs';
import { manifest } from './manifest_Ze0rMhd8.mjs';

const _page0  = () => import('./chunks/generic_MV6oM2GJ.mjs');
const _page1  = () => import('./chunks/index_OvZzbAS_.mjs');
const _page2  = () => import('./chunks/transactions_8W8wD7mr.mjs');
const _page3  = () => import('./chunks/reminders_qK0nbrJQ.mjs');
const _page4  = () => import('./chunks/accounts_va-NzPTk.mjs');
const _page5  = () => import('./chunks/register_DdFEkMkr.mjs');
const _page6  = () => import('./chunks/charts_hi3LtlBC.mjs');
const _page7  = () => import('./chunks/transaction_vcgVYrCU.mjs');
const _page8  = () => import('./chunks/remindes_IA-XT9Yd.mjs');
const _page9  = () => import('./chunks/account_pTyR27Ht.mjs');const pageMap = new Map([["node_modules/astro/dist/assets/endpoint/generic.js", _page0],["src/pages/index.astro", _page1],["src/pages/transactions.astro", _page2],["src/pages/reminders.astro", _page3],["src/pages/accounts.astro", _page4],["src/pages/register.astro", _page5],["src/pages/charts.astro", _page6],["src/pages/create/transaction.astro", _page7],["src/pages/create/remindes.astro", _page8],["src/pages/create/account.astro", _page9]]);
const _manifest = Object.assign(manifest, {
	pageMap,
	renderers,
});
const _args = {};

const _exports = adapter.createExports(_manifest, _args);
const handler = _exports['handler'];

const _start = 'start';
if(_start in adapter) {
	adapter[_start](_manifest, _args);
}

export { handler, pageMap };
