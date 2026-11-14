"""Web tiếp nhận yêu cầu làm video giới thiệu sản phẩm của B Productions.

Một máy chủ duy nhất: phục vụ trang khách, lưu phiếu, nhận ảnh sản phẩm,
và trang nhân viên (xem phiếu, số liệu, tải Excel).

Chạy thử:  uvicorn may_chu:app --port 8000
Dữ liệu:   SQLite trong thư mục du-lieu/ (mặc định), hoặc PostgreSQL nếu đặt DATABASE_URL.
"""
import hashlib
import html
import hmac
import io
import json
import os
import re
import secrets
import sqlite3
import time
import warnings
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from starlette.applications import Starlette
from starlette.concurrency import run_in_threadpool
from starlette.middleware.gzip import GZipMiddleware
from starlette.responses import FileResponse, HTMLResponse, JSONResponse, Response
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

GOC = Path(__file__).resolve().parent

# Đọc tệp .env đặt cạnh tệp này (nếu có), không ghi đè biến môi trường đã đặt sẵn.
if (GOC / ".env").exists():
    for _dong in (GOC / ".env").read_text(encoding="utf-8-sig").splitlines():
        _ten, _dau, _gia_tri = _dong.strip().partition("=")
        if _dau and _ten and not _ten.startswith("#"):
            os.environ.setdefault(_ten.strip(), _gia_tri.strip().strip('"'))
WEB = GOC / "web"
BO_CAU_HOI = json.loads((GOC / "cau_hoi.json").read_text(encoding="utf-8"))
MAU = json.loads((GOC / "mau.json").read_text(encoding="utf-8"))
CAU = BO_CAU_HOI["cau_hoi"]
THU_TU_NHOM = [n["id"] for n in BO_CAU_HOI["nhom"]]

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
THU_MUC_DU_LIEU = Path(os.environ.get("DATA_DIR", GOC / "du-lieu"))
MAT_KHAU_NHAN_VIEN = os.environ.get("ADMIN_PASSWORD", "")
KHOA_BI_MAT = (os.environ.get("SECRET_KEY") or secrets.token_hex(32)).encode()
TEN_STUDIO = os.environ.get("STUDIO_NAME", "B Productions")
HEN_PHAN_HOI = os.environ.get("REPLY_WITHIN", "một ngày làm việc")
LINK_ZALO = os.environ.get("ZALO_LINK", "").strip()
LIEN_HE_STUDIO = os.environ.get("STUDIO_CONTACT", "").strip() or "0941761768"
_so_lien_he = re.sub(r"[\s.\-()]", "", LIEN_HE_STUDIO)
LIEN_HE_HIEN_THI = f"{_so_lien_he[:4]} {_so_lien_he[4:7]} {_so_lien_he[7:]}" if re.fullmatch(r"0\d{9}", _so_lien_he) else LIEN_HE_STUDIO
LINK_LIEN_HE = "tel:" + ("+84" + _so_lien_he[1:] if re.fullmatch(r"0\d{9}", _so_lien_he) else _so_lien_he) if re.fullmatch(r"\+?\d{7,15}", _so_lien_he) else ""
SAU_PROXY = os.environ.get("TRUST_PROXY", "").lower() in ("1", "true", "yes")
COOKIE_AN_TOAN = os.environ.get("COOKIE_SECURE", "").lower() in ("1", "true", "yes")

GIO_VN = timezone(timedelta(hours=7))
ANH_TOI_DA = 3
# Vercel nhận yêu cầu tối đa 4,5 MB nên trên Vercel giới hạn ảnh 4 MB; trang tự thu nhỏ ảnh lớn trước khi gửi.
ANH_NANG_NHAT = (4 if os.environ.get("VERCEL") else 5) * 1024 * 1024
MB_ANH = ANH_NANG_NHAT // (1024 * 1024)
KIEU_ANH = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
DAI_NHAT = {"chu": 300, "doan": 1500}
Image.MAX_IMAGE_PIXELS = 20_000_000


# ---------- Cơ sở dữ liệu ----------

LA_POSTGRES = DATABASE_URL.startswith(("postgres://", "postgresql://", "postgresql+psycopg://"))
if (os.environ.get("RENDER") or os.environ.get("VERCEL")) and not LA_POSTGRES:
    raise RuntimeError("Cần DATABASE_URL PostgreSQL (Neon) khi chạy trên Render hoặc Vercel; ổ đĩa ở đó không giữ dữ liệu.")


def ket_noi():
    if LA_POSTGRES:
        import psycopg  # chỉ cần khi chạy với PostgreSQL

        return psycopg.connect(DATABASE_URL.replace("postgresql+psycopg://", "postgresql://"))
    THU_MUC_DU_LIEU.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(THU_MUC_DU_LIEU / "du_lieu.db", timeout=15)
    con.execute("PRAGMA journal_mode=WAL")
    return con


def sql(cau, tham_so=(), lay=None):
    """Chạy một câu SQL. lay='mot' trả một dòng, 'tat' trả mọi dòng, None không trả gì."""
    if LA_POSTGRES:
        cau = cau.replace("?", "%s")
    con = ket_noi()
    try:
        cur = con.cursor()
        cur.execute(cau, tham_so)
        ket_qua = cur.fetchone() if lay == "mot" else cur.fetchall() if lay == "tat" else None
        con.commit()
        return ket_qua
    finally:
        con.close()


@contextmanager
def khoa_phieu(ma):
    """Khóa cùng một phiếu trong suốt giao dịch, kể cả khi chạy nhiều worker."""
    con = ket_noi()
    try:
        if not LA_POSTGRES:
            con.execute("BEGIN IMMEDIATE")
        cur = con.cursor()
        def chay(cau, tham_so=()):
            return cur.execute(cau.replace("?", "%s") if LA_POSTGRES else cau, tham_so)
        chay("SELECT gui_luc FROM phieu WHERE id=?" + (" FOR UPDATE" if LA_POSTGRES else ""), (ma,))
        dong = cur.fetchone()
        yield chay, dong
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def tao_bang():
    nhi_phan = "BYTEA" if LA_POSTGRES else "BLOB"
    cau_lenh = ["""CREATE TABLE IF NOT EXISTS phieu (
        id TEXT PRIMARY KEY, tao_luc TEXT NOT NULL, sua_luc TEXT NOT NULL, gui_luc TEXT,
        nguon TEXT NOT NULL DEFAULT '', nhom_dang_dung TEXT NOT NULL DEFAULT '',
        tra_loi TEXT NOT NULL DEFAULT '{}')""",
        f"""CREATE TABLE IF NOT EXISTS anh (
        id TEXT PRIMARY KEY, phieu_id TEXT NOT NULL, ten TEXT NOT NULL, kieu TEXT NOT NULL,
        kich_thuoc INTEGER NOT NULL, du_lieu {nhi_phan} NOT NULL, tao_luc TEXT NOT NULL)"""]
    # Theo dõi sự đồng ý cho phiếu mới; giữ nguyên dữ liệu phiếu cũ.
    cot_moi = ("lien_he_luc", "dong_y_luu_luc", "dong_y_gui_luc")
    sau = ["CREATE INDEX IF NOT EXISTS anh_phieu_idx ON anh (phieu_id)",
           "CREATE INDEX IF NOT EXISTS phieu_tao_idx ON phieu (tao_luc, id)",
           """CREATE TABLE IF NOT EXISTS luot_xem (
        ngay TEXT NOT NULL, nguon TEXT NOT NULL, so INTEGER NOT NULL, PRIMARY KEY (ngay, nguon))"""]
    if LA_POSTGRES:
        # Một kết nối cho cả lượt: trên Vercel bước này chạy mỗi lần hàm khởi động lạnh.
        con = ket_noi()
        try:
            cur = con.cursor()
            for cau in cau_lenh + [f"ALTER TABLE phieu ADD COLUMN IF NOT EXISTS {cot} TEXT" for cot in cot_moi] + sau:
                cur.execute(cau)
            con.commit()
        finally:
            con.close()
        return
    for cau in cau_lenh:
        sql(cau)
    da_co = {d[1] for d in sql("PRAGMA table_info(phieu)", lay="tat")}
    for cot in cot_moi:
        if cot not in da_co:
            sql(f"ALTER TABLE phieu ADD COLUMN {cot} TEXT")
    for cau in sau:
        sql(cau)


