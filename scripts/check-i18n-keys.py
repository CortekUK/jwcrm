#!/usr/bin/env python3
"""Find broken i18n keys: t('...') calls whose key doesn't exist in the bound namespaces."""
import json, os, re, sys
from collections import defaultdict

ROOT = "/Users/apple/Ghulam/jwcrm"
SRC = os.path.join(ROOT, "src")
LOC = os.path.join(SRC, "locales")
NAMESPACES = ['common','auth','portal','admin','form','landing','pdf','toast','hr','finance','leadManagement','salesperson']
DEFAULT_NS = 'common'

def flatten(obj, prefix=""):
    out = set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            p = f"{prefix}.{k}" if prefix else k
            out.add(p)
            out |= flatten(v, p)
    elif isinstance(obj, list):
        out.add(prefix)
    else:
        out.add(prefix)
    return out

keys = {}   # lang -> ns -> set
for lang in ("en", "ar"):
    keys[lang] = {}
    for ns in NAMESPACES:
        p = os.path.join(LOC, lang, ns + ".json")
        with open(p) as f:
            keys[lang][ns] = flatten(json.load(f))

# ---- collect source files
files = []
for dp, dns, fns in os.walk(SRC):
    dns[:] = [d for d in dns if d not in ("node_modules", ".next", "locales")]
    for fn in fns:
        if fn.endswith((".ts", ".tsx")):
            files.append(os.path.join(dp, fn))

USE_T = re.compile(
    r"(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:await\s+)?useTranslation\s*\(([^;]*?)\)\s*;",
    re.S)
GET_FIXED = re.compile(r"(?:const|let|var)\s+(\w+)\s*=\s*(?:i18n\.)?getFixedT\s*\(([^)]*)\)")
STR = re.compile(r"""['"]([A-Za-z0-9_]+)['"]""")
KEYPREFIX = re.compile(r"""keyPrefix\s*:\s*['"]([^'"]+)['"]""")

results = []          # (file, line, alias, key, ns_list, reason)
dynamic = []          # (file, line, snippet)
ar_missing = []

def call_re(alias):
    return re.compile(r"(?<![\w.$])" + re.escape(alias) + r"\s*\(\s*([`'\"])(.*?)\1", re.S)

def dyn_re(alias):
    return re.compile(r"(?<![\w.$])" + re.escape(alias) + r"\s*\(\s*(?![`'\"])([^),]{0,60})")

for path in files:
    try:
        src = open(path, encoding="utf-8").read()
    except Exception:
        continue
    if "useTranslation" not in src and "getFixedT" not in src and "i18nKey" not in src:
        continue

    bindings = {}   # alias -> (ns_list, keyPrefix)
    for m in USE_T.finditer(src):
        destr, args = m.group(1), m.group(2)
        # find t alias
        alias = None
        for part in destr.split(","):
            part = part.strip()
            if part == "t":
                alias = "t"; break
            mm = re.match(r"^t\s*:\s*(\w+)$", part)
            if mm:
                alias = mm.group(1); break
        if not alias:
            continue
        # args: first argument may be string or array; second is options object
        nss = STR.findall(args)
        kp = KEYPREFIX.search(args)
        kp = kp.group(1) if kp else None
        if kp:  # keyPrefix value is captured by STR too; remove it
            nss = [n for n in nss if n != kp]
        nss = [n for n in nss if n in NAMESPACES]
        if not nss:
            nss = [DEFAULT_NS]
        bindings[alias] = (nss, kp)

    for m in GET_FIXED.finditer(src):
        alias, args = m.group(1), m.group(2)
        nss = [n for n in STR.findall(args) if n in NAMESPACES] or [DEFAULT_NS]
        bindings[alias] = (nss, None)

    if not bindings:
        continue

    lines = src.split("\n")
    def lineno(idx):
        return src.count("\n", 0, idx) + 1

    for alias, (nss, kp) in bindings.items():
        for m in call_re(alias).finditer(src):
            quote, key = m.group(1), m.group(2)
            if quote == "`" and "${" in key:
                dynamic.append((path, lineno(m.start()), key.strip()[:70], alias, nss))
                continue
            key = key.strip()
            if not key:
                continue
            full = f"{kp}.{key}" if kp else key
            # explicit ns prefix  ns:key
            search_ns = nss
            lookup = full
            if ":" in full:
                pre, rest = full.split(":", 1)
                if pre in NAMESPACES:
                    search_ns = [pre]; lookup = rest
            found_en = any(lookup in keys["en"][n] for n in search_ns)
            if not found_en:
                results.append((path, lineno(m.start()), alias, lookup, search_ns))
            else:
                if not any(lookup in keys["ar"][n] for n in search_ns):
                    ar_missing.append((path, lineno(m.start()), lookup, search_ns))
        for m in dyn_re(alias).finditer(src):
            frag = m.group(1).strip()
            if frag and not frag.startswith(")"):
                dynamic.append((path, lineno(m.start()), frag[:70], alias, nss))

def rel(p): return os.path.relpath(p, ROOT)

print("=" * 100)
print(f"BROKEN KEYS (missing in EN namespaces) — {len(results)} occurrences")
print("=" * 100)
by_file = defaultdict(list)
for path, ln, alias, key, nss in results:
    by_file[path].append((ln, key, nss))
for path in sorted(by_file):
    print(f"\n{rel(path)}")
    for ln, key, nss in sorted(by_file[path]):
        print(f"   L{ln:<5} {key}    [ns: {','.join(nss)}]")

print("\n" + "=" * 100)
print(f"EN ok but MISSING IN AR — {len(ar_missing)} occurrences")
print("=" * 100)
bf = defaultdict(list)
for path, ln, key, nss in ar_missing:
    bf[path].append((ln, key, nss))
for path in sorted(bf):
    print(f"\n{rel(path)}")
    for ln, key, nss in sorted(bf[path]):
        print(f"   L{ln:<5} {key}    [ns: {','.join(nss)}]")

print("\n" + "=" * 100)
print(f"DYNAMIC / UNRESOLVABLE keys (manual check) — {len(dynamic)}")
print("=" * 100)
bd = defaultdict(list)
for path, ln, frag, alias, nss in dynamic:
    bd[path].append((ln, frag, nss))
for path in sorted(bd):
    print(f"\n{rel(path)}")
    for ln, frag, nss in sorted(bd[path]):
        print(f"   L{ln:<5} {frag}    [ns: {','.join(nss)}]")
