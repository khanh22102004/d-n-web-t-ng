# B Productions — video sản phẩm bằng AI

Trang giới thiệu dịch vụ, thư viện video mẫu, form tư vấn nhanh và phiếu yêu cầu chi tiết. Khách không cần đăng nhập; nhân viên làm việc tại `/nhan-vien`.

## Bản 3: khách thấy nhiều mẫu ngay, trang lấy được nhiều thông tin hơn

- **Màn hình đầu là tường mẫu đang chạy** thay cho một mẫu duy nhất: máy tính có ba cột trôi dọc, điện thoại có một hàng trôi ngang, hiện cả 13 mẫu kèm nhãn ngành hàng. Bấm mẫu nào cũng mở trình xem có tiếng và lướt được qua cả 13 mẫu. Có nút “Dừng chuyển động”; khách bật chế độ giảm chuyển động thì tường đứng yên và vuốt tay được.
- **Thư viện mẫu là lưới**: máy tính thấy hết 13 mẫu, điện thoại thấy 6 mẫu hai cột và nút “Xem thêm 7 mẫu”. Mặc định hiện “Tất cả” thay cho 3 mẫu nổi bật. Mẫu loại `"hien": "video"` tự phát thử không tiếng khi nằm trong màn hình, mỗi lúc một video.
- **Xưng “anh chị”** trên trang khách, 20 câu hỏi, thông báo lỗi và trang chính sách; câu hỏi đủ chủ vị, lịch sự, không dùng “ạ”. Trang nhân viên giữ nguyên.
- **Bỏ các nhãn viết hoa chữ nhỏ** phía trên tiêu đề; chữ nhỏ nhất trên trang khách là 14 px.
- **Tư vấn nhanh hỏi thêm cách liên hệ** (Zalo hay gọi điện). Ngay sau khi gửi, khách được mời trả lời thêm, không bắt buộc: tên, khi nào cần video, ngân sách, nơi đăng. Câu chữ và lựa chọn lấy từ câu 7, 17, 18, 19 của `cau_hoi.json`. Chỉ bổ sung được trong 24 giờ sau khi gửi, bằng mã bí mật của chính yêu cầu đó.
- **Gộp tư vấn nhanh với phiếu chi tiết**: khách gửi tư vấn nhanh rồi mở phiếu chi tiết thì các câu đã biết được điền sẵn. Khi gửi phiếu, nếu số điện thoại trùng, hai yêu cầu thành một: giữ mẫu khách chọn và trạng thái “đã liên hệ”, nhân viên thấy dòng “Gộp từ yêu cầu tư vấn nhanh”. Số khác nhau thì giữ cả hai.
- Ô gửi ảnh dùng nút “Chọn ảnh từ máy” thay cho chữ tiếng Anh của trình duyệt. Nút trong trình xem video không còn bị gãy dòng trên điện thoại.

### Kéo khách từ “xem cho vui” sang “để lại số”

- **Phần “Chưa biết chọn kiểu video nào?”** ngay dưới màn hình đầu: khách bấm 3 câu (ngành hàng, nơi đăng, mục đích; lấy từ câu 2, 7, 4 của `cau_hoi.json`), trang gợi ý 3 mẫu hợp nhất và hiện **form ngắn ngay dưới 3 mẫu đó** (sản phẩm, số điện thoại, Zalo hay gọi điện). Yêu cầu gửi về có sẵn ngành hàng, nơi đăng, mục đích và mẫu khách đang chọn. Cách chọn mẫu nằm ở `NGANH_CUA_MAU`, `KIEU_THEO_NGANH`, `KIEU_THEO_MUC_DICH` trong `web/app.js`.
- Câu nào khách đã trả lời ở phần gợi ý thì phần hỏi thêm sau khi gửi không hỏi lại.
- **Form ngắn ngay trong khung xem video**: nút “Nhận báo giá làm video kiểu này” mở form ngay dưới video, khách không phải đóng video và cuộn đi tìm form. Nếu khách đã gửi một lần trên máy đó, sản phẩm và số điện thoại được điền sẵn. Gửi xong, khách được mời trả lời thêm 2 câu (thời hạn, ngân sách).
- Nút kêu gọi dùng chữ nói rõ khách nhận được gì: “Nhận báo giá”, “Gửi cho tôi phương án và báo giá”. Trang không hứa “miễn phí” hay đưa số liệu khách hàng khi studio chưa xác nhận.
- **Thanh nút dưới đáy màn hình điện thoại** (“Nhận báo giá”, “Gợi ý kiểu video”) hiện khi khách đã cuộn qua nút ở màn hình đầu; tự ẩn khi đang ở form tư vấn hoặc phần gợi ý.
- **Đoạn video riêng của studio**: đặt tệp vào `web/video-mau/` (xem `DOC-TOI.txt` trong thư mục đó). Mẫu có tệp sẽ tự phát không tiếng ở màn hình đầu và trong thư viện, nhiều mẫu cùng lúc; tệp chỉ tải khi mẫu hiện ra, tạm dừng khi ra khỏi màn hình, khi mở khung xem, khi bấm “Dừng chuyển động”, và không tự phát khi khách bật giảm chuyển động hoặc tiết kiệm dữ liệu.

