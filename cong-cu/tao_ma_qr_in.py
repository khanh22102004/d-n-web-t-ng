"""Tạo ảnh mã QR có logo B PRODUCTIONS ở giữa và dòng chữ bên dưới, để in hoặc gửi khách.

Mã dùng mức sửa lỗi H (đọc được dù khoảng 30% mã bị che) nên logo ở giữa không làm hỏng mã.
Mỗi ảnh tạo ra đều được đọc thử lại bằng ba bộ đọc QR của OpenCV ở nhiều cỡ; đọc sai thì dừng, không lưu.

Chạy trong thư mục web-b-productions:
    python cong-cu/tao_ma_qr_in.py
    python cong-cu/tao_ma_qr_in.py --url https://dichvuvideo-ai.bprovn.com/phieu?nguon=ma-qr --ra du-lieu/ma-qr

Tạo hai ảnh: bản gửi Zalo/Facebook (1080 x 1350) và bản in (2480 x 3100, khoảng 21 x 26 cm ở 300 dpi).
Cần Pillow và numpy; opencv-python để đọc thử (thiếu thì báo và không kiểm được).
"""
import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

GOC = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(GOC))
import ma_qr  # noqa: E402

URL_MAC_DINH = "https://d-n-web-t-ng.vercel.app/phieu?nguon=ma-qr"
TIEU_DE = "Phiếu câu hỏi làm video"
DONG_HAI = "Quý khách hàng quét mã để trả lời câu hỏi"
PHONG = GOC / "web" / "fonts"
LOGO = GOC / "web" / "logo-b-productions.png"
DEN, XAM = (0, 0, 0), (90, 92, 96)
LE_QR = 4                 # lề trắng quanh mã (số ô), theo chuẩn
O_LOGO = (15, 11)         # khung trắng đặt logo: rộng x cao, tính bằng ô của mã


def logo_cat():
    """Logo gồm hình mã vạch và chữ B PRODUCTIONS; bỏ dòng chữ nhỏ bên dưới vì đặt giữa mã sẽ quá nhỏ để đọc."""
    import numpy as np
    anh = Image.open(LOGO).convert("RGBA")
    nen = Image.new("RGBA", anh.size, "white"); nen.alpha_composite(anh)
    den = np.array(nen.convert("L")) < 128
    hang = np.where(den.any(1))[0]
    doan, dau = [], hang[0]                      # các dải hàng có nét: hình, chữ lớn, chữ nhỏ
    for a, b in zip(hang, hang[1:]):
        if b != a + 1:
            doan.append((dau, a)); dau = b
    doan.append((dau, hang[-1]))
    tren, duoi = doan[0][0], doan[min(1, len(doan) - 1)][1]
    cot = np.where(den[tren:duoi + 1].any(0))[0]
    return nen.convert("RGB").crop((cot.min(), tren, cot.max() + 1, duoi + 1))


