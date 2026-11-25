"""Kiểm tra trên trình duyệt: trang nhân viên — "Chọn tất cả" chọn hết phiếu mọi trang ngay lần bấm đầu, đánh dấu đã
liên hệ phải xác nhận và ghi lịch sử (ai, lúc nào, ghi chú), bỏ đánh dấu, xóa vào thùng rác, khôi phục, xóa vĩnh viễn.
Chỉ chạy trên máy chủ thử cục bộ dùng SQLite: bài thử ghi thẳng 23 phiếu giả vào tệp dữ liệu của máy chủ thử.
    python tests/browser_nhan_vien.py --base-url http://127.0.0.1:8000 --mat-khau <ADMIN_PASSWORD> --du-lieu <DATA_DIR>/du_lieu.db [--anh thư-mục-ảnh]
"""
import argparse
import io
import json
import secrets
import sqlite3
from pathlib import Path
from urllib.parse import urlsplit

from PIL import Image
from playwright.sync_api import expect, sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument('--base-url', default='http://127.0.0.1:8000')
ap.add_argument('--mat-khau', required=True)
ap.add_argument('--du-lieu', required=True)
ap.add_argument('--anh', default='')
args = ap.parse_args()
base = args.base_url.rstrip('/')
if urlsplit(base).hostname not in ('127.0.0.1', 'localhost', '::1'):
    raise SystemExit('Chỉ chạy bài kiểm tra này trên máy chủ thử cục bộ.')
anh = Path(args.anh) if args.anh else None
if anh:
    anh.mkdir(parents=True, exist_ok=True)

# 23 phiếu đã gửi (hơn một trang danh sách 20 phiếu); phiếu mới nhất có một ảnh
db = sqlite3.connect(args.du_lieu)
ma = []
for i in range(23):
    m = secrets.token_urlsafe(24)
    ma.append(m)
    luc = f'2026-11-{10 + i // 10:02d} 09:{i:02d}:00'
    tl = {'_bo': 'san-pham-dich-vu', '19.ten': f'Khách thử {i + 1:02d}', '19.kenh': 'Zalo', '19.dia_chi': f'09012345{i:02d}',
          '1.san_pham': f'Sản phẩm {i + 1}'}
    db.execute('INSERT INTO phieu (id, tao_luc, sua_luc, gui_luc, nguon, nhom_dang_dung, tra_loi, bo) VALUES (?,?,?,?,?,?,?,?)',
               (m, luc, luc, luc, 'ma-qr', '', json.dumps(tl, ensure_ascii=False), 'san-pham-dich-vu'))
tep = io.BytesIO(); Image.new('RGB', (600, 800), 'teal').save(tep, format='JPEG')
db.execute('INSERT INTO anh (id, phieu_id, ten, kieu, kich_thuoc, du_lieu, tao_luc) VALUES (?,?,?,?,?,?,?)',
           (secrets.token_urlsafe(16), ma[-1], 'san-pham.jpg', 'image/jpeg', len(tep.getvalue()), tep.getvalue(), '2026-11-12 09:22:00'))
db.commit(); db.close()

