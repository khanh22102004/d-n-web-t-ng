"""Tạo ảnh mã QR có logo B PRODUCTIONS ở giữa và dòng chữ bên dưới, để in hoặc gửi khách.

Mã dùng mức sửa lỗi H (đọc được dù khoảng 30% mã bị che) nên logo ở giữa không làm hỏng mã.
Mỗi ảnh tạo ra đều được đọc thử lại bằng ba bộ đọc QR của OpenCV ở nhiều cỡ; đọc sai thì dừng, không lưu.

Chạy trong thư mục web-b-productions:
    python cong-cu/tao_ma_qr_in.py
    python cong-cu/tao_ma_qr_in.py --url https://dichvuvideo-ai.bprovn.com/phieu?nguon=ma-qr --ra du-lieu/ma-qr
Trang nhân viên cũng tải được đúng ảnh này (nút "Tải ảnh gửi Zalo", "Tải ảnh để in"), theo tên miền đang mở.

Tạo hai ảnh: bản gửi Zalo/Facebook (1080 x 1350) và bản in (2480 x 3100, khoảng 21 x 26 cm ở 300 dpi).
Cần Pillow; opencv-python và numpy để đọc thử (thiếu thì báo và không kiểm được).
"""
import argparse
import sys
from pathlib import Path

GOC = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(GOC))
from the_qr import CO, ve_the  # noqa: E402  (vẽ ảnh dùng chung với máy chủ: /ma-qr.png ở trang nhân viên)

URL_MAC_DINH = "https://ks-bpro.vercel.app/phieu?nguon=ma-qr"


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
    for ten, (rong, cao) in (("ma-qr-phieu-cau-hoi.png", CO["zalo"]), ("ma-qr-phieu-cau-hoi-ban-in.png", CO["in"])):
        anh = ve_the(a.url, rong, cao)
        nang, le = doc_thu(anh, a.url)
        if nang:
            raise SystemExit(f"{ten}: đọc thử hỏng ({'; '.join(nang)}). Không lưu.")
        anh.save(ra / ten, "PNG", optimize=True, dpi=(300, 300))
        print(f"Đã lưu {ra / ten} — đọc thử đạt" + (f" (trượt lẻ: {'; '.join(le)})" if le else " với cả ba bộ đọc ở mọi cỡ"))


if __name__ == "__main__":
    main()