def bay_gio():
    return datetime.now(GIO_VN).strftime("%Y-%m-%d %H:%M:%S")


# ---------- Tiện ích ----------

def loi(ma, thong_bao, trang_thai=400):
    return JSONResponse({"loi": {"ma": ma, "thong_bao": thong_bao}}, status_code=trang_thai)


def dia_chi_khach(request):
    if SAU_PROXY:
        chuyen_tiep = request.headers.get("x-forwarded-for", "")
        if chuyen_tiep:
            return chuyen_tiep.split(",")[0].strip()
    return request.client.host if request.client else "?"


_dem = {}


def qua_nhieu(khoa, toi_da, trong_giay):
    """True nếu 'khoa' đã vượt 'toi_da' lần trong 'trong_giay' giây gần nhất."""
    luc = time.time()
    lan = [t for t in _dem.get(khoa, []) if luc - t < trong_giay]
    if len(lan) >= toi_da:
        _dem[khoa] = lan
        return True
    _dem[khoa] = lan + [luc]
    if len(_dem) > 5000:  # dọn bớt để không phình bộ nhớ
        for k in [k for k, v in _dem.items() if not v or luc - v[-1] > 3600]:
            _dem.pop(k, None)
    return False


def sach_nguon(gia_tri):
    return re.sub(r"[^a-z0-9_\-]", "", str(gia_tri or "").lower())[:40]


async def doc_json(request, toi_da=200_000):
    than = bytearray()
    async for phan in request.stream():
        than.extend(phan)
        if len(than) > toi_da:
            return None
    try:
        du_lieu = json.loads(than or b"{}")
    except ValueError:
        return None
    return du_lieu if isinstance(du_lieu, dict) else None


def ten_lua_chon(lc):
    return lc["ten"] if isinstance(lc, dict) else lc


# ---------- Kiểm tra câu trả lời ----------

DT = re.compile(r"^(0|\+?84)\d{9,10}$")
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")


def kiem_tra_lien_he(kenh, gia_tri):
    so = re.sub(r"[\s.\-()]", "", gia_tri)
    if kenh in ("Zalo", "Điện thoại"):
        return None if DT.match(so) else "Số điện thoại chưa đúng. Anh chị vui lòng nhập đủ 10 số, ví dụ 0901 234 567."
    if kenh == "Email":
        return None if EMAIL.match(gia_tri) else "Địa chỉ email chưa đúng. Anh chị vui lòng xem lại, ví dụ ten@gmail.com."
    return None if len(gia_tri) >= 3 else "Anh chị vui lòng nhập tên hoặc link Messenger."


def lam_sach(tra_loi):
    """Chỉ giữ những khóa có trong bộ câu hỏi, đúng kiểu, đúng lựa chọn, đúng độ dài."""
    sach = {}
    if not isinstance(tra_loi, dict):
        return sach
    for cau in CAU:
        for tr in cau["truong"]:
            khoa = f'{cau["so"]}.{tr["id"]}'
            gia_tri = tra_loi.get(khoa)
            if tr["kieu"] in ("chu", "doan"):
                if isinstance(gia_tri, str) and gia_tri.strip():
                    sach[khoa] = gia_tri.strip()[: DAI_NHAT[tr["kieu"]]]
                continue
            hop_le = {ten_lua_chon(lc) for lc in tr["lua_chon"]}
            if tr["kieu"] == "mot":
                if isinstance(gia_tri, str) and gia_tri in hop_le:
                    sach[khoa] = gia_tri
            else:
                chon = [g for g in gia_tri if isinstance(g, str) and g in hop_le] if isinstance(gia_tri, list) else []
                chon = list(dict.fromkeys(chon))[: tr.get("toi_da") or len(hop_le)]
                if chon:
                    sach[khoa] = chon
            if tr.get("tu_dien"):
                rieng = tra_loi.get(khoa + ".khac")
                if isinstance(rieng, str) and rieng.strip():
                    sach[khoa + ".khac"] = rieng.strip()[:300]
    return sach


def tim_thieu(tra_loi):
    """Danh sách lỗi {so, truong, thong_bao} của một phiếu trước khi gửi."""
    thieu = []
    for cau in CAU:
        for tr in cau["truong"]:
            khoa = f'{cau["so"]}.{tr["id"]}'
            bo_qua = tr.get("bo_qua_neu")
            if bo_qua and tra_loi.get(f'{cau["so"]}.{bo_qua["truong"]}') == bo_qua["la"]:
                continue
            co = bool(tra_loi.get(khoa)) or bool(tra_loi.get(khoa + ".khac"))
            if tr.get("bat_buoc") and not co:
                thieu.append({"so": cau["so"], "truong": tr["id"], "thong_bao": f'Câu {cau["so"]} chưa có câu trả lời.'})
            elif tr.get("kiem_tra") == "lien_he" and co:
                sai = kiem_tra_lien_he(tra_loi.get(f'{cau["so"]}.kenh', ""), tra_loi[khoa])
                if sai:
                    thieu.append({"so": cau["so"], "truong": tr["id"], "thong_bao": sai})
    return thieu


def gop(tra_loi, khoa):
    """Câu trả lời dạng chữ để hiện cho người đọc và ghi vào Excel."""
    gia_tri = tra_loi.get(khoa)
    phan = list(gia_tri) if isinstance(gia_tri, list) else [gia_tri] if gia_tri else []
    if tra_loi.get(khoa + ".khac"):
        phan.append(tra_loi[khoa + ".khac"])
    return ", ".join(phan)


