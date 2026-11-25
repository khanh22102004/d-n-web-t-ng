"""Kiểm tra trên trình duyệt: thư viện mẫu ở trang chủ có bộ lọc ba nhóm (mục đích là 8 loại video, ngành, phong cách),
nhãn trên từng thẻ mẫu, ba câu hỏi gợi ý loại video, phiếu mở từ gợi ý được điền sẵn phong cách, Facebook ở chân trang,
bản tiếng Nhật và tiếng Anh. Chỉ chạy trên máy chủ thử cục bộ (bài thử tạo phiếu giả).
    python tests/browser_tim_mau.py --base-url http://127.0.0.1:8000 [--anh thư-mục-ảnh]
"""
import argparse
import json
import re
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument('--base-url', default='http://127.0.0.1:8000')
ap.add_argument('--anh', default='')
args = ap.parse_args()
base = args.base_url.rstrip('/')
if urlsplit(base).hostname not in ('127.0.0.1', 'localhost', '::1'):
    raise SystemExit('Chỉ chạy bài kiểm tra này trên máy chủ thử cục bộ.')
anh = Path(args.anh) if args.anh else None
if anh:
    anh.mkdir(parents=True, exist_ok=True)
with urllib.request.urlopen(base + '/api/cau-hinh') as r:
    cfg = json.loads(r.read())
MAU, LOAI = cfg['mau'], {l['id']: l for l in cfg['bo_cau_hoi']['loai']}
dem = lambda **dk: sum(all(m.get(k) == v for k, v in dk.items()) for m in MAU)
loai_khong_mau = next(l for l in LOAI if not dem(loai=l))

