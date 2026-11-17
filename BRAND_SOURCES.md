# Nguồn và quyết định nhận diện B Productions

Đối chiếu ngày 16/11/2026. Mã gốc: main, commit 87e4af2c33333f08c36cb7a3e4b20484af8e54b5. Đã kiểm bằng git fetch, ls-remote và GitHub API. Tài liệu ghi nhận nguồn và quyết định thiết kế của bản cập nhật; trạng thái đưa mã lên GitHub và triển khai được đối chiếu riêng.

## Nguồn công khai đã đọc

| Nguồn | Thông tin sử dụng |
|---|---|
| https://www.bprovn.com/ | Tên B Productions, tinh thần truyền tải thông điệp qua phim sáng tạo |
| https://www.bprovn.com/blog | Nền nhận diện trắng/xám/đen và nguồn tuyển bài video |
| https://www.bprovn.com/dich-vu-video | TVC, video giới thiệu doanh nghiệp, animation/motion graphics; dùng cho đoạn giới thiệu nền tảng công ty |
| https://www.bprovn.com/blog/dich-vu-san-xuat-video-tiktok | Cách phát triển ý tưởng/kịch bản, duyệt và sản xuất video ngắn; liên kết đọc thêm |
| https://www.bprovn.com/blog/dich-vu-san-xuat-video-marketing | Các hình thức video, câu chuyện thương hiệu và ứng dụng AI; liên kết đọc thêm |

Đã đọc nội dung và xem render trang blog trong Chromium. Trang mẹ dùng đen #1c1c1c, trắng, các mảng xám và điểm cam ở điều hướng. Bản này dùng chữ đậm, độ tương phản và các mảng trắng/charcoal để tạo nhịp. Phần đầu dùng trắng #ffffff, xám ấm sáng chuyển #e8e4de đến #dad6cf, chữ than #202224. Sắc màu đến từ chính thư viện video/ảnh mẫu, dùng cùng nguồn ở lớp nền và cụm điện thoại. Vùng chữ được giữ sáng và tương phản cao.

## Phần đưa vào trang hiện tại

- Hero tập trung video AI cho thương hiệu và sản phẩm, không mô tả như công cụ khách tự tạo video ngay.
- Đoạn nền tảng B Productions có liên kết trực tiếp đến website và dịch vụ video chính thức.
- Hai bài được tuyển theo chủ đề video; phần tóm tắt được biên tập ngắn, không sao chép toàn bài.
- Hành trình chính: xem mẫu → gửi yêu cầu để studio tư vấn/phát triển và thực hiện. Phiếu chi tiết vẫn có khi khách cần.

Không đưa BPO hoặc tư vấn đầu tư vào hành trình video. Không đưa các con số tăng chuyển đổi/nhận diện, rút ngắn thời gian hay cam kết 4K/8K từ bài marketing thành lời hứa trên trang này. Không thêm giải thưởng, khách hàng hoặc testimonial mới.

## Liên hệ và chức năng

Giữ cấu hình liên hệ hiện có của microsite. Email ở footer/trang dịch vụ mẹ và trong một số bài blog khác nhau; không tự thay email hoặc suy ra tài khoản Zalo. Không chuyển dữ liệu khách sang website mẹ. Các liên kết mẹ là liên kết đọc thêm, mở khi khách chủ động bấm.

Giữ thư viện mẫu, form ngắn, consent, phiếu chi tiết, lịch sử Back/Forward và trang nhân viên. Các phần giới thiệu ẩn khi điền phiếu. Trang chính sách và khu vực nhân viên dùng cùng nhận diện; nội dung chính sách không đổi.

## Cấu trúc thay đổi

web/brand.css là lớp nhận diện sau style.css, chỉ kích hoạt trên body.parent-brand. web/desktop.css bổ sung bố cục desktop cho các màn hình công khai; web/nhan-vien.css định dạng khu vực nhân viên. Các hiệu ứng chữ nhiều màu/đổ khối và các lần xuất hiện làm nội dung bị ẩn được thay bằng typography rõ, media có chiều sâu và tương tác mẫu hiện có. Không thêm thư viện hoặc font. Logo gốc được lưu cục bộ. Backend và schema dữ liệu không được thay đổi.

## Nền màn hình đầu

Tường mẫu hiện có được đưa ra phủ phần đầu. Desktop có năm dải poster nhỏ. Mobile có bốn cột poster nhỏ xếp so le, đủ 13 mẫu chia vào các cột và bản lặp để trôi dọc xuống liên tục; không còn một ô lớn riêng ở bên phải. Nền giữ sắc ảnh mẫu, được tăng sáng nhẹ; đường viền từng ô poster dùng một lớp chỉ chứa khung, đặt trên lớp phủ sáng và dưới điện thoại/chữ. Viền đen 1 px ở alpha 0,19 dùng cùng mask với ảnh, không bị lớp phủ trắng làm mất nét. Lớp khung chạy đồng bộ với ảnh, không chứa ảnh/video/control hoặc ID trùng. Nền là trang trí, được ẩn với trình đọc màn hình và không nhận focus.

