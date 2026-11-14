"""Kiểm tra trên cơ sở dữ liệu tạm, không đọc hoặc sửa dữ liệu đang vận hành."""
import concurrent.futures
import io
import json
import os
import secrets
from pathlib import Path
import sys
import tempfile
import threading
from unittest.mock import patch
import unittest

from PIL import Image
from openpyxl import load_workbook
from starlette.testclient import TestClient

_TMP = tempfile.TemporaryDirectory()
os.environ.update(DATA_DIR=_TMP.name, DATABASE_URL='', ADMIN_PASSWORD='test-password', STUDIO_CONTACT='studio@example.test')
os.environ.pop('RENDER', None)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import may_chu as m


class RegressionTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(m.app)
        m._dem.clear()
        for table in ('anh', 'phieu', 'luot_xem'):
            m.sql('DELETE FROM ' + table)

    def tearDown(self):
        self.client.close()

    def new(self):
        r = self.client.post('/api/phieu', json={'dong_y_luu': True})
        self.assertEqual(r.status_code, 201, r.text)
        return '/api/phieu/' + r.json()['id']

    def answers(self):
        a = {}
        for c in m.CAU:
            for t in c['truong']:
                if not t.get('bat_buoc'):
                    continue
                if t['kieu'] in ('chu', 'doan'):
                    v = 'Kiểm thử'
                else:
                    v = m.ten_lua_chon(t['lua_chon'][0])
                    if t['kieu'] == 'nhieu':
                        v = [v]
                a[f"{c['so']}.{t['id']}"] = v
        a['19.dia_chi'] = '0901234567'
        return a

    def image(self, fmt='PNG'):
        out = io.BytesIO()
        Image.new('RGB', (40, 60), 'green').save(out, format=fmt)
        return out.getvalue()

    def login(self):
        r = self.client.post('/api/nhan-vien/dang-nhap', json={'mat_khau': 'test-password'})
        self.assertEqual(r.status_code, 200)

    def test_consent_required_before_creating_draft(self):
        self.assertEqual(self.client.post('/api/phieu', json={}).status_code, 400)
        path = self.new()
        row = m.sql('SELECT dong_y_luu_luc FROM phieu WHERE id=?', (path.split('/')[-1],), 'mot')
        self.assertTrue(row[0])

    def test_save_and_submit_lock(self):
        path = self.new()
        self.assertEqual(self.client.put(path, json={'tra_loi': self.answers()}).status_code, 200)
        self.assertEqual(self.client.post(path + '/gui', json={'dong_y': False}).status_code, 400)
        self.assertEqual(self.client.post(path + '/gui', json={'dong_y': True}).status_code, 200)
        self.assertEqual(self.client.put(path, json={'tra_loi': {}}).status_code, 409)
        self.assertEqual(self.client.post(path + '/anh', files={'anh': ('a.png', self.image())}).status_code, 409)
        self.assertEqual(self.client.post(path + '/gui', json={'dong_y': True}).status_code, 200)

    def test_fake_and_truncated_images_rejected(self):
        path = self.new()
        for data in (b'\x89PNG\r\n\x1a\nnot-an-image', self.image()[:30], b'not-an-image'):
            self.assertEqual(self.client.post(path + '/anh', files={'anh': ('a.png', data)}).status_code, 400)
        self.assertEqual(self.client.get(path).json()['anh'], [])

    def test_supported_images_round_trip(self):
        path = self.new()
        for fmt in ('PNG', 'JPEG', 'WEBP'):
            r = self.client.post(path + '/anh', files={'anh': ('a.' + fmt.lower(), self.image(fmt))})
            self.assertEqual(r.status_code, 201, r.text)
        self.login()
        for a in self.client.get(path).json()['anh']:
            r = self.client.get('/api/nhan-vien/anh/' + a['id'])
            Image.open(io.BytesIO(r.content)).verify()

    def test_concurrent_upload_limit(self):
        path = self.new()
        data = self.image()
        def upload(_):
            with TestClient(m.app) as client:
                return client.post(path + '/anh', files={'anh': ('a.png', data)}).status_code
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            statuses = list(pool.map(upload, range(8)))
        self.assertEqual(statuses.count(201), 3, statuses)
        self.assertEqual(statuses.count(400), 5, statuses)
        self.assertEqual(len(self.client.get(path).json()['anh']), 3)

    def test_chunked_upload_size_limit(self):
        path = self.new()
        def body():
            for _ in range(7):
                yield b'x' * 1_000_000
        r = self.client.post(path + '/anh', content=body(), headers={'Content-Type': 'multipart/form-data; boundary=test'})
        self.assertEqual(r.status_code, 413)

    def test_metadata_removed(self):
        from PIL.PngImagePlugin import PngInfo
        info = PngInfo(); info.add_text('private', 'secret')
        out = io.BytesIO(); Image.new('RGB', (2, 2)).save(out, format='PNG', pnginfo=info)
        clean, _ = m.chuan_hoa_anh(out.getvalue())
        self.assertNotIn('private', Image.open(io.BytesIO(clean)).info)

    def test_large_dimensions_rejected(self):
        previous = m.Image.MAX_IMAGE_PIXELS
        try:
            m.Image.MAX_IMAGE_PIXELS = 1000
            self.assertEqual(self.client.post(self.new() + '/anh', files={'anh': ('a.png', self.image())}).status_code, 400)
        finally:
            m.Image.MAX_IMAGE_PIXELS = previous

    def test_pagination_search_and_status(self):
        for i in range(25):
            m.sql('INSERT INTO phieu (id,tao_luc,sua_luc,tra_loi,gui_luc) VALUES (?,?,?,?,?)',
                  (f'test-{i:025}', m.bay_gio(), m.bay_gio(), json.dumps({'1.san_pham': f'Product {i:02}'}, ensure_ascii=False), m.bay_gio() if i == 0 else None))
        self.assertEqual(self.client.get('/api/nhan-vien/phieu').status_code, 401)
        self.login()
        page = self.client.get('/api/nhan-vien/phieu').json()
        self.assertEqual((len(page['phieu']), page['tong'], page['so_trang']), (20, 25, 2))
        self.assertEqual(page['thong_ke']['bat_dau'], 25)
        self.assertEqual(len(self.client.get('/api/nhan-vien/phieu?trang=2').json()['phieu']), 5)
        self.assertEqual(self.client.get('/api/nhan-vien/phieu?tim=Product+00').json()['tong'], 1)
        self.assertEqual(self.client.get('/api/nhan-vien/phieu?trang_thai=cho-lien-he').json()['tong'], 1)
        self.assertEqual(self.client.get('/api/nhan-vien/phieu?tim=%25').json()['tong'], 0)
        self.assertEqual(self.client.get('/api/nhan-vien/phieu?trang=x').status_code, 400)

    def test_excel_and_contact_policy(self):
        path = self.new()
        a = self.answers(); a['1.san_pham'] = '=1+1'
        self.client.post(path + '/gui', json={'dong_y': True, 'tra_loi': a})
        self.login()
        r = self.client.get('/api/nhan-vien/xuat-excel')
        workbook = load_workbook(io.BytesIO(r.content))
        self.assertEqual(workbook['Phiếu đã gửi'].cell(2, 5).value, "'=1+1")
        for path in ('/chinh-sach', '/chinh-sach.html'):
            text = self.client.get(path).text
            self.assertIn('studio@example.test', text)
            self.assertNotIn('__LIEN_HE_STUDIO__', text)

    def test_late_autosave_cannot_overwrite_submitted_answers(self):
        path = self.new()
        reached, release = threading.Event(), threading.Event()
        clean = m.lam_sach
        def delayed(answers):
            if answers.get('1.san_pham') == 'late autosave':
                reached.set()
                if not release.wait(5):
                    raise RuntimeError('test timed out')
            return clean(answers)
        def save():
            with TestClient(m.app) as client:
                return client.put(path, json={'tra_loi': {'1.san_pham': 'late autosave'}})
        with patch.object(m, 'lam_sach', delayed), concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            pending = pool.submit(save)
            try:
                self.assertTrue(reached.wait(5))
                self.assertEqual(self.client.post(path + '/gui', json={'dong_y': True, 'tra_loi': self.answers()}).status_code, 200)
            finally:
                release.set()
            self.assertEqual(pending.result(timeout=5).status_code, 409)
        self.assertEqual(self.client.get(path).json()['tra_loi'], self.answers())

    def test_delete_requires_login_confirmation_and_removes_images(self):
        path = self.new()
        self.client.post(path + '/anh', files={'anh': ('a.png', self.image())})
        admin_path = '/api/nhan-vien/phieu/' + path.split('/')[-1]
        self.assertEqual(self.client.request('DELETE', admin_path, json={'xac_nhan': True}).status_code, 401)
        self.login()
        self.assertEqual(self.client.request('DELETE', admin_path, json={}).status_code, 400)
        self.assertEqual(len(self.client.get(path).json()['anh']), 1)
        self.assertEqual(self.client.request('DELETE', admin_path, json={'xac_nhan': True}).status_code, 200)
        self.assertEqual(self.client.get(path).status_code, 404)
        self.assertEqual(m.sql('SELECT COUNT(*) FROM anh', lay='mot')[0], 0)

    def test_schema_upgrade_is_repeatable_and_preserves_existing_rows(self):
        path = self.new()
        self.client.put(path, json={'tra_loi': self.answers()})
        m.tao_bang()
        m.tao_bang()
        self.assertEqual(self.client.get(path).json()['tra_loi'], self.answers())

    def quick(self, **changes):
        return {**dict(san_pham='Cà phê rang', lien_he='0901 234 567', dong_y=True, ma_gui=secrets.token_hex(24)), **changes}

    def test_quick_request_requires_explicit_consent(self):
        data = self.quick(); data['dong_y'] = False
        self.assertEqual(self.client.post('/api/tu-van', json=data).status_code, 400)
        data['dong_y'] = 'true'
        self.assertEqual(self.client.post('/api/tu-van', json=data).status_code, 400)
        self.assertEqual(m.sql('SELECT COUNT(*) FROM phieu', lay='mot')[0], 0)

    def test_quick_request_rejects_invalid_fields(self):
        for changes in ({'san_pham': ' '}, {'san_pham': 'x' * 301}, {'lien_he': '09012345678'},
                        {'lien_he': ['0901234567']}, {'ma_mau': 'not-a-sample'}, {'ma_gui': 'short'}):
            data = self.quick(); data.update(changes)
            self.assertEqual(self.client.post('/api/tu-van', json=data).status_code, 400, changes)
        self.assertEqual(m.sql('SELECT COUNT(*) FROM phieu', lay='mot')[0], 0)

    def test_quick_request_appears_in_admin_and_excel_with_sample(self):
        data = self.quick(ma_mau='ST029', nguon='TikTok')
        self.assertEqual(self.client.post('/api/tu-van', json=data).status_code, 201)
        self.login()
        result = self.client.get('/api/nhan-vien/phieu?trang_thai=cho-lien-he').json()
        self.assertEqual(result['tong'], 1)
        request = result['phieu'][0]
        self.assertEqual(request['loai'], 'tu-van-nhanh')
        self.assertEqual(request['lien_he'], '0901234567')
        self.assertEqual(request['nguon'], 'tiktok')
        self.assertTrue(any('ST029' in row['tra_loi'] for row in request['tom_tat']))
        self.assertEqual(result['thong_ke']['cho_lien_he'], 1)
        workbook = load_workbook(io.BytesIO(self.client.get('/api/nhan-vien/xuat-excel').content))
        sheet = workbook['Phiếu đã gửi']
        self.assertEqual(sheet.cell(2, sheet.max_column - 1).value, 'Tư vấn nhanh')
        self.assertEqual(sheet.cell(2, sheet.max_column).value, 'ST029')
        row = m.sql('SELECT dong_y_gui_luc,dong_y_luu_luc FROM phieu', lay='mot')
        self.assertTrue(row[0]); self.assertIsNone(row[1])

    def test_quick_retry_does_not_create_duplicate_request(self):
        data = self.quick()
        self.assertEqual(self.client.post('/api/tu-van', json=data).status_code, 201)
        for _ in range(7):
            self.assertEqual(self.client.post('/api/tu-van', json=data).status_code, 200)
        self.assertEqual(m.sql('SELECT COUNT(*) FROM phieu', lay='mot')[0], 1)
        data['san_pham'] = 'Changed product'
        self.assertEqual(self.client.post('/api/tu-van', json=data).status_code, 409)

    def test_quick_concurrent_retries_create_one_request(self):
        data = self.quick()
        def submit(_):
            with TestClient(m.app) as client:
                return client.post('/api/tu-van', json=data).status_code
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            statuses = list(pool.map(submit, range(4)))
        self.assertTrue(all(s in (200, 201) for s in statuses), statuses)
        self.assertEqual(m.sql('SELECT COUNT(*) FROM phieu', lay='mot')[0], 1)

    def test_quick_request_rate_limit(self):
        for _ in range(5):
            self.assertEqual(self.client.post('/api/tu-van', json=self.quick()).status_code, 201)
        self.assertEqual(self.client.post('/api/tu-van', json=self.quick()).status_code, 429)

    def test_quick_request_contact_channel(self):
        self.assertEqual(self.client.post('/api/tu-van', json=self.quick(kenh='Zalo')).status_code, 201)
        self.assertEqual(self.client.post('/api/tu-van', json=self.quick(kenh='Fax')).status_code, 400)
        row = json.loads(m.sql('SELECT tra_loi FROM phieu', lay='mot')[0])
        self.assertEqual(row['19.kenh'], 'Zalo')

    def test_quick_follow_up_answers_are_added_and_validated(self):
        data = self.quick(kenh='Zalo')
        self.assertEqual(self.client.post('/api/tu-van', json=data).status_code, 201)
        extra = {'ma_gui': data['ma_gui'], 'ten': 'Lê Thị C', 'han': 'Trong 1 đến 2 tuần',
                 'ngan_sach': 'Không có trong danh sách', 'noi_dang': ['TikTok', 'Zalo', 'MySpace']}
        self.assertEqual(self.client.post('/api/tu-van/bo-sung', json=extra).status_code, 200)
        saved = json.loads(m.sql('SELECT tra_loi FROM phieu', lay='mot')[0])
        self.assertEqual(saved['19.ten'], 'Lê Thị C')
        self.assertEqual(saved['17.han'], 'Trong 1 đến 2 tuần')
        self.assertNotIn('18.ngan_sach', saved)  # lựa chọn lạ bị bỏ
        self.assertEqual(saved['7.noi_dang'], ['TikTok', 'Zalo'])
        # Gửi lại cùng yêu cầu gốc sau khi đã bổ sung vẫn được coi là một yêu cầu.
        self.assertEqual(self.client.post('/api/tu-van', json=data).status_code, 200)
        self.assertEqual(self.client.post('/api/tu-van/bo-sung', json={'ma_gui': secrets.token_hex(24), 'ten': 'X'}).status_code, 404)
        self.assertEqual(self.client.post('/api/tu-van/bo-sung', json={'ma_gui': data['ma_gui']}).status_code, 400)
        self.assertEqual(m.sql('SELECT COUNT(*) FROM phieu', lay='mot')[0], 1)

    def test_detailed_form_merges_quick_request_with_same_phone(self):
        data = self.quick(ma_mau='ST029', lien_he='+84 901 234 567')
        self.assertEqual(self.client.post('/api/tu-van', json=data).status_code, 201)
        self.login()
        quick_id = 'tv_' + data['ma_gui']
        self.client.post(f'/api/nhan-vien/phieu/{quick_id}/lien-he', json={'da_lien_he': True})
        url = self.new()
        r = self.client.post(url + '/gui', json={'tra_loi': self.answers(), 'dong_y': True, 'tu_van': data['ma_gui']})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(m.sql('SELECT COUNT(*) FROM phieu', lay='mot')[0], 1)
        tra_loi, lien_he_luc = m.sql('SELECT tra_loi, lien_he_luc FROM phieu', lay='mot')
        self.assertEqual(json.loads(tra_loi)['_mau'], 'ST029')
        self.assertTrue(lien_he_luc)
        self.assertTrue(any(row['cau'] == 'Gộp từ yêu cầu tư vấn nhanh' for row in r.json()['tom_tat']))

    def test_detailed_form_keeps_quick_request_when_phone_differs(self):
        data = self.quick(lien_he='0911 111 111')
        self.assertEqual(self.client.post('/api/tu-van', json=data).status_code, 201)
        url = self.new()
        r = self.client.post(url + '/gui', json={'tra_loi': self.answers(), 'dong_y': True, 'tu_van': data['ma_gui']})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(m.sql('SELECT COUNT(*) FROM phieu', lay='mot')[0], 2)

    def test_quick_request_keeps_valid_style_quiz_answers(self):
        data = self.quick(them={'2.nhom': 'Mỹ phẩm, làm đẹp', '7.noi_dang': ['TikTok', 'Không có'], '4.muc_dich': 'Bán hàng',
                                '18.ngan_sach': 'Trên 50 triệu đồng', '_loai': 'chi-tiet'})
        self.assertEqual(self.client.post('/api/tu-van', json=data).status_code, 201)
        saved = json.loads(m.sql('SELECT tra_loi FROM phieu', lay='mot')[0])
        self.assertEqual(saved['2.nhom'], 'Mỹ phẩm, làm đẹp')
        self.assertEqual(saved['7.noi_dang'], ['TikTok'])
        self.assertEqual(saved['4.muc_dich'], 'Bán hàng')
        self.assertNotIn('18.ngan_sach', saved)   # chỉ nhận ba câu của phần gợi ý
        self.assertEqual(saved['_loai'], 'tu-van-nhanh')
        self.assertEqual(self.client.post('/api/tu-van', json=self.quick(them=['x'])).status_code, 400)

    def test_concurrent_page_views(self):
        def view(_):
            with TestClient(m.app) as client:
                return client.post('/api/luot-xem', json={'nguon': 'test'}).status_code
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            self.assertEqual(list(pool.map(view, range(8))), [204] * 8)
        self.assertEqual(m.sql('SELECT so FROM luot_xem WHERE nguon=?', ('test',), 'mot')[0], 8)


if __name__ == '__main__':
    unittest.main()