def tom_tat(tra_loi):
    dong = []
    if tra_loi.get("_loai") == "tu-van-nhanh":
        dong.append({"so": None, "cau": "Loại yêu cầu", "tra_loi": "Tư vấn nhanh — khách chưa điền phiếu chi tiết"})
    if tra_loi.get("_tu_tu_van"):
        dong.append({"so": None, "cau": "Gộp từ yêu cầu tư vấn nhanh", "tra_loi": f'Khách gửi tư vấn nhanh lúc {tra_loi["_tu_tu_van"]}, sau đó điền phiếu chi tiết'})
    if tra_loi.get("_mau"):
        m = next((m for m in MAU if m["ma"] == tra_loi["_mau"]), None)
        dong.append({"so": None, "cau": "Mẫu khách quan tâm", "tra_loi": f'{m["ma"]} · {m["ten"]}' if m else tra_loi["_mau"]})
    for cau in CAU:
        phan = []
        for tr in cau["truong"]:
            chu = gop(tra_loi, f'{cau["so"]}.{tr["id"]}')
            if chu:
                phan.append(f'{tr["nhan"]}: {chu}' if tr.get("nhan") and len(cau["truong"]) > 1 else chu)
        if phan:
            dong.append({"so": cau["so"], "cau": cau["cau"], "tra_loi": "; ".join(phan)})
    return dong


# ---------- Phần của khách ----------

def mau_kem_doan_ngan():
    """Mẫu nào có tệp web/video-mau/<mã>.mp4 hoặc .webm thì trang sẽ phát tệp đó thay cho YouTube."""
    ket_qua = []
    for m in MAU:
        doan = next((f"/video-mau/{m['ma']}.{duoi}" for duoi in ("mp4", "webm") if (WEB / "video-mau" / f"{m['ma']}.{duoi}").is_file()), "")
        ket_qua.append({**m, "doan": doan})
    return ket_qua


def du_lieu_cau_hinh():
    return {"studio": TEN_STUDIO, "hen_phan_hoi": HEN_PHAN_HOI, "zalo": LINK_ZALO, "lien_he": LIEN_HE_HIEN_THI, "lien_he_url": LINK_LIEN_HE,
            "bo_cau_hoi": BO_CAU_HOI, "mau": mau_kem_doan_ngan(),
            "anh": {"toi_da": ANH_TOI_DA, "nang_nhat": ANH_NANG_NHAT}}


async def cau_hinh(request):
    return JSONResponse(du_lieu_cau_hinh())


async def ghi_luot_xem(request):
    du_lieu = await doc_json(request, 2000) or {}
    if qua_nhieu(("xem", dia_chi_khach(request)), 30, 3600):
        return Response(status_code=204)
    ngay, nguon = bay_gio()[:10], sach_nguon(du_lieu.get("nguon"))

    def ghi():
        sql("INSERT INTO luot_xem (ngay, nguon, so) VALUES (?,?,1) "
            "ON CONFLICT (ngay, nguon) DO UPDATE SET so=luot_xem.so+1", (ngay, nguon))

    await run_in_threadpool(ghi)
    return Response(status_code=204)


async def mo_phieu(request):
    du_lieu = await doc_json(request, 2000) or {}
    if du_lieu.get("dong_y_luu") is not True:
        return loi("CHUA_DONG_Y_LUU", "Anh chị vui lòng đồng ý lưu bản nháp trước khi bắt đầu.")
    if qua_nhieu(("mo", dia_chi_khach(request)), 8, 3600) or qua_nhieu("mo-tat-ca", 300, 3600):
        return loi("QUA_NHIEU", "Anh chị mở phiếu quá nhiều lần trong một giờ. Anh chị vui lòng thử lại sau.", 429)
    ma, luc = secrets.token_urlsafe(24), bay_gio()
    await run_in_threadpool(sql, "INSERT INTO phieu (id, tao_luc, sua_luc, nguon, dong_y_luu_luc) VALUES (?,?,?,?,?)",
                            (ma, luc, luc, sach_nguon(du_lieu.get("nguon")), luc))
    return JSONResponse({"id": ma}, status_code=201)


KENH_NHANH = ("Zalo", "Điện thoại")
# Những câu khách được trả lời thêm ngay sau khi gửi tư vấn nhanh (không bắt buộc).
KHOA_BO_SUNG = {"ten": "19.ten", "han": "17.han", "ngan_sach": "18.ngan_sach", "noi_dang": "7.noi_dang"}
# Câu trả lời khách bấm ở phần "Gợi ý kiểu video", gửi kèm yêu cầu tư vấn nhanh.
KHOA_GOI_Y = ("2.nhom", "7.noi_dang", "4.muc_dich")
HAN_BO_SUNG = timedelta(hours=24)


def cung_yeu_cau(da_luu, moi):
    """Cùng một yêu cầu tư vấn nhanh nếu các thông tin gốc giống nhau; phần khách bổ sung sau không tính."""
    return all(da_luu.get(k) == v for k, v in moi.items())


def so_dien_thoai(gia_tri):
    """Đưa số về dạng 0xxxxxxxxx để so sánh: 0901 234 567, +84901234567 và 84901234567 là một số."""
    so = re.sub(r"[\s.\-()]", "", gia_tri or "").removeprefix("+")
    return "0" + so[2:] if so.startswith("84") and len(so) == 11 else so


async def bo_sung_tu_van(request):
    du_lieu = await doc_json(request, 4000)
    if du_lieu is None:
        return loi("SAI_DU_LIEU", "Yêu cầu chưa đúng. Anh chị vui lòng thử lại.")
    ma_gui = du_lieu.get("ma_gui")
    if not isinstance(ma_gui, str) or not re.fullmatch(r"[a-f0-9]{48}", ma_gui):
        return loi("SAI_MA_GUI", "Mã yêu cầu chưa đúng. Anh chị vui lòng tải lại trang.")
    if qua_nhieu(("bo-sung", dia_chi_khach(request)), 20, 3600):
        return loi("QUA_NHIEU", "Anh chị gửi quá nhiều lần. Anh chị vui lòng thử lại sau.", 429)
    them = lam_sach({khoa: du_lieu.get(ten) for ten, khoa in KHOA_BO_SUNG.items()})
    if not them:
        return loi("TRONG", "Anh chị chưa chọn hoặc điền thông tin nào.")
    ma = "tv_" + ma_gui

    def ghi():
        with khoa_phieu(ma) as (chay, dong):
            if not dong:
                return "khong-thay"
            tra_loi_cu, tao_luc = chay("SELECT tra_loi, tao_luc FROM phieu WHERE id=?", (ma,)).fetchone()
            tra_loi = json.loads(tra_loi_cu or "{}")
            if tra_loi.get("_loai") != "tu-van-nhanh":
                return "khong-thay"
            if datetime.now(GIO_VN) - datetime.strptime(tao_luc, "%Y-%m-%d %H:%M:%S").replace(tzinfo=GIO_VN) > HAN_BO_SUNG:
                return "het-han"
            tra_loi.update(them)
            chay("UPDATE phieu SET tra_loi=?, sua_luc=? WHERE id=?", (json.dumps(tra_loi, ensure_ascii=False), bay_gio(), ma))
        return "xong"

    kq = await run_in_threadpool(ghi)
    if kq == "khong-thay":
        return loi("KHONG_THAY", "Không tìm thấy yêu cầu tư vấn này.", 404)
    if kq == "het-han":
        return loi("HET_HAN", "Yêu cầu này đã gửi quá lâu. Anh chị vui lòng gửi yêu cầu chi tiết.", 409)
    return JSONResponse({"da_luu": True})


