"""Kiểm tra trên trình duyệt: thẻ "Bộ câu hỏi" ở trang nhân viên (xem, sửa chữ, thêm câu, bỏ câu, đổi thứ tự,
lưu là khách thấy ngay, khách đang điền dở vẫn gửi được, lịch sử và khôi phục bản gốc).
Chỉ chạy trên máy chủ thử cục bộ mới tạo (DATA_DIR trống, ADMIN_PASSWORD riêng), vì bài thử sửa bộ câu hỏi đang dùng.
    python tests/browser_sua_cau_hoi.py --base-url http://127.0.0.1:8000 --mat-khau <ADMIN_PASSWORD> [--anh thư-mục-ảnh]
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
anh = Path(args.anh) if args.anh else None
if anh:
    anh.mkdir(parents=True, exist_ok=True)


def bo_hien_tai():
    with urllib.request.urlopen(base + '/api/cau-hinh') as r:
        return json.loads(r.read())['bo_cau_hoi']


def dien_phan(page, cfg, bo, ten):
    loai = {l['id']: l for l in cfg['loai']}; cau = {c['so']: c for c in cfg['cau_hoi']}
    for so in loai[bo]['cau']:
        hop = page.locator(f'#cau-{so}')
        if not hop.count():
            continue
        for t in cau[so]['truong']:
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


goc = bo_hien_tai()
assert goc['phien_ban'].startswith('goc-'), 'Cần máy chủ thử mới tạo (bộ câu hỏi đang là bản gốc).'
SU_KIEN = next(l for l in goc['loai'] if l['id'] == 'su-kien')

with sync_playwright() as p:
    trinh = p.chromium.launch(headless=True)
    loi_js = []

    def trang(viewport, **k):
        ctx = trinh.new_context(viewport=viewport, reduced_motion='reduce', **k)
        pg = ctx.new_page(); pg.route('https://**/*', lambda r: r.abort())
        pg.on('pageerror', lambda e: loi_js.append(str(e)))
        return ctx, pg

    # 0) Khách mở phiếu "Sự kiện" trước khi nhân viên sửa: dùng để thử khách đang điền dở lúc bộ câu hỏi đổi.
    ctx_khach, khach = trang({'width': 390, 'height': 844})
    khach.goto(base + '/phieu/su-kien', wait_until='networkidle')
    khach.locator('#dong-y-luu').check(); khach.locator('#bat-dau-xac-nhan').click()
    expect(khach).to_have_url(re.compile('#phieu/thong-tin$'))

    # 1) Nhân viên mở thẻ "Bộ câu hỏi": thấy bản gốc, chọn loại, xem từng câu.
    ctx, page = trang({'width': 1366, 'height': 900})
    page.on('dialog', lambda d: d.accept())
    page.goto(base + '/nhan-vien#bo-cau-hoi', wait_until='networkidle')
    page.locator('#mat-khau').fill(args.mat_khau); page.locator('#nv-dang-nhap-nut').click()
    expect(page.locator('#khu-cau-hoi')).to_be_visible()
    expect(page.locator('#khu-phieu')).to_be_hidden()
    expect(page.locator('#the-cau-hoi')).to_have_attribute('aria-selected', 'true')
    expect(page.locator('#sc-dang-dung')).to_have_text('Khách đang thấy bản gốc, chưa sửa lần nào.')
    expect(page.locator('.sc-cau')).to_have_count(20)
    page.locator('#the-phieu').focus(); page.keyboard.press('ArrowRight')
    expect(page.locator('#the-cau-hoi')).to_be_focused()
    page.locator('#sc-loai').select_option('su-kien')
    expect(page.locator('.sc-cau')).to_have_count(len(SU_KIEN['cau']))
    expect(page.locator('#sc-ten-loai')).to_have_value(SU_KIEN['ten'])
    expect(page.locator('#sc-xem')).to_have_attribute('href', '/phieu/su-kien')
    # Câu liên hệ không bỏ được; lựa chọn "Quay thực tế" đang làm điều kiện nên khóa.
    page.locator('.sc-cau[data-so="19"] summary').click()
    expect(page.locator('.sc-cau[data-so="19"]').get_by_role('button', name='Bỏ khỏi loại này')).to_be_disabled()
    expect(page.locator('.sc-cau[data-so="19"] .sc-lc-khoa li')).to_have_count(4)
    page.locator('.sc-cau[data-so="27"] summary').click()
    lis = page.locator('.sc-cau[data-so="27"] .sc-lc li')
    o_quay = lis.nth([lis.nth(i).locator('input').input_value() for i in range(lis.count())].index('Quay thực tế'))
    expect(o_quay.locator('input')).to_have_attribute('readonly', '')
    expect(o_quay.get_by_role('button')).to_be_disabled()
    print('PASS thẻ Bộ câu hỏi: xem bản gốc, chọn loại, câu liên hệ và lựa chọn điều kiện bị khóa')

    # 2) Sửa chữ câu dùng chung, đổi thứ tự, bỏ một câu, thêm câu mới, lưu có ghi chú.
    the21 = page.locator('.sc-cau[data-so="21"]')
    the21.locator('summary').click()
    expect(the21.locator('.sc-ghi').first).to_contain_text('dùng chung')
    moi21 = 'Tên đơn vị tổ chức sự kiện là gì?'
    the21.locator('textarea').fill(moi21)
    expect(the21.locator('summary b')).to_have_text(moi21)
    expect(page.locator('#sc-luu')).to_be_visible()
    the21.get_by_role('button', name=re.compile('xuống dưới')).click()
    thu_tu = page.locator('.sc-phan[data-nhom="thong-tin"] .sc-cau').evaluate_all('ds => ds.map(d => d.dataset.so)')
    assert thu_tu.index('46') < thu_tu.index('21'), thu_tu
    page.locator('.sc-cau[data-so="20"] summary').click()
    page.locator('.sc-cau[data-so="20"]').get_by_role('button', name='Bỏ khỏi loại này').click()
    expect(page.locator('.sc-cau[data-so="20"]')).to_have_count(0)
    expect(page.locator('#sc-bao')).to_contain_text('Câu vẫn còn trong kho')
    page.get_by_role('button', name='Thêm câu mới vào phần “Hình thức video”').click()
    moi = page.locator('.sc-cau').filter(has=page.locator('.sc-nhan.moi'))
    expect(moi.locator('textarea')).to_be_focused()
    # Chưa ghi chữ mà bấm lưu: báo lỗi, đưa con trỏ về câu đó.
    page.locator('#sc-luu-nut').click()
    expect(page.locator('#sc-luu-loi')).to_contain_text('chưa ghi chữ')
    expect(moi.locator('textarea')).to_be_focused()
    cau_moi = 'Quý khách hàng muốn video theo tông màu nào?'
    moi.locator('textarea').fill(cau_moi)
    moi.locator('.sc-lc li input').nth(0).fill('Tươi sáng'); moi.locator('.sc-lc li input').nth(1).fill('Trầm ấm')
    moi.get_by_role('button', name='Thêm lựa chọn').click()
    expect(moi.locator('.sc-lc li input').nth(2)).to_be_focused()
    moi.locator('.sc-lc li input').nth(2).fill('Theo màu thương hiệu')
    so_moi = int(moi.get_attribute('data-so')); assert so_moi >= 1001, so_moi
    if anh:
        page.screenshot(path=str(anh / 'sua-cau-hoi-1366.png'), full_page=True)
        moi.screenshot(path=str(anh / 'sua-cau-hoi-cau-moi.png'))
    page.locator('#sc-ghi-chu').fill('Thêm câu tông màu cho sự kiện')
    page.locator('#sc-luu-nut').click()
    expect(page.locator('#sc-bao')).to_have_text('Đã lưu. Khách mở phiếu từ bây giờ sẽ thấy bộ câu hỏi mới.')
    expect(page.locator('#sc-luu')).to_be_hidden()
    expect(page.locator('#sc-dang-dung')).to_contain_text('Khách đang thấy bản sửa lúc')
    expect(page.locator('#sc-dang-dung')).to_contain_text('Thêm câu tông màu cho sự kiện')
    expect(page.locator('#sc-lich-su li').first).to_contain_text('Thêm câu tông màu cho sự kiện')
    expect(page.locator(f'.sc-cau[data-so="{so_moi}"] .sc-nhan.moi')).to_have_count(0)
    print('PASS sửa chữ, đổi thứ tự, bỏ câu, thêm câu mới (chặn câu chưa có chữ), lưu có ghi chú và lịch sử')

    # 3) Khách mở phiếu sau khi lưu: thấy ngay bộ mới.
    cfg = bo_hien_tai()
    ctx2, k2 = trang({'width': 390, 'height': 844})
    k2.goto(base + '/phieu/su-kien', wait_until='networkidle')
    k2.locator('#dong-y-luu').check(); k2.locator('#bat-dau-xac-nhan').click()
    expect(k2.locator('#cau-46 .so-cau')).to_have_text('1')
    expect(k2.locator('#cau-21')).to_contain_text(moi21)
    dien_phan(k2, cfg, 'su-kien', 'Khách sau khi sửa'); k2.locator('#tiep-tuc').click()
    while not k2.locator(f'#cau-{so_moi}').count():
        dien_phan(k2, cfg, 'su-kien', 'Khách sau khi sửa'); k2.locator('#tiep-tuc').click()
    expect(k2.locator(f'#cau-{so_moi}')).to_contain_text(cau_moi)
    if anh:
        k2.locator(f'#cau-{so_moi}').screenshot(path=str(anh / 'khach-thay-cau-moi-390.png'))
    ctx2.close()
    print('PASS khách mở phiếu sau khi lưu thấy ngay câu đã sửa, thứ tự mới và câu mới')

    # 4) Khách đã mở phiếu từ trước khi sửa: gửi phiếu thì được đưa tới câu mới bắt buộc, trả lời rồi gửi được.
    nhom_cu = [n['id'] for n in goc['nhom'] if n['id'] != 'loai-video' and any(c['nhom'] == n['id'] for c in goc['cau_hoi'] if c['so'] in SU_KIEN['cau'])]
    for i in range(len(nhom_cu)):
        dien_phan(khach, goc, 'su-kien', 'Khách đang điền dở')
        if i == len(nhom_cu) - 1:
            khach.locator('#dong-y').check()
        khach.locator('#tiep-tuc').click()
    expect(khach.locator(f'#cau-{so_moi}')).to_be_visible()
    expect(khach.locator(f'#cau-{so_moi}')).to_have_class(re.compile('co-loi'))
    khach.locator(f'#cau-{so_moi}').get_by_role('button', name='Tươi sáng', exact=True).click()
    while not khach.locator('#cam-on').is_visible():
        dien_phan(khach, cfg, 'su-kien', 'Khách đang điền dở')
        if khach.locator('#dong-y').is_visible() and not khach.locator('#dong-y').is_checked():
            khach.locator('#dong-y').check()
        khach.locator('#tiep-tuc').click()
        khach.wait_for_timeout(300)
    expect(khach.locator('#tom-tat')).to_contain_text(cau_moi)
    ctx_khach.close()
    print('PASS khách đang điền dở lúc nhân viên sửa: được đưa tới câu mới, trả lời rồi gửi được')

    # 5) Khôi phục bản gốc, rồi lịch sử còn đủ các bản.
    page.locator('#sc-lich-su-hop summary').click()
    page.locator('#sc-ve-goc').click()
    expect(page.locator('#sc-dang-dung')).to_contain_text('Khách đang thấy bản gốc (khôi phục lúc')
    expect(page.locator('#sc-ve-goc')).to_be_disabled()
    expect(page.locator('#sc-lich-su li')).to_have_count(2)
    expect(page.locator('.sc-cau[data-so="20"]')).to_have_count(1)
    expect(page.locator(f'.sc-cau[data-so="{so_moi}"]')).to_have_count(0)
    page.locator('#sc-lich-su li').nth(1).get_by_role('button', name='Khôi phục bản này').click()
    expect(page.locator(f'.sc-cau[data-so="{so_moi}"]')).to_have_count(1)
    expect(page.locator('#sc-lich-su li').first).to_contain_text('Khôi phục bản lúc')
    # Bỏ thay đổi chưa lưu
    page.locator('.sc-cau[data-so="21"] summary').click()
    page.locator('.sc-cau[data-so="21"] textarea').fill('Sửa nháp')
    expect(page.locator('#sc-luu')).to_be_visible()
    page.locator('#sc-bo-doi').click()
    expect(page.locator('#sc-luu')).to_be_hidden()
    expect(page.locator('.sc-cau[data-so="21"] summary b')).to_have_text(moi21)
    print('PASS khôi phục bản gốc, khôi phục lại bản đã sửa, bỏ thay đổi chưa lưu')

    # 6) Thẻ "Yêu cầu của khách" vẫn như cũ; khổ điện thoại không tràn ngang.
    page.locator('#the-phieu').click()
    expect(page.locator('#khu-phieu')).to_be_visible(); expect(page.locator('#ds-phieu .nv-hang')).not_to_have_count(0)
    page.locator('#the-cau-hoi').click()
    for rong in (390, 768):
        page.set_viewport_size({'width': rong, 'height': 900})
        if page.locator('.sc-cau[data-so="27"]').get_attribute('open') is None:
            page.locator('.sc-cau[data-so="27"] summary').click()
        tran = page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
        assert tran <= 0, (rong, tran)
        if anh:
            page.screenshot(path=str(anh / f'sua-cau-hoi-{rong}.png'), full_page=True)
    ctx.close()
    print('PASS thẻ yêu cầu của khách vẫn dùng được, khổ 390 và 768 không tràn ngang')

    assert not loi_js, loi_js
    print('PASS không có lỗi JavaScript')
    trinh.close()
