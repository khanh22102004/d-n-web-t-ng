"""Tạo mã QR (chế độ byte, mức sửa lỗi M hoặc H, phiên bản 1–10) không cần thư viện ngoài.

Dùng cho mã QR mở trang điền phiếu: đường dẫn ngắn (dưới 200 ký tự) nên phiên bản 10 là đủ.
Theo chuẩn ISO/IEC 18004; cách đặt mô-đun và tính Reed–Solomon theo hướng dẫn của Project Nayuki.
    ma_tran("https://…/phieu")  -> danh sách hàng, mỗi ô True là ô đen
    ma_tran(url, muc="H")       -> mức sửa lỗi cao (đọc được dù 30% mã bị che), dùng khi đặt logo giữa mã
    svg(ma_tran)                -> chuỗi SVG có lề trắng 4 ô
"""

# Mức M: (số mã sửa lỗi mỗi khối, [(số khối, số mã dữ liệu mỗi khối), ...])
KHOI_M = {
    1: (10, [(1, 16)]), 2: (16, [(1, 28)]), 3: (26, [(1, 44)]), 4: (18, [(2, 32)]), 5: (24, [(2, 43)]),
    6: (16, [(4, 27)]), 7: (18, [(4, 31)]), 8: (22, [(2, 38), (2, 39)]), 9: (22, [(3, 36), (2, 37)]),
    10: (26, [(4, 43), (1, 44)]),
}
# Mức H (theo bảng 9 của chuẩn): dùng cho mã có logo ở giữa.
KHOI_H = {
    1: (17, [(1, 9)]), 2: (28, [(1, 16)]), 3: (22, [(2, 13)]), 4: (16, [(4, 9)]), 5: (22, [(2, 11), (2, 12)]),
    6: (28, [(4, 15)]), 7: (26, [(4, 13), (1, 14)]), 8: (26, [(4, 14), (2, 15)]), 9: (24, [(4, 12), (4, 13)]),
    10: (28, [(6, 15), (2, 16)]),
}
KHOI = {"M": KHOI_M, "H": KHOI_H}
BIT_MUC = {"M": 0b00, "H": 0b10}   # hai bit mức sửa lỗi trong thông tin định dạng
CAN_CHINH = {1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
             7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]}
