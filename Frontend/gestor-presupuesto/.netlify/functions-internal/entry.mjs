import * as adapter from '@astrojs/netlify/netlify-functions.js';
import { renderers } from './renderers.mjs';
import { manifest } from './manifest_rN--8LQ9.mjs';

const _page0  = () => import('./chunks/generic_XEXlwnx5.mjs');
const _page1  = () => import('./chunks/index_dA3F1gEJ.mjs');
const _page2  = () => import('./chunks/transactions__7tYn7Go.mjs');
const _page3  = () => import('./chunks/reminders_6Q9OSOef.mjs');
const _page4  = () => import('./chunks/accounts_AkR-Z12E.mjs');
const _page5  = () => import('./chunks/register_6LWp1sZ6.mjs');
const _page6  = () => import('./chunks/charts_Kz9xylP4.mjs');
const _page7  = () => import('./chunks/transaction_lXf_HgOO.mjs');
const _page8  = () => import('./chunks/remindes_cVH0gckF.mjs');
const _page9  = () => import('./chunks/account_JFo74QYn.mjs');
const _page10  = () => import('./chunks/login_koF2upCv.mjs');const pageMap = new Map([["node_modules/astro/dist/assets/endpoint/generic.js", _page0],["src/pages/index.astro", _page1],["src/pages/transactions.astro", _page2],["src/pages/reminders.astro", _page3],["src/pages/accounts.astro", _page4],["src/pages/register.astro", _page5],["src/pages/charts.astro", _page6],["src/pages/create/transaction.astro", _page7],["src/pages/create/remindes.astro", _page8],["src/pages/create/account.astro", _page9],["src/pages/login.astro", _page10]]);
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
