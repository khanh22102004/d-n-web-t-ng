"""Kiểm tra trên trình duyệt: trang điền phiếu riêng (/phieu, /phieu/<loại>, mã QR), phiếu theo loại video,
nút gửi link, câu hiện theo điều kiện, tiếng Nhật, và trang nhân viên (mã QR, link, lọc theo loại, tích chọn,
tải Excel phiếu đã chọn, xóa phiếu đã chọn, xóa hết phiếu đang lọc).
Chỉ chạy trên máy chủ thử cục bộ có DATA_DIR riêng và ADMIN_PASSWORD, vì bài thử tạo rồi xóa phiếu giả.
    python tests/browser_loai_video.py --base-url http://127.0.0.1:8000 --mat-khau <ADMIN_PASSWORD> [--anh thư-mục-ảnh]
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
ap.add_argument('--mat-khau', required=True)
ap.add_argument('--anh', default='')
args = ap.parse_args()
base = args.base_url.rstrip('/')
if urlsplit(base).hostname not in ('127.0.0.1', 'localhost', '::1'):
    raise SystemExit('Chỉ chạy bài kiểm tra này trên máy chủ thử cục bộ.')
with urllib.request.urlopen(base + '/api/cau-hinh') as r:
    cfg = json.loads(r.read())['bo_cau_hoi']
LOAI = {l['id']: l for l in cfg['loai']}
CAU = {c['so']: c for c in cfg['cau_hoi']}
anh = Path(args.anh) if args.anh else None
if anh:
    anh.mkdir(parents=True, exist_ok=True)


def nhom_cua(bo):
    co = {CAU[so]['nhom'] for so in LOAI[bo]['cau']}
    return [n['id'] for n in cfg['nhom'] if n['id'] == 'loai-video' or n['id'] in co]


def dien_phan(page, bo, ten):
    """Điền mọi câu bắt buộc đang hiện ở phần hiện tại (chọn lựa chọn đầu, chữ là tên khách)."""
    for so in LOAI[bo]['cau']:
        hop = page.locator(f'#cau-{so}')
        if not hop.count():
            continue
        for t in CAU[so]['truong']:
            if not t.get('bat_buoc'):
                continue
            o = page.locator(f'#o-{so}-{t["id"]}')
            if t['kieu'] in ('chu', 'doan'):
                if o.count():
                    o.fill('0901234567' if t['id'] == 'dia_chi' else ten)
                continue
            lc = t['lua_chon'][0]
            nut = hop.get_by_role('button', name=lc['ten'] if isinstance(lc, dict) else lc, exact=True)
            if nut.count() and nut.first.get_attribute('aria-pressed') != 'true':
                nut.first.click()


def dien_het(page, bo, ten):
    ds = nhom_cua(bo)
    for i in range(1, len(ds)):
        expect(page).to_have_url(re.compile(re.escape('#phieu/' + ds[i]) + '$'))
        dien_phan(page, bo, ten)
        if i == len(ds) - 1:
            page.locator('#dong-y').check()
        page.locator('#tiep-tuc').click()
    expect(page.locator('#cam-on')).to_be_visible()


with sync_playwright() as p:
    trinh = p.chromium.launch(headless=True)
    loi_js = []

    def trang_moi(**k):
        ctx = trinh.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce', **k)
        pg = ctx.new_page()
        pg.route('https://**/*', lambda r: r.abort())
        pg.on('pageerror', lambda e: loi_js.append(str(e)))
        return ctx, pg

    # 1) Link riêng một loại: vào thẳng trang điền phiếu (không qua trang chủ, không tải ảnh mẫu), đồng ý ngay trên trang,
    #    rồi vào bộ câu hỏi "Sự kiện"; số câu bắt đầu từ 1.
    ctx, page = trang_moi()
    anh_mau = []
    page.on('request', lambda r: anh_mau.append(r.url) if '/anh-mau/' in r.url else None)
    page.goto(base + '/phieu/su-kien', wait_until='networkidle')
    expect(page.locator('#bat-dau-hop')).to_be_visible()
    expect(page.locator('#mo-dau')).to_be_hidden()
    assert page.evaluate('!document.querySelector("#bat-dau-hop").matches(":modal")')   # khung nằm trên trang, không phải hộp nổi
    expect(page.locator('#bat-dau-loai')).to_have_text('Loại video: Sự kiện')
    expect(page.locator('#bat-dau-huy')).to_be_hidden()
    page.locator('#dong-y-luu').check(); page.locator('#bat-dau-xac-nhan').click()
    expect(page).to_have_url(re.compile('#phieu/thong-tin$'))
    so_phan = len(nhom_cua('su-kien'))
    expect(page.locator('#tien-do-nhom')).to_have_text(f'Phần 2 trên {so_phan}, câu 1 đến 2')
    expect(page.locator('#cau-21 .so-cau')).to_have_text('1')
    if anh:
        page.screenshot(path=str(anh / 'link-su-kien-390.png'), full_page=True)
    dien_het(page, 'su-kien', 'Khách link sự kiện')
    expect(page.locator('#tom-tat')).to_contain_text('Loại video')
    expect(page.locator('#tom-tat')).to_contain_text('Sự kiện')
    assert not anh_mau, anh_mau
    ctx.close()
    print('PASS /phieu/su-kien vào thẳng phiếu, không tải ảnh mẫu, số câu từ 1, gửi được và tóm tắt có loại video')

    # 1b) Mã QR chung (/phieu): đồng ý rồi tới bước chọn loại video; tải lại giữa chừng thì mở tiếp phiếu dở.
    ctx, page = trang_moi()
    page.goto(base + '/phieu', wait_until='networkidle')
    expect(page.locator('#bat-dau-loai')).to_be_hidden()
    page.locator('#bat-dau-xac-nhan').click()
    expect(page.locator('#loi-dong-y-luu')).to_be_visible()
    page.locator('#dong-y-luu').check(); page.locator('#bat-dau-xac-nhan').click()
    expect(page.locator('#cau-loai .the-loai')).to_have_count(8)
    page.locator('#cau-loai').get_by_role('button', name=re.compile('^Khác')).click()
    page.locator('#o-21-ten_don_vi').fill('Khách quét mã QR')
    page.wait_for_timeout(1500)
    page.reload(wait_until='networkidle')
    expect(page.locator('#o-21-ten_don_vi')).to_have_value('Khách quét mã QR')
    page.locator('#quay-lai').click(); page.locator('#quay-lai').click()
    expect(page.locator('#bat-dau-hop')).to_be_visible()      # về khung bắt đầu, không về trang chủ
    expect(page.locator('#mo-dau')).to_be_hidden()
    ctx.close()
    print('PASS /phieu (mã QR): đồng ý trên trang, chọn loại, tải lại mở tiếp phiếu dở, Quay lại về khung bắt đầu')

    # 2) Chọn loại ở bước đầu, câu "quay thực tế" chỉ hiện khi chọn, nút gửi link chép đúng link.
    ctx, page = trang_moi(permissions=['clipboard-read', 'clipboard-write'])
    page.goto(base + '/', wait_until='networkidle')
    page.get_by_role('button', name='Tôi đã có yêu cầu cụ thể →', exact=True).click()
    page.locator('#dong-y-luu').check(); page.locator('#bat-dau-xac-nhan').click()
    expect(page.locator('#cau-loai .the-loai')).to_have_count(8)
    expect(page.locator('#tien-do-nhom')).to_have_text('Chọn loại video')
    if anh:
        page.screenshot(path=str(anh / 'chon-loai-390.png'), full_page=True)
        page.set_viewport_size({'width': 768, 'height': 1024}); page.screenshot(path=str(anh / 'chon-loai-768.png'), full_page=False)
        page.set_viewport_size({'width': 1366, 'height': 900}); page.screenshot(path=str(anh / 'chon-loai-1366.png'), full_page=False)
        page.set_viewport_size({'width': 390, 'height': 844})
    page.locator('#cau-loai').get_by_role('button', name=re.compile('^Video doanh nghiệp')).click()
    expect(page).to_have_url(re.compile('#phieu/thong-tin$'))
    page.locator('#gui-link').click()
    expect(page.locator('#gui-link-bao')).to_have_text('Đã chép link. Quý khách hàng dán vào Zalo, Messenger hoặc email để gửi.')
    assert page.evaluate('navigator.clipboard.readText()') == base + '/phieu/doanh-nghiep'
    dien_phan(page, 'doanh-nghiep', 'Khách doanh nghiệp'); page.locator('#tiep-tuc').click()
    dien_phan(page, 'doanh-nghiep', 'Khách doanh nghiệp'); page.locator('#tiep-tuc').click()
    expect(page).to_have_url(re.compile('#phieu/hinh-thuc$'))
    expect(page.locator('#cau-28')).to_have_count(0)
    page.locator('#cau-27').get_by_role('button', name='Quay thực tế', exact=True).click()
    expect(page.locator('#cau-28')).to_be_visible()
    so28 = page.locator('#cau-28 .so-cau').inner_text()
    assert so28 == str(int(page.locator('#cau-27 .so-cau').inner_text()) + 1), so28
    if anh:
        page.locator('#cau-28').screenshot(path=str(anh / 'cau-quay-thuc-te-390.png'))
    page.locator('#cau-27').get_by_role('button', name='Quay thực tế', exact=True).click()
    expect(page.locator('#cau-28')).to_have_count(0)
    ctx.close()
    print('PASS bước chọn 8 loại video, câu quay thực tế hiện/ẩn đúng, nút gửi link chép link đúng loại')

    # 3) Tiếng Nhật: tên loại video được dịch.
    ctx, page = trang_moi()
    page.goto(base + '/?lang=ja', wait_until='networkidle')
    page.locator('[data-bat-dau]').first.click()
    page.locator('#dong-y-luu').check(); page.locator('#bat-dau-xac-nhan').click()
    expect(page.locator('#cau-loai')).to_contain_text('企業紹介動画')
    expect(page.locator('#cau-loai legend')).to_have_text('どの種類の動画をご希望ですか？')
    if anh:
        page.screenshot(path=str(anh / 'chon-loai-ja-390.png'), full_page=True)
    ctx.close()
    print('PASS tiếng Nhật ở bước chọn loại video')

    # 4) Trang nhân viên: lọc theo loại, tích chọn, tải Excel phiếu đã chọn, xóa phiếu đã chọn, xóa hết phiếu đang lọc.
    for bo, ten in (('tuyen-dung', 'Khách tuyển dụng A'), ('tuyen-dung', 'Khách tuyển dụng B')):
        ctx, page = trang_moi()
        page.goto(base + f'/phieu/{bo}', wait_until='networkidle')
        page.locator('#dong-y-luu').check(); page.locator('#bat-dau-xac-nhan').click()
        dien_het(page, bo, ten)
        ctx.close()
    ctx = trinh.new_context(viewport={'width': 1366, 'height': 900}, accept_downloads=True)
    page = ctx.new_page(); page.on('pageerror', lambda e: loi_js.append(str(e)))
    page.goto(base + '/nhan-vien', wait_until='networkidle')
    page.locator('#mat-khau').fill(args.mat_khau); page.locator('#nv-dang-nhap-nut').click()
    expect(page.locator('#bang')).to_be_visible()
    expect(page.locator('#ds-link li')).to_have_count(8)
    expect(page.locator('#link-chung')).to_have_value(base + '/phieu')
    assert page.evaluate('document.querySelector(".nv-qr img").naturalWidth') > 0
    with page.expect_download() as tai_qr:
        page.get_by_role('link', name='Tải ảnh mã QR').click()
    assert tai_qr.value.suggested_filename == 'ma-qr-phieu-b-productions.png', tai_qr.value.suggested_filename
    page.locator('#loc-bo').select_option('tuyen-dung')
    expect(page.locator('#phan-trang')).to_contain_text('2 phiếu')
    expect(page.locator('#xoa-dang-loc')).to_have_text('Xóa hết 2 phiếu đang lọc')
    page.locator('.nv-tich input').first.check()
    expect(page.locator('#so-da-chon')).to_have_text('Đã chọn 1 phiếu')
    with page.expect_download() as tai:
        page.locator('#xuat-da-chon').click()
    assert tai.value.suggested_filename.startswith('phieu-da-chon-'), tai.value.suggested_filename
    if anh:
        page.screenshot(path=str(anh / 'nhan-vien-1366.png'), full_page=True)
    page.locator('#xoa-da-chon').click()
    expect(page.locator('#nv-xac-nhan')).to_be_visible()
    expect(page.locator('#xn-xoa')).to_have_text('Xóa vĩnh viễn 1 phiếu')
    if anh:
        page.locator('.nv-danh-sach').screenshot(path=str(anh / 'nhan-vien-xac-nhan-xoa.png'))
    page.locator('#xn-xoa').click()
    expect(page.locator('#nv-bao')).to_have_text('Đã xóa 1 phiếu.')
    expect(page.locator('#phan-trang')).to_contain_text('1 phiếu')
    page.locator('#xoa-dang-loc').click(); page.locator('#xn-xoa').click()
    expect(page.locator('#nv-bao')).to_have_text('Đã xóa 1 phiếu.')
    expect(page.locator('#trong')).to_be_visible()
    page.locator('#loc-bo').select_option('su-kien')
    expect(page.locator('#phan-trang')).to_contain_text('1 phiếu')
    expect(page.locator('#ds-phieu')).to_contain_text('Sự kiện')
    if anh:
        page.set_viewport_size({'width': 390, 'height': 844}); page.screenshot(path=str(anh / 'nhan-vien-390.png'), full_page=True)
    ctx.close()
    print('PASS trang nhân viên: lọc theo loại, tải Excel phiếu đã chọn, xóa phiếu đã chọn, xóa hết phiếu đang lọc')
    assert not loi_js, loi_js
    print('PASS không có lỗi JavaScript')
    trinh.close()
