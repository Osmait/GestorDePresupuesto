// Injected with page.addInitScript() before any app code runs.
// Collects paint/LCP/CLS/long tasks, React commits (through a minimal
// React DevTools hook, which production React also calls) and the moment a
// "data visible" marker appears. Everything lands on window.__perf.
;(() => {
  const perf = (window.__perf = {
    longTasks: [],
    lcp: 0,
    cls: 0,
    fcp: 0,
    commits: [],
    renders: {},
    markerAt: null,
    hydratedAt: null,
  })
  const cfg = window.__perfConfig || {}
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) perf.longTasks.push({ start: e.startTime, duration: e.duration })
    }).observe({ type: 'longtask', buffered: true })
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) perf.lcp = e.startTime
    }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) perf.cls += e.value
    }).observe({ type: 'layout-shift', buffered: true })
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') perf.fcp = e.startTime
    }).observe({ type: 'paint', buffered: true })
  } catch {}

  // --- React commit hook (works with production React) ---
  const FN_TAGS = new Set([0, 1, 11, 14, 15]) // Function, Class, ForwardRef, Memo, SimpleMemo
  const nameOf = (f) => {
    const t = f.elementType || f.type
    if (!t) return null
    if (typeof t === 'string') return null
    return t.displayName || t.name || (t.render && (t.render.displayName || t.render.name)) || (t.type && (t.type.displayName || t.type.name)) || 'Anonymous'
  }
  const walk = (fiber) => {
    // DFS over the part of the committed tree that React actually visited
    // (same idea as React DevTools): a subtree whose child pointer is shared
    // with the previous tree was skipped entirely. A component counts as
    // rendered when it mounted (no alternate) or has PerformedWork (flag 1).
    // selfBaseDuration is only populated by the profiling build (next build --profile).
    const stack = [fiber]
    let n = 0
    while (stack.length) {
      const f = stack.pop()
      if (FN_TAGS.has(f.tag) && (f.alternate === null || (f.flags & 1) === 1)) {
        const name = nameOf(f)
        if (name) {
          const r = (perf.renders[name] ??= { count: 0, mounts: 0, selfMs: 0 })
          r.count++
          if (f.alternate === null) r.mounts++
          if (typeof f.selfBaseDuration === 'number') r.selfMs += f.selfBaseDuration
          n++
        }
      }
      if (f.alternate && f.child === f.alternate.child) continue
      for (let c = f.child; c; c = c.sibling) stack.push(c)
    }
    return n
  }
  const hook = {
    supportsFiber: true,
    renderers: new Map(),
    inject(renderer) {
      const id = this.renderers.size + 1
      this.renderers.set(id, renderer)
      return id
    },
    onScheduleFiberRoot() {},
    onCommitFiberRoot(_id, root) {
      const now = performance.now()
      if (perf.hydratedAt === null) perf.hydratedAt = now
      let rendered = 0
      if (cfg.countRenders) {
        try {
          rendered = walk(root.current)
        } catch {}
      }
      perf.commits.push({ at: now, rendered })
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
    isDisabled: false,
  }
  try {
    Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', { value: hook, configurable: true })
  } catch {}

  // --- data-visible marker ---
  const m = cfg.marker
  if (m) {
    const re = m.text ? new RegExp(m.text, m.flags || '') : null
    const check = () => {
      if (perf.markerAt !== null) return true
      let ok = false
      if (m.selector) ok = !!document.querySelector(m.selector)
      else if (re && document.body) ok = re.test(document.body.innerText || '')
      if (ok) perf.markerAt = performance.now()
      return ok
    }
    const start = () => {
      if (check()) return
      // innerText is expensive on big DOMs: check at most once per frame.
      let scheduled = false
      const mo = new MutationObserver(() => {
        if (scheduled) return
        scheduled = true
        requestAnimationFrame(() => {
          scheduled = false
          if (check()) mo.disconnect()
        })
      })
      mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true })
    }
    if (document.documentElement) start()
    else document.addEventListener('DOMContentLoaded', start)
  }
})()
