"""Đóng gói tệp tĩnh của trang chủ cho nhẹ hơn (chạy lại mỗi khi sửa CSS hoặc JS).

    python cong-cu/dong_goi.py

Tạo trong web/da-nen/:
  app.js, ngon-ngu.js  bản nén của web/app.js và web/ngon-ngu.js (esbuild)
  goi.css              bản nén của 4 tệp CSS gộp lại (style, brand, desktop, can-doi)
  dau.css              phần CSS của màn hình đầu (thanh trên + phần mở đầu), chèn thẳng vào trang
                       để trình duyệt vẽ ngay, không phải chờ tải goi.css

Dòng đầu mỗi tệp ghi mã băm của tệp nguồn. Máy chủ chỉ dùng bản nén khi mã băm còn khớp,
nên quên chạy lại công cụ này thì trang vẫn đúng (dùng tệp gốc), chỉ chậm hơn.
Cần: esbuild (npm) và Playwright Chromium (để chọn CSS màn hình đầu).
"""
import hashlib
import os
import re
import shutil
import subprocess
import sys
import threading
from pathlib import Path

GOC = Path(__file__).resolve().parent.parent
WEB = GOC / "web"
RA = WEB / "da-nen"
GOI_CSS = ("style.css", "brand.css", "desktop.css", "can-doi.css")
JS = ("app.js", "ngon-ngu.js")


def ma_nguon(*ten):
    h = hashlib.md5()
    for t in ten:
        h.update((WEB / t).read_bytes())
    return h.hexdigest()


def tim_esbuild():
    for p in (os.environ.get("ESBUILD"), shutil.which("esbuild"), "/opt/npm-tools/node_modules/.bin/esbuild",
              str(GOC / "node_modules/.bin/esbuild")):
        if p and Path(p).exists():
            return p
    sys.exit("Không tìm thấy esbuild. Cài bằng: npm i -g esbuild")


def nen(chu, loai):
    kq = subprocess.run([tim_esbuild(), "--minify", f"--loader={loai}", "--charset=utf8", "--log-level=warning"],
                        input=chu.encode("utf-8"), capture_output=True, check=True)
    return kq.stdout.decode("utf-8").strip()


# ---------- Tách CSS thành từng quy tắc, giữ nguyên chữ gốc ----------
def tach(chu):
    """Trả về danh sách mục: ("quy-tac", bo_chon, than) | ("nhom", dau_at, [mục con]) | ("khac", chữ)."""
    muc, i, n = [], 0, len(chu)
    while i < n:
        while i < n and chu[i] in " \n\t\r":
            i += 1
        if i >= n:
            break
        j, sau, ngoac = i, None, 0
        while j < n:
            c = chu[j]
            if c in "\"'":
                k = j + 1
                while k < n and chu[k] != c:
                    k += 2 if chu[k] == "\\" else 1
                j = k + 1
                continue
            if c == "/" and chu.startswith("/*", j):
                j = chu.index("*/", j) + 2
                continue
            if c == "(":
                ngoac += 1
            elif c == ")":
                ngoac -= 1
            elif ngoac == 0 and c in "{;":
                sau = c
                break
            j += 1
        dau = chu[i:j].strip()
        if sau == ";" or sau is None:
            muc.append(("khac", chu[i:j + 1].strip()))
            i = j + 1
            continue
        # tìm dấu } khớp
        k, sau_ngoac = j + 1, 1
        while k < n and sau_ngoac:
            c = chu[k]
            if c in "\"'":
                m = k + 1
                while m < n and chu[m] != c:
                    m += 2 if chu[m] == "\\" else 1
                k = m + 1
                continue
            if c == "/" and chu.startswith("/*", k):
                k = chu.index("*/", k) + 2
                continue
            if c == "{":
                sau_ngoac += 1
            elif c == "}":
                sau_ngoac -= 1
            k += 1
        than = chu[j + 1:k - 1]
        if re.match(r"@(media|supports|container|layer|document)\b", dau):
            muc.append(("nhom", dau, tach(than)))
        elif dau.startswith("@"):
            muc.append(("khac", f"{dau}{{{than}}}"))
        else:
            muc.append(("quy-tac", dau, than))
        i = k
    return muc


def cac_bo_chon(muc, ra):
    for m in muc:
        if m[0] == "quy-tac":
            ra.append(m[1])
        elif m[0] == "nhom":
            cac_bo_chon(m[2], ra)
    return ra