async def gui_tu_van(request):
    du_lieu = await doc_json(request, 4000)
    if du_lieu is None:
        return loi("SAI_DU_LIEU", "Yêu cầu chưa đúng. Anh chị vui lòng thử lại.")
    if du_lieu.get("trang_web"):
        return JSONResponse({"da_gui": True}, status_code=201)
    if du_lieu.get("dong_y") is not True:
        return loi("CHUA_DONG_Y", "Anh chị vui lòng đồng ý để chúng tôi liên hệ tư vấn.")
    san_pham, lien_he = du_lieu.get("san_pham"), du_lieu.get("lien_he")
    if not isinstance(san_pham, str) or not 1 <= len(san_pham.strip()) <= 300:
        return loi("THIEU_SAN_PHAM", "Anh chị vui lòng nhập tên sản phẩm, tối đa 300 ký tự.")
    if not isinstance(lien_he, str) or len(lien_he) > 30:
        return loi("SAI_LIEN_HE", "Anh chị vui lòng kiểm tra số điện thoại.")
    so = re.sub(r"[\s.\-()]", "", lien_he)
    if not re.fullmatch(r"(?:0\d{9}|\+?84\d{9})", so):
        return loi("SAI_LIEN_HE", "Anh chị vui lòng kiểm tra số điện thoại, ví dụ 0901 234 567.")
    ma_gui = du_lieu.get("ma_gui")
    if not isinstance(ma_gui, str) or not re.fullmatch(r"[a-f0-9]{48}", ma_gui):
        return loi("SAI_MA_GUI", "Mã yêu cầu chưa đúng. Anh chị vui lòng tải lại trang.")
    ma_mau = du_lieu.get("ma_mau", "")
    if not isinstance(ma_mau, str):
        return loi("SAI_MAU", "Mẫu tham khảo chưa đúng.")
    m = next((m for m in MAU if m["ma"] == ma_mau), None)
    if ma_mau and m is None:
        return loi("SAI_MAU", "Mẫu này không còn trong danh sách. Anh chị có thể bỏ chọn mẫu rồi gửi lại.")
    kenh = du_lieu.get("kenh", "Điện thoại")
    if kenh not in KENH_NHANH:
        return loi("SAI_KENH", "Anh chị vui lòng chọn Zalo hoặc gọi điện.")
    them = du_lieu.get("them") or {}
    if not isinstance(them, dict):
        return loi("SAI_DU_LIEU", "Yêu cầu chưa đúng. Anh chị vui lòng thử lại.")
    tra_loi = {**lam_sach({k: them.get(k) for k in KHOA_GOI_Y}),
               "1.san_pham": san_pham.strip(), "19.kenh": kenh, "19.dia_chi": so, "_loai": "tu-van-nhanh"}
    if m:
        tra_loi["_mau"] = m["ma"]
        if m.get("kieu"):
            tra_loi["11.kieu"] = [m["kieu"]]
    ma = "tv_" + ma_gui
    cu = await run_in_threadpool(lay_phieu, ma)
    if cu:
        if not cung_yeu_cau(cu["tra_loi"], tra_loi):
            return loi("MA_DA_DUNG", "Nội dung yêu cầu đã thay đổi. Anh chị vui lòng sửa thông tin rồi gửi lại.", 409)
        return JSONResponse({"da_gui": True})
    if qua_nhieu(("tu-van", dia_chi_khach(request)), 5, 3600) or qua_nhieu("tu-van-tat-ca", 300, 3600):
        return loi("QUA_NHIEU", "Anh chị đã gửi nhiều yêu cầu. Vui lòng thử lại sau hoặc liên hệ studio qua kênh đã biết.", 429)
    luc = bay_gio()
    await run_in_threadpool(sql,
        "INSERT INTO phieu (id,tao_luc,sua_luc,gui_luc,nguon,nhom_dang_dung,tra_loi,dong_y_gui_luc) "
        "VALUES (?,?,?,?,?,?,?,?) ON CONFLICT (id) DO NOTHING",
        (ma, luc, luc, luc, sach_nguon(du_lieu.get("nguon")), THU_TU_NHOM[-1], json.dumps(tra_loi, ensure_ascii=False), luc))
    da_luu = await run_in_threadpool(lay_phieu, ma)
    if not da_luu or not cung_yeu_cau(da_luu["tra_loi"], tra_loi):
        return loi("MA_DA_DUNG", "Nội dung yêu cầu đã thay đổi. Anh chị vui lòng sửa thông tin rồi gửi lại.", 409)
    return JSONResponse({"da_gui": True}, status_code=201)


def lay_phieu(ma):
    if not re.fullmatch(r"[A-Za-z0-9_\-]{20,60}", ma or ""):
        return None
    dong = sql("SELECT id, tao_luc, sua_luc, gui_luc, nguon, nhom_dang_dung, tra_loi FROM phieu WHERE id=?", (ma,), "mot")
    if not dong:
        return None
    return {"id": dong[0], "tao_luc": dong[1], "sua_luc": dong[2], "gui_luc": dong[3], "nguon": dong[4],
            "nhom_dang_dung": dong[5], "tra_loi": json.loads(dong[6] or "{}")}


def danh_sach_anh(ma):
    dong = sql("SELECT id, ten, kich_thuoc FROM anh WHERE phieu_id=? ORDER BY tao_luc", (ma,), "tat")
    return [{"id": d[0], "ten": d[1], "kich_thuoc": d[2]} for d in dong]


async def xem_phieu(request):
    phieu = await run_in_threadpool(lay_phieu, request.path_params["ma"])
    if not phieu:
        return loi("KHONG_THAY", "Không tìm thấy phiếu này.", 404)
    anh = await run_in_threadpool(danh_sach_anh, phieu["id"])
    return JSONResponse({"tra_loi": phieu["tra_loi"], "nhom_dang_dung": phieu["nhom_dang_dung"],
                         "da_gui": bool(phieu["gui_luc"]), "anh": anh})