Theo yêu cầu mới, mỗi ô nền rộng khoảng 80–108 px trên màn hình 320–430 px, khoảng cách 8 px; ở 390 px mỗi ô rộng 97,5 px. Bốn cột phủ phía sau nội dung, cột chẵn lệch nửa ô để vẫn so le cả khi tắt chuyển động. Mỗi cột có tốc độ/pha riêng và đều trôi xuống; ảnh và viền dùng chung bố cục. Header, khoảng đệm và cụm điện thoại được giữ gọn. Các phần trang chủ dùng cùng mép 18 px, nền tràn đủ chiều ngang và tiếp giáp trực tiếp; nội dung và hành trình gửi nhu cầu vẫn đầy đủ. Chỉ áp dụng các điều chỉnh này tới 760 px.

Nút dừng tiếp tục điều khiển cả hai lớp. Tôn trọng giảm chuyển động, tiết kiệm dữ liệu, hộp thoại và tab ẩn.

## Logo và tiêu đề hiện tại

Tiêu đề hiển thị theo yêu cầu: “Video AI chân thật chất lượng cao”. Tên trong logo là B PRODUCTIONS, viết hoa toàn bộ. Logo trong header của trang chủ, chính sách và nhân viên dùng nguyên file PNG gốc từ website mẹ, đã đối chiếu trực quan với ảnh bảng hiệu: các thanh đen, wordmark và tagline “Borderless Video Production Company”. Không tái tạo lại font chữ của logo.

Nguồn logo gốc (được trang mẹ dùng làm nguồn icon):
https://custom-images.strikinglycdn.com/res/hrscywv4p/image/upload/1146684/467404_780284.png

- File cục bộ: web/logo-b-productions.png; 768×508, 54.483 bytes.
- SHA-256: 7fbef1e6940b7fd27bf0b56d1e8a4e0a7cca397d1bc3e239e5c601342d9cf6e1.
- Đã kiểm byte-identical với file tải từ nguồn. Trình duyệt dùng bản cục bộ, không phụ thuộc CDN logo bên ngoài.

Favicon lấy đúng bản thumbnail từ nguồn icon của trang mẹ:
https://custom-images.strikinglycdn.com/res/hrscywv4p/image/upload/c_limit,fl_lossy,h_64,w_64,q_auto/1146684/467404_780284.png

Mã tiêu đề và OG title đã thống nhất với tiêu đề mới. Nền và đường viền các ô poster phía sau được giữ.

## Hướng rõ–mờ của khung nền

Ảnh và viền ô poster dùng chung mask từ phải sang trái: bên phải rõ, độ hiện giảm dần sang vùng chữ bên trái. Máy tính mờ từ phải sang trái; điện thoại dùng chiều dọc từ trên xuống dưới. Ảnh và viền luôn dùng chung mask theo từng breakpoint. Tiêu đề, logo gốc, viền điện thoại, màu và chuyển động được giữ.

Vùng rõ được kéo rộng hơn: mask giữ đầy đủ trong 48% tính từ phải, giảm còn 0,7 ở mốc 68% và về 0 ở 94%. Lớp phủ sáng máy tính được chuyển tiếp muộn về phía trái tương ứng, để các ô sau cụm điện thoại còn rõ. Hai lớp ảnh và viền dùng cùng mask: desktop từ phải sang trái, mobile từ trên xuống dưới.

Trên điện thoại (tối đa 760 px), nền trắng và lớp phủ sáng cũng chuyển theo chiều dọc để phần trên rõ hơn, phần dưới hòa vào trắng. Chữ mô tả được tăng độ đậm nhẹ để đọc rõ khi ảnh phía trên có nhiều chi tiết. Không hạ hay sắp xếp lại cụm ba điện thoại.

## Hoàn thiện các màn hình máy tính

Hành trình xem mẫu → gửi nhu cầu → studio liên hệ vẫn là mục đích chính. Trình xem dùng video và ảnh mẫu bên trái, lời giới thiệu hoặc form bên phải; không yêu cầu đăng nhập hay tạo tài khoản khách. Khi YouTube chưa phản hồi, giữ ảnh dự phòng và cho thử lại/mở trực tiếp.

Phiếu chi tiết giữ nguyên câu hỏi và cơ chế đồng ý lưu; chỉ bổ sung bố cục, chỉ dẫn tiến độ và thao tác sau khi gửi. Trang chính sách thêm mục lục và giới hạn chiều dài dòng. Trang nhân viên dùng cùng logo/tông màu, đặt danh sách yêu cầu trước thống kê, làm rõ trạng thái liên hệ, tìm kiếm, lỗi mạng và đăng nhập.

Không thay cơ chế xác thực, API, trường dữ liệu hoặc cấu hình liên hệ. Các phiếu dùng kiểm tra và ảnh xem trước là dữ liệu tổng hợp trong SQLite riêng; không kết nối hệ thống khách đang vận hành. Việc kiểm tra mạng và thông điệp YouTube mô phỏng được ghi rõ trong báo cáo, không diễn giải thành video thật đã phát thành công.