def ghep(muc, giu, keyframes, dung_keyframes):
    ra = []
    for m in muc:
        if m[0] == "quy-tac":
            if giu[m[1]]:
                ra.append(f"{m[1]}{{{m[2]}}}")
                dung_keyframes.update(re.findall(r"animation(?:-name)?\s*:\s*([^;}]+)", m[2]))
        elif m[0] == "nhom":
            con = ghep(m[2], giu, keyframes, dung_keyframes)
            if con:
                ra.append(f"{m[1]}{{{con}}}")
        else:
            khung = re.match(r"@(?:-webkit-)?keyframes\s+([\w-]+)", m[1])
            if khung:
                keyframes.append((khung.group(1), m[1]))
            else:
                ra.append(m[1])   # @font-face, @property…: giữ hết
    return "".join(ra)


# Bỏ phần chỉ đúng khi khách tương tác (rê chuột, bấm…) và phần tử giả (::before) trước khi thử khớp:
# thử rộng ra thì chỉ giữ thừa, không bao giờ bỏ sót.
GIA = re.compile(r"::?(?:before|after|placeholder|selection|marker|backdrop|first-line|first-letter|file-selector-button|"
                 r"-webkit-[\w-]+|-moz-[\w-]+)(?:\([^)]*\))?|:(?:hover|focus-visible|focus-within|focus|active|visited|target|"
                 r"checked|disabled|enabled|open|modal|popover-open|placeholder-shown|invalid|valid|user-invalid|autofill)\b")

THU_KHOP = """([ds, gia]) => {
  const re = new RegExp(gia, "g");
  const tap = [document.documentElement, document.head, document.body, document.querySelector("main"),
    ...document.querySelectorAll(".bo-qua, header.dau-trang, header.dau-trang *, #mo-dau, #mo-dau *")].filter(Boolean);
  return ds.map(bc => {
    for (let s of bc.split(/,(?![^()]*\\))/)) {
      s = s.replace(re, "").trim();
      if (!s || /[>+~]$/.test(s)) return true;
      try { if (tap.some(e => e.matches(s))) return true; } catch { return true; }
    }
    return false;
  });
}"""


def chon_css_dau(goi, dia_chi):
    from playwright.sync_api import sync_playwright
    muc = tach(goi)
    ds = list(dict.fromkeys(cac_bo_chon(muc, [])))
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        pg.route(re.compile(r"\.js(\?|$)"), lambda r: r.abort())   # trạng thái trước khi app.js chạy
        pg.goto(dia_chi, wait_until="load")
        kq = pg.evaluate(THU_KHOP, [ds, GIA.pattern])
        b.close()
    giu = dict(zip(ds, kq))
    keyframes, dung = [], set()
    than = ghep(muc, giu, keyframes, dung)
    ten_dung = {t for gt in dung for t in re.findall(r"[\w-]+", gt)}
    than += "".join(k for ten, k in keyframes if ten in ten_dung)
    return than, sum(kq), len(ds)


def chay_may_chu():
    import uvicorn
    sys.path.insert(0, str(GOC))
    os.environ.setdefault("ADMIN_PASSWORD", "dong-goi")
    os.environ["BO_QUA_DA_NEN"] = "1"   # dùng CSS gốc khi chọn phần màn hình đầu
    import may_chu
    cau_hinh = uvicorn.Config(may_chu.app, port=8799, log_level="warning")
    may = uvicorn.Server(cau_hinh)
    threading.Thread(target=may.run, daemon=True).start()
    import time
    for _ in range(100):
        if may.started:
            return
        time.sleep(0.1)


def main():
    RA.mkdir(exist_ok=True)
    for t in JS:
        chu = nen((WEB / t).read_text(encoding="utf-8"), "js")
        (RA / t).write_text(f"/*nguon:{ma_nguon(t)}*/{chu}\n", encoding="utf-8")
    goi = "\n".join((WEB / t).read_text(encoding="utf-8") for t in GOI_CSS)
    ma = ma_nguon(*GOI_CSS)
    (RA / "goi.css").write_text(f"/*nguon:{ma}*/{nen(goi, 'css')}\n", encoding="utf-8")
    chay_may_chu()
    goi_gon = re.sub(r"/\*.*?\*/", "", goi, flags=re.S)
    dau, so_giu, tong = chon_css_dau(goi_gon, "http://127.0.0.1:8799/")
    # Tạm ẩn các phần dưới màn hình đầu cho tới khi goi.css tới (goi.css có quy tắc hiện lại, cuối can-doi.css).
    dau += ":where(main > section:not(#mo-dau), body > footer){display:none}"
    (RA / "dau.css").write_text(f"/*nguon:{ma}*/{nen(dau, 'css')}", encoding="utf-8")
    for t in sorted(RA.iterdir()):
        print(f"{t.name:12} {t.stat().st_size:>8} byte")
    print(f"CSS màn hình đầu: giữ {so_giu}/{tong} bộ chọn")


if __name__ == "__main__":
    main()