async def luu_phieu(request):
    du_lieu = await doc_json(request)
    if du_lieu is None:
        return loi("SAI_DU_LIEU", "Dữ liệu gửi lên chưa đúng.")
    phieu = await run_in_threadpool(lay_phieu, request.path_params["ma"])
    if not phieu:
        return loi("KHONG_THAY", "Không tìm thấy phiếu này.", 404)
    if phieu["gui_luc"]:
        return loi("DA_GUI", "Phiếu này đã được gửi.", 409)
    if qua_nhieu(("luu", phieu["id"]), 300, 3600):
        return loi("QUA_NHIEU", "Anh chị lưu quá nhiều lần. Anh chị vui lòng chờ ít phút.", 429)
    tra_loi = lam_sach(du_lieu.get("tra_loi"))
    nhom = du_lieu.get("nhom") if du_lieu.get("nhom") in THU_TU_NHOM else phieu["nhom_dang_dung"]
    def ghi():
        with khoa_phieu(phieu["id"]) as (chay, dong):
            if not dong or dong[0]:
                return False
            chay("UPDATE phieu SET tra_loi=?, nhom_dang_dung=?, sua_luc=? WHERE id=?",
                 (json.dumps(tra_loi, ensure_ascii=False), nhom, bay_gio(), phieu["id"]))
            if du_lieu.get("dong_y_luu") is True:
                chay("UPDATE phieu SET dong_y_luu_luc=COALESCE(dong_y_luu_luc, ?) WHERE id=?", (bay_gio(), phieu["id"]))
        return True
    if not await run_in_threadpool(ghi):
        return loi("DA_GUI", "Phiếu này đã được gửi.", 409)
    return JSONResponse({"da_luu": True})


def chuan_hoa_anh(du_lieu):
    """Giải mã toàn bộ ảnh, chặn ảnh lỗi/quá lớn và loại bỏ metadata."""
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        with Image.open(io.BytesIO(du_lieu)) as anh:
            if anh.format not in ("JPEG", "PNG", "WEBP") or getattr(anh, "is_animated", False):
                raise ValueError("Chỉ nhận ảnh tĩnh JPG, PNG hoặc WEBP.")
            dinh_dang = anh.format
            anh.verify()
        with Image.open(io.BytesIO(du_lieu)) as anh:
            anh.load()
            anh = ImageOps.exif_transpose(anh)
            anh = anh.convert("RGB" if dinh_dang == "JPEG" else "RGBA" if "A" in anh.getbands() or "transparency" in anh.info else "RGB")
            # Tạo ảnh mới để không sao chép EXIF, bình luận hoặc hồ sơ màu của tệp gốc.
            sach = Image.new(anh.mode, anh.size)
            sach.paste(anh)
            tep = io.BytesIO()
            sach.save(tep, format=dinh_dang)
            return tep.getvalue(), Image.MIME[dinh_dang]


async def tai_anh(request):
    phieu = await run_in_threadpool(lay_phieu, request.path_params["ma"])
    if not phieu:
        return loi("KHONG_THAY", "Không tìm thấy phiếu này.", 404)
    if phieu["gui_luc"]:
        return loi("DA_GUI", "Phiếu này đã được gửi.", 409)
    async with request.form(max_files=1, max_fields=5, max_part_size=200_000) as form:
        tep = form.get("anh")
        if not hasattr(tep, "read"):
            return loi("THIEU_ANH", "Chưa có ảnh nào được chọn.")
        du_lieu = await tep.read(ANH_NANG_NHAT + 1)
        ten_goc = tep.filename or "anh"
    if len(du_lieu) > ANH_NANG_NHAT:
        return loi("ANH_QUA_NANG", f"Ảnh nặng quá {MB_ANH} MB. Anh chị vui lòng chọn ảnh nhẹ hơn.", 413)
    try:
        du_lieu, kieu = await run_in_threadpool(chuan_hoa_anh, du_lieu)
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        return loi("SAI_KIEU_ANH", "Ảnh không hợp lệ hoặc quá lớn. Chỉ nhận ảnh tĩnh JPG, PNG hoặc WEBP, tối đa 20 triệu điểm ảnh.")
    if len(du_lieu) > ANH_NANG_NHAT:
        return loi("ANH_QUA_NANG", f"Ảnh sau xử lý nặng quá {MB_ANH} MB. Anh chị vui lòng chọn ảnh nhỏ hơn.", 413)
    ten = re.sub(r"[^\w.\- ]", "_", os.path.basename(ten_goc))[:80] or "anh"

    def ghi():
        with khoa_phieu(phieu["id"]) as (chay, dong):
            if not dong or dong[0]:
                return "DA_GUI"
            so = chay("SELECT COUNT(*) FROM anh WHERE phieu_id=?", (phieu["id"],)).fetchone()[0]
            if so >= ANH_TOI_DA:
                return "DU_ANH"
            chay("INSERT INTO anh (id, phieu_id, ten, kieu, kich_thuoc, du_lieu, tao_luc) VALUES (?,?,?,?,?,?,?)",
                 (secrets.token_urlsafe(12), phieu["id"], ten, kieu, len(du_lieu), du_lieu, bay_gio()))
        return "OK"

    ket_qua = await run_in_threadpool(ghi)
    if ket_qua == "DA_GUI":
        return loi("DA_GUI", "Phiếu này đã được gửi.", 409)
    if ket_qua == "DU_ANH":
        return loi("DU_ANH", f"Mỗi phiếu gửi tối đa {ANH_TOI_DA} ảnh.")
    return JSONResponse({"anh": await run_in_threadpool(danh_sach_anh, phieu["id"])}, status_code=201)


async def xoa_anh(request):
    def xoa():
        with khoa_phieu(request.path_params["ma"]) as (chay, dong):
            if not dong or dong[0]:
                return False
            chay("DELETE FROM anh WHERE id=? AND phieu_id=?", (request.path_params["anh"], request.path_params["ma"]))
        return True
    if not await run_in_threadpool(xoa):
        return loi("KHONG_THAY", "Không tìm thấy phiếu đang dở này.", 404)
    return JSONResponse({"anh": await run_in_threadpool(danh_sach_anh, request.path_params["ma"])})


async def gui_phieu(request):
    du_lieu = await doc_json(request)
    if du_lieu is None:
        return loi("SAI_DU_LIEU", "Dữ liệu gửi lên chưa đúng.")
    phieu = await run_in_threadpool(lay_phieu, request.path_params["ma"])
    if not phieu:
        return loi("KHONG_THAY", "Không tìm thấy phiếu này.", 404)
    if phieu["gui_luc"]:
        return JSONResponse({"da_gui": True, "tom_tat": tom_tat(phieu["tra_loi"])})
    if du_lieu.get("trang_web"):  # ô ẩn, người thật không thấy và không điền
        return JSONResponse({"da_gui": True, "tom_tat": []})
    if du_lieu.get("dong_y") is not True:
        return loi("CHUA_DONG_Y", "Anh chị vui lòng đánh dấu ô đồng ý trước khi gửi.")
    tra_loi = lam_sach(du_lieu.get("tra_loi")) if "tra_loi" in du_lieu else phieu["tra_loi"]
    thieu = tim_thieu(tra_loi)
    if thieu:
        return JSONResponse({"loi": {"ma": "CON_THIEU", "thong_bao": thieu[0]["thong_bao"], "thieu": thieu}}, status_code=422)
    tu_van = du_lieu.get("tu_van")
    tu_van = tu_van if isinstance(tu_van, str) and re.fullmatch(r"[a-f0-9]{48}", tu_van) else ""

    def ghi():
        with khoa_phieu(phieu["id"]) as (chay, dong):
            if not dong:
                return None
            if dong[0]:
                return json.loads(chay("SELECT tra_loi FROM phieu WHERE id=?", (phieu["id"],)).fetchone()[0])
            luc = bay_gio()
            chay("UPDATE phieu SET tra_loi=?, gui_luc=?, sua_luc=?, nhom_dang_dung=?, dong_y_gui_luc=? WHERE id=?",
                 (json.dumps(tra_loi, ensure_ascii=False), luc, luc, THU_TU_NHOM[-1], luc, phieu["id"]))
        return gop_tu_van(phieu["id"], tra_loi, tu_van) if tu_van else tra_loi
    da_luu = await run_in_threadpool(ghi)
    if da_luu is None:
        return loi("KHONG_THAY", "Không tìm thấy phiếu này.", 404)
    return JSONResponse({"da_gui": True, "tom_tat": tom_tat(da_luu)})