## Bản sửa Back/Forward và số liên hệ

- Mỗi phần của phiếu chi tiết có mục lịch sử riêng. Back/Forward của trình duyệt và nút quay lại trong trang hoạt động cùng nhau, giữ câu trả lời đã điền.
- Quay từ phần đầu về trang giới thiệu; tiến tới mở lại đúng phần đã điền mà không tạo phiếu khác. Tham số nguồn khách và vị trí trang đầu (ví dụ `#tu-van`) được giữ.
- Tải lại giữa phiếu sẽ khôi phục đúng phần và bản nháp trên thiết bị. Lịch sử chỉ ghi màn hình, phần và mã lượt điều hướng; không ghi mã truy cập phiếu hay câu trả lời vào URL.
- Sau khi gửi, Back về trang đầu, Forward chỉ hiện xác nhận. Các bước chỉnh sửa của phiếu đã gửi được bỏ qua. Tải lại trang xác nhận không lưu hay khôi phục câu trả lời riêng tư trong lịch sử trình duyệt.
- Có thể mở yêu cầu mới từ trang đầu mà không trộn dữ liệu với phiếu đã gửi.
- Số studio do chủ studio cung cấp: **0941 761 768**. Hiển thị ở chân trang, phần tư vấn và trang chính sách; nút gọi dùng `tel:+84941761768`. Không tự cấu hình Zalo từ số điện thoại.

## Bản sửa mới: gọn hơn và dễ thao tác

- Gộp phần lợi ích bị lặp vào quy trình ba bước. Ở khung nhìn Chromium 390×844, với cùng dữ liệu, trang giảm từ 5.203 xuống 4.126 px (khoảng 21%); form tư vấn xuất hiện sớm hơn khoảng 1.047 px. Đây là số đo bố cục, không phải tỷ lệ chuyển đổi của khách.
- Bộ lọc ban đầu chỉ có “Mẫu nổi bật”, “Tất cả”, “Ngành hàng”. Các ngành mở khi bấm; chọn xong tự thu gọn, hiển thị ngành đang chọn. Có thể đóng bằng Escape và dùng bàn phím.
- Khi danh sách có thể cuộn ngang, hiện hướng dẫn vuốt, số thứ tự mẫu và nút trước/sau. Khi chỉ có một mẫu hoặc màn hình đã hiện hết danh sách, tự ẩn điều khiển không cần thiết.
- (Bản 3 đổi lại thành “anh chị”.) Không đổi mã câu hỏi, kiểu dữ liệu hay các giá trị lựa chọn đã lưu.
- Ảnh tại chỗ hiện ngay; khi tải được ảnh dọc YouTube rộng ít nhất 480 px, trang thay bằng ảnh nét hơn. Không chấp nhận thumbnail nhỏ hoặc ảnh ngang. Nếu ảnh tại chỗ cũng lỗi, vẫn có nút mở video thay cho biểu tượng ảnh hỏng.
- Studio có thể cung cấp ảnh gốc bằng thuộc tính `anh_bia` trong từng mục `mau.json`, ví dụ `"anh_bia": "/anh-mau/ST029-hd.webp"`. Ảnh riêng được ưu tiên; lỗi sẽ quay về ảnh dự phòng.

Tệp hiện có chỉ chứa ảnh bìa 360×640 và các video mẫu sẵn có. Bản này không tạo ảnh gốc độ phân giải cao hay mẫu tiếng Việt giả; cần studio cung cấp tài nguyên thật để thay thế. Ảnh YouTube độ phân giải cao chưa được xác minh trực tiếp do tài nguyên ngoài bị chặn trong phiên; đã kiểm thử nâng chất lượng và dự phòng bằng dữ liệu giả lập riêng, không đưa vào bản phát hành.

