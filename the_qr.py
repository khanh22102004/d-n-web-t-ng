"""Ảnh mã QR mở trang điền phiếu, có logo B PRODUCTIONS ở giữa và dòng chữ bên dưới, để in hoặc gửi khách.

Mã dùng mức sửa lỗi H (đọc được dù khoảng 30% mã bị che) nên logo ở giữa không làm hỏng mã.
Máy chủ dùng tệp này cho /ma-qr.png (trang nhân viên); cong-cu/tao_ma_qr_in.py dùng để tạo ảnh và đọc thử bằng OpenCV.
Chỉ cần Pillow; phông Inter lấy trong web/fonts/.
"""
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

import ma_qr

GOC = Path(__file__).resolve().parent
PHONG = GOC / "web" / "fonts"
LOGO = GOC / "web" / "logo-b-productions.png"
TIEU_DE = "Phiếu câu hỏi làm video"
DONG_HAI = "Quý khách hàng quét mã để trả lời câu hỏi"
DEN, XAM = (0, 0, 0), (90, 92, 96)
LE_QR = 4                 # lề trắng quanh mã (số ô), theo chuẩn
O_LOGO = (15, 11)         # khung trắng đặt logo: rộng x cao, tính bằng ô của mã
CO = {"zalo": (1080, 1350), "in": (2480, 3100)}   # gửi Zalo/Facebook; in (khoảng 21 x 26 cm ở 300 dpi)


@lru_cache(maxsize=1)
def logo_cat():
    """Logo gồm hình mã vạch và chữ B PRODUCTIONS; bỏ dòng chữ nhỏ bên dưới vì đặt giữa mã sẽ quá nhỏ để đọc."""
    anh = Image.open(LOGO).convert("RGBA")
    nen = Image.new("RGBA", anh.size, "white")
    nen.alpha_composite(anh)
    nen = nen.convert("RGB")
    den = nen.convert("L").point(lambda v: 255 if v < 128 else 0)
    co_net = [den.crop((0, y, den.width, y + 1)).getbbox() is not None for y in range(den.height)]
    doan, y = [], 0                               # các dải hàng có nét: hình mã vạch, chữ lớn, chữ nhỏ
    while y < len(co_net):
        if co_net[y]:
            dau = y
            while y < len(co_net) and co_net[y]:
                y += 1
            doan.append((dau, y))
        y += 1
    tren, duoi = doan[0][0], doan[min(1, len(doan) - 1)][1]
    trai, _, phai, _ = den.crop((0, tren, den.width, duoi)).getbbox()
    return nen.crop((trai, tren, phai, duoi))


def _phong(ten, co, rong_toi_da, chu):
    """Phông cỡ co, thu nhỏ dần nếu dòng chữ dài hơn bề ngang cho phép."""
    while True:
        f = ImageFont.truetype(str(PHONG / ten), co)
        if f.getlength(chu) <= rong_toi_da or co <= 12:
            return f
        co -= 2


def ve_the(url, rong, cao, tieu_de=TIEU_DE, dong_hai=DONG_HAI):
    o = ma_qr.ma_tran(url, "H")
    n = len(o)
    k = rong / 1080                              # tỉ lệ so với bản 1080 điểm ảnh
    so_o = n + 2 * LE_QR
    buoc = int((rong - 2 * round(36 * k)) // so_o)   # mỗi ô là số điểm ảnh nguyên để in sắc nét
    co_qr = buoc * so_o
    the = Image.new("RGB", (rong, cao), "white")
    ve = ImageDraw.Draw(the)
    # Chữ bên dưới mã: đo trước để đặt cả khối (mã + chữ) vào giữa ảnh theo chiều dọc.
    dia_chi = url.split("://", 1)[-1].split("?", 1)[0]
    duoi = f"Hoặc mở trang {dia_chi}"
    rong_chu = rong - 2 * round(60 * k)
    cac_dong = [(tieu_de, _phong("InterDisplay-ExtraBold.woff", round(66 * k), rong_chu, tieu_de), DEN, round(8 * k)),
                (dong_hai, _phong("Inter-SemiBold.woff", round(36 * k), rong_chu, dong_hai), DEN, round(28 * k)),
                (duoi, _phong("Inter-Regular.woff", round(27 * k), rong_chu, duoi), XAM, round(24 * k))]
    cao_chu = sum(c + ve.textbbox((0, 0), chu, font=f)[3] - ve.textbbox((0, 0), chu, font=f)[1] for chu, f, _, c in cac_dong)
    tren = max(0, (cao - co_qr - cao_chu) // 2)
    x0, y0 = (rong - co_qr) // 2 + LE_QR * buoc, tren + LE_QR * buoc
    for y, dong in enumerate(o):
        for x, v in enumerate(dong):
            if v:
                ve.rectangle([x0 + x * buoc, y0 + y * buoc, x0 + (x + 1) * buoc - 1, y0 + (y + 1) * buoc - 1], fill=DEN)
    # Khung trắng giữa mã, đúng lưới ô, rồi đặt logo vào giữa khung.
    w, h = O_LOGO
    ox, oy = (n - w) // 2, (n - h) // 2
    kx0, ky0, kx1, ky1 = x0 + ox * buoc, y0 + oy * buoc, x0 + (ox + w) * buoc - 1, y0 + (oy + h) * buoc - 1
    ve.rectangle([kx0, ky0, kx1, ky1], fill="white")
    logo = logo_cat()
    ti = min((w - 2) * buoc / logo.width, (h - 2) * buoc / logo.height)
    logo = logo.resize((round(logo.width * ti), round(logo.height * ti)), Image.LANCZOS)
    the.paste(logo, ((kx0 + kx1 + 1 - logo.width) // 2, (ky0 + ky1 + 1 - logo.height) // 2))
    y = y0 + n * buoc + LE_QR * buoc
    for chu, phong, mau, cach in cac_dong:
        y += cach
        hop = ve.textbbox((0, 0), chu, font=phong)
        ve.text(((rong - (hop[2] - hop[0])) // 2 - hop[0], y - hop[1]), chu, font=phong, fill=mau)
        y += hop[3] - hop[1]
    if y > cao - round(30 * k):
        raise ValueError(f"Chữ tràn khỏi ảnh {rong}x{cao}")
    return the


def png(url, co="zalo", **chu):
    from io import BytesIO
    anh = ve_the(url, *CO[co], **chu)
    ra = BytesIO()
    anh.save(ra, "PNG", optimize=co != "in", dpi=(300, 300))
    return ra.getvalue()
