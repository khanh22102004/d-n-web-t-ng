"""Kiểm tra trên trình duyệt: thẻ "Video mẫu" ở trang nhân viên (thêm video bằng link YouTube và ảnh bìa, sửa, đổi thứ tự,
ẩn, hiện lại, chặn lỗi trước khi lưu) và trang khách thấy đúng danh sách sau khi lưu.
Chỉ chạy trên máy chủ thử cục bộ mới tạo (DATA_DIR trống, ADMIN_PASSWORD riêng), vì bài thử sửa danh sách video mẫu.
    python tests/browser_video_mau.py --base-url http://127.0.0.1:8000 --mat-khau <ADMIN_PASSWORD> [--anh thư-mục-ảnh]
"""
import argparse
import io
import json
import re
import tempfile
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

from PIL import Image, ImageDraw
from playwright.sync_api import expect, sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument('--base-url', default='http://127.0.0.1:8000')
ap.add_argument('--mat-khau', required=True)
ap.add_argument('--anh', default='')
args = ap.parse_args()
base = args.base_url.rstrip('/')
if urlsplit(base).hostname not in ('127.0.0.1', 'localhost', '::1'):
    raise SystemExit('Chỉ chạy bài kiểm tra này trên máy chủ thử cục bộ.')
anh = Path(args.anh) if args.anh else None
if anh:
    anh.mkdir(parents=True, exist_ok=True)
with urllib.request.urlopen(base + '/api/cau-hinh') as r:
    GOC = [m['ma'] for m in json.loads(r.read())['mau']]
so_moi = max(int(m[2:]) for m in GOC if re.fullmatch(r'ST\d+', m)) + 1
MA_MOI = f'ST{so_moi:03d}'

# Ảnh bìa thử: ảnh dọc có chữ, như ảnh nhân viên chụp màn hình video.
tep_anh = Path(tempfile.mkdtemp()) / 'anh-bia.png'
a = Image.new('RGB', (1080, 1920), (32, 90, 160)); ImageDraw.Draw(a).rectangle((200, 700, 880, 1220), fill=(250, 200, 40)); a.save(tep_anh)