def gop_tu_van(ma_phieu, tra_loi, ma_gui):
    """Khách đã gửi tư vấn nhanh rồi điền tiếp phiếu chi tiết: gộp làm một yêu cầu, giữ mẫu đã chọn
    và trạng thái đã liên hệ. Chỉ gộp khi số điện thoại trùng nhau."""
    ma_tv = "tv_" + ma_gui
    with khoa_phieu(ma_tv) as (chay, dong):
        if not dong:
            return tra_loi
        cu, lien_he_luc, tao_luc = chay("SELECT tra_loi, lien_he_luc, tao_luc FROM phieu WHERE id=?", (ma_tv,)).fetchone()
        cu = json.loads(cu or "{}")
        if cu.get("_loai") != "tu-van-nhanh" or so_dien_thoai(cu.get("19.dia_chi")) != so_dien_thoai(tra_loi.get("19.dia_chi")):
            return tra_loi
        moi = {**tra_loi, "_tu_tu_van": tao_luc}
        if cu.get("_mau"):
            moi["_mau"] = cu["_mau"]
        chay("UPDATE phieu SET tra_loi=?, lien_he_luc=COALESCE(lien_he_luc, ?) WHERE id=?",
             (json.dumps(moi, ensure_ascii=False), lien_he_luc, ma_phieu))
        chay("DELETE FROM anh WHERE phieu_id=?", (ma_tv,))
        chay("DELETE FROM phieu WHERE id=?", (ma_tv,))
    return moi


# ---------- Phần của nhân viên ----------

def ky(han):
    return hmac.new(KHOA_BI_MAT, str(han).encode(), hashlib.sha256).hexdigest()


def la_nhan_vien(request):
    gia_tri = request.cookies.get("nv", "")
    han, _, chu_ky = gia_tri.partition(".")
    return bool(han.isdigit() and int(han) > time.time() and hmac.compare_digest(chu_ky, ky(han)))


async def dang_nhap(request):
    du_lieu = await doc_json(request, 2000) or {}
    if not MAT_KHAU_NHAN_VIEN:
        return loi("CHUA_DAT_MAT_KHAU", "Chưa đặt mật khẩu nhân viên. Hãy đặt biến ADMIN_PASSWORD rồi chạy lại.", 503)
    if qua_nhieu(("dn", dia_chi_khach(request)), 8, 900):
        return loi("QUA_NHIEU", "Nhập sai quá nhiều lần. Hãy thử lại sau 15 phút.", 429)
    if not hmac.compare_digest(str(du_lieu.get("mat_khau", "")).encode(), MAT_KHAU_NHAN_VIEN.encode()):
        return loi("SAI_MAT_KHAU", "Mật khẩu chưa đúng.", 401)
    han = int(time.time()) + 12 * 3600
    tra = JSONResponse({"da_dang_nhap": True})
    tra.set_cookie("nv", f"{han}.{ky(han)}", max_age=12 * 3600, httponly=True, samesite="strict", secure=COOKIE_AN_TOAN, path="/")
    return tra


async def dang_xuat(request):
    tra = JSONResponse({"da_dang_xuat": True})
    tra.delete_cookie("nv", path="/")
    return tra


def tat_ca_phieu():
    dong = sql("SELECT id, tao_luc, sua_luc, gui_luc, nguon, nhom_dang_dung, tra_loi, lien_he_luc FROM phieu ORDER BY tao_luc DESC", (), "tat")
    so_anh = dict(sql("SELECT phieu_id, COUNT(*) FROM anh GROUP BY phieu_id", (), "tat"))
    return [{"id": d[0], "tao_luc": d[1], "sua_luc": d[2], "gui_luc": d[3], "nguon": d[4], "nhom_dang_dung": d[5],
             "tra_loi": json.loads(d[6] or "{}"), "lien_he_luc": d[7] or "", "so_anh": so_anh.get(d[0], 0)} for d in dong]


def thong_ke():
    # Chỉ lấy số tổng hợp, không tải toàn bộ nội dung phiếu vào bộ nhớ.
    bat_dau, da_gui, cho = sql("SELECT COUNT(*), COALESCE(SUM(CASE WHEN gui_luc IS NOT NULL THEN 1 ELSE 0 END),0), "
                              "COALESCE(SUM(CASE WHEN gui_luc IS NOT NULL AND lien_he_luc IS NULL THEN 1 ELSE 0 END),0) "
                              "FROM phieu WHERE tra_loi<>'{}'", lay="mot")
    dung = dict(sql("SELECT nhom_dang_dung, COUNT(*) FROM phieu WHERE gui_luc IS NULL AND tra_loi<>'{}' GROUP BY nhom_dang_dung", lay="tat"))
    nguon = {}
    for ten, so in sql("SELECT nguon, SUM(so) FROM luot_xem GROUP BY nguon", lay="tat"):
        nguon.setdefault(ten or "trực tiếp", {"xem": 0, "gui": 0})["xem"] += int(so)
    for ten, so in sql("SELECT nguon, COUNT(*) FROM phieu WHERE gui_luc IS NOT NULL GROUP BY nguon", lay="tat"):
        nguon.setdefault(ten or "trực tiếp", {"xem": 0, "gui": 0})["gui"] += int(so)
    # Phiếu chưa chọn nhóm được tính vào nhóm đầu tiên.
    dung[THU_TU_NHOM[0]] = dung.get(THU_TU_NHOM[0], 0) + sum(v for k, v in dung.items() if k not in THU_TU_NHOM)
    return {"mo_trang": sum(v["xem"] for v in nguon.values()), "bat_dau": bat_dau, "da_gui": int(da_gui),
            "cho_lien_he": int(cho), "dung_o_nhom": [{"nhom": n["ten"], "so": dung.get(n["id"], 0)} for n in BO_CAU_HOI["nhom"]],
            "theo_nguon": [{"nguon": k, **v} for k, v in sorted(nguon.items())]}


