# B PRODUCTIONS — Trang tiếp nhận yêu cầu video AI

Trang web công khai giúp chủ shop và doanh nghiệp xem video mẫu làm bằng AI, chọn phong cách, rồi gửi yêu cầu để B PRODUCTIONS tư vấn, lên phương án và báo giá. Khách không cần tạo tài khoản. Nhân viên xem và xử lý yêu cầu tại `/nhan-vien`.

- Trang đang chạy: https://d-n-web-t-ng.vercel.app
- Công ty: B PRODUCTIONS — https://www.bprovn.com
- Mã nguồn: https://github.com/khanh22102004/d-n-web-t-ng

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Tính năng](#2-tính-năng)
3. [Nhận diện và giao diện](#3-nhận-diện-và-giao-diện)
4. [Cấu trúc thư mục](#4-cấu-trúc-thư-mục)
5. [Kiến trúc kỹ thuật](#5-kiến-trúc-kỹ-thuật)
6. [Chạy trên máy](#6-chạy-trên-máy)
7. [Cấu hình](#7-cấu-hình)
8. [Nội dung: mẫu, câu hỏi, đánh giá, số liệu](#8-nội-dung-mẫu-câu-hỏi-đánh-giá-số-liệu)
9. [API](#9-api)
10. [Triển khai](#10-triển-khai)
11. [Cập nhật một bản đang dùng](#11-cập-nhật-một-bản-đang-dùng)
12. [Dữ liệu, ảnh và quyền riêng tư](#12-dữ-liệu-ảnh-và-quyền-riêng-tư)
13. [Kiểm thử](#13-kiểm-thử)
14. [Giới hạn và việc chờ xác nhận](#14-giới-hạn-và-việc-chờ-xác-nhận)
15. [Lịch sử thay đổi](#15-lịch-sử-thay-đổi)

---

## 1. Tổng quan

**Mục tiêu:** biến người xem thành người để lại số điện thoại, bằng cách cho họ thấy ngay video mẫu thật và chỉ hỏi những gì cần để tư vấn.

**Hành trình của khách:**

```
Màn hình đầu  →  Thư viện 13 video mẫu  →  Tư vấn nhanh (2 ô)  →  Studio liên hệ
     │                    │                        │
     │                    └─ Khung xem video ──────┤  (form ngay dưới video)
     └─ "Tôi đã có yêu cầu cụ thể" → Phiếu chi tiết 20 câu → Xác nhận
```

**Người dùng:**

| Ai | Làm gì | Ở đâu |
|---|---|---|
| Khách | Xem mẫu, gửi tư vấn nhanh hoặc phiếu chi tiết | `/` |
| Nhân viên studio | Xem, tìm, lọc, đánh dấu đã liên hệ, xuất Excel, xóa phiếu | `/nhan-vien` |
| Mọi người | Đọc cách dùng thông tin | `/chinh-sach` |

**Giọng văn:** tiếng Việt, xưng "chúng tôi", gọi khách là "Quý khách hàng" (viết hoa chữ Q), lịch sự, không dùng "ạ"; câu đã có "Quý khách hàng" thì câu ngay sau không lặp lại (ví dụ "Vui lòng thử lại sau."). Trang nhân viên giữ cách gọi nội bộ. Không đưa lời chứng thực, số liệu, giá hay khách hàng chưa được studio xác nhận.

## 2. Tính năng

### Phía khách

- **Màn hình đầu:** tiêu đề "Video AI chân thật chất lượng cao", ba điện thoại xòe quạt phát video mẫu, nền là tường poster các mẫu trôi chậm. Mẫu đầu tiên là ST025 (hoạt hình giới thiệu món ăn).
- **Điện thoại có tiếng:** video chạy không tiếng khi vào trang; tiếng chỉ bật khi khách bấm vào video trên điện thoại hoặc nút "Bật tiếng" (chạm chỗ khác, như ô điền thông tin, không bật tiếng). Đây là giới hạn của trình duyệt: không trang nào tự phát có tiếng khi khách chưa tương tác.
- **Thư viện mẫu:** 13 mẫu, lọc "Tất cả / Mẫu nổi bật / Ngành hàng". Bấm ảnh mở khung xem video có tiếng, lướt qua các mẫu, và có nút "Nhận báo giá làm video kiểu này" mở form ngay dưới video.
- **Tư vấn nhanh:** chỉ cần tên sản phẩm và số điện thoại, chọn Zalo hoặc gọi điện, đánh dấu đồng ý. Gửi xong có thể trả lời thêm (tên, thời hạn, ngân sách, nơi đăng), không bắt buộc, trong 24 giờ.
- **Phiếu chi tiết:** 20 câu chia 6 phần, lưu nháp sau khi khách đồng ý, Back/Forward của trình duyệt dùng được, khôi phục khi tải lại hoặc mất mạng, gửi kèm tối đa 3 ảnh.
- Giới thiệu B PRODUCTIONS, Góc chia sẻ gồm đường dẫn blog công ty và một bài đọc thêm.
- **Gộp yêu cầu:** khách gửi tư vấn nhanh rồi gửi phiếu chi tiết với cùng số điện thoại thì hai yêu cầu thành một.
- **Nguồn khách:** đọc `?nguon=tiktok|facebook|zalo` hoặc `utm_source`.

### Phía nhân viên

- Đăng nhập bằng mật khẩu chung (`ADMIN_PASSWORD`).
- Danh sách yêu cầu có tìm kiếm, lọc trạng thái, phân trang, xem chi tiết và ảnh, đánh dấu đã liên hệ, xóa phiếu kèm ảnh sau xác nhận.
- Thống kê lượt mở trang, phiếu bắt đầu/gửi, khách dừng ở phần nào, theo nguồn.
- Xuất Excel toàn bộ yêu cầu (gồm cột "Loại yêu cầu" và "Mẫu tham khảo").

## 3. Nhận diện và giao diện

Giao diện theo nhận diện của công ty mẹ B PRODUCTIONS. Nguồn và quyết định chi tiết ở [BRAND_SOURCES.md](BRAND_SOURCES.md).

### Màu

Một hệ màu cho cả trang. **Màu chính lấy từ màn hình đầu**: giấy trắng, đá ấm, mực than. **Màu phụ lấy từ logo**: đen tuyền và họa tiết mã vạch. Màu sắc còn lại chỉ đến từ chính video và ảnh mẫu.

| Vai trò | Biến CSS | Mã | Dùng cho |
|---|---|---|---|
| Giấy | `--bp-giay` | `#ffffff` | Nền chính, thẻ form |
| Đá 1 | `--bp-da-1` | `#f5f3ef` | Phần "Về B Productions", nút phụ khi rê chuột |
| Đá 2 | `--bp-da-2` | `#ebe7e1` | Đường kẻ, nhãn mã mẫu |
| Đá 3 | `--bp-da-3` | `#dad6cf` | Cuối dải nền màn hình đầu |
| Mực than | `--bp-muc` | `#202224` | Chữ, nút chính, dải thư viện mẫu, dải tư vấn |
| Mực nhạt | `--bp-muc-2` / `--bp-muc-3` | `#505255` / `#6b6d70` | Chữ mô tả, chú thích |
| Logo | `--bp-logo` | `#111111` | Cột "B Productions làm", chân trang, khung điện thoại, thanh tiến độ |
| Báo lỗi | `--do` | `#b3261e` | Chỉ dùng cho lỗi |

Nhịp các phần: màn hình đầu (giấy → đá) · thư viện (mực than) · về B Productions (đá) · tư vấn (mực than) · Góc chia sẻ (giấy) · chân trang (đen logo).

### Logo và điểm nhấn

- Logo gốc của công ty: `web/logo-b-productions.png` (ở đầu trang chính, chính sách, nhân viên); logo **luôn giữ chữ đen gốc**, không đảo màu: ở chân trang nền tối, logo đặt trên một ô trắng; ở phần "Về B Productions", logo nằm trên thẻ nền giấy trắng. Favicon: `web/bieu-tuong.png`.
- **Họa tiết mã vạch** đo đúng từ logo gốc (biến `--bp-ma-vach`): 11 vạch cách đều, dày dần từ trái sang phải, khung tỉ lệ 365 : 205. Đây là điểm nhấn xuyên suốt: dưới tiêu đề lớn (kèm vạch quét) và phía trên tiêu đề mỗi phần. Bốn góc khung ngắm máy quay ôm tiêu đề màn hình đầu và thẻ logo ở phần "Về B Productions".
- Chữ: Inter và Inter Display (tệp cục bộ trong `web/fonts/`, giấy phép OFL).

### Hiệu ứng

Một nhịp chung, vừa phải:

| Ở đâu | Hiệu ứng |
|---|---|
| Màn hình đầu (một lần khi tải) | Ba dòng tiêu đề trồi lên lần lượt; vạch mã vạch vẽ ra; mô tả và nút hiện lên; hai điện thoại bên xòe ra từ máy giữa |
| Mỗi phần khi cuộn tới (một lần) | Phần mờ → rõ, trồi lên 22 px; vạch mã vạch trên tiêu đề vẽ ra; thẻ và dòng bên trong nối đuôi nhau |
| Rê chuột | Thẻ mẫu và bài đọc nhấc lên; mũi tên trong nút nhích |
| Liên tục | Tường poster ở màn hình đầu trôi chậm; điện thoại tự chuyển mẫu |

Khách bật **giảm chuyển động** thì mọi hiệu ứng tắt, nội dung hiện đầy đủ ngay. Nút "Dừng chuyển động" dưới điện thoại dừng tường poster và việc tự chuyển mẫu. Tường poster cũng dừng khi khách rê chuột lên điện thoại, mở hộp thoại, chuyển tab hoặc bật tiết kiệm dữ liệu.

### Thứ tự lớp CSS

| Trang | Thứ tự nạp |
|---|---|
| Trang chủ `/`, chính sách `/chinh-sach` | `style.css` → `brand.css` → `desktop.css` → `can-doi.css` |
| Nhân viên `/nhan-vien` | `style.css` → `brand.css` → `nhan-vien.css` → `can-doi.css` |

- `style.css`: cấu trúc, bố cục và mọi thành phần (tích lũy qua các bản).
- `brand.css`: nhận diện công ty mẹ, chỉ áp dụng trên `body.parent-brand`.
- `desktop.css`: bố cục màn hình rộng cho khung xem video, phiếu, chính sách.
- `nhan-vien.css`: riêng trang nhân viên.
- `can-doi.css`: bảng màu thống nhất, họa tiết logo và hiệu ứng; luôn nạp sau cùng.

Muốn đổi màu, chỉ sửa các biến `--bp-*` ở đầu `web/can-doi.css`.

## 4. Cấu trúc thư mục

```
web-b-productions/
├── app.py                  # Điểm vào cho Vercel (import app từ may_chu)
├── may_chu.py              # Máy chủ Starlette: trang, API, lưu trữ, Excel
├── cau_hoi.json            # 20 câu hỏi của phiếu chi tiết
├── mau.json                # 13 video mẫu (mã, tên, ngành, kiểu, YouTube, số liệu)
├── danh_gia.json           # Đánh giá thật của khách (đang trống → phần đánh giá ẩn)
├── requirements.txt        # Thư viện chạy
├── requirements-test.txt   # Thư viện kiểm thử
├── render.yaml             # Cấu hình Render (cách triển khai thay thế)
├── CHAY-WEB.bat            # Chạy nhanh trên Windows
├── .env.example            # Mẫu cấu hình; CHAY-WEB.bat tự chép thành .env
├── BRAND_SOURCES.md        # Nguồn và quyết định nhận diện
├── KIEM_TRA_GIAO_DIEN.md   # Kết quả kiểm tra giao diện
├── tests/
│   ├── test_regressions.py # 26 kiểm thử máy chủ
│   └── browser_history.py  # Kiểm thử Back/Forward bằng Chromium
└── web/
    ├── index.html          # Trang khách
    ├── chinh-sach.html     # Cách dùng thông tin
    ├── nhan-vien.html/.js  # Trang nhân viên
    ├── app.js              # Toàn bộ tương tác phía khách
    ├── style.css, brand.css, desktop.css, can-doi.css, nhan-vien.css
    ├── logo-b-productions.png/.webp, bieu-tuong.png
    ├── ma-vach.svg            # Mã vạch đo từ logo, dùng làm họa tiết điểm nhấn
    ├── fonts/              # Inter, Inter Display (OFL)
    ├── anh-mau/            # Ảnh bìa mẫu (và nho/ bản nhỏ .webp)
    └── video-mau/          # Đặt video gốc .mp4/.webm của studio vào đây
```

## 5. Kiến trúc kỹ thuật

- **Máy chủ:** Python 3.12, Starlette, Uvicorn. Một tiến trình phục vụ cả trang tĩnh lẫn API.
- **Lưu trữ:** SQLite trong `du-lieu/` khi chạy trên máy; PostgreSQL (Neon) khi có `DATABASE_URL`. Bảng và chỉ mục tự tạo khi khởi động; mã nâng cấp không xóa dữ liệu cũ.
- **Phía khách:** HTML, CSS, JavaScript thuần, không thư viện, không bước build.
- **Video:** YouTube nhúng (`youtube-nocookie.com`); đặt tệp vào `web/video-mau/` để phát tại chỗ.
- **Bảo mật:** Content-Security-Policy, cookie phiên ký bằng `SECRET_KEY`, giới hạn tần suất gửi, chống gửi trùng, ô bẫy chống bot, ảnh tải lên được giải mã và tạo lại.
- **Bộ nhớ đệm:** trang công khai và tệp tĩnh có `s-maxage` cho CDN của Vercel.

### Hiệu năng cho máy yếu

- **Nhận biết máy yếu** (`app.js`, biến `mayYeu`, lớp `html.may-yeu`): RAM từ 4 GB trở xuống, CPU từ 4 nhân trở xuống, hoặc bật tiết kiệm dữ liệu. Khi đó: tường ảnh nền đứng yên, không làm mờ nền (`backdrop-filter`), tiêu đề thư viện không dùng làm mờ khi lấy nét, không có ánh kim và vạch quét lặp, ảnh mẫu không trôi kiểu Ken Burns, không có tim/bình luận bay lên, không nghiêng 3D theo chuột, và **không tự tải trình phát YouTube**, ở cả điện thoại đầu trang lẫn thẻ thư viện: khách bấm vào thì video mới tải và phát. Điện thoại đổi mẫu thưa hơn (6,5 giây thay vì 4 giây), không có thanh đếm giờ, sóng âm và con trỏ chữ đứng yên.
- **Mọi máy:** tường ảnh nền chỉ dựng cho loại màn hình đang xem (máy tính cột dọc, điện thoại hàng ngang), tự dựng lại khi đổi khổ qua 760px; số ảnh lặp vừa đủ cho vòng trôi liền mạch; bỏ lớp tường thứ hai chỉ để vẽ viền, bỏ bộ lọc màu và bóng đổ trên tường. Phần nào khuất khỏi màn hình thì dừng mọi hiệu ứng CSS bên trong (lớp `.khuat`); các phần phía dưới dùng `content-visibility: auto`.
- **Tải về nhẹ hơn:** ảnh mẫu dùng WebP 360×640 (13 ảnh từ 464KB còn 205KB, JPG giữ làm dự phòng); logo dùng `logo-b-productions.webp` 560px (8,7KB thay vì PNG 54KB); máy yếu không tải ảnh bìa YouTube độ nét cao.
- **Lưu đệm:** máy chủ gắn mã phiên bản (băm nội dung) vào đường dẫn CSS, JS, logo trong trang (`/style.css?v=…`, hàm `gan_phien_ban` trong `may_chu.py`); tệp có mã được giữ 1 năm (`immutable`), tệp đổi thì mã đổi. Phông chữ và ảnh mẫu giữ 30 ngày như trước.
- **Số đo** (Chromium, CPU chậm 4 lần): máy yếu từ 17 lên 60 khung/giây khi cuộn trên máy tính, 0 khung giật; số phần tử trên trang từ 1.728 còn khoảng 850–980; ảnh từ 160 còn 62–84. Máy mạnh từ 17 lên 43 khung/giây (máy tính), 46 lên 58 (điện thoại).
- **Số đo khắc nghiệt** (CPU chậm 6 lần, RAM 2 GB, mạng 3G, `/tmp/v4/may-yeu.py`): điện thoại yếu hiện nội dung chính sau 1,4 giây, tải về 448KB, bộ nhớ trang 1 MB, cuộn 51 khung/giây với 3 lần giật (trước là 44 và 13); CPU khi đứng yên ở đầu trang trung bình khoảng 7% (trước là 21–24%), ở cuối trang gần 0%.

## 6. Chạy trên máy

### Windows

1. Cài Python 3.12, bấm đúp `CHAY-WEB.bat`. Lần đầu cần mạng để cài thư viện.
2. Mở `.env`, đặt `ADMIN_PASSWORD` và `SECRET_KEY` (chuỗi ngẫu nhiên dài). `STUDIO_CONTACT` đã có sẵn 0938248891.
3. Chạy lại `CHAY-WEB.bat`. Trang khách: http://localhost:8000 · Nhân viên: http://localhost:8000/nhan-vien

### Dòng lệnh

```bash
python -m venv .venv
# Kích hoạt môi trường theo hệ điều hành, rồi:
python -m pip install -r requirements.txt
python -m uvicorn may_chu:app --host 127.0.0.1 --port 8000
```

## 7. Cấu hình

| Biến | Bắt buộc | Mục đích |
|---|---|---|
| `ADMIN_PASSWORD` | Có | Mật khẩu trang nhân viên |
| `SECRET_KEY` | Có (khi triển khai) | Ký phiên đăng nhập; dùng giá trị cố định, ngẫu nhiên, dài |
| `DATABASE_URL` | Có trên Vercel/Render | Chuỗi kết nối PostgreSQL. Để trống khi chạy trên máy (SQLite) |
| `STUDIO_CONTACT` | Không | Số điện thoại/email hiển thị; mặc định `0938248891`, số điện thoại có nút bấm gọi |
| `ZALO_LINK` | Không | Liên kết Zalo thật của studio |
| `REPLY_WITHIN` | Không | Thời gian phản hồi hiển thị; mặc định "một ngày làm việc" |
| `STUDIO_NAME` | Không | Tên studio trong nội dung; mặc định "B PRODUCTIONS" (in hoa như logo) |
| `DATA_DIR` | Không | Thư mục dữ liệu SQLite và ảnh; mặc định `du-lieu/` |
| `COOKIE_SECURE`, `TRUST_PROXY` | Khi chạy HTTPS sau proxy | Đặt `true` trên Vercel/Render |

Máy chủ từ chối khởi động trên Vercel hoặc Render nếu thiếu `DATABASE_URL` PostgreSQL, vì ổ đĩa ở đó không giữ dữ liệu.

## 8. Nội dung: mẫu, câu hỏi, đánh giá, số liệu

| Muốn đổi | Sửa ở đâu |
|---|---|
| Danh sách video mẫu | `mau.json`: `ma`, `ten`, `nhom`, `kieu`, `id` (YouTube), `hien` (`"video"` để tự phát thử trong thư viện) |
| Ba mẫu nổi bật, mẫu đầu tiên trên điện thoại | `web/app.js` → `maNoiBat` (mẫu đầu danh sách cũng đứng đầu thư viện) |
| Ảnh bìa nét hơn | Thêm `"anh_bia": "/anh-mau/<mã>-hd.webp"` vào mẫu; nên dùng ảnh dọc 9:16 |
| Video phát tại chỗ (có tiếng cả trên iPhone) | Đặt `web/video-mau/<mã>.mp4` hoặc `.webm` (xem `DOC-TOI.txt`) |
| Câu hỏi phiếu chi tiết | `cau_hoi.json` (không đổi mã câu đã dùng để dữ liệu cũ vẫn đọc được) |

Sửa xong khởi động lại máy chủ.

### Đánh giá và số liệu: chỉ dữ liệu thật

Trang không tự tạo đánh giá, số sao hay số lượt tương tác. Khi trống, phần tương ứng tự ẩn.

**Đánh giá** — `danh_gia.json`. Chỉ hiện mục có `"da_dong_y": true`, đủ tên, nội dung và số sao 1–5:

```json
[{"ten": "Chị Lan", "doanh_nghiep": "Tiệm bánh ...", "sao": 5, "noi_dung": "Lời khách viết ...",
  "ma_mau": "ST029", "ngay": "11/2026", "nguon": "https://...", "da_dong_y": true}]
```

**Số liệu bài đăng của một mẫu** — thêm `so_lieu` vào mẫu trong `mau.json`:

```json
"so_lieu": {"nen_tang": "TikTok", "xem": 125000, "tim": 10100, "binh_luan": 2123, "chia_se": 534,
            "ngay": "11/2026", "nguon": "https://www.tiktok.com/@.../video/..."}
```

Điện thoại ở màn hình đầu hiện số dưới các nút tim, bình luận, chia sẻ (từ 10.000 ghi gọn kiểu 10.1K) và một dòng ghi nguồn.

## 9. API

| Phương thức | Đường dẫn | Mục đích |
|---|---|---|
| GET | `/api/suc-khoe` | Kiểm tra máy chủ, trả `{"on": true}` |
| GET | `/api/cau-hinh` | Câu hỏi, mẫu, thông tin liên hệ cho trang |
| POST | `/api/luot-xem` | Ghi một lượt mở trang (thống kê) |
| POST | `/api/tu-van` | Gửi tư vấn nhanh |
| POST | `/api/tu-van/bo-sung` | Trả lời thêm sau tư vấn nhanh (24 giờ, kèm mã bí mật) |
| POST | `/api/phieu` | Mở phiếu chi tiết |
| GET / PUT | `/api/phieu/{ma}` | Đọc / lưu nháp phiếu |
| POST | `/api/phieu/{ma}/anh` | Tải ảnh lên phiếu |
| DELETE | `/api/phieu/{ma}/anh/{anh}` | Xóa ảnh của phiếu |
| POST | `/api/phieu/{ma}/gui` | Gửi phiếu |
| POST | `/api/nhan-vien/dang-nhap`, `/dang-xuat` | Đăng nhập / đăng xuất nhân viên |
| GET | `/api/nhan-vien/phieu` | Danh sách, tìm, lọc, phân trang, thống kê |
| DELETE | `/api/nhan-vien/phieu/{ma}` | Xóa phiếu kèm ảnh |
| GET | `/api/nhan-vien/phieu/{ma}/anh`, `/api/nhan-vien/anh/{anh}` | Xem ảnh của phiếu |
| POST | `/api/nhan-vien/phieu/{ma}/lien-he` | Đánh dấu đã liên hệ |
| GET | `/api/nhan-vien/xuat-excel` | Tải Excel |

Mọi đường dẫn `/api/nhan-vien/*` (trừ đăng nhập) cần phiên đăng nhập.

## 10. Triển khai

### Vercel + Neon (đang dùng)

Mỗi lần đẩy lên nhánh `main`, Vercel tự triển khai lại.

1. Trên Neon, tạo cơ sở dữ liệu riêng cho web này và chép chuỗi kết nối.
2. Vercel → **Settings → Build and Deployment**: Framework Preset **Python** (không chọn Other), Root Directory để trống, tắt các ô Override.
3. **Settings → Environment Variables** (Production): `DATABASE_URL`, `ADMIN_PASSWORD`, `SECRET_KEY`, `COOKIE_SECURE=true`, `TRUST_PROXY=true`; thêm `STUDIO_CONTACT`, `ZALO_LINK`, `REPLY_WITHIN` nếu cần.
4. **Deployments → Redeploy**. Mở `/api/suc-khoe` phải thấy `{"on":true}`.

### Render + Neon (cách thay thế)

Tạo dịch vụ qua Blueprint `render.yaml`, điền `ADMIN_PASSWORD` và `DATABASE_URL`. Gói miễn phí có thể ngủ, lượt truy cập đầu sẽ chậm.

### Đưa thay đổi lên

Trong GitHub Desktop: kiểm tra danh sách tệp đổi → ghi tóm tắt → **Commit to main** → **Push origin**. Đợi 1–2 phút rồi mở trang bằng tab mới.

## 11. Cập nhật một bản đang dùng

1. Sao lưu dữ liệu: SQLite thì chép cả thư mục `du-lieu/` khi máy chủ đã dừng; Neon thì dùng chức năng sao lưu của Neon.
2. Thay mã nguồn, giữ nguyên `.env`, `du-lieu/`, ảnh và video riêng của studio.
3. Cài lại `requirements.txt`, khởi động lại.
4. Tải lại trang để nhận CSS/JS mới. Thử tư vấn nhanh, chọn mẫu, phiếu chi tiết, trang nhân viên và Excel.

## 12. Dữ liệu, ảnh và quyền riêng tư

- Tư vấn nhanh chỉ gửi khi khách đánh dấu đồng ý và bấm gửi; không lưu lúc đang gõ. Gửi lại cùng yêu cầu sau khi mất phản hồi không tạo bản trùng.
- Phiếu chi tiết chỉ lưu nháp sau khi khách đồng ý; nhân viên xem được phiếu dở như đã thông báo. Lưu đến muộn không ghi đè phiếu đã gửi.
- Ảnh: tối đa 3 ảnh/phiếu, mỗi ảnh 5 MB (4 MB trên Vercel), tối đa 20 triệu điểm ảnh. Trình duyệt tự thu nhỏ ảnh trên 3 MB. Máy chủ chỉ nhận JPEG/PNG/WebP, tạo lại ảnh để bỏ metadata và chặn tệp giả.
- Lịch sử trình duyệt không chứa mã truy cập phiếu hay câu trả lời.
- Không tự xóa dữ liệu theo lịch. Studio tự quyết thời hạn lưu, quản lý bản Excel và xử lý yêu cầu xóa.
- Nội dung `/chinh-sach` ghi rõ thu gì, dùng để làm gì và quyền của khách; cần kiểm lại trước khi chạy quảng cáo.

## 13. Kiểm thử

```bash
python -m pip install -r requirements-test.txt
python -m unittest discover -s tests -v
```

26 kiểm thử máy chủ chạy trên SQLite tạm, không đọc dữ liệu khách: ảnh (đồng thời, tệp giả, giới hạn), quyền xóa, lưu đến muộn, phân trang, Excel, tư vấn nhanh (đồng ý, dữ liệu sai, giới hạn tần suất, gửi lại, gửi đồng thời, trả lời bổ sung, gộp với phiếu chi tiết), đánh giá chỉ hiện khi đủ điều kiện.

**Back/Forward bằng Chromium** (chỉ chạy trên máy chủ thử có `DATA_DIR` riêng, vì bài thử tạo phiếu giả):

```bash
python -m pip install -r requirements-test.txt playwright
python -m playwright install chromium
python -m uvicorn may_chu:app --host 127.0.0.1 --port 8000     # cửa sổ khác, DATA_DIR thử
python tests/browser_history.py --base-url http://127.0.0.1:8000
```

Kết quả kiểm tra giao diện theo từng bản ở [KIEM_TRA_GIAO_DIEN.md](KIEM_TRA_GIAO_DIEN.md).

## 14. Giới hạn và việc chờ xác nhận

- **YouTube:** máy kiểm tra không có mạng ra ngoài, nên việc phát video và bật tiếng thật cần thử trên trang đang chạy. iPhone không cho trang bật tiếng video YouTube hộ khách; đặt video gốc vào `web/video-mau/` để khắc phục.
- **Số liệu ST029** (10.100 tim, 2.123 bình luận, 534 chia sẻ) do studio cung cấp là số thật của một bài đăng; cần bổ sung `nen_tang`, `ngay`, `nguon` cho đúng bài.
- **Thông tin công ty mẹ** (số điện thoại, email, tên pháp nhân đầy đủ, năm thành lập) chưa đưa lên trang khi chưa được ban lãnh đạo xác nhận. Xem [BRAND_SOURCES.md](BRAND_SOURCES.md).
- Chưa thử trên Safari/iPhone thật; chỉ giả lập kích thước màn hình trong Chromium.
- Chưa có số liệu chuyển đổi thật; bố cục cần được đo bằng lượt khách thật.

## 15. Lịch sử thay đổi

| Ngày | Bản | Thay đổi chính |
|---|---|---|
| 19/11/2026 | Điện thoại: thư viện mẫu gọn lại | Sửa lỗi luật "thu gọn" bị đè nên điện thoại hiện cả 13 mẫu liền nhau (phần mẫu cao 3553px); nay hiện 6 mẫu đầu + nút "Xem thêm 7 mẫu", phần mẫu còn 1855px, cả trang ngắn hơn khoảng 1700px |
| 19/11/2026 | Quy trình gọn hơn | 4 bước dạng các vòng tròn số nối nhau bằng đường mảnh (điện thoại: xếp dọc, đường nối dọc); bỏ đường kẻ ngang và các vạch dọc, bớt khoảng trắng trên dưới |
| 19/11/2026 | Giữ điện thoại minh họa ở phần tư vấn | Máy tính: hàng dưới cột trái = điện thoại minh họa + (phản hồi, gọi trực tiếp, khung phiếu chi tiết); đầu điện thoại ngang dòng "Phản hồi", đáy ngang khung phiếu chi tiết; hai cột thẳng đầu, thẳng đáy |
| 19/11/2026 | Phần tư vấn gọn hơn | Máy tính: bỏ điện thoại minh họa ở cột trái; "Phản hồi trong… · Gọi trực tiếp…" một hàng; khung "Quý khách đã có yêu cầu rõ ràng?" nằm ngang (chữ bên trái, nút bên phải); hai cột thẳng đầu và thẳng đáy |
| 19/11/2026 | Cân hai cột phần tư vấn | Màn rộng: đầu và chân cột trái thẳng hàng với khung điền thông tin; "Phản hồi trong…" và "Gọi trực tiếp…" chung một hàng khi đủ chỗ; khung phiếu chi tiết và điện thoại minh họa thẳng đáy; màn 901–1180px khung bên phải đứng giữa |
| 19/11/2026 | Lối vào phiếu chi tiết nổi rõ hơn | Phần tư vấn: "Quý khách đã có yêu cầu rõ ràng?" thành một khung có viền, dòng giải thích (20 câu, khoảng 5–7 phút) và nút trắng "Gửi yêu cầu chi tiết →"; có bản dịch Nhật, Anh |
| 19/11/2026 | Nút đổi ngôn ngữ có cờ | Mỗi nút có lá cờ vẽ bằng SVG (Việt Nam, Nhật Bản, Anh) cạnh chữ VI/JA/EN; màn hình dưới 1180px chỉ còn cờ; trong menu điện thoại mỗi ngôn ngữ một hàng: cờ + Tiếng Việt / 日本語 / English. Sửa "1 samples" thành "1 sample" |
| 18/11/2026 | Chân trang gọn, có bản đồ | Chân trang 3 khối: thương hiệu + năm thành lập, liên hệ, bản đồ Google Maps định vị 134 đường 30/4 (máy mạnh tự tải khi cuộn tới, máy yếu bấm "Xem bản đồ" mới tải); hàng cuối gồm tên công ty và các liên kết. CSP cho phép khung www.google.com |
| 18/11/2026 | Soát lại bản dịch Nhật, Anh | Viết lại khoảng 130 câu cho tự nhiên hơn: tiếng Nhật dùng kính ngữ kinh doanh (お見積もり依頼, ご依頼を承りました…), tiêu đề đầu trang theo đúng trật tự từng thứ tiếng (リアルで / 高品質な / AI動画; Realistic, / high-quality / AI videos), địa chỉ, chân trang, câu hỏi phiếu và tên mẫu. Bảng dịch sinh ra web/ngon-ngu.js |
| 18/11/2026 | Hết giật trên máy yếu | Máy yếu: bỏ hiệu ứng trượt/hiện dần khi cuộn và hiệu ứng lấy nét tiêu đề thư viện, không bật/tắt lớp "khuat" khi cuộn, khung minh họa ở phần tư vấn không tự đổi ảnh, trang mở ở trạng thái đứng yên (bấm nút phát để máy minh họa tự đổi mẫu). Đo bằng do-may-yeu.py: điện thoại yếu 45→59 khung/giây, laptop yếu 41→57 khung/giây và 13→1 lần giật, CPU khi đứng yên 11–12% → 0,1% |
| 18/11/2026 | Giảm bộ nhớ cho máy yếu | Tường ảnh nền dùng ảnh 180×320 riêng (web/anh-mau/tuong) trên điện thoại và máy yếu; chỉ vài ô đầu mỗi cột tải ngay; tường đứng yên (máy yếu, giảm chuyển động) chỉ dựng một bản thay vì hai; khung điện thoại chỉ giữ 3 cảnh (trước, đang xem, kế tiếp) thay vì giữ ảnh mọi mẫu đã chiếu. Ảnh giải nén sau 1 phút: máy yếu 32–35MB → 16–17MB, điện thoại thường 44MB → 22MB |
| 18/11/2026 | Thang cỡ chữ chung | Gom 23 cỡ chữ lẻ ở trang chủ về một thang 12/13/14/15/16/18px cùng một cỡ tiêu đề phụ và một cỡ tiêu đề mục: tiêu đề các mục bằng nhau (48px máy tính, 27px điện thoại), hai tiêu đề phụ cùng kiểu; đoạn văn 16px, chữ phụ 14px, nhãn biểu mẫu và nút lọc 15px, nút chính 16px; chữ trong khung điện thoại mô phỏng không dưới 12px. Tiêu đề thư viện giữ cỡ riêng để nằm một dòng |
| 18/11/2026 | Logo bằng chữ thật, kiểm mọi cỡ chữ | Logo không còn là ảnh: mã vạch vẽ vector, “B PRODUCTIONS” và dòng phụ là chữ SVG ép đúng khổ đo từ logo gốc nên giống biển hiệu, chọn và đọc được, phóng to không vỡ; nhãn ngành xuống dòng thay vì cắt “…”; tiêu đề thư viện xuống dòng trên điện thoại khi chữ lớn; chân trang chừa chỗ cho thanh nút đáy. Kiểm 3 trang × 4 khổ (320–1366) × cỡ chữ trình duyệt 100/125/150% và phóng to 200%: không tràn, không cắt, không chữ dưới 11px |
| 17/11/2026 | Đầu thư viện nổi | Tiêu đề "Anh chị muốn sản phẩm xuất hiện như thế nào?" đặt trong khung ngắm trắng, nổi lên và có vạch sáng quét qua một lần khi cuộn tới; dòng "Bấm vào ảnh để xem video có tiếng" thành thẻ kính mờ có biểu tượng sóng âm nhấp nhô |
| 17/11/2026 | Đầu thư viện: dòng thời gian | Bên phải tiêu đề thư viện là dòng thời gian dựng phim thu nhỏ: rãnh hình gồm các đoạn clip mang tên kiểu video có trong thư viện (dài theo số mẫu), rãnh tiếng có sóng âm, kim phát chạy ngang; kim tới đoạn nào thì đoạn sáng lên và dòng chữ tự gõ dưới tiêu đề đổi sang kiểu đó; thẻ "Bấm vào ảnh để xem video có tiếng" có sóng âm nhấp nhô; dừng theo nút dừng và chế độ giảm chuyển động |
| 17/11/2026 | Tối ưu thêm cho máy yếu | Thẻ thư viện không tự phát YouTube trên máy yếu; điện thoại đổi mẫu thưa hơn, bỏ thanh đếm giờ; sóng âm và con trỏ đứng yên; ảnh khung tư vấn chuyển sang WebP |
| 17/11/2026 | Tối ưu tải về | Ảnh mẫu WebP (−56%), logo WebP (54KB → 8,7KB), máy yếu không tải ảnh bìa YouTube độ nét cao; CSS/JS/logo có mã phiên bản và lưu đệm 1 năm nên lần quay lại không phải hỏi lại máy chủ |
| 17/11/2026 | Tối ưu cho máy yếu | Chế độ máy yếu (RAM ≤ 4 GB, CPU ≤ 4 nhân, tiết kiệm dữ liệu) tắt hiệu ứng nặng và không tự tải YouTube; tường ảnh chỉ dựng cho màn hình đang xem, bỏ lớp viền trùng, bộ lọc màu, bóng đổ; dừng hiệu ứng ở phần khuất; `content-visibility` cho phần dưới; sửa 4 quy tắc CSS sai cú pháp (phần tử giả trong `:is()`) khiến nút dừng không dừng được vạch quét |
| 17/11/2026 | Bỏ REC và đồng hồ | Tiêu đề màn hình đầu bỏ chấm "● REC" và đồng hồ giờ:phút:giây:khung (trông như đồng hồ báo giờ); giữ bốn góc khung ngắm và vạch quét |
| 17/11/2026 | Tiêu đề thư viện, Blog cân đối | Tiêu đề thư viện "Dịch vụ sản xuất Video AI" một dòng (cỡ chữ co theo màn hình). Blog: tiêu đề "Có ý tưởng. Có hướng bắt đầu." một dòng trên máy tính; hai bài thành hai ô trắng đều nhau trên nền đá, viền trên mực, các hàng nhãn/tiêu đề/mô tả/đường dẫn thẳng nhau, nhấc nhẹ khi rê chuột |
| 17/11/2026 | Nút tư vấn cuối thư viện | Nút đổi chữ thành "Nhờ chúng tôi tư vấn →", đặt bên phải, cách đầu mút đường kẻ phía trên một khoảng nhỏ (trên máy tính), cỡ to hơn một chút (cao 56px) |
| 17/11/2026 | Gọn cuối thư viện | Bỏ dòng "Tất cả 13 mẫu trong thư viện" (vẫn giữ cho trình đọc màn hình để báo kết quả lọc) và ghi chú về video AI, tiếng Nhật; hàng cuối chỉ còn nút tư vấn |
| 17/11/2026 | Menu mới | Menu: Trang chủ · Kiểu video · Về B Productions · Blog · Nhận báo giá (bỏ "Video mẫu", "Góc chia sẻ" đổi thành "Blog"); gạch chân mực trượt ra khi rê chuột, mục ứng với phần đang xem giữ gạch chân; 761–920px ẩn "Trang chủ" (logo đã dẫn về); menu điện thoại cùng thứ tự |
| 17/11/2026 | Bỏ phần cam kết | Bỏ phần "Cảm ơn Quý khách hàng đã tin tưởng" (4 cam kết và dòng gọi trực tiếp); số điện thoại vẫn ở phần tư vấn. Trang chủ còn: màn hình đầu → thư viện → về B Productions → tư vấn → Góc chia sẻ |
| 17/11/2026 | Tiếng chỉ bật khi bấm video, cân phần tư vấn | Bỏ việc tự bật tiếng khi khách chạm bất kỳ đâu (kể cả ô điền thông tin); tiếng chỉ bật khi bấm vào video trên điện thoại hoặc nút "Bật tiếng". Phần tư vấn: điện thoại minh họa nhỏ lại, khối chữ căn giữa theo nó, cột trái cao bằng khung điền thông tin |
| 17/11/2026 | Gọn khung tư vấn | Bỏ các dòng chữ phụ trong khung tư vấn nhanh: chú thích dưới khung video minh họa, "Quý khách hàng chỉ cần cho biết sản phẩm và số điện thoại.", "Chỉ dùng để tư vấn về yêu cầu này.", "Thông tin chỉ được gửi khi Quý khách hàng bấm nút…" |
| 17/11/2026 | Góc chia sẻ | Đường dẫn "Góc chia sẻ của B Productions" chuyển từ góc tiêu đề xuống thành ô thứ nhất (dẫn tới bprovn.com/blog, thay bài 5 tiêu chí); ô thứ hai giữ bài video marketing |
| 17/11/2026 | Đổi bài đọc thêm | Góc chia sẻ thay bài "Video TikTok" bằng bài "Cách chọn công ty làm phim quảng cáo uy tín: 5 tiêu chí" trên bprovn.com |
| 17/11/2026 | Bỏ phần so sánh, căn giữa thẻ | Bỏ hẳn phần "Tự làm, hay để chúng tôi làm?" (cả khung trong Góc chia sẻ và trang blog); thẻ B Productions căn giữa logo, câu giới thiệu và nút |
| 17/11/2026 | Quý khách hàng, Thực phẩm, blog | Gọi khách là "Quý khách hàng" ở mọi phần khách đọc (trang, phiếu 20 câu, thông báo máy chủ, chính sách); ngành "Đồ ăn, thức uống" thành "Thực phẩm"; thư viện và cụm điện thoại xếp theo nhóm (ST025, ST033 rồi Làm đẹp, Ứng dụng, Trường học, Tuyển dụng, Nhân vật AI); phần so sánh chuyển thành bài blog `/blog/tu-lam-hay-de-chung-toi-lam` với khung dẫn trong Góc chia sẻ; bỏ phần hỏi đáp, menu "Hỏi đáp" thành "Góc chia sẻ"; số gọn ghi kiểu 10,1K |
| 17/11/2026 | Tiêu đề thư viện "lấy nét" | Tiêu đề "Anh chị muốn sản phẩm xuất hiện như thế nào?" to hơn, chữ ánh kim trắng bạc có vệt sáng lướt qua mỗi 6 giây; khi cuộn tới, từng chữ hiện từ mờ nhòe sang sắc nét như ống kính xoay nét; dòng "Ví dụ" tự gõ lần lượt các kiểu video có trong thư viện, gõ xong có gạch chân trắng vẽ dần; thẻ "Bấm vào ảnh để xem video có tiếng" có sóng âm nhấp nhô |
| 17/11/2026 | Thư viện cân đối | Thẻ mẫu chia hàng chung với cả lưới (CSS subgrid) nên tên, kiểu video, đường kẻ và nút "Tư vấn kiểu này" thẳng hàng; rê chuột hiện bốn góc khung ngắm trên ảnh, ảnh phóng nhẹ, gạch chân trắng chạy dưới nút; nhãn ngành luôn một dòng; hàng cuối: số mẫu bên trái, nút trắng "Chưa biết chọn? Nhờ chúng tôi tư vấn" bên phải, ghi chú trải ngang |
| 17/11/2026 | Gọn chữ điện thoại, mã vạch vector | Chữ trên điện thoại mẫu gọn lại (ngành, tên 2 dòng, kiểu 1 dòng, nút "Bật tiếng" / "Tắt tiếng" một dòng, lớp tối nhạt hơn) để sản phẩm lộ ra; mã vạch vẽ bằng tệp vector `web/ma-vach.svg` làm mặt nạ nên giữ đúng độ dày từng vạch ở cỡ nhỏ; tiêu đề phần cam kết đổi thành "Cảm ơn Anh Chị đã tin tưởng." |
| 17/11/2026 | Mã vạch đúng logo | Họa tiết mã vạch ở dưới tiêu đề lớn và trên tiêu đề các phần được dựng lại theo đúng mã vạch trong logo (11 vạch cách đều, dày dần 10 → 31 trên khung 365 × 205), thay cho mẫu sọc tự vẽ sai nhịp và sai tỉ lệ |
| 17/11/2026 | Thẻ công ty mẹ | Khối B Productions ở mục "Về B Productions" thành thẻ nền giấy trắng với logo thật chữ đen (thay chữ gõ và mã vạch vẽ bằng CSS), bốn góc khung ngắm như màn hình đầu, nút "Khám phá B Productions" nền mực; logo luôn giữ chữ đen gốc, ở chân trang nền tối đặt trên ô trắng |
| 17/11/2026 | Tiêu đề khung ngắm | Tiêu đề màn hình đầu đặt trong khung ngắm máy quay: bốn góc bật ra sau khi chữ lên, chấm REC nhấp nháy và đồng hồ quay giờ:phút:giây:khung; cứ 7 giây một vạch quét chạy qua mã vạch logo rồi lướt qua tiêu đề kèm dải sáng; dừng theo nút dừng và chế độ giảm chuyển động; cú vuốt trong lúc máy đang xoay được thực hiện ngay sau đó |
| 17/11/2026 | Cụm máy xoay | Bỏ hàng nút ‹ ⏸ ⤢ ›; cụm điện thoại tự xoay tròn sang mẫu kế, vuốt hoặc kéo ngang để xoay, bấm máy bên cạnh hoặc phím mũi tên cũng được; thanh dưới gồm nút dừng tự xoay và chấm vị trí; cột tim, bình luận, chia sẻ, xem lớn xếp kiểu TikTok kèm ảnh kênh; máy vẫn tự xoay khi video không tải được |
| 17/11/2026 | Một khung hình | Màn hình đầu vừa đúng chiều cao cửa sổ: thanh đầu trang gọn lại, tiêu đề và điện thoại mẫu co theo chiều cao (svh); từ laptop 1280×720 tới màn 1920×1080 và điện thoại 360×780 trở lên thấy đủ tiêu đề, nút, điện thoại và nút điều khiển không cần lướt; chữ trong điện thoại mẫu co theo cỡ máy |
| 17/11/2026 | Cân đối màu và hiệu ứng | Một hệ màu theo màn hình đầu (giấy, đá ấm, mực than), logo làm màu phụ; họa tiết mã vạch làm điểm nhấn; bật lại hiệu ứng xuất hiện thống nhất; chân trang đen có logo; ST025 lên đầu; viết lại README |
| 17/11/2026 | Nhận diện công ty mẹ | Logo gốc, nền trắng/xám, tường poster sau điện thoại, phần "Về B Productions", bài đọc thêm từ blog, bố cục máy tính cho khung xem, phiếu, chính sách, nhân viên |
| 16/11/2026 | Màn hình đầu | Ba điện thoại xòe quạt, tiếng bật ở lần chạm đầu, số liệu bài đăng thật, gọn chữ, bỏ phần Gợi ý và Cách làm |
| 14–15/11/2026 | Bản 3–8 | Tường mẫu, thư viện lưới, tư vấn nhanh trong khung xem, trả lời bổ sung, gộp yêu cầu, Back/Forward, triển khai Vercel + Neon |

Lịch sử chi tiết xem bằng `git log`.