MASK = [
    lambda x, y: (x + y) % 2 == 0,
    lambda x, y: y % 2 == 0,
    lambda x, y: x % 3 == 0,
    lambda x, y: (x + y) % 3 == 0,
    lambda x, y: (x // 3 + y // 2) % 2 == 0,
    lambda x, y: x * y % 2 + x * y % 3 == 0,
    lambda x, y: (x * y % 2 + x * y % 3) % 2 == 0,
    lambda x, y: ((x + y) % 2 + x * y % 3) % 2 == 0,
]


def _nhan(x, y):
    """Nhân trong GF(2^8), đa thức 0x11D."""
    z = 0
    for i in reversed(range(8)):
        z = (z << 1) ^ ((z >> 7) * 0x11D)
        z ^= ((y >> i) & 1) * x
    return z


def _so_chia(bac):
    kq = [0] * (bac - 1) + [1]
    goc = 1
    for _ in range(bac):
        for j in range(bac):
            kq[j] = _nhan(kq[j], goc)
            if j + 1 < bac:
                kq[j] ^= kq[j + 1]
        goc = _nhan(goc, 0x02)
    return kq


def _du(du_lieu, so_chia):
    kq = [0] * len(so_chia)
    for b in du_lieu:
        he_so = b ^ kq.pop(0)
        kq.append(0)
        for i, c in enumerate(so_chia):
            kq[i] ^= _nhan(c, he_so)
    return kq


def _ma_hoa(du_lieu: bytes, muc="M"):
    """Chọn phiên bản nhỏ nhất chứa được dữ liệu; trả (phiên bản, dãy mã đã xen khối)."""
    for pb, (so_sua, khoi) in KHOI[muc].items():
        suc_chua = sum(n * d for n, d in khoi)
        bit_dem = 8 if pb <= 9 else 16
        if 4 + bit_dem + 8 * len(du_lieu) <= suc_chua * 8:
            break
    else:
        raise ValueError("Đường dẫn quá dài cho mã QR")
    bit = [0, 1, 0, 0] + [(len(du_lieu) >> i) & 1 for i in reversed(range(bit_dem))]
    for b in du_lieu:
        bit += [(b >> i) & 1 for i in reversed(range(8))]
    bit += [0] * min(4, suc_chua * 8 - len(bit))
    bit += [0] * (-len(bit) % 8)
    ma = [int("".join(map(str, bit[i:i + 8])), 2) for i in range(0, len(bit), 8)]
    dem = 0
    while len(ma) < suc_chua:
        ma.append(0xEC if dem % 2 == 0 else 0x11)
        dem += 1
    # Chia khối, tính mã sửa lỗi từng khối, rồi xen kẽ theo cột.
    cac_khoi, vi_tri, so_chia = [], 0, _so_chia(so_sua)
    for n, d in khoi:
        for _ in range(n):
            phan = ma[vi_tri:vi_tri + d]
            vi_tri += d
            cac_khoi.append((phan, _du(phan, so_chia)))
    ket_qua = []
    for i in range(max(len(p) for p, _ in cac_khoi)):
        ket_qua += [p[i] for p, _ in cac_khoi if i < len(p)]
    for i in range(so_sua):
        ket_qua += [s[i] for _, s in cac_khoi]
    return pb, ket_qua


def ma_tran(chu: str, muc="M"):
    pb, ma = _ma_hoa(chu.encode("utf-8"), muc)
    n = pb * 4 + 17
    o = [[False] * n for _ in range(n)]
    co_dinh = [[False] * n for _ in range(n)]

    def dat(x, y, den):
        o[y][x] = den
        co_dinh[y][x] = True

    for i in range(n):                                  # vạch định thời
        dat(6, i, i % 2 == 0)
        dat(i, 6, i % 2 == 0)
    for cx, cy in ((3, 3), (n - 4, 3), (3, n - 4)):     # ba ô vuông định vị kèm viền trắng
        for dy in range(-4, 5):
            for dx in range(-4, 5):
                x, y = cx + dx, cy + dy
                if 0 <= x < n and 0 <= y < n:
                    k = max(abs(dx), abs(dy))
                    dat(x, y, k not in (2, 4))
    vt = CAN_CHINH[pb]                                  # ô căn chỉnh
    for i, a in enumerate(vt):
        for j, b in enumerate(vt):
            if (i == 0 and j == 0) or (i == 0 and j == len(vt) - 1) or (i == len(vt) - 1 and j == 0):
                continue
            for dy in range(-2, 3):
                for dx in range(-2, 3):
                    dat(a + dx, b + dy, max(abs(dx), abs(dy)) != 1)

    def thong_tin_dinh_dang(mask):
        du_lieu = (BIT_MUC[muc] << 3) | mask
        du = du_lieu
        for _ in range(10):
            du = (du << 1) ^ ((du >> 9) * 0x537)
        bits = ((du_lieu << 10) | du) ^ 0x5412
        lay = lambda i: (bits >> i) & 1 == 1
        for i in range(6):
            dat(8, i, lay(i))
        dat(8, 7, lay(6)); dat(8, 8, lay(7)); dat(7, 8, lay(8))
        for i in range(9, 15):
            dat(14 - i, 8, lay(i))
        for i in range(8):
            dat(n - 1 - i, 8, lay(i))
        for i in range(8, 15):
            dat(8, n - 15 + i, lay(i))
        dat(8, n - 8, True)                             # ô đen cố định

    thong_tin_dinh_dang(0)                              # giữ chỗ trước khi đặt dữ liệu
    if pb >= 7:                                         # thông tin phiên bản
        du = pb
        for _ in range(12):
            du = (du << 1) ^ ((du >> 11) * 0x1F25)
        bits = pb << 12 | du
        for i in range(18):
            b = (bits >> i) & 1 == 1
            a, c = n - 11 + i % 3, i // 3
            dat(a, c, b); dat(c, a, b)

    i = 0                                               # đặt dữ liệu theo đường zic zắc
    phai = n - 1
    while phai >= 1:
        if phai == 6:
            phai = 5
        for doc in range(n):
            for j in range(2):
                x = phai - j
                len_tren = ((phai + 1) & 2) == 0
                y = n - 1 - doc if len_tren else doc
                if not co_dinh[y][x] and i < len(ma) * 8:
                    o[y][x] = (ma[i >> 3] >> (7 - (i & 7))) & 1 == 1
                    i += 1
        phai -= 2

    def ap_mask(m):
        for y in range(n):
            for x in range(n):
                if not co_dinh[y][x] and MASK[m](x, y):
                    o[y][x] = not o[y][x]

    tot, diem_tot = 0, None
    for m in range(8):                                  # thử 8 mặt nạ, lấy mặt nạ ít điểm phạt nhất
        ap_mask(m); thong_tin_dinh_dang(m)
        d = _diem_phat(o)
        if diem_tot is None or d < diem_tot:
            tot, diem_tot = m, d
        ap_mask(m)
    ap_mask(tot); thong_tin_dinh_dang(tot)
    return o


def _diem_phat(o):
    n, diem = len(o), 0
    hang = o + [list(c) for c in zip(*o)]
    for dong in hang:                                   # chuỗi cùng màu từ 5 ô
        dem = 1
        for a, b in zip(dong, dong[1:]):
            if a == b:
                dem += 1
            else:
                if dem >= 5:
                    diem += dem - 2
                dem = 1
        if dem >= 5:
            diem += dem - 2
        s = "".join("1" if v else "0" for v in dong)    # mẫu giống ô định vị
        diem += 40 * (s.count("10111010000") + s.count("00001011101"))
    for y in range(n - 1):                              # khối 2x2 cùng màu
        for x in range(n - 1):
            if o[y][x] == o[y][x + 1] == o[y + 1][x] == o[y + 1][x + 1]:
                diem += 3
    den = sum(map(sum, o))
    tong = n * n
    diem += ((abs(den * 20 - tong * 10) + tong - 1) // tong - 1) * 10
    return diem


def svg(o, le=4):
    n = len(o) + 2 * le
    duong = "".join(f"M{x + le},{y + le}h1v1h-1z" for y, dong in enumerate(o) for x, v in enumerate(dong) if v)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" shape-rendering="crispEdges">'
            f'<rect width="{n}" height="{n}" fill="#fff"/><path d="{duong}" fill="#000"/></svg>')


def png(o, co=1024, le=4):
    """Ảnh PNG đen trắng; mỗi ô là số điểm ảnh nguyên để in ra vẫn sắc nét."""
    from io import BytesIO
    from PIL import Image
    n = len(o) + 2 * le
    buoc = max(1, co // n)
    anh = Image.new("1", (n, n), 1)
    for y, dong in enumerate(o):
        for x, v in enumerate(dong):
            if v:
                anh.putpixel((x + le, y + le), 0)
    anh = anh.resize((n * buoc, n * buoc), Image.NEAREST)
    ra = BytesIO()
    anh.save(ra, "PNG", optimize=True)
    return ra.getvalue()
