# Kiểm tra bản hoàn thiện máy tính và điện thoại B PRODUCTIONS


## Lượt "một khung hình" — 17/11/2026

Yêu cầu: màn hình đầu phải thấy đủ thông tin trong một khung hình, không phải lướt. Trước khi sửa, thanh đầu trang máy tính cao 143px; laptop 1366×768 và 1280×720 bị đẩy dòng "Tôi đã có yêu cầu cụ thể" xuống dưới mép, điện thoại 390×844 thấy điện thoại mẫu bị cắt và nút điều khiển nằm ngoài màn hình.

Đã đo vị trí cuối cùng của chữ, nút và nút điều khiển điện thoại so với chiều cao cửa sổ:

| Khổ | Kết quả |
|---|---|
| 1920×1080, 1536×864, 1440×900, 1366×768, 1280×720, 1024×768, 768×1024 | Vừa một khung hình |
| Điện thoại 430×932, 412×915, 393×873, 390×844, 360×800, 360×780 | Vừa một khung hình |
| Điện thoại thấp 375×667, 360×640 | Đủ tiêu đề, mô tả, nút và màn hình điện thoại mẫu; riêng hàng nút điều khiển nằm ngay dưới mép (dòng ghi chú lặp lại được ẩn ở khổ này) |

`pytest` 26/26, kiểm thử trình duyệt 40/40 (gồm tương phản nút).

## Lượt cân đối màu và hiệu ứng — 17/11/2026

Mã gốc: main, commit 3516c4e. Thay đổi: thêm `web/can-doi.css` (hệ màu thống nhất, họa tiết mã vạch, hiệu ứng), thêm vạch mã vạch dưới tiêu đề lớn và logo ở chân trang, đưa ST025 lên đầu điện thoại và thư viện, mở rộng danh sách phần có hiệu ứng xuất hiện trong `web/app.js`, viết lại README. Backend, API, câu hỏi và dữ liệu không đổi.

| Kiểm tra | Kết quả |
|---|---|
| `python -m unittest` / `pytest tests` | 26/26 đạt |
| `tests/browser_history.py` (Back/Forward, gửi phiếu, mất mạng, tải lại) | Đạt |
| `node --check web/app.js web/nhan-vien.js` | Đạt |
| Hành trình khách bằng Chromium, 1440×900 và 390×844 (36 bước) | 36/36 đạt |

Các bước trong hành trình 36 bước: màn hình đầu hiện tiêu đề, vạch mã vạch, điện thoại, nút; mẫu đầu tiên là ST025; cuộn hết trang thì mọi phần đều đã hiện; giao diện không còn màu nào ngoài hệ giấy/đá/mực/logo (trừ video, ảnh, tim, báo lỗi); thư viện đủ 13 mẫu với ST025 đứng đầu; mở menu; mở khung xem video; form trống báo lỗi tiếng Việt; gửi tư vấn nhanh; mở phiếu chi tiết và phần giới thiệu ẩn; trang chính sách có logo chân trang; không lỗi JavaScript; không tràn ngang ở 320, 360, 390, 430, 768, 1024, 1280, 1440, 1920 px; chế độ giảm chuyển động hiện đủ nội dung, không chạy hiệu ứng; trang nhân viên thấy hai yêu cầu vừa gửi.

Giới hạn: máy kiểm tra không có mạng ra ngoài nên không phát được YouTube; chưa thử Safari/iPhone thật; dữ liệu là dữ liệu thử trong SQLite riêng.
Ngày 16/11/2026. Mã gốc: main, commit 87e4af2c33333f08c36cb7a3e4b20484af8e54b5. Báo cáo ghi nhận lần kiểm tra cục bộ trước khi đưa mã lên GitHub, không xác nhận trạng thái triển khai. FILE_MANIFEST.json trong ZIP bàn giao ghi kích thước và SHA-256 của từng tệp tại thời điểm đóng gói đó.