loi_js = []
with sync_playwright() as p:
    trinh = p.chromium.launch()
    for rong, cao in ((1366, 900), (390, 844)):
        ctx = trinh.new_context(viewport={'width': rong, 'height': cao}, reduced_motion='reduce')
        page = ctx.new_page(); page.on('pageerror', lambda e: loi_js.append(str(e)))
        page.goto(base + '/nhan-vien', wait_until='networkidle')
        if page.locator('#form-dang-nhap').is_visible():
            page.fill('#mat-khau', args.mat_khau); page.click('#nv-dang-nhap-nut')
        expect(page.locator('#phan-trang')).to_contain_text('23 phiếu' if rong > 760 else '21 phiếu')   # khổ 1366 chạy trước, xóa vĩnh viễn 2 phiếu
        if rong < 760:
            # Khổ điện thoại: khung xác nhận, lịch sử không tràn ngang
            page.locator('#ds-phieu details').first.locator('summary').click()
            page.locator('#ds-phieu details').first.get_by_role('button', name='Đánh dấu đã liên hệ').click()
            expect(page.locator('.nv-hoi')).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth') <= rong, 'tràn ngang ở khổ điện thoại'
            if anh:
                page.locator('#ds-phieu details').first.screenshot(path=str(anh / f'nhan-vien-xac-nhan-{rong}.png'))
            page.locator('.nv-hoi').get_by_role('button', name='Hủy').click()
            expect(page.locator('.nv-hoi')).to_have_count(0)
            ctx.close()
            continue

        # 1) Chọn tất cả: chọn hết 23 phiếu (2 trang) ngay lần bấm đầu
        expect(page.locator('#chon-ca-chu')).to_have_text('Chọn tất cả 23 phiếu')
        page.locator('#chon-ca-trang').check()
        expect(page.locator('#so-da-chon')).to_have_text('Đã chọn 23 phiếu')
        expect(page.locator('#xoa-da-chon')).to_be_enabled()
        page.click('#trang-sau')
        expect(page.locator('#phan-trang')).to_contain_text('Trang 2/2')
        expect(page.locator('.nv-tich input:checked')).to_have_count(3)
        expect(page.locator('#chon-ca-trang')).to_be_checked()
        page.locator('.nv-tich input').first.uncheck()
        expect(page.locator('#so-da-chon')).to_have_text('Đã chọn 22 phiếu')
        assert page.evaluate("document.getElementById('chon-ca-trang').indeterminate")
        page.click('#trang-truoc')
        page.locator('#chon-ca-trang').check()                         # đang chọn dở: bấm là chọn lại tất cả
        expect(page.locator('#so-da-chon')).to_have_text('Đã chọn 23 phiếu')
        page.locator('#chon-ca-trang').uncheck()
        expect(page.locator('#so-da-chon')).to_have_text('Chưa chọn phiếu nào')
        expect(page.locator('.nv-tich input:checked')).to_have_count(0)

        # 2) Đánh dấu đã liên hệ: phải xác nhận, Hủy thì không đổi; xác nhận thì ghi lịch sử kèm người và ghi chú
        phieu = page.locator('#ds-phieu details').first
        phieu.locator('summary').click()
        phieu.get_by_role('button', name='Đánh dấu đã liên hệ').click()
        hoi = phieu.locator('.nv-hoi')
        expect(hoi).to_contain_text('Xác nhận đã liên hệ với Khách thử 23 (Zalo: 0901234522)?')
        hoi.get_by_role('button', name='Hủy').click()
        expect(phieu.locator('.nhan-tt')).to_have_text('Chờ liên hệ')
        expect(phieu.locator('.lich-su li')).to_have_count(1)            # chỉ có "Khách gửi phiếu"
        phieu.get_by_role('button', name='Đánh dấu đã liên hệ').click()
        hoi.get_by_label('Người liên hệ').fill('Khánh')
        hoi.get_by_label('Ghi chú (không bắt buộc)').fill('Gọi Zalo, hẹn gửi báo giá thứ Sáu')
        if anh:
            phieu.screenshot(path=str(anh / 'nhan-vien-xac-nhan-1366.png'))
        hoi.get_by_role('button', name='Xác nhận đã liên hệ').click()
        phieu = page.locator('#ds-phieu details').first
        expect(phieu.locator('.nhan-tt')).to_have_text('Đã liên hệ')
        expect(phieu.locator('.lich-su li').first).to_contain_text('Đánh dấu đã liên hệ · Khánh')
        expect(phieu.locator('.lich-su li').first).to_contain_text('Gọi Zalo, hẹn gửi báo giá thứ Sáu')
        expect(page.locator('#so-lieu')).to_contain_text('22')               # phiếu chờ liên hệ giảm còn 22
        # Bỏ đánh dấu: hỏi lại, tên người làm đã nhớ sẵn
        phieu.get_by_role('button', name='Bỏ đánh dấu đã liên hệ').click()
        expect(phieu.locator('.nv-hoi').get_by_label('Người thực hiện')).to_have_value('Khánh')
        phieu.locator('.nv-hoi').get_by_label('Lý do (không bắt buộc)').fill('Đánh dấu nhầm')
        phieu.locator('.nv-hoi').get_by_role('button', name='Bỏ đánh dấu').click()
        phieu = page.locator('#ds-phieu details').first
        expect(phieu.locator('.nhan-tt')).to_have_text('Chờ liên hệ')
        expect(phieu.locator('.lich-su li')).to_have_count(3)
        expect(phieu.locator('.lich-su li').first).to_contain_text('Bỏ đánh dấu đã liên hệ · Khánh')
        if anh:
            phieu.screenshot(path=str(anh / 'nhan-vien-lich-su-1366.png'))

        # 3) Xóa một phiếu: vào thùng rác, khôi phục được
        phieu.get_by_role('button', name='Xóa phiếu').click()
        expect(phieu.locator('.nv-hoi')).to_contain_text('chuyển vào Thùng rác, khôi phục được trong 30 ngày')
        phieu.locator('.nv-hoi').get_by_role('button', name='Xóa phiếu').click()
        expect(page.locator('#nv-bao')).to_have_text('Đã chuyển phiếu của Khách thử 23 vào thùng rác.')
        expect(page.locator('#phan-trang')).to_contain_text('22 phiếu')
        expect(page.locator('#mo-thung-rac')).to_have_text('Thùng rác (1)')
        page.click('#mo-thung-rac')
        expect(page.locator('#nv-thung-rac')).to_be_visible()
        expect(page.locator('#phan-trang')).to_contain_text('1 phiếu')
        rac = page.locator('#ds-phieu details').first
        expect(rac.locator('.nhan-tt')).to_have_text('Đã xóa')
        rac.locator('summary').click()
        expect(rac).to_contain_text('tự xóa hẳn sau 30 ngày nữa')
        expect(rac.get_by_role('button', name='Đánh dấu đã liên hệ')).to_have_count(0)
        if anh:
            page.locator('.nv-danh-sach').screenshot(path=str(anh / 'nhan-vien-thung-rac-1366.png'))
        rac.get_by_role('button', name='Khôi phục phiếu này').click()
        expect(page.locator('#nv-bao')).to_have_text('Đã khôi phục 1 phiếu về danh sách.')
        expect(page.locator('#trong')).to_be_visible()
        page.click('#ra-thung-rac')
        expect(page.locator('#phan-trang')).to_contain_text('23 phiếu')
        phieu = page.locator('#ds-phieu details').first
        phieu.locator('summary').click()
        expect(phieu.locator('.lich-su li').first).to_contain_text('Khôi phục từ thùng rác')
        expect(phieu.locator('.anh-khach img')).to_have_count(1)            # ảnh vẫn còn sau khi khôi phục

        # 4) Xóa nhiều phiếu rồi xóa vĩnh viễn trong thùng rác
        for o in page.locator('.nv-tich input').all()[:2]:
            o.check()
        page.click('#xoa-da-chon')
        expect(page.locator('#xn-xoa')).to_have_text('Xóa 2 phiếu')
        expect(page.locator('#xn-xuat')).to_be_hidden()
        page.click('#xn-xoa')
        expect(page.locator('#nv-bao')).to_have_text('Đã chuyển 2 phiếu vào thùng rác.')
        page.locator('#trang-thai').select_option('da-xoa')
        expect(page.locator('#phan-trang')).to_contain_text('2 phiếu')
        expect(page.locator('#khoi-phuc-da-chon')).to_be_visible()
        expect(page.locator('#chon-ca-chu')).to_have_text('Chọn tất cả 2 phiếu trong thùng rác')
        page.locator('#chon-ca-trang').check()
        expect(page.locator('#xoa-da-chon')).to_have_text('Xóa vĩnh viễn phiếu đã chọn')
        page.click('#xoa-da-chon')
        expect(page.locator('#xn-xoa')).to_have_text('Xóa vĩnh viễn 2 phiếu')
        expect(page.locator('#xn-xuat')).to_be_visible()
        page.click('#xn-xoa')
        expect(page.locator('#nv-bao')).to_have_text('Đã xóa vĩnh viễn 2 phiếu.')
        expect(page.locator('#trong')).to_be_visible()
        page.click('#ra-thung-rac')
        expect(page.locator('#phan-trang')).to_contain_text('21 phiếu')
        expect(page.locator('#mo-thung-rac')).to_have_text('Thùng rác')
        ctx.close()
    trinh.close()
assert not loi_js, loi_js
print('PASS trang nhân viên: chọn tất cả mọi trang ngay lần đầu, xác nhận và lịch sử liên hệ, thùng rác, khôi phục, xóa vĩnh viễn (1366, 390)')