with sync_playwright() as p:
    trinh = p.chromium.launch(headless=True)
    loi_js = []

    def trang(rong=1366, **k):
        ctx = trinh.new_context(viewport={'width': rong, 'height': 900}, reduced_motion='reduce', **k)
        pg = ctx.new_page(); pg.route('https://**/*', lambda r: r.abort())
        pg.on('pageerror', lambda e: loi_js.append(str(e)))
        return ctx, pg

    # 1) Bộ lọc: 8 loại video, ngành và phong cách chỉ hiện mục có mẫu; mỗi thẻ có nhãn loại, ngành, phong cách.
    ctx, page = trang()
    page.goto(base + '/', wait_until='networkidle')
    the = page.locator('#ray-mau > li')
    expect(page.locator('.tim-loai-nut')).to_have_count(8)
    expect(the).to_have_count(len(MAU))
    m0 = MAU[0]
    expect(page.locator('#ray-mau > li').first.locator('.nhan-mau span')).to_have_text([LOAI[m0['loai']]['ten'], m0['nhom'], m0['phong_cach']])
    page.locator('.tim-loai-nut', has_text='Sản phẩm, dịch vụ').click()
    expect(the).to_have_count(dem(loai='san-pham-dich-vu'))
    expect(page.locator('.tim-loai-nut', has_text='Sản phẩm, dịch vụ')).to_have_attribute('aria-pressed', 'true')
    page.locator('.tim-chip', has_text='Làm đẹp').click()
    expect(the).to_have_count(dem(loai='san-pham-dich-vu', nhom='Làm đẹp'))
    expect(page.locator('.tim-ket-qua p')).to_have_text(f"Có {dem(loai='san-pham-dich-vu', nhom='Làm đẹp')} video phù hợp")
    expect(page.locator('.tim-chip', has_text='Làm đẹp')).to_be_focused()
    # Đổi sang loại không có mẫu ngành đang chọn: bỏ ngành, rồi mời điền phiếu đúng loại đó.
    page.locator('.tim-loai-nut', has_text=LOAI[loai_khong_mau]['ten']).click()
    expect(page.locator('.tim-chip[aria-pressed="true"]')).to_have_count(0)
    expect(page.locator('.tim-trong')).to_contain_text('Chưa có video mẫu đúng lựa chọn này')
    expect(page.locator('.tim-trong a.nut')).to_have_attribute('href', f'/phieu/{loai_khong_mau}')
    page.locator('.tim-trong').get_by_role('button', name='Xóa bộ lọc').click()
    expect(the).to_have_count(len(MAU))
    if anh:
        page.locator('.tim-loai-nut', has_text='Video tuyển dụng').click()
        page.locator('#mau').screenshot(path=str(anh / 'tim-mau-1366.png'))
        page.locator('.tim-loai-nut', has_text='Video tuyển dụng').click()
    print('PASS bộ lọc 8 loại video, ngành, phong cách; nhãn trên thẻ; loại chưa có mẫu thì mời điền phiếu đúng loại')

    # 2) Ba câu hỏi gợi ý: mục đích → ngành → phong cách → loại video, video mẫu gần nhất, nút điền phiếu.
    page.locator('#goi-y-mo').click()
    expect(page.locator('#goi-y-mo')).to_have_attribute('aria-expanded', 'true')
    expect(page.locator('.goi-y-buoc')).to_have_text('Câu 1/3'); expect(page.locator('#goi-y-tieu-de')).to_be_focused()
    expect(page.locator('.goi-y-nut')).to_have_count(8)
    page.locator('.goi-y-nut', has_text='Video tuyển dụng').click()
    expect(page.locator('.goi-y-buoc')).to_have_text('Câu 2/3')
    expect(page.locator('.goi-y-nut')).to_have_count(len(cfg['phan_loai']['nganh']))
    page.get_by_role('button', name='← Câu trước').click()
    expect(page.locator('.goi-y-nut', has_text='Video tuyển dụng')).to_have_attribute('aria-pressed', 'true')
    page.locator('.goi-y-nut', has_text='Video tuyển dụng').click()
    page.locator('.goi-y-nut', has_text='Chăm sóc, y tế').click()
    expect(page.locator('.goi-y-buoc')).to_have_text('Câu 3/3')
    page.locator('.goi-y-nut', has_text='Hoạt hình').click()
    expect(page.locator('.goi-y-buoc')).to_have_text('Gợi ý cho Quý khách hàng')
    expect(page.locator('#goi-y-tieu-de')).to_have_text('Video tuyển dụng')
    goi_y = [m['ma'] for m in MAU if m['loai'] == 'tuyen-dung' or m['nhom'] == 'Chăm sóc, y tế']
    expect(page.locator('.goi-y-mau li')).to_have_count(min(4, len(goi_y)))
    expect(page.locator('.goi-y-mau li').first.locator('.ma-mau')).to_have_text('ST057')   # đúng loại, ngành và phong cách đứng đầu
    expect(page.get_by_role('link', name='Điền phiếu Video tuyển dụng')).to_have_attribute('href', '/phieu/tuyen-dung?phong=Ho%E1%BA%A1t%20h%C3%ACnh')
    if anh:
        page.locator('#goi-y-loai').screenshot(path=str(anh / 'goi-y-ket-qua-1366.png'))
    page.get_by_role('button', name='Xem video mẫu cùng loại').click()
    expect(page.locator('#goi-y-loai')).to_be_hidden()
    expect(the).to_have_count(dem(loai='tuyen-dung', phong_cach='Hoạt hình'))
    expect(page.locator('.tim-loai-nut', has_text='Video tuyển dụng')).to_have_attribute('aria-pressed', 'true')
    # Loại chưa có mẫu: không có nút xem video cùng loại; chọn "nhờ chúng tôi gợi ý" thì phiếu chọn sẵn "Nhờ chúng tôi tư vấn".
    page.locator('#goi-y-mo').click()
    page.locator('.goi-y-nut', has_text=LOAI[loai_khong_mau]['ten']).click(); page.locator('.goi-y-nut', has_text='Khác').click()
    page.locator('.goi-y-nut', has_text='Chưa biết, nhờ chúng tôi gợi ý').click()
    expect(page.get_by_role('button', name='Xem video mẫu cùng loại')).to_have_count(0)
    expect(page.locator('.goi-y-chi-tiet')).to_contain_text('Phong cách: chúng tôi gợi ý khi liên hệ')
    expect(page.locator('.goi-y-ket a.nut')).to_have_attribute('href', f'/phieu/{loai_khong_mau}?phong=goi-y')
    page.get_by_role('button', name='Đóng').click()
    expect(page.locator('#goi-y-mo')).to_be_focused()
    # Chân trang: chỉ có Facebook của công ty.
    fb = page.locator('footer .chan-mxh a')
    expect(fb).to_have_count(1)
    expect(fb).to_have_attribute('href', 'https://www.facebook.com/bproductionsdanang')
    expect(fb).to_have_attribute('target', '_blank'); expect(fb).to_have_attribute('rel', 'noopener noreferrer')
    expect(fb).to_have_attribute('aria-label', 'Facebook của B PRODUCTIONS')
    ctx.close()
    print('PASS ba câu hỏi gợi ý: đủ 3 bước, quay lại câu trước, gợi ý loại video và mẫu gần nhất, nút điền phiếu, lọc thư viện; Facebook ở chân trang')

    # 3) Phiếu mở từ gợi ý được điền sẵn phong cách ở câu "cách làm video" (loại video có câu này).
    ctx, page = trang(390)
    page.goto(base + '/phieu/doanh-nghiep?phong=Quay%20th%E1%BB%B1c%20t%E1%BA%BF', wait_until='networkidle')
    page.locator('#dong-y-luu').check(); page.locator('#bat-dau-xac-nhan').click()
    expect(page).to_have_url(re.compile('#phieu/thong-tin$'))
    page.wait_for_timeout(1500)
    luu = page.evaluate(f"fetch('/api/phieu/' + localStorage.getItem('bp-phieu')).then(r => r.json())")
    assert luu['tra_loi'].get('27.cach_lam') == ['Quay thực tế'], luu['tra_loi']
    ctx.close()
    print('PASS phiếu mở từ gợi ý có sẵn phong cách đã chọn (câu cách làm video), lưu lên máy chủ')

    # 4) Tiếng Nhật, tiếng Anh; khổ điện thoại không tràn ngang.
    for nn, tieu_de, nut in (('ja', 'サンプル動画を探す', '3つの質問に答える'), ('en', 'Find sample videos', 'Answer 3 questions')):
        ctx, page = trang(390)
        page.goto(base + f'/?lang={nn}', wait_until='networkidle')
        expect(page.locator('.tim-dau h3')).to_have_text(tieu_de)
        expect(page.locator('#goi-y-mo')).to_have_text(nut)
        page.locator('#goi-y-mo').click()
        assert page.locator('#goi-y-tieu-de').inner_text() != 'Quý khách hàng muốn làm video để làm gì?'
        tran = page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
        assert tran <= 0, (nn, tran)
        if anh and nn == 'ja':
            page.locator('#mau').screenshot(path=str(anh / 'tim-mau-ja-390.png'))
        ctx.close()
    print('PASS tiếng Nhật, tiếng Anh; khổ 390 không tràn ngang')
    assert not loi_js, loi_js
    print('PASS không có lỗi JavaScript')
    trinh.close()