Lượt sửa mới nhất: thay nền một cột điện thoại bằng bốn cột ô nhỏ so le như desktop. Ở 390 px, ô rộng 97,5 px; đủ 13 mẫu, các cột trôi xuống và lặp liên tục. Chỉ thay hàm dựng nền và CSS mobile; bố cục, nội dung và luồng gửi yêu cầu giữ nguyên. Kết quả lượt này nằm trong XEM_TRUOC/mobile-mosaic-checks.json; các kết quả nghiệp vụ bên dưới thuộc lượt hoàn thiện desktop trước đó.

Ảnh đã xem trực tiếp ở 390 px và desktop 1440 px. Tương phản bảo thủ của nền sau vùng chữ mô tả đo được 6,42:1 tại sáu kích thước mobile trong chế độ giảm chuyển động; phép đo giới hạn ở vùng và trạng thái đã kiểm, không phải chứng nhận tương phản toàn trang/mọi pha chuyển động.

## Phạm vi đã hoàn thiện

| Màn hình | Kết quả |
|---|---|
| Trang chủ và các phần giới thiệu | Logo gốc, tiêu đề đúng yêu cầu, nền sáng, mẫu có màu; điều hướng, so sánh, quy trình, bài blog, hỏi đáp và chân trang đồng bộ. |
| Thư viện / trình xem video | Desktop hai cột, video cạnh lời giới thiệu/form; giữ tiêu đề và nút đóng trong màn hình; chuyển mẫu, ảnh dự phòng, thử lại và liên kết YouTube. |
| Tư vấn nhanh | Form, đồng ý gửi thông tin, trạng thái gửi thành công và nội dung bổ sung; không tạo yêu cầu chỉ vì khách đang xem hoặc nhập sai. |
| Phiếu chi tiết | Sáu phần, 20 câu hỏi hiện có; tiến độ và sidebar trên màn hình rộng; đồng ý lưu, điều hướng, lưu/gửi và bản tóm tắt. |
| Xác nhận | Thông báo đã nhận, nội dung đã gửi, in/lưu và về trang chủ. |
| Chính sách | Mục lục và bố cục đọc rõ; đã so sánh toàn bộ đoạn văn với HEAD, nội dung chính sách giữ nguyên. |
| Nhân viên | Cùng logo/tông màu; danh sách trước thống kê; tìm/lọc, xóa bộ lọc, chi tiết, trạng thái liên hệ, Excel, trạng thái tải/lỗi, đăng nhập/đăng xuất. |
| Điện thoại gọn | Bốn cột nền nhỏ so le, trôi xuống; header và cụm điện thoại gọn; các phần chung mép, nền tiếp giáp liên tục. |

## Kiểm tra đã chạy

- Chromium 1024×768, 1280×800, 1440×900, 1920×1080: trang chủ/thư viện/chính sách không tràn ngang; đích điều hướng không bị header che; trình xem và nút đóng nằm trong màn hình; form sai không gửi yêu cầu. Không ghi nhận lỗi JavaScript trong các ca này.
- Luồng desktop: gửi tư vấn nhanh thành công; đi qua đủ sáu phần phiếu, đồng ý và gửi, nhận bản tóm tắt. Đã kiểm nút in gọi window.print; không coi đó là kiểm chứng bố cục PDF trên mọi hệ điều hành.
- Nhân viên trên dữ liệu thử riêng: đăng nhập sai/đúng, tìm kiếm hai phiếu tổng hợp, xóa bộ lọc, mở chi tiết, đánh dấu liên hệ, hủy thao tác xóa, tải Excel thật và đọc nội dung bằng openpyxl, đăng xuất và API trả 401. Kiểm tra chiều rộng 1024/1280/1920 px; lỗi mạng hiển thị thông báo tiếng Việt và kết thúc trạng thái tải.
- Menu desktop mở/đóng bằng Escape; bốn mục hỏi đáp mở được. Điều hướng Tab trong trình xem không đi vào điều khiển của trang bên dưới; Escape đóng và trả focus về nút mẫu đã mở.
- Điện thoại 320, 360, 390, 430, 600, 760 px: không tràn ngang; các phần trang chủ rộng đúng màn hình, mép khối nối nhau không có khoảng hở; header dưới 90 px. Menu và trang chính sách/đăng nhập đã kiểm ở bản gọn trước. Lượt nền so le kiểm lại kích thước trang/phần, đủ 13 mẫu, bốn cột và độ lệch ô khi giảm chuyển động. Ở 390 px, chiều cao trang vẫn 7735 px như bản gọn.
- 320/390 px: trình xem/form không tràn ngang, nút đóng dùng được và iframe được dọn khi đóng ở lượt trước. Lượt mới đo bốn cột nền có dx=0, dy>0 tại 320/390/430 px; nút dừng/chạy tiếp và ảnh/viền đồng bộ. Desktop 1024/1440/1920 px không tràn; chiều cao, vị trí/kích thước các phần ở 1440 px khớp bản trước và ảnh được xem trực tiếp.
- 26 kiểm thử máy chủ đạt: `python -m unittest discover -s tests -p test_regressions.py -q`. SQLite tạm; kiểm ảnh, giới hạn, quyền, đồng thời, tư vấn nhanh, Excel và các hồi quy hiện có.
- `tests/browser_history.py` đạt: Back/Forward, giữ câu trả lời, không tạo phiếu trùng, mất mạng/tải lại, phiếu đã gửi không quay lại chỉnh sửa, yêu cầu mới tách riêng và số liên hệ bấm gọi. Không thực hiện cuộc gọi.
- `node --check web/app.js`, `node --check web/nhan-vien.js` và `git diff --check`: đạt.