## Khách khám phá trước khi để lại thông tin

- Màn hình đầu tập trung vào sản phẩm và ý tưởng video; nút chính dẫn tới mẫu, nút phụ dẫn tới tư vấn nhanh.
- Ba mẫu nổi bật cho ba hướng: người mẫu giới thiệu, hoạt hình, ứng dụng. Có thể đổi mẫu nổi bật, lọc ngành hàng hoặc xem tất cả 13 mẫu.
- Khung video mở khi bấm ảnh; có nút “Nhận báo giá làm video kiểu này” mở form ngắn ngay trong khung xem. Giao diện nói rõ một số mẫu hiện tại có nội dung tiếng Nhật.
- Form tư vấn nhanh chỉ cần tên sản phẩm và số điện thoại/Zalo. Không lưu lúc gõ. Chỉ gửi khi khách đồng ý và bấm gửi; gửi lại cùng yêu cầu sau khi mất phản hồi không tạo bản trùng.
- Yêu cầu nhanh xuất hiện ngay trong danh sách chờ liên hệ của nhân viên, có nhãn riêng, mẫu tham khảo và nguồn khách. Excel có thêm hai cột cuối: “Loại yêu cầu” và “Mẫu tham khảo”.
- Phiếu chi tiết 20 câu vẫn được giữ. Chỉ khi khách chủ động mở phiếu mới hiện giải thích và ô đồng ý lưu bản nháp.
- Có nội dung giải thích cách làm và hỏi đáp về kịch bản, chi phí, AI và phiếu chi tiết. Không thêm lời chứng thực, số liệu hiệu quả, khách hàng hoặc bảng giá chưa được studio cung cấp.
- Khung nhìn đã kiểm tra: 320, 360, 390, 768 và 1440 px. Video không tự chạy khi vừa vào trang; xem thử khi rê chuột và mở đầy đủ khi bấm. Tôn trọng chế độ giảm chuyển động và tiết kiệm dữ liệu.

Bố cục mới cần được đo bằng dữ liệu khách thật để đánh giá tỷ lệ liên hệ; chưa có thử nghiệm A/B hay khẳng định tăng doanh số.

## Chạy trên Windows

1. Cài Python 3.12 rồi bấm đúp `CHAY-WEB.bat`. Lần đầu cần mạng để cài thư viện.
2. Mở `.env`, đặt `ADMIN_PASSWORD`, `SECRET_KEY` (chuỗi ngẫu nhiên dài), `STUDIO_CONTACT` (đã điền số 0941761768, có thể đổi khi cần). Có thể đặt thêm `ZALO_LINK` và `REPLY_WITHIN`.
3. Chạy lại `CHAY-WEB.bat`. Trang khách: http://localhost:8000. Trang nhân viên: http://localhost:8000/nhan-vien.

Tệp BAT tự cập nhật thư viện khi `requirements.txt` thay đổi. `.env` và dữ liệu khách không nằm trong ZIP này.

## Chạy bằng dòng lệnh

```bash
python -m venv .venv
# Kích hoạt môi trường theo hệ điều hành, sau đó:
python -m pip install -r requirements.txt
python -m uvicorn may_chu:app --host 127.0.0.1 --port 8000
```

## Cập nhật một bản đang dùng

1. Dừng máy chủ và sao lưu dữ liệu. Với SQLite, sao lưu toàn bộ thư mục `du-lieu/` khi máy chủ đã dừng; với Neon, dùng chức năng sao lưu của nhà cung cấp.
2. Thay mã nguồn bằng bản này, giữ `.env`, `du-lieu/`, ảnh và video riêng của studio.
3. Cài lại `requirements.txt`, bổ sung thông tin liên hệ thật rồi khởi động lại. Các cột và chỉ mục bổ sung tự được tạo; mã nâng cấp không xóa phiếu cũ.
4. Tải lại trang để nhận JavaScript/CSS mới. Thử cả form tư vấn nhanh, chọn mẫu và phiếu chi tiết; kiểm tra trang nhân viên và Excel.

## Cấu hình và nội dung

