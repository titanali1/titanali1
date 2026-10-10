#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""موکِ `api.php` برای تست روی ماشین خودتان (بدون هاست).

    python3 tests/mock-api.py 8099          # سایت: http://127.0.0.1:8099/
    NO_TLS=1 bash deploy/verify-site.sh http://127.0.0.1:8099/
    TA_ADMIN_USER=admin TA_ADMIN_PASS=xxxxxxxxxxxx bash deploy/install-api.sh http://127.0.0.1:8099/

فرقش با سرور واقعی: هش رمز sha256 است (نه bcrypt) و throttle ندارد. فقط برای توسعه.
داده‌ها در `.mockapi/` کنار مخزن نوشته می‌شود (در .gitignore هست).
"""
import hashlib
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATE = os.path.join(ROOT, ".mockapi")
os.makedirs(os.path.join(STATE, "uploads"), exist_ok=True)
DENY_DIR = ("titanali-data", "deploy", "dist", ".git", "tests")
DENY_FILE = (".htaccess", "titanali-config.php", "titanali-cpanel.zip")


def path(n):
    return os.path.join(STATE, n)


def read(n, default):
    try:
        with open(path(n), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def write(n, obj):
    os.makedirs(os.path.join(STATE, "uploads"), exist_ok=True)   # اگر .mockapi را پاک کرده باشید، خودکار بسازد
    with open(path(n), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


def hpw(pw):
    return "sha256$" + hashlib.sha256(("mocksalt|" + str(pw)).encode("utf-8")).hexdigest()


def users():
    return read("config.json", {}).get("users") or []


def rev():
    return int(read("meta.json", {}).get("rev", 0))


SECKEYS = ("profile", "tags", "stats", "cats", "gallery", "hobbies", "quick", "copy", "feed", "contacts", "ig", "settings")
BAKED = os.path.join(ROOT, "titanali-content.json")


def sections(d):
    d = d or {}
    out = {}
    for k in SECKEYS:
        v = d.get(k)
        out[k] = "" if v is None else hashlib.md5(json.dumps(v, ensure_ascii=False).encode()).hexdigest()[:10]
    return out


def bake(data, r, by):
    """شبیه‌سازی ta_bake در api.php: نوشتن فایل ایستای کنار index.html"""
    raw = json.dumps({"ok": True, "app": "titanali", "rev": r, "at": int(time.time()),
                      "data": data, "social": read("social.json", {})}, ensure_ascii=False)
    old = open(BAKED, encoding="utf-8").read() if os.path.isfile(BAKED) else None
    with open(BAKED, "w", encoding="utf-8") as f:
        f.write(raw)
    return {"at": int(time.time()), "by": by, "rev": r, "file": "titanali-content.json",
            "bytes": len(raw.encode("utf-8")), "changed": old != raw}


def baked_info():
    if not os.path.isfile(BAKED):
        return {"file": "titanali-content.json", "exists": False, "bytes": 0, "mtime": 0, "rev": 0}
    st = os.stat(BAKED)
    head = open(BAKED, encoding="utf-8").read(2048)
    revn = 0
    for tok in head.replace(" ", "").split(","):
        if tok.startswith('"rev":') and tok[6:].isdigit():
            revn = int(tok[6:])
    return {"file": "titanali-content.json", "exists": True, "bytes": st.st_size,
            "mtime": int(st.st_mtime), "rev": revn}


def bump():
    m = read("meta.json", {"rev": 0})
    m["rev"] = int(m.get("rev", 0)) + 1
    m["updated"] = int(time.time())
    write("meta.json", m)
    return m["rev"]


TOK = read("tokens.json", {})


class MockAPI(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    # ---------- ابزار ----------
    def js(self, obj, code=200):
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(raw)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if not n:
            return {}
        try:
            return json.loads(self.rfile.read(n).decode("utf-8"))
        except Exception:
            return {}

    def who(self):
        t = self.headers.get("X-TA-Token") or ""
        u = TOK.get(t)
        if not u:
            auth = self.headers.get("Authorization") or ""
            if auth.startswith("Bearer "):
                u = TOK.get(auth[7:].strip())
        return {"u": u} if u else None

    # ---------- مسیرها ----------
    def do_HEAD(self):
        if urlparse(self.path).path.endswith("api.php"):
            return self.api(urlparse(self.path))
        return SimpleHTTPRequestHandler.do_HEAD(self)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path.endswith("api.php"):
            return self.api(u)
        p = u.path.lstrip("/")
        if p.split("/")[0] in DENY_DIR or p in DENY_FILE:
            return self.js({"ok": False, "error": "دسترسی بسته است (شبیه‌سازی .htaccess)"}, 403)
        return SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
        u = urlparse(self.path)
        if u.path.endswith("api.php"):
            return self.api(u)
        return self.js({"ok": False, "error": "only api.php accepts POST"}, 404)

    def api(self, u):
        q = parse_qs(u.query)
        a = (q.get("action") or ["health"])[0]
        b = self.body() if self.command == "POST" else {}
        me = self.who()
        inst = len(users()) > 0

        if a == "health":
            return self.js({"ok": True, "app": "titanali", "ver": "1.0.0-mock", "installed": inst,
                            "needSetup": not inst, "rev": rev(), "writable": True, "php": "8.2 (mock)",
                            "dataDir": STATE, "host": "127.0.0.1", "domain": "",
                            "publish": baked_info(), "igOn": False})

        if a == "install":
            if inst:
                return self.js({"ok": False, "error": "روی این سرور قبلاً نصب شده است"}, 409)
            un, pw = str(b.get("u") or ""), str(b.get("p") or "")
            if len(un) < 3:
                return self.js({"ok": False, "error": "نام کاربری حداقل ۳ حرف"}, 400)
            if len(pw) < 8:
                return self.js({"ok": False, "error": "رمز حداقل ۸ کاراکتر"}, 400)
            c = read("config.json", {})
            c["users"] = [{"u": un, "p": hpw(pw), "name": b.get("name") or "ادمین سرور", "role": "owner"}]
            write("config.json", c)
            if isinstance(b.get("data"), dict):
                write("content.json", b["data"])
                bump()
            t = "tok-" + hashlib.sha256((un + str(time.time())).encode()).hexdigest()[:16]
            TOK[un] = t
            write("tokens.json", TOK)
            return self.js({"ok": True, "token": t, "user": un, "name": c["users"][0]["name"],
                            "rev": rev(), "msg": "ادمین سرور ساخته شد (موک)"})

        if a == "login":
            if not inst:
                return self.js({"ok": False, "error": "نصب انجام نشده"}, 423)
            for x in users():
                if x["u"] == str(b.get("u")) and x["p"] == hpw(str(b.get("p"))):
                    t = "tok-" + hashlib.sha256((x["u"] + str(time.time())).encode()).hexdigest()[:16]
                    TOK[x["u"]] = t
                    write("tokens.json", TOK)
                    return self.js({"ok": True, "token": t, "user": x["u"], "name": x["name"]})
            return self.js({"ok": False, "error": "نام کاربری یا رمز درست نیست"}, 401)

        if a == "logout":
            for k, v in list(TOK.items()):
                if v == (b.get("t") or ""):
                    TOK.pop(k)
            write("tokens.json", TOK)
            return self.js({"ok": True})

        if a == "publish":
            if not me:
                return self.js({"ok": False, "error": "نشست لازم است"}, 401)
            data = b.get("data")
            if not isinstance(data, dict) or not data:
                return self.js({"ok": False, "error": "data لازم است"}, 400)
            if b.get("baseRev") is not None and int(b["baseRev"]) != rev():
                return self.js({"ok": False, "conflict": True, "rev": rev(),
                                "data": read("content.json", None), "error": "تعارض نسخه"}, 409)
            write("content.json", data)
            r = bump()
            pub = bake(data, r, me["u"])
            m = read("meta.json", {})
            m["publish"] = {"at": pub["at"], "by": me["u"], "rev": r, "bytes": pub["bytes"],
                            "file": pub["file"], "error": ""}
            m["savedBy"] = me["u"]
            write("meta.json", m)
            lg = read("log.json", [])
            lg.append({"ts": int(time.time()), "u": me["u"], "what": "publish", "rev": r})
            write("log.json", lg[-200:])
            return self.js({"ok": True, "rev": r, "publish": pub, "sections": sections(data)})

        if a == "state":
            if not me:
                return self.js({"ok": False, "error": "نشست لازم است"}, 401)
            m = read("meta.json", {})
            d = read("content.json", None) or {}
            ups = os.path.join(STATE, "uploads")
            fl = [f for f in os.listdir(ups) if os.path.isfile(os.path.join(ups, f))] if os.path.isdir(ups) else []
            return self.js({"ok": True, "who": me["u"], "rev": rev(), "updated": m.get("updated", 0),
                            "savedBy": m.get("savedBy", ""), "publish": m.get("publish"),
                            "baked": baked_info(),
                            "hash": hashlib.md5(json.dumps(d, ensure_ascii=False).encode()).hexdigest()[:10],
                            "sections": sections(d),
                            "uploads": {"files": len(fl), "bytes": sum(os.path.getsize(os.path.join(ups, f)) for f in fl)},
                            "inbox": len(read("inbox.json", [])), "log": read("log.json", [])[-14:],
                            "igOn": False,
                            "counts": {"gallery": len(d.get("gallery") or []), "cats": len(d.get("cats") or []),
                                       "contacts": len(d.get("contacts") or []), "admins": len(users())}})

        if a == "baked":
            if os.path.isfile(BAKED):
                raw = open(BAKED, "rb").read()
                etag = '"' + hashlib.md5(raw).hexdigest() + '"'
                if (self.headers.get("If-None-Match") or "").strip() == etag:
                    self.send_response(304)
                    self.send_header("ETag", etag)
                    self.end_headers()
                    return
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("ETag", etag)
                self.send_header("Cache-Control", "public, max-age=60, must-revalidate")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)
                return
            return self.js({"ok": True, "rev": rev(), "at": 0, "baked": False,
                            "data": read("content.json", None), "social": read("social.json", {})})

        if a == "ig":
            if not me:
                return self.js({"ok": False, "error": "نشست لازم است"}, 401)
            cached = read("ig.json", {})
            items = cached.get("items")
            if not items:
                items = [{"id": "101", "image_url": "https://example.com/p1.jpg",
                          "media_url": "https://example.com/p1.jpg", "caption": "پست اول از پیج متصل",
                          "likes": 12, "comments": 3, "link": "https://www.instagram.com/p/AAA/",
                          "date": "2026-10-01", "user": "titanali1"},
                         {"id": "102", "image_url": "https://example.com/p2.jpg",
                          "media_url": "https://example.com/p2.jpg", "caption": "پست دوم",
                          "likes": 7, "comments": 1, "video": True,
                          "link": "https://www.instagram.com/p/BBB/", "date": "2026-09-24", "user": "titanali1"}]
            if b.get("store") is not None:
                write("ig.json", {"at": int(time.time()), "src": "mock", "items": b["store"]})
                items = b["store"]
            return self.js({"ok": True, "src": "mock", "items": items, "count": len(items), "at": int(time.time())})

        if a == "content":
            if self.command == "GET":
                return self.js({"ok": True, "rev": rev(), "installed": inst,
                                "updated": read("meta.json", {}).get("updated", 0),
                                "data": read("content.json", None), "social": read("social.json", {})})
            if not me:
                return self.js({"ok": False, "error": "نشست لازم است"}, 401)
            if b.get("baseRev") is not None and int(b["baseRev"]) != rev():
                return self.js({"ok": False, "conflict": True, "rev": rev(),
                                "data": read("content.json", None), "error": "تعارض نسخه"}, 409)
            write("content.json", b.get("data") or {})
            return self.js({"ok": True, "rev": bump()})

        if a == "admins":
            if not me:
                return self.js({"ok": False, "error": "نشست لازم است"}, 401)
            if self.command == "GET" or not b.get("op"):
                return self.js({"ok": True, "admins": [
                    {"u": x["u"], "name": x.get("name", x["u"]), "role": x.get("role", "admin")} for x in users()]})
            us = users()
            byU = {x["u"]: i for i, x in enumerate(us)}
            op = b.get("op")
            if op == "add":
                if len(str(b.get("p") or "")) < 8:
                    return self.js({"ok": False, "error": "رمز ۸+ کاراکتر"}, 400)
                if b.get("u") in byU:
                    return self.js({"ok": False, "error": "این نام کاربری هست"}, 409)
                us.append({"u": b["u"], "p": hpw(str(b["p"])), "name": b.get("name") or b["u"], "role": "admin"})
            elif op == "pw":
                i = byU.get(b.get("u") or me["u"])
                if i is None:
                    return self.js({"ok": False, "error": "پیدا نشد"}, 404)
                if len(str(b.get("p") or "")) < 8:
                    return self.js({"ok": False, "error": "رمز جدید حداقل ۸ کاراکتر"}, 400)
                us[i]["p"] = hpw(str(b["p"]))
            elif op == "remove":
                if len(us) <= 1:
                    return self.js({"ok": False, "error": "آخرین ادمین حذف نمی‌شود"}, 400)
                if b.get("u") == me["u"]:
                    return self.js({"ok": False, "error": "از خودتان نمی‌توانید خارج شوید"}, 400)
                us = [x for x in us if x["u"] != b.get("u")]
            else:
                return self.js({"ok": False, "error": "op نامعتبر است"}, 400)
            c = read("config.json", {})
            c["users"] = us
            write("config.json", c)
            bump()
            return self.js({"ok": True, "admins": [
                {"u": x["u"], "name": x.get("name", x["u"]), "role": x.get("role", "admin")} for x in us]})

        if a == "export":
            if not me:
                return self.js({"ok": False, "error": "نشست لازم است"}, 401)
            return self.js({"ok": True, "rev": rev(), "data": read("content.json", None),
                            "social": read("social.json", {}), "inbox": read("inbox.json", []), "log": []})

        if a == "stats":
            return self.js({"ok": True, "rev": rev(), "social": read("social.json", {}),
                            "inboxCount": len(read("inbox.json", [])),
                            "uploads": os.listdir(os.path.join(STATE, "uploads"))})

        return self.js({"ok": False, "error": "action ناشناخته: " + a}, 404)


class Handler(MockAPI, SimpleHTTPRequestHandler):
    pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8099
    os.chdir(ROOT)

    class S(ThreadingHTTPServer):
        daemon_threads = True
        allow_reuse_address = True

    print("موک api.php → http://127.0.0.1:%d/   (ریشه: %s | داده: %s)" % (port, ROOT, STATE))
    S(("0.0.0.0", port), Handler).serve_forever()