26 kiểm thử backend và bài lịch sử chạy ở bản hoàn thiện desktop. Lượt nền so le chỉ sửa JavaScript dựng poster trang trí và CSS mobile, nên kiểm lại phần hiển thị, chuyển động, độ tương phản nền sau chữ, không tạo phiếu khi xem và hồi quy kích thước desktop; không chạy lại toàn bộ backend cho thay đổi này.

## Video và giới hạn chứng cứ

Trong kiểm tra UI, HTTPS video ngoài bị chặn chủ động để kiểm ảnh dự phòng, thời gian chờ, thử lại và đóng/mở. Tín hiệu YouTube sẵn sàng/lỗi được mô phỏng với kiểm nguồn và đúng iframe; nguồn không tin cậy bị bỏ qua. Các ca mô phỏng này không chứng minh video thật đã phát.

Đã thử thêm một lượt không chặn HTTPS trong Chromium của môi trường làm việc: không nhận được phản hồi iframe nhúng hoặc tín hiệu sẵn sàng từ YouTube; giao diện chuyển sang ảnh dự phòng/thử lại. Vì vậy chưa chứng nhận playback YouTube trên mạng khách hoặc trình duyệt thật của khách. Ảnh bìa giữ chất lượng nguồn hiện có; chưa có asset gốc độ nét cao thay thế.

Kiểm tra viewport Chromium không thay cho Safari/iPhone hoặc thiết bị vật lý. Chưa kiểm tích hợp PostgreSQL/Neon hay triển khai thực tế trong lượt này. Backend/schema và cấu hình liên hệ không đổi.

Lượt này do điều phối triển khai và kiểm trực tiếp. Hạn mức agent đã hết nên không có reviewer agent độc lập mới; không dùng review bản cũ làm chứng nhận độc lập cho bản bàn giao này.

## Dữ liệu và tệp bằng chứng

Máy chủ thử dùng DATA_DIR riêng; không kết nối DB vận hành. Các phiếu/ảnh quản lý là dữ liệu tổng hợp, tên bắt đầu bằng DỮ LIỆU THỬ; số liên hệ trong những phiếu đó chỉ là fixture. Gói không chứa DB, Excel xuất, session, .env, token, ảnh tải lên hoặc dữ liệu khách.

Mở XEM_TRUOC/index.html để xem ảnh các trang, clip nền điện thoại 7 giây và báo cáo JSON. Ảnh là bản xem trước ngoại tuyến, không phải website đã triển khai. Các báo cáo gồm desktop-checks.json, final-surfaces-checks.json (phần desktop/bàn phím của bản trước), mobile-mosaic-checks.json (nền so le hiện tại), external-player-check.json và browser-history.log. FILE_MANIFEST.json dùng để đối chiếu đúng tệp bàn giao, không phải chữ ký hoặc chứng nhận bảo mật.