| Tệp / biến | Mục đích |
|---|---|
| `cau_hoi.json` | Bộ câu hỏi, đáp án và nhóm của phiếu chi tiết. |
| `mau.json` | Mã mẫu, tên, nhóm sản phẩm, kiểu video và mã YouTube. |
| `web/app.js` → `maNoiBat` | Ba mã mẫu của nút lọc “Mẫu nổi bật”. Thay bằng mẫu mới tại đây khi studio có mẫu phù hợp hơn. |
| `web/anh-mau/<mã>.jpg` | Ảnh bìa dự phòng. Nên thay bằng ảnh gốc rõ nét, khung dọc 9:16. |
| `web/video-mau/<mã>.mp4` hoặc `.webm` | Đoạn phát thử tại chỗ nếu studio có. Khung xem đầy đủ vẫn dùng video YouTube. |
| `ADMIN_PASSWORD` | Mật khẩu nhân viên. |
| `SECRET_KEY` | Ký phiên đăng nhập; dùng giá trị cố định, ngẫu nhiên dài. |
| `STUDIO_CONTACT` | Số điện thoại/email ở chân trang và trang chính sách; mặc định 0941761768 do chủ studio cung cấp. Số điện thoại có liên kết bấm gọi. |
| `ZALO_LINK` | Liên kết Zalo thật của studio, nếu có. |
| `REPLY_WITHIN` | Thời gian phản hồi hiển thị cho khách; cần khớp khả năng thực tế. |
| `DATABASE_URL` | Kết nối PostgreSQL. Để trống khi thử tại chỗ bằng SQLite. |
| `COOKIE_SECURE`, `TRUST_PROXY` | Bật khi triển khai HTTPS sau proxy tin cậy, như cấu hình Render đi kèm. |

Sửa `cau_hoi.json` hoặc `mau.json` rồi khởi động lại. Mục `hien` trong `mau.json`: `"video"` là mẫu được tự phát thử không tiếng trong thư viện; các giá trị khác chỉ hiện ảnh. Tường mẫu ở màn hình đầu luôn hiện đủ mọi mẫu trong `mau.json`.

Nguồn khách được lấy từ `?nguon=tiktok`, `?nguon=facebook`, `?nguon=zalo` hoặc `utm_source`.

## Bảo vệ dữ liệu và ảnh

- Phiếu chi tiết lưu bản nháp sau khi khách đồng ý; có bản nháp trên thiết bị, tự thử lại khi mạng phục hồi. “Đã lưu” nghĩa là máy chủ đã nhận bản hiện tại.
- Nhân viên xem được phiếu dở như nội dung đã thông báo. Yêu cầu lưu đến muộn không ghi đè phiếu đã gửi.
- Tối đa 3 ảnh/phiếu, mỗi ảnh 5 MB (4 MB khi chạy trên Vercel) và 20 triệu điểm ảnh. Ảnh trên 3 MB được trình duyệt tự thu nhỏ (cạnh dài 2560 px, JPEG) trước khi gửi, nên ảnh chụp điện thoại vẫn gửi được. Máy chủ giải mã ảnh tĩnh JPEG/PNG/WebP, tạo lại để loại metadata, chặn tệp giả/hỏng và giới hạn cả dung lượng yêu cầu tải lên.
- Giới hạn số ảnh được kiểm tra trong giao dịch khóa phiếu, tránh vượt khi gửi đồng thời. Các thao tác lưu/gửi/xóa ảnh cùng dùng khóa phiếu.
- Trang nhân viên có tìm kiếm, lọc, phân trang và nút xóa phiếu kèm ảnh sau xác nhận. Không tự xóa dữ liệu theo lịch.
- Studio cần xác định thời hạn lưu theo quy trình thực tế, quản lý bản Excel/bản sao lưu riêng và xử lý yêu cầu xóa. Khi cần xóa bản nháp trên thiết bị, khách phải xóa dữ liệu trang trong trình duyệt đã sử dụng.
- Kiểm tra nội dung `/chinh-sach`, mức ngân sách và thời gian phản hồi trước khi công khai.

## Vercel + Neon (đang dùng)

Repo có sẵn `app.py` (Vercel tìm biến `app` ở đây) và `.python-version`. Mỗi lần đẩy lên nhánh `main`, Vercel tự triển khai lại.

