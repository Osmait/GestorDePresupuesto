#!/usr/bin/env python3
"""Aggregate k6 ladder results into markdown tables.

    python3 aggregate.py <results-dir>/k6 [versions=branch,main] > tables.md

For every endpoint x version it reports, over all runs (r1..rN):
  * the "moderate load" step (50 req/s; dashboard and login: 10/s; mixed:
    100/s): median p50/p95/p99, achieved RPS and error rate, with the
    min-max spread of p95 across runs;
  * max sustainable RPS (highest ladder step with p95 < 300 ms, errors < 1%
    and achieved >= 95% of target): median and min-max across runs;
  * the delta of branch vs main for p95 and max RPS.
"""
import glob
import json
import os
import statistics
import sys
from collections import defaultdict

MODERATE = {"dashboard": 10, "login": 10, "mixed": 100, "cc_payment": 10}


def med(xs):
    xs = [x for x in xs if x is not None]
    return statistics.median(xs) if xs else None


def fmt(x, nd=1):
    if x is None:
        return "-"
    if isinstance(x, float) and x.is_integer() and nd == 0:
        return str(int(x))
    return f"{x:.{nd}f}"


def rng(xs, nd=1):
    xs = [x for x in xs if x is not None]
    if not xs:
        return "-"
    return f"{fmt(min(xs), nd)}–{fmt(max(xs), nd)}"


def load(d):
    runs = defaultdict(list)  # (ep, version) -> [json]
    for f in sorted(glob.glob(os.path.join(d, "*-r*.json"))):
        base = os.path.basename(f)[:-5]
        ep_ver, _, run = base.rpartition("-r")
        ep, _, ver = ep_ver.rpartition("-")
        with open(f) as fh:
            runs[(ep, ver)].append(json.load(fh))
    return runs


def step_at(js, rate):
    for s in js["steps"]:
        if s["target_rps"] == rate:
            return s
    return None


def main():
    d = sys.argv[1]
    versions = (sys.argv[2] if len(sys.argv) > 2 else "branch,main").split(",")
    runs = load(d)
    eps = []
    for ep, _ in runs:
        if ep not in eps:
            eps.append(ep)
    order = ["accounts", "budgets", "dash_summary", "tx_recent", "tx_list_name", "analytics_cat_1y",
             "analytics_summary_1y", "analytics_monthly", "dashboard", "login", "refresh", "create_tx",
             "cc_payment", "mixed"]
    eps.sort(key=lambda e: order.index(e) if e in order else 99)

    print("### Moderate load (fixed arrival rate) — medians over runs\n")
    print("| endpoint | rate | version | runs | p50 ms | p95 ms (spread) | p99 ms | achieved RPS | errors |")
    print("|---|---:|---|---:|---:|---:|---:|---:|---:|")
    summary = {}
    for ep in eps:
        rate = MODERATE.get(ep, 50)
        for v in versions:
            js = runs.get((ep, v), [])
            st = [step_at(j, rate) for j in js]
            st = [s for s in st if s]
            if not st:
                continue
            p50 = med([s["p50"] for s in st]); p95 = med([s["p95"] for s in st]); p99 = med([s["p99"] for s in st])
            ach = med([s["achieved_rps"] for s in st]); err = med([s["error_rate"] for s in st])
            summary.setdefault(ep, {})[v] = {"p95": p95, "p50": p50}
            print(f"| {ep} | {rate} | {v} | {len(st)} | {fmt(p50)} | {fmt(p95)} ({rng([s['p95'] for s in st])}) | "
                  f"{fmt(p99)} | {fmt(ach)} | {fmt(100 * err if err is not None else None, 2)}% |")

    print("\n### Max sustainable RPS (p95 < 300 ms, errors < 1%, achieved >= 95% of target)\n")
    print("| endpoint | version | runs | median max RPS | spread | first failing step (median) | p95 at max step (median) |")
    print("|---|---|---:|---:|---:|---:|---:|")
    for ep in eps:
        for v in versions:
            js = runs.get((ep, v), [])
            if not js:
                continue
            mx = [j["max_sustainable_rps"] for j in js]
            ff = [j.get("first_fail_rps") for j in js]
            p95max = [step_at(j, j["max_sustainable_rps"])["p95"] if step_at(j, j["max_sustainable_rps"]) else None for j in js]
            summary.setdefault(ep, {}).setdefault(v, {})["max"] = med(mx)
            print(f"| {ep} | {v} | {len(js)} | {fmt(med(mx), 0)} | {rng(mx, 0)} | {fmt(med(ff), 0)} | {fmt(med(p95max))} |")

    if len(versions) == 2:
        a, b = versions
        print(f"\n### {a} vs {b} (positive = {a} slower / lower capacity)\n")
        print(f"| endpoint | p50 Δ% | p95 Δ% at moderate load | max RPS {a} | max RPS {b} | max RPS Δ% |")
        print("|---|---:|---:|---:|---:|---:|")
        for ep in eps:
            s = summary.get(ep, {})
            if a not in s or b not in s:
                continue
            def pct(x, y):
                return None if (x is None or not y) else 100.0 * (x - y) / y
            p50d = pct(s[a].get("p50"), s[b].get("p50"))
            p95d = pct(s[a].get("p95"), s[b].get("p95"))
            mxd = pct(s[a].get("max"), s[b].get("max"))
            print(f"| {ep} | {fmt(p50d)} | {fmt(p95d)} | {fmt(s[a].get('max'), 0)} | {fmt(s[b].get('max'), 0)} | "
                  f"{fmt(-mxd if mxd is not None else None)} |")

    # mixed per-op breakdown
    for v in versions:
        js = runs.get(("mixed", v), [])
        if not js:
            continue
        for rate in (100, 400):
            ops = defaultdict(lambda: defaultdict(list))
            for j in js:
                s = step_at(j, rate)
                if not s or "ops" not in s:
                    continue
                for op, o in s["ops"].items():
                    for k in ("p50", "p95", "p99", "error_rate", "count"):
                        ops[op][k].append(o.get(k))
            if not ops:
                continue
            print(f"\n### mixed workload per operation — {v} @ {rate} req/s (medians over {len(js)} runs)\n")
            print("| op | count/run | p50 ms | p95 ms | p99 ms | errors |")
            print("|---|---:|---:|---:|---:|---:|")
            for op, o in ops.items():
                e = med(o["error_rate"])
                print(f"| {op} | {fmt(med(o['count']), 0)} | {fmt(med(o['p50']))} | {fmt(med(o['p95']))} | {fmt(med(o['p99']))} | "
                      f"{fmt(100 * e if e is not None else None, 2)}% |")

    tsv = os.path.join(d, "runs.tsv")
    if os.path.exists(tsv):
        loads = [float(l.split("\t")[5].split()[0]) for l in open(tsv) if "HANG" not in l and len(l.split("\t")) > 5]
        hangs = [l.strip() for l in open(tsv) if "HANG" in l]
        print(f"\nRuns: {len(loads)}; host load average (1m) at run start: median {fmt(med(loads), 2)}, "
              f"range {rng(loads, 2)} on {open(tsv).readline().split(chr(9))[4]} CPUs.")
        if hangs:
            print("\nWedged backends (restarted):\n")
            for h in hangs:
                print(f"- {h}")


if __name__ == "__main__":
    main()
