// Trang nhân viên, thẻ "Video mẫu": thêm video mẫu (link YouTube + ảnh bìa dọc), sửa, đổi thứ tự, ẩn khỏi trang khách, hiện lại.
// Máy chủ kiểm lại mọi thay đổi (kiem_mau trong may_chu.py); ở đây chỉ chặn sớm các lỗi dễ thấy.
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const tao = (the, lop, chu) => { const e = document.createElement(the); if (lop) e.className = lop; if (chu != null) e.textContent = chu; return e; };
  const nut = (chu, lop = "nut-chu") => { const b = tao("button", lop, chu); b.type = "button"; return b; };

  async function goi(duong, tuy = {}) {
    let r;
    const laForm = tuy.body instanceof FormData;
    try { r = await fetch(duong, { cache: "no-store", credentials: "same-origin", ...tuy, headers: tuy.body && !laForm ? { "Content-Type": "application/json" } : undefined }); }
    catch { throw new Error("Chưa kết nối được máy chủ. Anh chị vui lòng kiểm tra mạng rồi thử lại."); }
    let du = {};
    try { du = await r.json(); } catch { /* không có nội dung */ }
    if (!r.ok) {
      const loi = new Error(r.status === 401 ? "Phiên đăng nhập đã hết. Anh chị tải lại trang để đăng nhập lại." : du.loi?.thong_bao || "Chưa kết nối được máy chủ.");
      loi.ma = r.status; throw loi;
    }
    return du;
  }

  let du = null, ds = [], dsLuu = "", daTai = false, dem = 0;
  const dangMo = new Set(), moi = new Set();   // mã mẫu đang mở để sửa; mã mẫu mới chưa lưu
  const sao = x => JSON.parse(JSON.stringify(x));
  const coThayDoi = () => !!du && JSON.stringify(ds) !== dsLuu;
  const maMoi = () => `vm-o-${++dem}`;
  const luc = s => { const m = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)/.exec(s || ""); return m ? `${m[4]}:${m[5]} ngày ${m[3]}/${m[2]}/${m[1]}` : s; };
  // Phải trùng anhMau() trong app.js và duong_anh_mau() trong may_chu.py.
  const anhMau = (m, co = "goc") => {
    const ma = encodeURIComponent(m.ma);
    if (m.anh_moi) return `/anh-mau-tai/${ma}/${encodeURIComponent(m.anh_moi)}/${co}.${co === "jpg" ? "jpg" : "webp"}`;
    return co === "goc" ? `/anh-mau/${ma}.webp` : co === "jpg" ? `/anh-mau/${ma}.jpg` : `/anh-mau/${co}/${ma}.webp`;
  };
  const coAnh = m => !!m.anh_moi || du.khoa.anh_san.includes(m.ma);
  // Mã video YouTube từ link (youtube.com/shorts/…, youtu.be/…, watch?v=…) hoặc mã 11 ký tự. Phải trùng id_youtube() trong may_chu.py.
  const idYoutube = chu => {
    chu = (chu || "").trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(chu)) return chu;
    const m = /(?:youtu\.be\/|\/shorts\/|\/embed\/|\/live\/|[?&]v=)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/.exec(chu);
    return m ? m[1] : "";
  };

  function bao(chu, loi = false) { const p = $("vm-bao"); p.textContent = chu; p.classList.toggle("loi", loi); p.hidden = !chu; }
  function baoLuu(chu) { $("vm-luu-loi").textContent = chu; $("vm-luu-loi").hidden = !chu; }
  function capNhatLuu() { $("vm-luu").hidden = !coThayDoi(); baoLuu(""); }

  document.addEventListener("nv-mo-the", e => { if (e.detail === "khu-video" && !daTai) tai(); });
  if (!$("bang").hidden && !$("khu-video").hidden) tai();
  window.addEventListener("beforeunload", e => { if (coThayDoi()) { e.preventDefault(); e.returnValue = ""; } });

  async function tai() {
    daTai = true; $("vm-loi-tai").hidden = true; $("vm-dang-dung").textContent = "Đang tải video mẫu…";
    try { nhan(await goi("/api/nhan-vien/mau")); }
    catch (e) { daTai = false; $("vm-dang-dung").textContent = ""; $("vm-loi-tai").textContent = e.message; $("vm-loi-tai").hidden = false; }
  }
  function nhan(d) {
    du = d; ds = sao(d.mau); dsLuu = JSON.stringify(ds); moi.clear();
    $("vm-dang-dung").textContent = d.lan_sua ? `Trang khách đang dùng danh sách sửa lúc ${luc(d.lan_sua.luc)}${d.lan_sua.ghi_chu ? `: ${d.lan_sua.ghi_chu}` : ""}.` : "Trang khách đang dùng danh sách video mẫu gốc, chưa sửa lần nào.";
    $("vm-goi-y-kieu").replaceChildren(...d.goi_y.kieu.map(x => { const o = tao("option"); o.value = x; return o; }));
    ve(); capNhatLuu(); $("vm-khung").hidden = false;
  }

  function ve(sau) {
    const hien = ds.filter(m => !m.an).length;
    $("vm-dem").textContent = `${ds.length} video, ${hien} đang hiện cho khách${ds.length > hien ? `, ${ds.length - hien} đang ẩn` : ""}`;
    $("vm-ds").replaceChildren(...ds.map((m, i) => theVideo(m, i)));
    if (sau) sau();
  }
  const timThe = ma => document.querySelector(`.vm-the[data-ma="${CSS.escape(ma)}"]`);

  function theVideo(m, i) {
    const li = tao("li", "vm-the"), laMoi = moi.has(m.ma), khoaAn = du.khoa.trong_cau_hoi.includes(m.ma);
    li.dataset.ma = m.ma; li.classList.toggle("an", !!m.an);
    const anh = coAnh(m) ? tao("img", "vm-anh") : tao("div", "vm-anh vm-chua-anh", "Chưa có ảnh bìa");
    if (anh.tagName === "IMG") { anh.src = anhMau(m, "nho"); anh.alt = ""; anh.width = 90; anh.height = 160; anh.loading = "lazy"; }
    const chu = tao("div", "vm-chu"), ten = tao("b", "", m.ten || "Video mới, chưa có tên"), phu = tao("small", "", moTa(m));
    const nhan = tao("span", "sc-nhan-ds");
    if (laMoi) nhan.append(tao("span", "sc-nhan moi", "Mới, chưa lưu"));
    if (m.an) nhan.append(tao("span", "sc-nhan", "Đang ẩn"));
    if (du.khoa.noi_bat.includes(m.ma)) nhan.append(tao("span", "sc-nhan", "Nổi bật ở trang chủ"));
    if (khoaAn) nhan.append(tao("span", "sc-nhan", "Có trong phiếu"));
    chu.append(ten, phu, nhan);
    if (m.id) { const yt = tao("a", "vm-yt", "Mở trên YouTube ↗"); yt.href = `https://www.youtube.com/shorts/${m.id}`; yt.target = "_blank"; yt.rel = "noopener"; chu.append(yt); }

    const thaoTac = tao("div", "vm-thao-tac");
    const sua = nut(dangMo.has(m.ma) ? "Đóng" : "Sửa"); sua.setAttribute("aria-expanded", String(dangMo.has(m.ma)));
    sua.setAttribute("aria-label", `${dangMo.has(m.ma) ? "Đóng phần sửa" : "Sửa"} video ${m.ma}`);
    sua.addEventListener("click", () => { if (dangMo.has(m.ma)) dangMo.delete(m.ma); else dangMo.add(m.ma); ve(() => timThe(m.ma)?.querySelector(".vm-thao-tac button")?.focus()); });
    const len = nut("Đưa lên"), xuong = nut("Đưa xuống");
    len.disabled = i === 0; xuong.disabled = i === ds.length - 1;
    len.setAttribute("aria-label", `Đưa video ${m.ma} lên trên`); xuong.setAttribute("aria-label", `Đưa video ${m.ma} xuống dưới`);
    const doi = k => { [ds[i], ds[i + k]] = [ds[i + k], ds[i]]; capNhatLuu();
      ve(() => { const b = [...timThe(m.ma).querySelectorAll(".vm-thao-tac button")]; (k < 0 ? [b[1], b[2]] : [b[2], b[1]]).find(x => x && !x.disabled)?.focus(); }); };
    len.addEventListener("click", () => doi(-1)); xuong.addEventListener("click", () => doi(1));
    thaoTac.append(sua, len, xuong);
    if (laMoi) {
      const bo = nut("Bỏ video mới này", "nut-chu nut-nguy-hiem");
      bo.addEventListener("click", () => { ds = ds.filter(x => x !== m); moi.delete(m.ma); dangMo.delete(m.ma); ve(); capNhatLuu(); bao("Đã bỏ video mới chưa lưu."); });
      thaoTac.append(bo);
    } else if (m.an) {
      const hienLai = nut("Hiện lại");
      hienLai.addEventListener("click", () => { delete m.an; ve(() => timThe(m.ma)?.querySelector(".vm-thao-tac button:last-of-type")?.focus()); capNhatLuu(); bao(`Video ${m.ma} sẽ hiện lại cho khách sau khi lưu.`); });
      thaoTac.append(hienLai);
    } else {
      const an = nut("Ẩn khỏi trang", "nut-chu nut-nguy-hiem");
      // Video là lựa chọn ở câu chọn kiểu video của phiếu: ẩn thì phiếu thiếu ảnh, nên không cho ẩn (máy chủ cũng chặn).
      if (khoaAn) thaoTac.append(tao("small", "sc-ghi-nho vm-khong-an", "Không ẩn được vì có trong phiếu"));
      else {
        an.addEventListener("click", () => {
          if (ds.filter(x => !x.an).length <= 3) { bao("Trang khách cần ít nhất 3 video mẫu đang hiện.", true); return; }
          m.an = true; ve(() => timThe(m.ma)?.querySelector(".vm-thao-tac button:last-of-type")?.focus()); capNhatLuu();
          bao(`Video ${m.ma} sẽ ẩn khỏi trang khách sau khi lưu. Bấm “Hiện lại” nếu đổi ý.`);
        });
        thaoTac.append(an);
      }
    }
    li.append(anh, chu, thaoTac);
    if (dangMo.has(m.ma)) li.append(oSua(m, laMoi, ten, phu));
    return li;
  }

  function oChu(nhan, giaTri, khiDoi, { toiDa = 80, goiY = "", list = "", rong = false, truong = "" } = {}) {
    const hop = tao("div", `sc-o${rong ? " vm-rong" : ""}`), id = maMoi(), l = tao("label", "nhan", nhan), o = tao("input");
    l.htmlFor = id; o.id = id; o.type = "text"; o.maxLength = toiDa; o.value = giaTri || ""; o.dataset.truong = truong;
    if (list) o.setAttribute("list", list);
    o.addEventListener("input", () => khiDoi(o.value, o));
    hop.append(l, o);
    if (goiY) hop.append(tao("small", "sc-ghi-nho", goiY));
    return hop;
  }

  const tenLoai = id => du.phan_loai.loai.find(l => l.id === id)?.ten || "";
  const moTa = m => [m.ma, tenLoai(m.loai), m.nhom, m.phong_cach].filter(Boolean).join(" · ");
  // Ô chọn trong một danh sách cố định (loại video, ngành, phong cách). Giá trị cũ không có trong danh sách thì hiện "Chưa chọn".
  function oChon(nhan, giaTri, ds, khiDoi, { truong = "", goiY = "" } = {}) {
    const hop = tao("div", "sc-o"), id = maMoi(), l = tao("label", "nhan", nhan), chon = tao("select");
    l.htmlFor = id; chon.id = id; chon.dataset.truong = truong;
    const trong = tao("option", "", "Chưa chọn"); trong.value = ""; chon.append(trong);
    ds.forEach(([v, chu]) => { const o = tao("option", "", chu); o.value = v; chon.append(o); });
    chon.value = ds.some(([v]) => v === giaTri) ? giaTri : "";
    chon.addEventListener("change", () => khiDoi(chon.value));
    hop.append(l, chon);
    if (goiY) hop.append(tao("small", "sc-ghi-nho", goiY));
    return hop;
  }

  function oSua(m, laMoi, ten, phu) {
    const khung = tao("div", "vm-sua"), capPhu = () => { phu.textContent = moTa(m); };
    if (laMoi) {
      const o = oChu("Mã mẫu", m.ma, (v, inp) => { inp.value = v.toUpperCase().replace(/[^A-Z0-9]/g, ""); const cu = m.ma; m.ma = inp.value;
        if (dangMo.delete(cu)) dangMo.add(m.ma); moi.delete(cu); moi.add(m.ma); timThe(cu).dataset.ma = m.ma; capPhu(); capNhatLuu(); },
        { toiDa: 12, truong: "ma", goiY: m.anh_moi ? "Đã tải ảnh bìa theo mã này nên không đổi mã được nữa." : "2 đến 12 chữ in hoa hoặc số, không trùng mã khác. Phiếu và Excel ghi mã này khi khách chọn video." });
      o.querySelector("input").readOnly = !!m.anh_moi;
      khung.append(o);
    }
    const ytGoiY = tao("small", "sc-ghi-nho");
    const capYt = (v) => { const id = idYoutube(v); ytGoiY.textContent = !v.trim() ? "Dán link video YouTube Shorts, ví dụ youtube.com/shorts/…" : id ? `Mã video: ${id}` : "Chưa nhận ra link YouTube. Anh chị dán đúng link video."; ytGoiY.classList.toggle("loi", !!v.trim() && !id); };
    const ytO = oChu("Link YouTube", m.id ? `https://www.youtube.com/shorts/${m.id}` : "", v => { const id = idYoutube(v); if (id) m.id = id; else m.id = ""; capYt(v); capNhatLuu(); }, { toiDa: 300, rong: true, truong: "id" });
    ytO.append(ytGoiY); capYt(m.id || "");
    khung.append(ytO,
      oChu("Tên video", m.ten, v => { m.ten = v; ten.textContent = v || "Video mới, chưa có tên"; capNhatLuu(); }, { rong: true, truong: "ten" }),
      oChon("Loại video", m.loai, du.phan_loai.loai.map(l => [l.id, l.ten]), v => { m.loai = v; capPhu(); capNhatLuu(); }, { truong: "loai", goiY: "Khách lọc theo mục đích và câu hỏi gợi ý dùng loại này." }),
      oChon("Ngành", m.nhom, du.phan_loai.nganh.map(x => [x, x]), v => { m.nhom = v; capPhu(); capNhatLuu(); }, { truong: "nhom" }),
      oChon("Phong cách", m.phong_cach, du.phan_loai.phong_cach.map(x => [x, x]), v => { m.phong_cach = v; capPhu(); capNhatLuu(); }, { truong: "phong_cach" }),
      oChu("Kiểu chi tiết (không bắt buộc)", m.kieu, v => { m.kieu = v; capNhatLuu(); }, { toiDa: 60, list: "vm-goi-y-kieu", goiY: "Hiện dưới điện thoại mẫu ở đầu trang chủ, ví dụ: Người mẫu giới thiệu sản phẩm." }));
    const hopHien = tao("div", "sc-o"), idHien = maMoi(), nhanHien = tao("label", "nhan", "Cách hiện trên thẻ"), chon = tao("select");
    nhanHien.htmlFor = idHien; chon.id = idHien;
    Object.entries(du.cach_hien).forEach(([k, v]) => { const o = tao("option", "", v); o.value = k; chon.append(o); });
    chon.value = m.hien || "video";
    chon.addEventListener("change", () => { m.hien = chon.value; capNhatLuu(); });
    hopHien.append(nhanHien, chon); khung.append(hopHien);

    // Ảnh bìa: thu nhỏ ngay trên máy (tối đa 1080 × 1920) rồi tải lên; máy chủ cắt giữa về khổ 9:16 và làm đủ các cỡ.
    const hopAnh = tao("div", "sc-o vm-rong vm-o-anh"), idAnh = maMoi(), nhanAnh = tao("label", "nhan", "Ảnh bìa"), tep = tao("input"), xem = tao("div", "vm-xem-anh");
    const capXem = () => { if (coAnh(m)) { const i = tao("img"); i.src = anhMau(m, "nho"); i.alt = `Ảnh bìa video ${m.ma}`; i.width = 135; i.height = 240; xem.replaceChildren(i); } else xem.replaceChildren(tao("span", "vm-chua-anh", "Chưa có ảnh bìa")); };
    capXem();
    nhanAnh.htmlFor = idAnh; tep.id = idAnh; tep.type = "file"; tep.dataset.truong = "anh"; tep.accept = "image/jpeg,image/png,image/webp";
    const trangThai = tao("small", "sc-ghi-nho", "Ảnh dọc 9:16, ví dụ 1080 × 1920; ảnh khác khổ được cắt giữa. JPG, PNG hoặc WebP.");
    trangThai.setAttribute("aria-live", "polite");
    tep.addEventListener("change", async () => {
      const f = tep.files[0]; if (!f) return;
      if (!/^[A-Z0-9]{2,12}$/.test(m.ma) || ds.filter(x => x.ma === m.ma).length > 1) { trangThai.textContent = "Anh chị ghi mã mẫu đúng và không trùng trước khi chọn ảnh bìa."; trangThai.classList.add("loi"); tep.value = ""; return; }
      trangThai.classList.remove("loi"); trangThai.textContent = "Đang tải ảnh lên…"; tep.disabled = true;
      try {
        const form = new FormData(); form.append("anh", await thuNho(f), "anh-bia.jpg");
        const kq = await goi(`/api/nhan-vien/mau/anh?ma=${encodeURIComponent(m.ma)}`, { method: "POST", body: form });
        m.anh_moi = kq.anh_moi; capXem(); capNhatLuu();
        // Ảnh nhỏ ở đầu thẻ: thay tại chỗ (không vẽ lại cả danh sách để giữ chỗ đang sửa).
        const cu = khung.closest(".vm-the")?.querySelector(".vm-anh"), moiAnh = tao("img", "vm-anh");
        moiAnh.src = anhMau(m, "nho"); moiAnh.alt = ""; moiAnh.width = 90; moiAnh.height = 160; cu?.replaceWith(moiAnh);
        trangThai.textContent = "Đã tải ảnh bìa. Bấm “Lưu và áp dụng” để dùng ảnh này.";
        if (laMoi) { const o = khung.querySelector("input"); if (o) o.readOnly = true; }
      } catch (e) { trangThai.textContent = e.message; trangThai.classList.add("loi"); }
      finally { tep.disabled = false; tep.value = ""; }
    });
    hopAnh.append(nhanAnh, xem, tep, trangThai); khung.append(hopAnh);

    const soLieu = tao("fieldset", "sc-truong vm-rong vm-so-lieu");
    soLieu.append(tao("legend", "", "Số liệu bài đăng (không bắt buộc)"));
    [["tim", "Lượt tim"], ["binh_luan", "Bình luận"], ["chia_se", "Chia sẻ"]].forEach(([k, nhan]) => {
      const hop = tao("div", "sc-o"), id = maMoi(), l = tao("label", "nhan", nhan), o = tao("input");
      l.htmlFor = id; o.id = id; o.type = "number"; o.min = "0"; o.step = "1"; o.inputMode = "numeric"; o.value = m.so_lieu?.[k] ?? "";
      o.addEventListener("input", () => {
        const v = o.value === "" ? null : Number(o.value);
        m.so_lieu = { ...(m.so_lieu || {}) };
        if (v === null || !Number.isInteger(v) || v < 0) delete m.so_lieu[k]; else m.so_lieu[k] = v;
        if (!Object.keys(m.so_lieu).length) delete m.so_lieu;
        capNhatLuu();
      });
      hop.append(l, o); soLieu.append(hop);
    });
    soLieu.append(tao("small", "sc-ghi-nho", "Chỉ ghi số thật của bài đăng gốc; để trống thì trang không hiện số."));
    khung.append(soLieu);
    return khung;
  }

  // Thu nhỏ ảnh trên máy trước khi gửi (Vercel nhận tối đa khoảng 4 MB mỗi lần gửi).
  async function thuNho(f) {
    let bm;
    try { bm = await createImageBitmap(f, { imageOrientation: "from-image" }); }
    catch { throw new Error("Trang chưa đọc được ảnh này. Anh chị chọn ảnh JPG, PNG hoặc WebP."); }
    const ti = Math.min(1, 1080 / bm.width, 1920 / bm.height), c = document.createElement("canvas");
    c.width = Math.round(bm.width * ti); c.height = Math.round(bm.height * ti);
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(bm, 0, 0, c.width, c.height); bm.close?.();
    return new Promise((xong, hong) => c.toBlob(b => b ? xong(b) : hong(new Error("Chưa thu nhỏ được ảnh này.")), "image/jpeg", 0.9));
  }

  $("vm-them").addEventListener("click", () => {
    const so = Math.max(0, ...ds.map(m => /^ST(\d+)$/.exec(m.ma)).filter(Boolean).map(x => Number(x[1]))) + 1;
    const m = { ma: `ST${String(so).padStart(3, "0")}`, ten: "", nhom: "", loai: "", phong_cach: "", kieu: "", id: "", hien: "video" };
    ds.push(m); moi.add(m.ma); dangMo.add(m.ma); bao("");
    ve(() => { const t = timThe(m.ma); t?.scrollIntoView({ block: "center" }); t?.querySelector('.vm-sua input[type="text"]:not([readonly])')?.focus(); });
    capNhatLuu();
  });

  // Chặn sớm lỗi dễ thấy, mở đúng video bị lỗi; máy chủ vẫn kiểm đầy đủ.
  function kiemTruoc() {
    const daCo = new Set();
    for (const m of ds) {
      if (!/^[A-Z0-9]{2,12}$/.test(m.ma)) return { ma: m.ma, truong: "ma", loi: `Mã mẫu “${m.ma}” chưa đúng: 2 đến 12 chữ in hoa hoặc số.` };
      if (daCo.has(m.ma)) return { ma: m.ma, truong: "ma", loi: `Mã mẫu ${m.ma} bị trùng.` };
      daCo.add(m.ma);
      if (!m.id) return { ma: m.ma, truong: "id", loi: `Video ${m.ma} chưa có link YouTube đúng.` };
      if ((m.ten || "").trim().length < 3) return { ma: m.ma, truong: "ten", loi: `Video ${m.ma} chưa có tên.` };
      if (!tenLoai(m.loai)) return { ma: m.ma, truong: "loai", loi: `Video ${m.ma} chưa chọn loại video.` };
      if (!du.phan_loai.nganh.includes(m.nhom)) return { ma: m.ma, truong: "nhom", loi: `Video ${m.ma} chưa chọn ngành.` };
      if (!du.phan_loai.phong_cach.includes(m.phong_cach)) return { ma: m.ma, truong: "phong_cach", loi: `Video ${m.ma} chưa chọn phong cách.` };
      if (!coAnh(m)) return { ma: m.ma, truong: "anh", loi: `Video ${m.ma} chưa có ảnh bìa.` };
    }
    if (ds.filter(m => !m.an).length < 3) return { loi: "Trang khách cần ít nhất 3 video mẫu đang hiện." };
    return null;
  }
  $("vm-luu-nut").addEventListener("click", async () => {
    const k = kiemTruoc();
    if (k) {
      if (k.ma) { dangMo.add(k.ma); ve(() => { const t = timThe(k.ma); t?.scrollIntoView({ block: "center" }); t?.querySelector(`.vm-sua [data-truong="${k.truong}"]`)?.focus(); }); }
      baoLuu(k.loi); return;
    }
    const b = $("vm-luu-nut"); b.disabled = true; b.textContent = "Đang lưu…"; baoLuu("");
    try {
      const d = await goi("/api/nhan-vien/mau", { method: "PUT", body: JSON.stringify({ mau: ds, phien_ban: du.phien_ban, ghi_chu: $("vm-ghi-chu").value.trim() }) });
      $("vm-ghi-chu").value = ""; dangMo.clear(); nhan(d); bao("Đã lưu. Trang khách đổi theo trong khoảng 5 phút.");
    } catch (e) { baoLuu(e.ma === 409 ? `${e.message} Bấm “Bỏ thay đổi” để tải bản mới nhất.` : e.message); }
    finally { b.disabled = false; b.textContent = "Lưu và áp dụng"; }
  });
  $("vm-bo-doi").addEventListener("click", async () => {
    if (!confirm("Bỏ mọi thay đổi chưa lưu và tải lại danh sách video mẫu đang dùng?")) return;
    dangMo.clear(); bao(""); await tai();
  });
})();