with sync_playwright() as p:
    trinh = p.chromium.launch(headless=True)
    loi_js = []
    ctx = trinh.new_context(viewport={'width': 1366, 'height': 900}, reduced_motion='reduce')
    page = ctx.new_page(); page.route('https://**/*', lambda r: r.abort())
    page.on('pageerror', lambda e: loi_js.append(str(e))); page.on('dialog', lambda d: d.accept())

    # 1) Mở thẳng thẻ Video mẫu bằng địa chỉ #video-mau; video đang là lựa chọn trong phiếu không ẩn được.
    page.goto(base + '/nhan-vien#video-mau', wait_until='networkidle')
    page.locator('#mat-khau').fill(args.mat_khau); page.locator('#nv-dang-nhap-nut').click()
    expect(page.locator('#khu-video')).to_be_visible()
    expect(page.locator('#vm-dang-dung')).to_have_text('Trang khách đang dùng danh sách video mẫu gốc, chưa sửa lần nào.')
    expect(page.locator('.vm-the')).to_have_count(len(GOC))
    expect(page.locator('#vm-dem')).to_have_text(f'{len(GOC)} video, {len(GOC)} đang hiện cho khách')
    the29 = page.locator('.vm-the[data-ma="ST029"]')
    expect(the29.get_by_role('button', name='Ẩn khỏi trang')).to_have_count(0)
    expect(the29).to_contain_text('Không ẩn được vì có trong phiếu')
    expect(the29).to_contain_text('Có trong phiếu')
    page.locator('#the-phieu').focus(); page.keyboard.press('End')              # thẻ cuối là Bảo mật
    expect(page.locator('#the-bao-mat')).to_be_focused(); page.keyboard.press('ArrowLeft')
    expect(page.locator('#the-video')).to_be_focused(); expect(page.locator('#khu-video')).to_be_visible()
    print('PASS thẻ Video mẫu: mở bằng #video-mau, đủ danh sách, video có trong phiếu không ẩn được')

    # 2) Thêm video mới: mã gợi ý, link YouTube (sai rồi đúng), tên, ngành, ảnh bìa tải lên; thiếu tên thì chặn khi lưu.
    page.locator('#vm-them').click()
    moi = page.locator(f'.vm-the[data-ma="{MA_MOI}"]')
    expect(moi).to_contain_text('Mới, chưa lưu')
    expect(moi.locator('.vm-sua input').first).to_be_focused()
    expect(moi.locator('.vm-sua input').first).to_have_value(MA_MOI)
    yt = moi.get_by_label('Link YouTube')
    yt.fill('https://vimeo.com/12345'); expect(moi.locator('.sc-ghi-nho.loi')).to_contain_text('Chưa nhận ra link YouTube')
    yt.fill('https://youtube.com/shorts/abcDEF12345?si=x'); expect(moi).to_contain_text('Mã video: abcDEF12345')
    moi.get_by_label('Loại video').select_option('san-pham-dich-vu')
    moi.get_by_label('Ngành').select_option('Ẩm thực')
    moi.get_by_label('Phong cách').select_option('Quay thực tế')
    moi.get_by_label('Kiểu chi tiết (không bắt buộc)').fill('Người thật, đời thường')
    moi.get_by_label('Cách hiện trên thẻ').select_option('dong')
    moi.get_by_label('Ảnh bìa').set_input_files(str(tep_anh))
    expect(moi.locator('.vm-o-anh .sc-ghi-nho')).to_have_text('Đã tải ảnh bìa. Bấm “Lưu và áp dụng” để dùng ảnh này.', timeout=15000)
    expect(moi.locator('.vm-sua input').first).to_have_attribute('readonly', '')
    assert moi.locator('.vm-xem-anh img').evaluate('i => i.decode().then(() => i.naturalWidth)') == 270
    page.locator('#vm-luu-nut').click()
    expect(page.locator('#vm-luu-loi')).to_have_text(f'Video {MA_MOI} chưa có tên.')
    expect(moi.get_by_label('Tên video')).to_be_focused()
    moi.get_by_label('Tên video').fill('Quảng cáo quán cà phê')
    moi.get_by_label('Lượt tim').fill('1500')
    moi.get_by_role('button', name=f'Đưa video {MA_MOI} lên trên').click()
    thu_tu = page.locator('.vm-the').evaluate_all('ds => ds.map(d => d.dataset.ma)')
    assert thu_tu.index(MA_MOI) == len(GOC) - 1, thu_tu
    if anh:
        page.screenshot(path=str(anh / 'video-mau-1366.png'), full_page=True)
        moi.screenshot(path=str(anh / 'video-mau-them.png'))
    print('PASS thêm video: mã gợi ý, nhận link YouTube, tải ảnh bìa (máy chủ cắt 270×480), chặn khi thiếu tên, đổi thứ tự')

    # 3) Ẩn một video rồi lưu: trang khách thấy video mới với ảnh bìa tải lên, không thấy video đã ẩn.
    page.locator('.vm-the[data-ma="ST053"]').get_by_role('button', name='Ẩn khỏi trang').click()
    expect(page.locator('.vm-the[data-ma="ST053"]')).to_contain_text('Đang ẩn')
    page.locator('#vm-ghi-chu').fill('Thêm quán cà phê, ẩn video game')
    page.locator('#vm-luu-nut').click()
    expect(page.locator('#vm-bao')).to_have_text('Đã lưu. Trang khách đổi theo trong khoảng 5 phút.')
    expect(page.locator('#vm-luu')).to_be_hidden()
    expect(page.locator('#vm-dang-dung')).to_contain_text('Thêm quán cà phê, ẩn video game')
    expect(moi).not_to_contain_text('Mới, chưa lưu')
    expect(page.locator('#vm-dem')).to_have_text(f'{len(GOC) + 1} video, {len(GOC)} đang hiện cho khách, 1 đang ẩn')

    kh = ctx.new_page(); kh.route('https://**/*', lambda r: r.abort()); kh.on('pageerror', lambda e: loi_js.append(str(e)))
    kh.goto(base + '/#mau', wait_until='networkidle')
    # Ảnh bìa tải lên có mặt ở tường nền (cỡ 180×320) và thư viện (cỡ 270×480), tải được.
    anh_moi = kh.evaluate(f"""async () => {{ const ds = [...document.querySelectorAll('img[src^="/anh-mau-tai/{MA_MOI}/"]')];
      await Promise.all(ds.map(i => i.decode().catch(() => null))); return ds.map(i => [i.getAttribute('src'), i.naturalWidth]); }}""")
    assert any(s.endswith('/nho.webp') and w == 270 for s, w in anh_moi), anh_moi
    assert any(s.endswith('/tuong.webp') and w == 180 for s, w in anh_moi), anh_moi
    expect(kh.locator('img[src*="ST053"]')).to_have_count(0)
    if anh:
        the_moi = kh.locator(f'li:has(img[src^="/anh-mau-tai/{MA_MOI}/"][src$="nho.webp"])').first
        the_moi.scroll_into_view_if_needed(); the_moi.screenshot(path=str(anh / 'khach-thay-video-moi.png'))
    kh.close()
    print('PASS lưu: trang khách có video mới với ảnh bìa tải lên, video đã ẩn không còn')

    # 4) Hiện lại video đã ẩn; bỏ thay đổi chưa lưu.
    page.locator('.vm-the[data-ma="ST053"]').get_by_role('button', name='Hiện lại').click()
    page.locator('#vm-luu-nut').click()
    expect(page.locator('#vm-dem')).to_have_text(f'{len(GOC) + 1} video, {len(GOC) + 1} đang hiện cho khách')
    page.locator('.vm-the[data-ma="ST011"]').get_by_role('button', name='Sửa video ST011').click()
    page.locator('.vm-the[data-ma="ST011"]').get_by_label('Tên video').fill('Sửa nháp')
    expect(page.locator('#vm-luu')).to_be_visible()
    page.locator('#vm-bo-doi').click()
    expect(page.locator('#vm-luu')).to_be_hidden()
    expect(page.locator('.vm-the[data-ma="ST011"] .vm-chu b')).not_to_have_text('Sửa nháp')
    print('PASS hiện lại video đã ẩn, bỏ thay đổi chưa lưu')

    # 5) Khổ điện thoại, máy tính bảng: không tràn ngang.
    page.locator('.vm-the').last.get_by_role('button', name=re.compile('^Sửa video')).click()
    for rong in (390, 768):
        page.set_viewport_size({'width': rong, 'height': 900})
        tran = page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
        assert tran <= 0, (rong, tran)
        if anh:
            page.screenshot(path=str(anh / f'video-mau-{rong}.png'), full_page=True)
    print('PASS khổ 390 và 768 không tràn ngang')
    ctx.close()
    assert not loi_js, loi_js
    print('PASS không có lỗi JavaScript')
    trinh.close()