def trang_phieu(trang, tim, trang_thai):
    dieu_kien, tham_so = ["p.tra_loi<>'{}'"], []
    if tim:
        chu = tim.lower().replace("!", "!!").replace("%", "!%").replace("_", "!_")
        dieu_kien.append("LOWER(p.tra_loi) LIKE ? ESCAPE '!'")
        tham_so.append("%" + chu + "%")
    loc = {"dang-do": "p.gui_luc IS NULL", "cho-lien-he": "p.gui_luc IS NOT NULL AND p.lien_he_luc IS NULL",
           "da-lien-he": "p.gui_luc IS NOT NULL AND p.lien_he_luc IS NOT NULL"}
    if trang_thai in loc:
        dieu_kien.append(loc[trang_thai])
    where = " AND ".join(dieu_kien)
    tong = sql("SELECT COUNT(*) FROM phieu p WHERE " + where, tham_so, "mot")[0]
    so_trang = max(1, (tong + 19) // 20)
    trang = min(trang, so_trang)
    dong = sql("SELECT p.id, p.tao_luc, p.gui_luc, p.lien_he_luc, p.nguon, p.tra_loi, "
               "(SELECT COUNT(*) FROM anh a WHERE a.phieu_id=p.id) FROM phieu p WHERE " + where +
               " ORDER BY p.tao_luc DESC, p.id DESC LIMIT 20 OFFSET ?", [*tham_so, (trang - 1) * 20], "tat")
    phieu = []
    for ma, tao_luc, gui_luc, lien_he_luc, nguon, tra_loi, so_anh in dong:
        t = json.loads(tra_loi or "{}")
        phieu.append({"id": ma, "tao_luc": tao_luc, "gui_luc": gui_luc, "lien_he_luc": lien_he_luc or "",
                      "loai": t.get("_loai", "chi-tiet"),
                      "nguon": nguon or "trực tiếp", "so_anh": so_anh, "san_pham": t.get("1.san_pham", ""),
                      "thuong_hieu": t.get("1.thuong_hieu", ""), "ten": t.get("19.ten", ""),
                      "lien_he": gop(t, "19.dia_chi"), "kenh": t.get("19.kenh", ""), "tom_tat": tom_tat(t)})
    return {"phieu": phieu, "trang": trang, "so_trang": so_trang, "tong": tong}


async def nv_phieu(request):
    if not la_nhan_vien(request):
        return loi("CHUA_DANG_NHAP", "Cần đăng nhập.", 401)
    try:
        trang = max(1, int(request.query_params.get("trang", "1")))
    except ValueError:
        return loi("SAI_TRANG", "Số trang chưa đúng.")
    du_lieu = await run_in_threadpool(trang_phieu, trang, request.query_params.get("tim", "")[:100], request.query_params.get("trang_thai", ""))
    du_lieu["thong_ke"] = await run_in_threadpool(thong_ke)
    return JSONResponse(du_lieu)


async def nv_danh_dau_lien_he(request):
    if not la_nhan_vien(request):
        return loi("CHUA_DANG_NHAP", "Cần đăng nhập.", 401)
    du_lieu = await doc_json(request, 2000) or {}
    phieu = await run_in_threadpool(lay_phieu, request.path_params["ma"])
    if not phieu or not phieu["gui_luc"]:
        return loi("KHONG_THAY", "Không tìm thấy phiếu đã gửi này.", 404)
    luc = bay_gio() if du_lieu.get("da_lien_he") is True else None
    await run_in_threadpool(sql, "UPDATE phieu SET lien_he_luc=? WHERE id=?", (luc, phieu["id"]))
    return JSONResponse({"lien_he_luc": luc or ""})


async def nv_xoa_phieu(request):
    if not la_nhan_vien(request):
        return loi("CHUA_DANG_NHAP", "Cần đăng nhập.", 401)
    du_lieu = await doc_json(request, 2000) or {}
    if du_lieu.get("xac_nhan") is not True:
        return loi("CHUA_XAC_NHAN", "Cần xác nhận xóa phiếu và toàn bộ ảnh đính kèm.")
    def xoa():
        with khoa_phieu(request.path_params["ma"]) as (chay, dong):
            if dong is None:
                return False
            chay("DELETE FROM anh WHERE phieu_id=?", (request.path_params["ma"],))
            chay("DELETE FROM phieu WHERE id=?", (request.path_params["ma"],))
        return True
    if not await run_in_threadpool(xoa):
        return loi("KHONG_THAY", "Không tìm thấy phiếu này.", 404)
    return JSONResponse({"da_xoa": True})


async def nv_anh_cua_phieu(request):
    if not la_nhan_vien(request):
        return loi("CHUA_DANG_NHAP", "Cần đăng nhập.", 401)
    return JSONResponse({"anh": await run_in_threadpool(danh_sach_anh, request.path_params["ma"])})


async def nv_anh(request):
    if not la_nhan_vien(request):
        return loi("CHUA_DANG_NHAP", "Cần đăng nhập.", 401)
    dong = await run_in_threadpool(sql, "SELECT kieu, du_lieu FROM anh WHERE id=?", (request.path_params["anh"],), "mot")
    if not dong:
        return loi("KHONG_THAY", "Không tìm thấy ảnh.", 404)
    return Response(bytes(dong[1]), media_type=dong[0],
                    headers={"Content-Disposition": "inline", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600"})


def an_toan_excel(chu):
    """Chặn ô bắt đầu bằng = + - @ bị Excel hiểu là công thức."""
    chu = str(chu or "")
    return "'" + chu if chu[:1] in ("=", "+", "-", "@", "\t", "\r") else chu


def tao_excel(danh_sach):
    so = Workbook()
    trang = so.active
    trang.title = "Phiếu đã gửi"
    cot = [("Gửi lúc", None), ("Đã liên hệ lúc", None), ("Nguồn", None), ("Số ảnh", None)]
    for cau in CAU:
        for tr in cau["truong"]:
            nhan = f'{cau["so"]}. {tr.get("nhan") or cau["cau"]}'
            cot.append((nhan, f'{cau["so"]}.{tr["id"]}'))
    trang.append([c[0] for c in cot] + ["Loại yêu cầu", "Mẫu tham khảo"])
    for o in trang[1]:
        o.font = Font(bold=True)
        o.fill = PatternFill("solid", fgColor="FFE9B8")
        o.alignment = Alignment(wrap_text=True, vertical="top")
    for p in danh_sach:
        if not p["gui_luc"]:
            continue
        trang.append([p["gui_luc"], p["lien_he_luc"] or "Chưa liên hệ", p["nguon"] or "trực tiếp", p["so_anh"]] +
                     [an_toan_excel(gop(p["tra_loi"], khoa)) for _, khoa in cot[4:]] +
                     ["Tư vấn nhanh" if p["tra_loi"].get("_loai") == "tu-van-nhanh" else "Phiếu chi tiết", an_toan_excel(p["tra_loi"].get("_mau", ""))])
    for i, _ in enumerate(cot, start=1):
        trang.column_dimensions[trang.cell(row=1, column=i).column_letter].width = 18 if i <= 4 else 30
    trang.freeze_panes = "E2"
    trang.row_dimensions[1].height = 60

    dang_do = so.create_sheet("Phiếu đang dở")
    dang_do.append(["Mở lúc", "Sửa lúc", "Nguồn", "Dừng ở nhóm", "Sản phẩm", "Tên", "Liên hệ"])
    ten_nhom = {n["id"]: n["ten"] for n in BO_CAU_HOI["nhom"]}
    for p in danh_sach:
        if p["gui_luc"] or not p["tra_loi"]:
            continue
        dang_do.append([p["tao_luc"], p["sua_luc"], p["nguon"] or "trực tiếp", ten_nhom.get(p["nhom_dang_dung"], ""),
                        an_toan_excel(p["tra_loi"].get("1.san_pham", "")), an_toan_excel(p["tra_loi"].get("19.ten", "")),
                        an_toan_excel(gop(p["tra_loi"], "19.dia_chi"))])
    for o in dang_do[1]:
        o.font = Font(bold=True)
    tep = io.BytesIO()
    so.save(tep)
    return tep.getvalue()


async def nv_excel(request):
    if not la_nhan_vien(request):
        return loi("CHUA_DANG_NHAP", "Cần đăng nhập.", 401)
    danh_sach = await run_in_threadpool(tat_ca_phieu)
    du_lieu = await run_in_threadpool(tao_excel, danh_sach)
    ten = f'phieu-khach-{bay_gio()[:10]}.xlsx'
    return Response(du_lieu, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="{ten}"'})


# ---------- Trang và ứng dụng ----------

async def trang_chu(request):
    # Gắn sẵn bộ câu hỏi và danh sách mẫu vào trang để trình duyệt không phải gọi thêm một lượt.
    du_lieu = json.dumps(du_lieu_cau_hinh(), ensure_ascii=False).replace("</", "<\\/")
    trang = (WEB / "index.html").read_text(encoding="utf-8").replace("__CAU_HINH__", du_lieu)
    return HTMLResponse(trang, headers={"Cache-Control": "no-cache"})


async def trang_chinh_sach(request):
    trang = (WEB / "chinh-sach.html").read_text(encoding="utf-8")
    lien_he = html.escape(LIEN_HE_HIEN_THI)
    if LINK_LIEN_HE:
        lien_he = f'<a href="{html.escape(LINK_LIEN_HE, quote=True)}">{lien_he}</a>'
    trang = trang.replace("__LIEN_HE_STUDIO__", lien_he)
    return HTMLResponse(trang, headers={"Cache-Control": "no-cache"})


async def trang_nhan_vien(request):
    return FileResponse(WEB / "nhan-vien.html", headers={"Cache-Control": "no-store"})


async def suc_khoe(request):
    await run_in_threadpool(sql, "SELECT 1", (), "mot")
    return JSONResponse({"on": True})


class BaoVe:
    """Thêm các tiêu đề bảo mật cho mọi phản hồi."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        if scope.get("method") == "POST" and re.fullmatch(r"/api/phieu/[^/]+/anh", scope.get("path", "")):
            than = bytearray()
            while True:
                tin = await receive()
                if tin["type"] == "http.disconnect":
                    return
                than.extend(tin.get("body", b""))
                if len(than) > ANH_NANG_NHAT + 200_000:
                    return await loi("ANH_QUA_NANG", f"Ảnh nặng quá {MB_ANH} MB. Anh chị vui lòng chọn ảnh nhẹ hơn.", 413)(scope, receive, send)
                if not tin.get("more_body", False):
                    break
            nhan_goc = receive
            da_doc = False
            async def nhan_anh():
                nonlocal da_doc
                if da_doc:
                    return await nhan_goc()
                da_doc = True
                return {"type": "http.request", "body": bytes(than), "more_body": False}
            receive = nhan_anh

        async def gui(tin):
            if tin["type"] == "http.response.start":
                tieu_de = list(tin.get("headers", []))
                duong = scope.get("path", "")
                if not any(ten.lower() == b"cache-control" for ten, _ in tieu_de):
                    # Phông, ảnh mẫu, video mẫu hầu như không đổi nên cho trình duyệt giữ 30 ngày; còn lại luôn hỏi lại máy chủ.
                    lau = duong.startswith(("/fonts/", "/anh-mau/", "/video-mau/")) or duong.endswith(".svg")
                    tieu_de.append((b"cache-control", b"public, max-age=2592000" if lau else b"no-store" if duong.startswith("/api/") else b"no-cache"))
                tieu_de += [(b"x-content-type-options", b"nosniff"), (b"x-frame-options", b"DENY"),
                            (b"referrer-policy", b"strict-origin-when-cross-origin"),
                            (b"content-security-policy", b"default-src 'self'; img-src 'self' data: blob: https://i.ytimg.com; style-src 'self'; "
                                                         b"script-src 'self'; frame-src https://www.youtube-nocookie.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")]
                tin = {**tin, "headers": tieu_de}
            await send(tin)

        await self.app(scope, receive, gui)


tao_bang()

app = BaoVe(GZipMiddleware(Starlette(routes=[
    Route("/", trang_chu),
    Route("/nhan-vien", trang_nhan_vien),
    Route("/chinh-sach", trang_chinh_sach),
    Route("/chinh-sach.html", trang_chinh_sach),
    Route("/api/suc-khoe", suc_khoe),
    Route("/api/cau-hinh", cau_hinh),
    Route("/api/luot-xem", ghi_luot_xem, methods=["POST"]),
    Route("/api/tu-van", gui_tu_van, methods=["POST"]),
    Route("/api/tu-van/bo-sung", bo_sung_tu_van, methods=["POST"]),
    Route("/api/phieu", mo_phieu, methods=["POST"]),
    Route("/api/phieu/{ma}", xem_phieu, methods=["GET"]),
    Route("/api/phieu/{ma}", luu_phieu, methods=["PUT"]),
    Route("/api/phieu/{ma}/anh", tai_anh, methods=["POST"]),
    Route("/api/phieu/{ma}/anh/{anh}", xoa_anh, methods=["DELETE"]),
    Route("/api/phieu/{ma}/gui", gui_phieu, methods=["POST"]),
    Route("/api/nhan-vien/dang-nhap", dang_nhap, methods=["POST"]),
    Route("/api/nhan-vien/dang-xuat", dang_xuat, methods=["POST"]),
    Route("/api/nhan-vien/phieu", nv_phieu),
    Route("/api/nhan-vien/phieu/{ma}", nv_xoa_phieu, methods=["DELETE"]),
    Route("/api/nhan-vien/phieu/{ma}/anh", nv_anh_cua_phieu),
    Route("/api/nhan-vien/phieu/{ma}/lien-he", nv_danh_dau_lien_he, methods=["POST"]),
    Route("/api/nhan-vien/anh/{anh}", nv_anh),
    Route("/api/nhan-vien/xuat-excel", nv_excel),
    Mount("/", StaticFiles(directory=WEB), name="web"),
]), minimum_size=600))