1. Trên Neon, tạo một cơ sở dữ liệu riêng cho web này (không dùng chung với Video OS cũ) và chép chuỗi kết nối.
2. Trong dự án Vercel: **Settings → Build and Deployment**: Framework Preset chọn **Python** (không chọn Other, vì Other không chạy tệp app.py), Root Directory để trống, tắt các ô Override của Build/Install/Output.
3. **Settings → Environment Variables** (Production): `DATABASE_URL` (chuỗi Neon), `ADMIN_PASSWORD`, `SECRET_KEY` (chuỗi ngẫu nhiên dài), `COOKIE_SECURE=true`, `TRUST_PROXY=true`. Có thể thêm `STUDIO_CONTACT`, `ZALO_LINK`, `REPLY_WITHIN`.
4. Vào **Deployments**, bấm **Redeploy** bản mới nhất. Mở `/api/suc-khoe` phải thấy `{"on":true}`.

Máy chủ từ chối chạy trên Vercel nếu thiếu `DATABASE_URL` PostgreSQL, vì ổ đĩa ở đó không giữ dữ liệu.

## Render + Neon (cách khác)

1. Đưa mã nguồn lên repo GitHub riêng và tạo cơ sở dữ liệu PostgreSQL trên Neon.
2. Tạo dịch vụ qua Blueprint `render.yaml`, điền `ADMIN_PASSWORD`, `DATABASE_URL` và kiểm tra `STUDIO_CONTACT` đã đặt 0941761768. `SECRET_KEY` được Render tạo theo cấu hình đi kèm.
3. Sau triển khai, thử gửi tư vấn nhanh, phiếu chi tiết, ảnh; xem và đánh dấu liên hệ; xuất Excel.

Máy chủ từ chối khởi động trên Render nếu thiếu `DATABASE_URL` PostgreSQL để tránh mất dữ liệu trên ổ đĩa tạm. Gói miễn phí có thể ngủ khiến lượt truy cập đầu chậm; cần đánh giá điều này trước khi chạy quảng cáo.

Chưa kiểm thử tích hợp PostgreSQL/Neon hoặc triển khai lên Render trong phiên sửa này. Cần xác minh trực tiếp trên môi trường triển khai trước khi công khai.

## Kiểm thử

```bash
python -m pip install -r requirements-test.txt
python -m unittest discover -s tests -v
```

24 kiểm thử máy chủ chạy trên SQLite tạm, không đọc dữ liệu khách: bao gồm tải ảnh đồng thời, tệp giả/hỏng, quyền xóa, lưu đến muộn, phân trang, Excel và các trường hợp của tư vấn nhanh (đồng ý, dữ liệu sai, giới hạn gửi, gửi lại và gửi đồng thời, cách liên hệ, trả lời bổ sung, gộp với phiếu chi tiết).

Đã kiểm tra Chromium: trang đầu không tự tạo phiếu; lọc mẫu; chuyển mẫu; mở/đóng trình xem; chọn mẫu vào tư vấn nhanh; không gửi khi nhập; lỗi số điện thoại; mất phản hồi sau khi máy chủ đã lưu rồi gửi lại không trùng; hiển thị ở trang nhân viên; đồng ý khi mở phiếu chi tiết; lưu khi có mạng trở lại; phục hồi sau tải lại; gửi đủ 20 câu. Tải và phát video từ YouTube thực tế cần kiểm tra trên mạng của khách; trong phiên này chỉ xác minh URL nhúng, mở/đóng khung và ảnh dự phòng khi tài nguyên ngoài không tải được.

### Kiểm tra Back/Forward bằng Chromium

Chỉ chạy trên máy chủ thử cục bộ với `DATA_DIR` riêng; bài kiểm tra tạo phiếu giả. Không chạy vào dữ liệu đang vận hành.

```bash
python -m pip install -r requirements-test.txt playwright
python -m playwright install chromium
# Chạy máy chủ ở cửa sổ khác với DATA_DIR trỏ đến thư mục dữ liệu thử:
python -m uvicorn may_chu:app --host 127.0.0.1 --port 8000
# Chạy bài kiểm tra:
python tests/browser_history.py --base-url http://127.0.0.1:8000
```

Nếu dùng Chromium cài sẵn trên Linux, thêm `--chromium /usr/bin/chromium`. Bài kiểm tra xác minh Back/Forward qua ba phần và trang đầu, giữ câu trả lời, không tạo phiếu trùng, chặn bước tiếp khi thiếu câu trả lời, hoạt động khi mất mạng và sau tải lại, gửi đủ 20 câu, không quay lại chỉnh sửa phiếu đã gửi, mở phiếu mới và số liên hệ bấm gọi đúng. Không thực hiện cuộc gọi và không tải video ngoài trong bài kiểm tra.