def ve_the(url, rong, cao):
    o = ma_qr.ma_tran(url, "H")
    n = len(o)
    k = rong / 1080                              # tỉ lệ so với bản 1080 điểm ảnh
    so_o = n + 2 * LE_QR
    buoc = int((rong - 2 * round(36 * k)) // so_o)   # mỗi ô là số điểm ảnh nguyên để in sắc nét
    co_qr = buoc * so_o
    the = Image.new("RGB", (rong, cao), "white")
    ve = ImageDraw.Draw(the)
    # Chữ bên dưới mã: đo trước để đặt cả khối (mã + chữ) vào giữa ảnh theo chiều dọc.
    phong_lon = ImageFont.truetype(str(PHONG / "InterDisplay-ExtraBold.woff"), round(66 * k))
    phong_vua = ImageFont.truetype(str(PHONG / "Inter-SemiBold.woff"), round(36 * k))
    phong_nho = ImageFont.truetype(str(PHONG / "Inter-Regular.woff"), round(27 * k))
    dia_chi = url.split("://", 1)[-1].split("?", 1)[0]
    cac_dong = [(TIEU_DE, phong_lon, DEN, round(8 * k)), (DONG_HAI, phong_vua, DEN, round(28 * k)),
            (f"Hoặc mở trang {dia_chi}", phong_nho, XAM, round(24 * k))]
    cao_chu = sum(c + (ve.textbbox((0, 0), chu, font=f)[3] - ve.textbbox((0, 0), chu, font=f)[1]) for chu, f, _, c in cac_dong)
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
    toi_da_r, toi_da_c = (w - 2) * buoc, (h - 2) * buoc
    ti = min(toi_da_r / logo.width, toi_da_c / logo.height)
    logo = logo.resize((round(logo.width * ti), round(logo.height * ti)), Image.LANCZOS)
    the.paste(logo, ((kx0 + kx1 + 1 - logo.width) // 2, (ky0 + ky1 + 1 - logo.height) // 2))
    y = y0 + n * buoc + LE_QR * buoc
    for chu, phong, mau, cach in cac_dong:
        y += cach
        hop = ve.textbbox((0, 0), chu, font=phong)
        ve.text(((rong - (hop[2] - hop[0])) // 2 - hop[0], y - hop[1]), chu, font=phong, fill=mau)
        y += hop[3] - hop[1]
    if y > cao - round(30 * k):
        raise SystemExit(f"Chữ tràn khỏi ảnh {rong}x{cao}; tăng chiều cao.")
    return the


def doc_thu(anh, url):
    """Đọc lại bằng ba bộ đọc của OpenCV, ở cỡ gốc và cỡ nhỏ như ảnh chụp điện thoại.
    Trả (lần đọc hỏng nặng, lần đọc hỏng lẻ). Hỏng nặng: bộ đọc WeChat (gần với Zalo) không đọc được,
    hoặc quá nửa số bộ đọc không đọc được ở cùng một cỡ. Từng bộ đọc của OpenCV đôi khi trượt ở một cỡ lẻ
    dù mã đúng chuẩn, nên một lần trượt đơn lẻ chỉ được báo, không chặn."""
    try:
        import cv2
        import numpy as np
    except ImportError:
        print("Chưa có opencv-python: bỏ qua bước đọc thử."); return [], []
    bo_doc = [("thường", cv2.QRCodeDetector())]
    if hasattr(cv2, "QRCodeDetectorAruco"):
        bo_doc.append(("aruco", cv2.QRCodeDetectorAruco()))
    if hasattr(cv2, "wechat_qrcode_WeChatQRCode"):
        bo_doc.append(("wechat", cv2.wechat_qrcode_WeChatQRCode()))
    goc = np.array(anh.convert("L"))
    nang, le = [], []
    for rong in (anh.width, 720, 480, 360):
        a = cv2.resize(goc, (rong, round(goc.shape[0] * rong / goc.shape[1])), interpolation=cv2.INTER_AREA)
        for mo in (0, 1.2):                       # 1,2: làm mờ nhẹ như ảnh chụp hơi rung
            b = cv2.GaussianBlur(a, (0, 0), mo) if mo else a
            truot = []
            for ten, d in bo_doc:
                kq = d.detectAndDecode(b)
                doc = (kq[0][0] if kq[0] else "") if ten == "wechat" else kq[0]
                if doc != url:
                    truot.append(ten)
            cho = f"cỡ {rong}px{' (mờ)' if mo else ''}"
            if "wechat" in truot or 2 * len(truot) > len(bo_doc):
                nang.append(f"{', '.join(truot)} ở {cho}")
            elif truot:
                le.append(f"{', '.join(truot)} ở {cho}")
    return nang, le


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--url", default=URL_MAC_DINH, help="đường dẫn trong mã (mặc định: trang điền phiếu, nguồn ma-qr)")
    p.add_argument("--ra", default=str(GOC / "du-lieu" / "ma-qr"), help="thư mục lưu ảnh")
    a = p.parse_args()
    ra = Path(a.ra); ra.mkdir(parents=True, exist_ok=True)
    for ten, (rong, cao) in (("ma-qr-phieu-cau-hoi.png", (1080, 1350)), ("ma-qr-phieu-cau-hoi-ban-in.png", (2480, 3100))):
        anh = ve_the(a.url, rong, cao)
        nang, le = doc_thu(anh, a.url)
        if nang:
            raise SystemExit(f"{ten}: đọc thử hỏng ({'; '.join(nang)}). Không lưu.")
        anh.save(ra / ten, "PNG", optimize=True, dpi=(300, 300))
        print(f"Đã lưu {ra / ten} — đọc thử đạt" + (f" (trượt lẻ: {'; '.join(le)})" if le else " với cả ba bộ đọc ở mọi cỡ"))


if __name__ == "__main__":
    main()
