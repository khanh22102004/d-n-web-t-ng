"""Kiểm tra Back/Forward trên máy chủ thử cục bộ, không dùng dữ liệu vận hành.
Cần Playwright và Chromium; xem README trước khi chạy.
"""
import argparse
import json
import re
from urllib.parse import urlsplit

import httpx
from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--base-url', default='http://127.0.0.1:8000')
parser.add_argument('--chromium', default=None)
args = parser.parse_args()
base = args.base_url.rstrip('/')
if urlsplit(base).hostname not in ('127.0.0.1', 'localhost', '::1'):
    raise SystemExit('Chỉ chạy bài kiểm tra này trên máy chủ thử cục bộ.')
config = httpx.get(base + '/api/cau-hinh').json()['bo_cau_hoi']
# Phiếu bắt đầu bằng phần "Loại video"; bài thử chọn loại "Sản phẩm, dịch vụ" (bộ 20 câu cũ), nên có 7 phần.
bo = next(l for l in config['loai'] if l['id'] == config['bo_mac_dinh'])
cau_bo = [next(c for c in config['cau_hoi'] if c['so'] == so) for so in bo['cau']]
groups = [n for n in config['nhom'] if n['id'] == 'loai-video' or any(c['nhom'] == n['id'] for c in cau_bo)]
SO_PHAN = len(groups)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=args.chromium)
    context = browser.new_context(viewport={'width':390,'height':844}, reduced_motion='reduce')
    page = context.new_page()
    page.route('https://**/*', lambda r:r.abort())
    errors, created = [], []
    page.on('pageerror', lambda e:errors.append(str(e)))
    page.on('request', lambda r:created.append(r.url) if r.method=='POST' and r.url==base+'/api/phieu' else None)

    def step(index):
        expect(page.locator('#phieu')).to_be_visible()
        if index == 0:
            expect(page.locator('#cau-loai')).to_be_visible()
        else:
            expect(page.locator('#tien-do-nhom')).to_contain_text(f'Phần {index+1} trên {SO_PHAN}')
        expect(page).to_have_url(re.compile(re.escape('#phieu/'+groups[index]['id'])+'$'))

    def chon_loai():
        page.locator('#cau-loai').get_by_role('button', name=re.compile('^' + re.escape(bo['ten']))).click()

    def fill(index):
        for q in cau_bo:
            if q['nhom'] != groups[index]['id']:
                continue
            for field in q['truong']:
                if not field.get('bat_buoc'):
                    continue
                if field['kieu'] in ('chu','doan'):
                    value = '0901234567' if field['id']=='dia_chi' else 'Khách kiểm tra lịch sử'
                    page.locator(f'#o-{q["so"]}-{field["id"]}').fill(value)
                else:
                    choice=field['lua_chon'][0]
                    label=choice['ten'] if isinstance(choice,dict) else choice
                    button=page.locator(f'#cau-{q["so"]}').get_by_role('button',name=label,exact=True)
                    if button.get_attribute('aria-pressed') != 'true':
                        button.click()

    root=base+'/?nguon=history-test#tu-van'
    page.goto(root,wait_until='networkidle')
    # Số mặc định của studio (STUDIO_CONTACT chưa đặt): chữ và liên kết bấm gọi phải cùng một số.
    expect(page.locator('#goi-studio')).to_have_text('Gọi trực tiếp 0938 248 891')
    expect(page.locator('#goi-studio')).to_have_attribute('href','tel:+84938248891')
    assert 'tel:+84938248891' in httpx.get(base+'/chinh-sach').text
    print('PASS số studio và liên kết bấm gọi; không thực hiện cuộc gọi')

    page.get_by_role('button',name='Tôi đã có yêu cầu cụ thể →',exact=True).click()
    assert len(created)==0
    page.locator('#dong-y-luu').check();page.locator('#bat-dau-xac-nhan').click()
    step(0)
    history_length=page.evaluate('history.length')
    page.locator('#tiep-tuc').click()  # Chưa chọn loại video: không thêm mục lịch sử.
    step(0);assert page.evaluate('history.length')==history_length
    expect(page.locator('#cau-loai .loi-cau')).to_have_text('Quý khách hàng vui lòng chọn một loại video.')
    chon_loai();step(1)
    history_length=page.evaluate('history.length')
    page.locator('#tiep-tuc').click()  # Thiếu câu trả lời: không thêm mục lịch sử.
    step(1);assert page.evaluate('history.length')==history_length
    fill(1);page.locator('#tiep-tuc').click();step(2)
    fill(2);page.locator('#tiep-tuc').click();step(3)
    draft=page.evaluate('localStorage.getItem("bp-phieu")')
    assert draft not in page.url
    assert 'Khách kiểm tra lịch sử' not in page.evaluate('JSON.stringify(history.state)')

    page.go_back();step(2)
    expect(page.locator('#cau-4').get_by_role('button',name='Bán hàng',exact=True)).to_have_attribute('aria-pressed','true')
    page.go_back();step(1)
    expect(page.locator('#o-1-san_pham')).to_have_value('Khách kiểm tra lịch sử')
    page.go_back();step(0)
    expect(page.locator('#cau-loai').get_by_role('button', name=re.compile('^' + re.escape(bo['ten'])))).to_have_attribute('aria-pressed','true')
    page.go_back();expect(page.locator('#mo-dau')).to_be_visible();expect(page).to_have_url(root)
    assert len(created)==1
    page.go_forward();step(0)
    page.go_forward();step(1)
    page.go_forward();step(2)
    page.go_forward();step(3)
    assert len(created)==1 and page.evaluate('localStorage.getItem("bp-phieu")')==draft
    print('PASS Back/Forward qua phần chọn loại video, 3 phần câu hỏi và trang đầu, giữ câu trả lời và không tạo phiếu trùng')

    page.locator('#quay-lai').click();step(2)
    page.go_forward();step(3)
    page.locator('#cau-7').get_by_role('button',name='TikTok',exact=True).click()
    context.set_offline(True)
    page.locator('#cau-7').get_by_role('button',name='Facebook, Instagram',exact=True).click()
    page.go_back();step(2)
    page.go_forward();step(3)
    expect(page.locator('#cau-7').get_by_role('button',name='Facebook, Instagram',exact=True)).to_have_attribute('aria-pressed','true')
    context.set_offline(False)
    expect(page.locator('#tien-do-luu')).to_have_text('Đã lưu',timeout=20000)
    page.reload(wait_until='networkidle');step(3)
    expect(page.locator('#cau-7').get_by_role('button',name='Facebook, Instagram',exact=True)).to_have_attribute('aria-pressed','true')
    page.go_back();step(2);page.go_forward();step(3)
    print('PASS nút quay lại trong trang, mất mạng và tải lại giữa phiếu vẫn dùng được lịch sử')

    for index in range(3,SO_PHAN):
        fill(index)
        if index==SO_PHAN-1:page.locator('#dong-y').check()
        page.locator('#tiep-tuc').click()
        if index<SO_PHAN-1:step(index+1)
    expect(page.locator('#cam-on')).to_be_visible()
    expect(page).to_have_url(re.compile('#da-gui$'))
    assert page.evaluate('localStorage.getItem("bp-phieu")') is None
    assert page.evaluate('localStorage.getItem("bp-ban-nhap")') is None
    page.go_back();expect(page.locator('#mo-dau')).to_be_visible();expect(page).to_have_url(root)
    expect(page.locator('#phieu')).to_be_hidden()
    page.go_forward();expect(page.locator('#cam-on')).to_be_visible()
    page.reload(wait_until='networkidle');expect(page.locator('#cam-on')).to_be_visible()
    expect(page.locator('#cam-on-co-tom-tat')).to_be_hidden()
    page.go_back();expect(page.locator('#mo-dau')).to_be_visible()
    page.go_forward();expect(page.locator('#cam-on')).to_be_visible()
    assert len(created)==1
    print('PASS sau gửi, Back về trang đầu; Forward/tải lại chỉ hiện xác nhận, không mở lại phiếu để sửa')

    page.go_back();expect(page.locator('#mo-dau')).to_be_visible()
    page.get_by_role('button',name='Tôi đã có yêu cầu cụ thể →',exact=True).click()
    expect(page.locator('#bat-dau-hop')).to_be_visible()
    page.locator('#dong-y-luu').check();page.locator('#bat-dau-xac-nhan').click();step(0)
    expect(page.locator('#cau-loai [aria-pressed="true"]')).to_have_count(0)
    chon_loai();step(1)
    expect(page.locator('#o-1-san_pham')).to_have_value('')
    assert len(created)==2 and page.evaluate('localStorage.getItem("bp-phieu")')!=draft
    page.locator('#quay-lai').click();step(0)
    page.locator('#quay-lai').click();expect(page.locator('#mo-dau')).to_be_visible()
    page.go_forward();step(0)
    print('PASS yêu cầu mới có phiếu riêng, không trộn dữ liệu và lịch sử với phiếu đã gửi')
    assert not errors,errors
    print('PASS không có lỗi JavaScript')
    browser.close()
