"""Kiểm tra trên cơ sở dữ liệu tạm, không đọc hoặc sửa dữ liệu đang vận hành."""
import concurrent.futures
import io
import json
import re
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
        for table in ('anh', 'phieu', 'luot_xem', 'bo_cau_hoi'):
            m.sql('DELETE FROM ' + table)
        m.dam_bao_bo(ngay=True)              # bộ câu hỏi về bản gốc trong mã

    def tearDown(self):
        self.client.close()

    def new(self):
        r = self.client.post('/api/phieu', json={'dong_y_luu': True})
        self.assertEqual(r.status_code, 201, r.text)
        return '/api/phieu/' + r.json()['id']

    def answers(self, bo=None):
        """Câu trả lời đủ các câu bắt buộc của một loại video (mặc định: bộ "Sản phẩm, dịch vụ" như phiếu cũ)."""
        a = {'_bo': bo} if bo else {}
        for c in m.CAU_CUA_BO[bo or m.BO_MAC_DINH]:
            if not m.dang_hien(a, c):
                continue
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

    def test_reviews_only_show_complete_consented_entries(self):
        data = [
            {'ten': 'Chị A', 'noi_dung': 'Video rõ ràng.', 'sao': 5, 'da_dong_y': True, 'nguon': 'javascript:alert(1)'},
            {'ten': 'Anh B', 'noi_dung': 'Ổn.', 'sao': 4},                      # chưa đồng ý cho đăng
            {'ten': 'Chị C', 'noi_dung': 'Tốt.', 'sao': 6, 'da_dong_y': True},  # số sao sai
            {'ten': '', 'noi_dung': 'Thiếu tên', 'sao': 5, 'da_dong_y': True},
            {'ten': 'Anh D', 'noi_dung': 'Được', 'sao': True, 'da_dong_y': True},
            'không phải đánh giá',
        ]
        with tempfile.TemporaryDirectory() as d:
            tep = Path(d) / 'danh_gia.json'
            tep.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
            ds = m.doc_danh_gia(tep)
            self.assertEqual([x['ten'] for x in ds], ['Chị A'])
            self.assertEqual(ds[0]['nguon'], '')
            tep.write_text('{hỏng', encoding='utf-8')
            self.assertEqual(m.doc_danh_gia(tep), [])
        self.assertIn('danh_gia', self.client.get('/api/cau-hinh').json())

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
        sheet = workbook['Phiếu đã gửi']
        cot = [o.value for o in sheet[1]].index('Tên sản phẩm') + 1
        self.assertEqual(sheet.cell(2, cot).value, "'=1+1")
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

    def test_international_phone_numbers_are_accepted(self):
        # Khách Nhật và khách quốc tế: số có mã nước được nhận; số Việt Nam vẫn phải đủ 10 số
        for so in ('+81 90 1234 5678', '+1 (415) 555-0123', '+84 901 234 567'):
            data = self.quick(lien_he=so, ma_gui=secrets.token_hex(24))
            self.assertEqual(self.client.post('/api/tu-van', json=data).status_code, 201, so)
        for so in ('+84 12', '+0 123 456 789', '090123', '+81 90 1234 5678 9999'):
            data = self.quick(lien_he=so, ma_gui=secrets.token_hex(24))
            self.assertEqual(self.client.post('/api/tu-van', json=data).status_code, 400, so)
        self.assertIsNone(m.kiem_tra_lien_he('Zalo', '+81 90-1234-5678'))
        self.assertIsNotNone(m.kiem_tra_lien_he('Zalo', '+81 12'))

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

    # ---------- Loại video: mỗi loại một bộ câu hỏi ----------
    def test_question_sets_are_well_formed(self):
        thu_tu = [n['id'] for n in m.BO_CAU_HOI['nhom']]
        self.assertEqual(len(m.LOAI), 8)
        self.assertEqual(len({c['so'] for c in m.CAU}), len(m.CAU))
        for ma, l in m.LOAI.items():
            ds = l['cau']
            self.assertEqual(len(ds), len(set(ds)), ma)
            self.assertLessEqual(len(ds), 20, ma)
            self.assertTrue({19, 20} <= set(ds), ma)            # ai cũng phải để lại liên hệ
            vi_tri = [thu_tu.index(m.CAU_THEO_SO[so]['nhom']) for so in ds]
            self.assertEqual(vi_tri, sorted(vi_tri), ma)      # các phần đi đúng thứ tự, không xen kẽ
            for so in ds:
                c = m.CAU_THEO_SO[so]
                dk = c.get('hien_khi')
                if dk:
                    self.assertIn(int(dk['khoa'].split('.')[0]), ds[:ds.index(so)], ma)
                for t in c['truong']:
                    if t.get('chi_khi'):
                        self.assertIn(int(t['chi_khi']['khoa'].split('.')[0]), ds, ma)
        self.assertEqual(m.LOAI[m.BO_MAC_DINH]['cau'], list(range(1, 21)))   # phiếu cũ vẫn đọc đúng

    def test_every_video_type_submits_with_its_own_questions(self):
        for ma in m.LOAI:
            path = self.new()
            a = self.answers(ma)
            r = self.client.post(path + '/gui', json={'dong_y': True, 'tra_loi': a})
            self.assertEqual(r.status_code, 200, (ma, r.text))
            tom = r.json()['tom_tat']
            self.assertEqual(tom[0], {'so': None, 'cau': 'Loại video', 'tra_loi': m.LOAI[ma]['ten']})
            so = [d['so'] for d in tom if d['so'] is not None]
            # Số câu là số khách thấy trên trang (1, 2, 3…), không phải số câu trong kho chung; câu tùy chọn để trống thì không có dòng.
            self.assertEqual(so, sorted(so), ma)
            self.assertLessEqual(max(so), len(m.cau_hien(a)), ma)
            self.assertEqual(so[0], 1, ma)

    def test_missing_answer_reports_number_the_client_sees(self):
        path = self.new()
        a = self.answers('tuyen-dung'); del a['33.vi_tri']
        r = self.client.post(path + '/gui', json={'dong_y': True, 'tra_loi': a})
        self.assertEqual(r.status_code, 422)
        thieu = r.json()['loi']['thieu'][0]
        self.assertEqual((thieu['so'], thieu['hien']), (33, 3))
        self.assertEqual(r.json()['loi']['thong_bao'], 'Câu 3 chưa có câu trả lời.')

    def test_answers_outside_chosen_type_are_dropped(self):
        path = self.new()
        a = self.answers('doanh-nghiep'); a['1.san_pham'] = 'không thuộc bộ này'; a['_bo'] = 'doanh-nghiep'
        self.client.put(path, json={'tra_loi': a})
        luu = self.client.get(path).json()['tra_loi']
        self.assertNotIn('1.san_pham', luu)
        self.assertEqual(luu['_bo'], 'doanh-nghiep')
        self.client.put(path, json={'tra_loi': {**a, '_bo': 'khong-co'}})
        self.assertNotIn('_bo', self.client.get(path).json()['tra_loi'])

    def test_live_shooting_details_only_when_chosen(self):
        a = self.answers('doanh-nghiep')
        self.assertEqual(m.tim_thieu(a), [])
        a['27.cach_lam'] = ['Quay thực tế']
        self.assertEqual({t['so'] for t in m.tim_thieu(a)}, {28})
        a.update({'28.dia_diem': 'Văn phòng', '28.so_ngay': '1 ngày', '28.nguoi': 'Dùng người của đơn vị', '28.flycam': 'Không cần'})
        self.assertEqual(m.tim_thieu(a), [])
        a['27.cach_lam'] = ['Hoạt hình']
        self.assertFalse([k for k in m.lam_sach(a) if k.startswith('28.')])

    def test_staff_filter_select_export_and_bulk_delete(self):
        ma = {}
        for bo in ('doanh-nghiep', 'su-kien', 'su-kien'):
            path = self.new()
            a = self.answers(bo); a['19.ten'] = f'Khách {bo} {len(ma)}'
            self.assertEqual(self.client.post(path + '/gui', json={'dong_y': True, 'tra_loi': a}).status_code, 200)
            ma[a['19.ten']] = path.rsplit('/', 1)[1]
        self.assertEqual(self.client.post('/api/nhan-vien/phieu/xoa-nhieu', json={'ma': list(ma.values()), 'xac_nhan': True}).status_code, 401)
        self.login()
        du = self.client.get('/api/nhan-vien/phieu?bo=su-kien').json()
        self.assertEqual(du['tong'], 2)
        self.assertEqual({p['ten_bo'] for p in du['phieu']}, {'Sự kiện'})
        self.assertEqual(len(du['loai']), 8)
        # Xuất Excel đúng các phiếu đã chọn
        chon = [ma['Khách doanh-nghiep 0']]
        r = self.client.post('/api/nhan-vien/xuat-excel', json={'ma': chon})
        self.assertEqual(r.status_code, 200)
        wb = load_workbook(io.BytesIO(r.content))
        self.assertEqual(wb['Phiếu đã gửi'].max_row, 2)
        self.assertEqual(wb['Phiếu đã gửi'].cell(2, 5).value, 'Video doanh nghiệp')
        self.assertEqual(self.client.post('/api/nhan-vien/xuat-excel', json={'ma': ['../x']}).status_code, 400)
        # Xuất theo bộ lọc
        r = self.client.post('/api/nhan-vien/xuat-excel', json={'loc': {'bo': 'su-kien'}})
        self.assertEqual(load_workbook(io.BytesIO(r.content))['Phiếu đã gửi'].max_row, 3)
        # Xóa phiếu đã chọn: phải xác nhận
        self.assertEqual(self.client.post('/api/nhan-vien/phieu/xoa-nhieu', json={'ma': chon}).status_code, 400)
        r = self.client.post('/api/nhan-vien/phieu/xoa-nhieu', json={'ma': chon, 'xac_nhan': True})
        self.assertEqual(r.json(), {'da_xoa': 1})
        # Xóa hết phiếu đang lọc: số phiếu nhân viên thấy phải khớp
        r = self.client.post('/api/nhan-vien/phieu/xoa-nhieu', json={'loc': {'bo': 'su-kien'}, 'so_du_kien': 1, 'xac_nhan': True})
        self.assertEqual(r.status_code, 409)
        r = self.client.post('/api/nhan-vien/phieu/xoa-nhieu', json={'loc': {'bo': 'su-kien'}, 'so_du_kien': 2, 'xac_nhan': True})
        self.assertEqual(r.json(), {'da_xoa': 2})
        self.assertEqual(self.client.get('/api/nhan-vien/phieu').json()['tong'], 0)

    def test_excel_sheet_for_other_video_type(self):
        path = self.new()
        a = self.answers('su-kien'); a['46.ten_su_kien'] = 'Lễ kỷ niệm 10 năm'
        self.client.post(path + '/gui', json={'dong_y': True, 'tra_loi': a})
        self.login()
        wb = load_workbook(io.BytesIO(self.client.get('/api/nhan-vien/xuat-excel').content))
        trang = wb[wb.sheetnames[1]]
        chu = '\n'.join(str(o.value) for hang in trang.iter_rows() for o in hang if o.value)
        self.assertIn('Loại video: Sự kiện', chu)
        self.assertIn('Sự kiện: Lễ kỷ niệm 10 năm', chu)
        self.assertEqual(wb['Tổng hợp'].cell(7, 4).value, 'Sự kiện')

    # ---------- Trang điền phiếu riêng và mã QR ----------
    def test_form_page_opens_without_homepage_assets(self):
        r = self.client.get('/phieu/tuyen-dung')
        self.assertEqual(r.status_code, 200)
        self.assertIn('class="parent-brand che-do-phieu" data-loai="tuyen-dung"', r.text)
        self.assertIn('<title>Phiếu yêu cầu làm video: Video tuyển dụng | B PRODUCTIONS</title>', r.text)
        self.assertNotIn('as="image"', r.text)                 # không tải trước ảnh màn hình đầu
        self.assertNotIn('fetchpriority="high"', r.text)
        for the in re.findall(r'<img [^>]*>', r.text):
            self.assertTrue('loading="lazy"' in the or 'logo-anh' in the, the)
        self.assertIn('data-loai=""', self.client.get('/phieu').text)
        r = self.client.get('/phieu/khong-co', follow_redirects=False)
        self.assertEqual((r.status_code, r.headers['location']), (302, '/phieu'))
        self.assertNotIn('che-do-phieu', self.client.get('/').text)

    def test_qr_code_opens_form_page(self):
        r = self.client.get('/ma-qr.svg')
        self.assertEqual((r.status_code, r.headers['content-type']), (200, 'image/svg+xml'))
        self.assertTrue(r.text.startswith('<svg'))
        r = self.client.get('/ma-qr.png?tai=1&loai=su-kien')
        self.assertEqual(r.headers['content-type'], 'image/png')
        self.assertIn('ma-qr-phieu-b-productions-su-kien.png', r.headers['content-disposition'])
        try:
            import cv2, numpy as np
        except ImportError:
            self.skipTest('Không có OpenCV để đọc thử mã QR')
        from PIL import Image
        doc = lambda b: cv2.QRCodeDetector().detectAndDecode(np.array(Image.open(io.BytesIO(b)).convert('L')))[0]
        self.assertEqual(doc(r.content), 'http://testserver/phieu/su-kien')
        self.assertEqual(doc(self.client.get('/ma-qr.png?loai=../x').content), 'http://testserver/phieu')
        r = self.client.get('/ma-qr.png', headers={'x-forwarded-proto': 'https', 'x-forwarded-host': 'dichvuvideo-ai.bprovn.com'})
        self.assertEqual(doc(r.content), 'https://dichvuvideo-ai.bprovn.com/phieu')

    def test_qr_encoder_versions(self):
        import ma_qr
        with self.assertRaises(ValueError):
            ma_qr.ma_tran('x' * 300)                   # quá phiên bản 10: báo lỗi rõ, không tạo mã sai
        try:
            import cv2, numpy as np
        except ImportError:
            self.skipTest('Không có OpenCV để đọc thử mã QR')
        from PIL import Image
        for n in (1, 20, 40, 70, 100, 150, 190):
            chu = 'https://vi.du/' + 'a' * n
            o = ma_qr.ma_tran(chu)
            anh = np.array(Image.open(io.BytesIO(ma_qr.png(o, 600))).convert('L'))
            self.assertEqual(cv2.QRCodeDetector().detectAndDecode(anh)[0], chu, len(o))

    # ---------- Nhân viên xem và sửa bộ câu hỏi ----------
    def bo_dang_dung(self):
        r = self.client.get('/api/nhan-vien/bo-cau-hoi')
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    def luu_bo(self, bo, phien_ban, ghi_chu='thử'):
        return self.client.put('/api/nhan-vien/bo-cau-hoi', json={'bo': bo, 'phien_ban': phien_ban, 'ghi_chu': ghi_chu})

    def test_question_bank_check_keeps_current_bank(self):
        import copy
        ra = m.kiem_bo(copy.deepcopy(m.BO_CAU_HOI))
        bo = lambda x: json.dumps({k: v for k, v in x.items() if k != 'phien_ban'}, ensure_ascii=False, sort_keys=True)
        self.assertEqual(bo(ra), bo(m.BO_CAU_HOI))

    def test_staff_edits_questions_and_customers_see_them(self):
        self.assertEqual(self.client.get('/api/nhan-vien/bo-cau-hoi').status_code, 401)
        self.assertEqual(self.client.put('/api/nhan-vien/bo-cau-hoi', json={}).status_code, 401)
        # Phiếu đã gửi trả lời câu 13 trước khi câu này bị bỏ khỏi loại "Sản phẩm, dịch vụ".
        cu = self.new(); a = self.answers(); a['13.can_tranh'] = 'Không nhắc đối thủ X'
        self.assertEqual(self.client.post(cu + '/gui', json={'dong_y': True, 'tra_loi': a}).status_code, 200)
        self.login()
        du = self.bo_dang_dung()
        self.assertTrue(du['dang_dung_goc']); self.assertEqual(du['lich_su'], [])
        bo, cu_pb = du['bo'], du['bo']['phien_ban']
        c5 = next(c for c in bo['cau_hoi'] if c['so'] == 5)
        c5['cau'] = 'Video cần ghi những thông tin nào?'
        bo['cau_hoi'].append({'so': 1001, 'nhom': 'hinh-thuc', 'cau': 'Quý khách hàng thích màu chủ đạo nào?',
                              'truong': [{'kieu': 'mot', 'bat_buoc': True, 'lua_chon': ['Màu sáng', 'Màu tối', ' ', 'Màu sáng']}]})
        sp = next(l for l in bo['loai'] if l['id'] == m.BO_MAC_DINH)
        sp['cau'] = [so for so in sp['cau'] if so != 13] + [1001]          # thêm ở cuối: máy chủ tự xếp theo phần
        sp['ten'] = 'Sản phẩm và dịch vụ'
        r = self.luu_bo(bo, cu_pb, 'thêm câu màu chủ đạo')
        self.assertEqual(r.status_code, 200, r.text)
        du = r.json(); moi_pb = du['bo']['phien_ban']
        self.assertFalse(du['dang_dung_goc']); self.assertEqual(du['lich_su'][0]['ghi_chu'], 'thêm câu màu chủ đạo')
        c1001 = next(c for c in du['bo']['cau_hoi'] if c['so'] == 1001)
        self.assertEqual(c1001['truong'], [{'id': 'tra_loi', 'kieu': 'mot', 'bat_buoc': True, 'lua_chon': ['Màu sáng', 'Màu tối']}])
        ds = next(l for l in du['bo']['loai'] if l['id'] == m.BO_MAC_DINH)['cau']
        self.assertNotIn(13, ds)
        self.assertLess(ds.index(1001), ds.index(17))                    # câu "hình thức" đứng trước phần thời gian
        # Khách thấy ngay: trang lấy bản mới, phiếu mới phải trả lời câu mới.
        self.assertEqual(self.client.get('/api/bo-cau-hoi?v=' + moi_pb).status_code, 204)
        r = self.client.get('/api/bo-cau-hoi?v=' + cu_pb)
        self.assertEqual(r.json()['bo_cau_hoi']['phien_ban'], moi_pb)
        self.assertIn('Video cần ghi những thông tin nào?', self.client.get('/phieu').text)
        path = self.new(); b = self.answers()
        r = self.client.post(path + '/gui', json={'dong_y': True, 'tra_loi': {k: v for k, v in b.items() if not k.startswith('1001.')}})
        self.assertEqual(r.status_code, 422)
        r = self.client.post(path + '/gui', json={'dong_y': True, 'tra_loi': b})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIn({'so': None, 'cau': 'Loại video', 'tra_loi': 'Sản phẩm và dịch vụ'}, r.json()['tom_tat'])
        self.assertTrue(any(d['cau'] == 'Quý khách hàng thích màu chủ đạo nào?' and d['tra_loi'] == 'Màu sáng' for d in r.json()['tom_tat']))
        # Phiếu cũ vẫn hiện câu trả lời của câu đã bỏ khỏi loại, cả trên trang nhân viên và trong Excel.
        ds_phieu = self.client.get('/api/nhan-vien/phieu').json()['phieu']
        phieu_cu = next(p for p in ds_phieu if p['id'] == cu.rsplit('/', 1)[1])
        self.assertTrue(any(d['so'] is None and 'Không nhắc đối thủ X' in d['tra_loi'] for d in phieu_cu['tom_tat']))
        wb = load_workbook(io.BytesIO(self.client.get('/api/nhan-vien/xuat-excel').content))
        chu = '\n'.join(str(o.value) for t in wb.worksheets for hang in t.iter_rows() for o in hang if o.value)
        self.assertIn('Không nhắc đối thủ X', chu); self.assertIn('Quý khách hàng thích màu chủ đạo nào?', chu)

    def test_question_bank_edits_that_would_break_the_site_are_refused(self):
        import copy
        self.login()
        du = self.bo_dang_dung(); pb = du['bo']['phien_ban']
        def thu(sua, thong_bao):
            bo = copy.deepcopy(du['bo']); sua(bo)
            r = self.luu_bo(bo, pb)
            self.assertEqual(r.status_code, 422, r.text)
            self.assertIn(thong_bao, r.json()['loi']['thong_bao'])
        cau = lambda bo, so: next(c for c in bo['cau_hoi'] if c['so'] == so)
        loai = lambda bo, ma: next(l for l in bo['loai'] if l['id'] == ma)
        thu(lambda bo: loai(bo, 'su-kien')['cau'].remove(19), 'không bỏ khỏi loại')
        thu(lambda bo: loai(bo, m.BO_MAC_DINH)['cau'].remove(11), 'không bỏ khỏi loại')
        thu(lambda bo: cau(bo, 27)['truong'][0].update(lua_chon=['Video bằng AI', 'Hoạt hình']), 'Quay thực tế')
        thu(lambda bo: cau(bo, 15)['truong'][0].update(lua_chon=['Giọng nam', 'Giọng nữ']), 'Không cần giọng đọc')
        thu(lambda bo: cau(bo, 14)['truong'][0].update(lua_chon=['Tiếng Nhật', 'Tiếng Anh']), 'Tiếng Việt')
        thu(lambda bo: cau(bo, 15)['truong'][0].update(id='doi_ten'), 'ô trả lời')
        thu(lambda bo: bo['cau_hoi'].remove(cau(bo, 20)), 'Không xóa câu')
        thu(lambda bo: cau(bo, 5).update(cau='  '), 'không được để trống')
        thu(lambda bo: bo['loai'].pop(), 'loại video')
        thu(lambda bo: bo['cau_hoi'].append({'so': 49, 'nhom': 'thong-tin', 'cau': 'Câu mới?', 'truong': [{'kieu': 'chu'}]}), 'Số của câu mới')
        thu(lambda bo: bo['cau_hoi'].append({'so': 1001, 'nhom': 'thong-tin', 'cau': 'Câu mới?', 'truong': [{'kieu': 'mot', 'lua_chon': ['Một']}]}), 'hai lựa chọn')
        thu(lambda bo: bo['cau_hoi'].append({'so': 1001, 'nhom': 'loai-video', 'cau': 'Câu mới?', 'truong': [{'kieu': 'chu'}]}), 'phần của phiếu')
        # Đổi được chữ, gợi ý, bắt buộc; không đổi được kiểu ô, lựa chọn gắn video mẫu, cách liên hệ.
        bo = copy.deepcopy(du['bo'])
        cau(bo, 15)['truong'][0]['kieu'] = 'chu'
        cau(bo, 11)['truong'][0]['lua_chon'] = ['A', 'B']
        cau(bo, 19)['truong'][1]['lua_chon'] = ['Thư tay', 'Bồ câu']
        cau(bo, 19)['truong'][0]['bat_buoc'] = False
        cau(bo, 20)['truong'][0]['bat_buoc'] = False
        r = self.luu_bo(bo, pb); self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(m.CAU_THEO_SO[15]['truong'][0]['kieu'], 'mot')
        self.assertEqual(m.CAU_THEO_SO[11]['truong'][0]['lua_chon'], m.BO_GOC['cau_hoi'][10]['truong'][0]['lua_chon'])
        self.assertEqual(m.CAU_THEO_SO[19]['truong'][1]['lua_chon'], ['Zalo', 'Điện thoại', 'Email', 'Messenger'])
        self.assertTrue(m.CAU_THEO_SO[19]['truong'][0]['bat_buoc'])
        self.assertFalse(m.CAU_THEO_SO[20]['truong'][0]['bat_buoc'])
        # Người khác vừa lưu: bản cũ không ghi đè được.
        self.assertEqual(self.luu_bo(copy.deepcopy(du['bo']), pb).status_code, 409)

    def test_question_bank_history_and_restore(self):
        import copy
        self.login()
        du = self.bo_dang_dung(); goc_cau5 = m.CAU_THEO_SO[5]['cau']
        bo = copy.deepcopy(du['bo']); next(c for c in bo['cau_hoi'] if c['so'] == 5)['cau'] = 'Bản một?'
        bo['cau_hoi'].append({'so': 1001, 'nhom': 'noi-dung', 'cau': 'Câu thêm ở bản một?', 'truong': [{'kieu': 'doan', 'vi_du': 'Ví dụ'}]})
        du1 = self.luu_bo(bo, du['bo']['phien_ban'], 'bản một').json()
        bo = copy.deepcopy(du1['bo']); next(c for c in bo['cau_hoi'] if c['so'] == 5)['cau'] = 'Bản hai?'
        du2 = self.luu_bo(bo, du1['bo']['phien_ban'], 'bản hai').json()
        self.assertEqual([b['ghi_chu'] for b in du2['lich_su']], ['bản hai', 'bản một'])
        r = self.client.post('/api/nhan-vien/bo-cau-hoi/khoi-phuc', json={'ma': 'goc', 'phien_ban': du1['bo']['phien_ban']})
        self.assertEqual(r.status_code, 409)
        r = self.client.post('/api/nhan-vien/bo-cau-hoi/khoi-phuc', json={'ma': 'goc', 'phien_ban': du2['bo']['phien_ban']})
        self.assertEqual(m.CAU_THEO_SO[5]['cau'], goc_cau5)
        self.assertIn(1001, m.CAU_THEO_SO)                         # câu thêm sau vẫn giữ trong kho để đọc phiếu cũ
        self.assertNotIn(1001, [so for l in m.LOAI.values() for so in l['cau']])
        du3 = r.json(); self.assertEqual(du3['lich_su'][0]['ghi_chu'], 'Khôi phục bản gốc')
        ma_ban_mot = next(b['id'] for b in du3['lich_su'] if b['ghi_chu'] == 'bản một')
        r = self.client.post('/api/nhan-vien/bo-cau-hoi/khoi-phuc', json={'ma': ma_ban_mot, 'phien_ban': du3['bo']['phien_ban']})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(m.CAU_THEO_SO[5]['cau'], 'Bản một?')
        self.assertTrue(r.json()['lich_su'][0]['ghi_chu'].startswith('Khôi phục bản lúc'))
        self.assertEqual(self.client.post('/api/nhan-vien/bo-cau-hoi/khoi-phuc', json={'ma': 'khong-co', 'phien_ban': r.json()['bo']['phien_ban']}).status_code, 404)

    def test_qr_with_logo_uses_high_error_correction(self):
        import ma_qr
        url = 'https://d-n-web-t-ng.vercel.app/phieu?nguon=ma-qr'
        self.assertGreater(len(ma_qr.ma_tran(url, 'H')), len(ma_qr.ma_tran(url)))
        try:
            import cv2, numpy as np
        except ImportError:
            self.skipTest('Không có OpenCV để đọc thử mã QR')
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'cong-cu'))
        import tao_ma_qr_in
        anh = tao_ma_qr_in.ve_the(url, 1080, 1350)
        nang, _ = tao_ma_qr_in.doc_thu(anh, url)
        self.assertEqual(nang, [])

    def test_concurrent_page_views(self):
        def view(_):
            with TestClient(m.app) as client:
                return client.post('/api/luot-xem', json={'nguon': 'test'}).status_code
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            self.assertEqual(list(pool.map(view, range(8))), [204] * 8)
        self.assertEqual(m.sql('SELECT so FROM luot_xem WHERE nguon=?', ('test',), 'mot')[0], 8)


    def test_packed_files_match_sources(self):
        # web/da-nen/ phải được đóng gói lại (python cong-cu/dong_goi.py) mỗi khi sửa CSS hoặc app.js / ngon-ngu.js
        for ten, nguon in (('app.js', ('app.js',)), ('ngon-ngu.js', ('ngon-ngu.js',)), ('goi.css', m.GOI_CSS), ('dau.css', m.GOI_CSS)):
            self.assertIsNotNone(m.ban_nen(ten, nguon), f'web/da-nen/{ten} cũ: chạy python cong-cu/dong_goi.py')

    def test_home_inlines_first_screen_css_with_csp_hash(self):
        r = self.client.get('/')
        self.assertEqual(r.status_code, 200)
        dau, bam = m.css_dau()
        self.assertIn('<style>' + dau + '</style>', r.text)
        self.assertIn(f"'{bam}'", r.headers['content-security-policy'])
        # tệp CSS đầy đủ chuyển xuống cuối trang, trước các tệp JS; ảnh và chữ mẫu đầu có sẵn trong trang
        self.assertLess(r.text.index('href="/goi.css'), r.text.index('src="/app.js'))
        self.assertGreater(r.text.index('href="/goi.css'), r.text.index('</main>'))
        self.assertNotIn('__', r.text.split('id="cau-hinh"')[0].replace('__cf', ''))
        self.assertIn('class="dt-mot hien" data-ma="ST025"', r.text)
        js = self.client.get('/app.js')
        self.assertTrue(js.text.startswith('/*nguon:'))


if __name__ == '__main__':
    unittest.main()
