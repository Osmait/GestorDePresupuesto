import '@astrojs/internal-helpers/path';
import 'cookie';
import 'kleur/colors';
import 'string-width';
import 'html-escaper';
import 'clsx';
import './chunks/astro_qutKXqfs.mjs';
import { compile } from 'path-to-regexp';

if (typeof process !== "undefined") {
  let proc = process;
  if ("argv" in proc && Array.isArray(proc.argv)) {
    if (proc.argv.includes("--verbose")) ; else if (proc.argv.includes("--silent")) ; else ;
  }
}

function getRouteGenerator(segments, addTrailingSlash) {
  const template = segments.map((segment) => {
    return "/" + segment.map((part) => {
      if (part.spread) {
        return `:${part.content.slice(3)}(.*)?`;
      } else if (part.dynamic) {
        return `:${part.content}`;
      } else {
        return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
    }).join("");
  }).join("");
  let trailing = "";
  if (addTrailingSlash === "always" && segments.length) {
    trailing = "/";
  }
  const toPath = compile(template + trailing);
  return toPath;
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments,
    prerender: rawRouteData.prerender,
    redirect: rawRouteData.redirect,
    redirectRoute: rawRouteData.redirectRoute ? deserializeRouteData(rawRouteData.redirectRoute) : void 0,
    fallbackRoutes: rawRouteData.fallbackRoutes.map((fallback) => {
      return deserializeRouteData(fallback);
    })
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  const componentMetadata = new Map(serializedManifest.componentMetadata);
  const clientDirectives = new Map(serializedManifest.clientDirectives);
  return {
    ...serializedManifest,
    assets,
    componentMetadata,
    clientDirectives,
    routes
  };
}

const manifest = deserializeManifest({"adapterName":"@astrojs/netlify/functions","routes":[{"file":"index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/","type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"transactions/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/transactions","type":"page","pattern":"^\\/transactions\\/?$","segments":[[{"content":"transactions","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/transactions.astro","pathname":"/transactions","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"reminders/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/reminders","type":"page","pattern":"^\\/reminders\\/?$","segments":[[{"content":"reminders","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/reminders.astro","pathname":"/reminders","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"accounts/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/accounts","type":"page","pattern":"^\\/accounts\\/?$","segments":[[{"content":"accounts","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/accounts.astro","pathname":"/accounts","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"register/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/register","type":"page","pattern":"^\\/register\\/?$","segments":[[{"content":"register","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/register.astro","pathname":"/register","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"charts/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/charts","type":"page","pattern":"^\\/charts\\/?$","segments":[[{"content":"charts","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/charts.astro","pathname":"/charts","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"create/transaction/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/create/transaction","type":"page","pattern":"^\\/create\\/transaction\\/?$","segments":[[{"content":"create","dynamic":false,"spread":false}],[{"content":"transaction","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/create/transaction.astro","pathname":"/create/transaction","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"create/remindes/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/create/remindes","type":"page","pattern":"^\\/create\\/remindes\\/?$","segments":[[{"content":"create","dynamic":false,"spread":false}],[{"content":"remindes","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/create/remindes.astro","pathname":"/create/remindes","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"create/account/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/create/account","type":"page","pattern":"^\\/create\\/account\\/?$","segments":[[{"content":"create","dynamic":false,"spread":false}],[{"content":"account","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/create/account.astro","pathname":"/create/account","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"endpoint","route":"/_image","pattern":"^\\/_image$","segments":[[{"content":"_image","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/astro/dist/assets/endpoint/generic.js","pathname":"/_image","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}}],"base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/accounts.astro",{"propagation":"in-tree","containsHead":true}],["/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/charts.astro",{"propagation":"in-tree","containsHead":true}],["/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/create/account.astro",{"propagation":"in-tree","containsHead":true}],["/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/create/remindes.astro",{"propagation":"in-tree","containsHead":true}],["/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/create/transaction.astro",{"propagation":"in-tree","containsHead":true}],["/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/index.astro",{"propagation":"in-tree","containsHead":true}],["/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/register.astro",{"propagation":"in-tree","containsHead":true}],["/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/reminders.astro",{"propagation":"in-tree","containsHead":true}],["/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/pages/transactions.astro",{"propagation":"in-tree","containsHead":true}],["/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/layouts/Layout.astro",{"propagation":"in-tree","containsHead":false}],["\u0000@astro-page:src/pages/accounts@_@astro",{"propagation":"in-tree","containsHead":false}],["\u0000@astrojs-ssr-virtual-entry",{"propagation":"in-tree","containsHead":false}],["\u0000@astro-page:src/pages/charts@_@astro",{"propagation":"in-tree","containsHead":false}],["\u0000@astro-page:src/pages/create/account@_@astro",{"propagation":"in-tree","containsHead":false}],["\u0000@astro-page:src/pages/create/remindes@_@astro",{"propagation":"in-tree","containsHead":false}],["\u0000@astro-page:src/pages/create/transaction@_@astro",{"propagation":"in-tree","containsHead":false}],["\u0000@astro-page:src/pages/index@_@astro",{"propagation":"in-tree","containsHead":false}],["\u0000@astro-page:src/pages/register@_@astro",{"propagation":"in-tree","containsHead":false}],["\u0000@astro-page:src/pages/reminders@_@astro",{"propagation":"in-tree","containsHead":false}],["\u0000@astro-page:src/pages/transactions@_@astro",{"propagation":"in-tree","containsHead":false}],["/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/components/transactionFrom.astro",{"propagation":"in-tree","containsHead":false}],["/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/components/RemindersForm.astro",{"propagation":"in-tree","containsHead":false}],["/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/src/components/AccountFrom.astro",{"propagation":"in-tree","containsHead":false}]],"renderers":[],"clientDirectives":[["idle","(()=>{var i=t=>{let e=async()=>{await(await t())()};\"requestIdleCallback\"in window?window.requestIdleCallback(e):setTimeout(e,200)};(self.Astro||(self.Astro={})).idle=i;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var s=(i,t)=>{let a=async()=>{await(await i())()};if(t.value){let e=matchMedia(t.value);e.matches?a():e.addEventListener(\"change\",a,{once:!0})}};(self.Astro||(self.Astro={})).media=s;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var r=(i,c,s)=>{let n=async()=>{await(await i())()},t=new IntersectionObserver(e=>{for(let o of e)if(o.isIntersecting){t.disconnect(),n();break}});for(let e of s.children)t.observe(e)};(self.Astro||(self.Astro={})).visible=r;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000@astrojs-ssr-virtual-entry":"entry.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000empty-middleware":"_empty-middleware.mjs","/node_modules/astro/dist/assets/endpoint/generic.js":"chunks/pages/generic_Enk22OdP.mjs","\u0000@astrojs-manifest":"manifest_ZmIFHsS2.mjs","/home/osmait/ProgramingFiles/WorkSpace/GestorDePresupuesto/Frontend/gestor-presupuesto/node_modules/@astrojs/react/vnode-children.js":"chunks/vnode-children_3wEZly-Z.mjs","\u0000@astro-page:node_modules/astro/dist/assets/endpoint/generic@_@js":"chunks/generic_YuY5Y38I.mjs","\u0000@astro-page:src/pages/index@_@astro":"chunks/index_DcA4U964.mjs","\u0000@astro-page:src/pages/transactions@_@astro":"chunks/transactions_cOrgBu9h.mjs","\u0000@astro-page:src/pages/reminders@_@astro":"chunks/reminders_Dm-wmM_P.mjs","\u0000@astro-page:src/pages/accounts@_@astro":"chunks/accounts_zhnfvJo_.mjs","\u0000@astro-page:src/pages/register@_@astro":"chunks/register_jTtClh2L.mjs","\u0000@astro-page:src/pages/charts@_@astro":"chunks/charts_QB9C-p_N.mjs","\u0000@astro-page:src/pages/create/transaction@_@astro":"chunks/transaction_kHS1Ip2q.mjs","\u0000@astro-page:src/pages/create/remindes@_@astro":"chunks/remindes_P8T4mdqF.mjs","\u0000@astro-page:src/pages/create/account@_@astro":"chunks/account_SUZ0HXBh.mjs","/astro/hoisted.js?q=0":"_astro/hoisted.rfglzoOR.js","@astrojs/react/client.js":"_astro/client.gSoe9Upx.js","astro:scripts/before-hydration.js":""},"assets":["/favicon.svg","/_astro/client.gSoe9Upx.js","/_astro/hoisted.rfglzoOR.js","/index.html","/transactions/index.html","/reminders/index.html","/accounts/index.html","/register/index.html","/charts/index.html","/create/transaction/index.html","/create/remindes/index.html","/create/account/index.html"]});

export { manifest };
