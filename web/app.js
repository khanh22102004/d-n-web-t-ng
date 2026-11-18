// Trang khách: khám phá mẫu, tư vấn nhanh hoặc điền phiếu chi tiết có lưu bản nháp.
(() => {
  "use strict";
  const KHOA_PHIEU = "bp-phieu", KHOA_NHAP = "bp-ban-nhap";
  const $ = id => document.getElementById(id);
  const tao = (the, lop, chu) => { const e = document.createElement(the); if (lop) e.className = lop; if (chu != null) e.textContent = chu; return e; };
  const nho = { doc: k => { try { return localStorage.getItem(k) || ""; } catch { return ""; } }, ghi: (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } }, xoa: k => { try { localStorage.removeItem(k); } catch { /* bỏ qua */ } } };

  const itChuyenDong = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tietKiem = !!(navigator.connection && navigator.connection.saveData);
  document.body.classList.toggle("tiet-kiem-du-lieu", tietKiem);
  // Máy yếu (RAM từ 4 GB trở xuống, ít nhân CPU) hoặc đang tiết kiệm dữ liệu: tắt các hiệu ứng nặng, không tự tải trình phát YouTube.
  const mayYeu = tietKiem || (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  document.documentElement.classList.toggle("may-yeu", !!mayYeu);
  document.body.classList.toggle("tam-dung-nen", document.hidden);
  let cauHinh = null, nhom = [], cau = [], mau = {};
  let maPhieu = "", traLoi = {}, anh = [], viTri = 0, henLuu = 0, dangLuu = Promise.resolve();
  let lanSua = 0, canLuu = false, dangGuiLuu = false, dangGui = false, daGui = false, choThu = 1500, canTaiPhieu = false;
  let luotPhieu = crypto.randomUUID(), doSauLichSu = 0, doSauDaGui = 0, ketQuaDaGui = [];
  let gocLichSu = location.pathname + location.search;

  function nhoBanNhap() {
    if (!maPhieu || daGui) return;
    nho.ghi(KHOA_NHAP, JSON.stringify({ id: maPhieu, tra_loi: traLoi, nhom: nhom[viTri]?.id, can_luu: canLuu, luot: luotPhieu }));
  }
  function docBanNhap(ma) {
    try { const p = JSON.parse(nho.doc(KHOA_NHAP)); return p?.id === ma && p.tra_loi && typeof p.tra_loi === "object" && !Array.isArray(p.tra_loi) ? p : null; } catch { return null; }
  }
  function xoaBanNhap() { nho.xoa(KHOA_PHIEU); nho.xoa(KHOA_NHAP); }
  function henLuuLai(ms = 700) {
    clearTimeout(henLuu);
    if (!daGui && !dangGui) henLuu = setTimeout(luu, ms);
  }

  async function goi(duong, tuy = {}) {
    const r = await fetch(duong, { cache: "no-store", ...tuy, headers: tuy.body && !(tuy.body instanceof FormData) ? { "Content-Type": "application/json" } : undefined });
    let du = {};
    try { du = r.status === 204 ? {} : await r.json(); } catch { /* không có nội dung */ }
    if (!r.ok) { const loi = new Error(du.loi?.thong_bao || "Chưa kết nối được máy chủ. Quý khách hàng vui lòng thử lại."); loi.chi_tiet = du.loi; loi.trangThai = r.status; throw loi; }
    return du;
  }

  function nguon() {
    const q = new URLSearchParams(location.search);
    const moi = (q.get("nguon") || q.get("utm_source") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
    try { if (moi) sessionStorage.setItem("bp-nguon", moi); return sessionStorage.getItem("bp-nguon") || ""; } catch { return moi; }
  }

  // ---------- Trang mở đầu và mẫu ----------
  // Hiện ảnh tại chỗ ngay; nâng lên ảnh dọc nét hơn khi tải được.
  function khungAnh(m, net = false) {
    const k = tao("div", "khung"), i = tao("img"), taiCho = `/anh-mau/${m.ma}.webp`, duPhongJpg = `/anh-mau/${m.ma}.jpg`;   // WebP nhẹ hơn ~56%; JPG dự phòng
    i.alt = `Mẫu ${m.ma}: ${m.ten}`; i.loading = "lazy"; i.decoding = "async"; i.width = 360; i.height = 640;
    const anhRieng = typeof m.anh_bia === "string" && m.anh_bia.startsWith("/anh-mau/") && !m.anh_bia.includes("..") && !/[?#]/.test(m.anh_bia) ? m.anh_bia : "";
    let daDuPhong = false, daJpg = false;
    i.addEventListener("error", () => {
      if (!daDuPhong && i.getAttribute("src") !== taiCho) { daDuPhong = true; i.src = taiCho; }
      else if (!daJpg) { daJpg = true; i.src = duPhongJpg; }
      else { i.hidden = true; k.classList.add("thieu-anh"); }
    });
    i.addEventListener("load", () => { i.hidden = false; k.classList.remove("thieu-anh"); });
    i.src = anhRieng || (net === "nho" ? `/anh-mau/nho/${m.ma}.webp` : net === "tuong" ? `/anh-mau/tuong/${m.ma}.webp` : taiCho);   // "tuong": ảnh 180×320 chỉ cho tường nền
    if (!anhRieng && net === true && m.id && !tietKiem && !mayYeu) {   // máy yếu: không tải thêm ảnh bìa YouTube độ nét cao
      const netHon = new Image();
      netHon.addEventListener("load", () => {
        if (i.isConnected && netHon.naturalWidth >= 480 && netHon.naturalHeight / netHon.naturalWidth >= 1.2) i.src = netHon.src;
      });
      netHon.src = `https://i.ytimg.com/vi_webp/${encodeURIComponent(m.id)}/oar2.webp`;
    }
    k.append(i); return k;
  }

  // ---------- Đoạn xem thử không tiếng ----------
  // Mỗi mẫu hiện theo "hien" trong mau.json: "video" tự phát thử khi nằm trong tầm nhìn,
  // "dong" là ảnh bìa trôi chậm, "anh" là ảnh tĩnh. Rê chuột vào mẫu nào cũng phát thử mẫu đó.
  let tamDung = false, theDangPhat = null;
  const duocPhat = () => !itChuyenDong && !tietKiem && !mayYeu && !tamDung &&   // máy yếu: thẻ thư viện chỉ hiện ảnh bìa, bấm mới phát
    !$("xem").open && !$("bat-dau-hop").open && !document.hidden;

  function phatThu(the) {
    if (!duocPhat() || the === theDangPhat) return;
    const m = the._mau;
    if (!m.doan) dungThu(theDangPhat);           // mỗi lúc chỉ chạy một khung YouTube
    if (the.querySelector(".xem-thu")) return;
    const lop = tao("div", "xem-thu"), hienLen = () => { lop.classList.add("hien"); the.classList.add("dang-phat"); };
    if (m.doan) {
      const v = tao("video"); v.src = m.doan; v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.preload = "metadata";
      v.addEventListener("playing", hienLen, { once: true }); lop.append(v);
    } else {
      // Chỉ hiện video khi YouTube báo đang phát thật; quá 9 giây không phát được thì bỏ, giữ ảnh bìa.
      const f = tao("iframe"); f.tabIndex = -1; f.setAttribute("aria-hidden", "true"); f.referrerPolicy = "strict-origin-when-cross-origin"; f.allow = "autoplay; encrypted-media";
      f.src = `${YT}/embed/${encodeURIComponent(m.id)}?autoplay=1&mute=1&controls=0&loop=1&playlist=${encodeURIComponent(m.id)}&playsinline=1&rel=0&modestbranding=1&disablekb=1&iv_load_policy=3&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
      const hoi = () => { try { f.contentWindow.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), YT); } catch { /* khung đã bị gỡ */ } };
      f.addEventListener("load", () => { hoi(); setTimeout(hoi, 800); setTimeout(hoi, 2500); }, { once: true });
      choPhat.set(f, hienLen);
      setTimeout(() => { if (lop.isConnected && !lop.classList.contains("hien")) dungThu(the); }, 9000);
      lop.append(f); theDangPhat = the;
    }
    the.querySelector(".khung").append(lop);
  }
  const YT = "https://www.youtube-nocookie.com", choPhat = new Map();
  window.addEventListener("message", e => {
    if (e.origin !== YT || typeof e.data !== "string") return;
    let tin; try { tin = JSON.parse(e.data); } catch { return; }
    if (tin?.info?.playerState !== 1) return;
    for (const [f, hienLen] of choPhat) if (f.contentWindow === e.source) { hienLen(); choPhat.delete(f); }
  });
  function dungThu(the) {
    if (!the) return;
    const lop = the.querySelector(".xem-thu"); if (lop) { const f = lop.querySelector("iframe"); if (f) choPhat.delete(f); lop.remove(); }
    the.classList.remove("dang-phat"); if (theDangPhat === the) theDangPhat = null;
  }
  const dungTatCa = () => {
    document.querySelectorAll(".mau-nut .xem-thu").forEach(l => dungThu(l.closest(".mau-nut")));
    dungThu($("dt-phat"));
    document.querySelectorAll("video.doan").forEach(v => v.pause());
  };

  const quanSat = "IntersectionObserver" in window ? new IntersectionObserver(muc => {
    muc.forEach(e => { if (e.isIntersecting && e.intersectionRatio > 0.75) phatThu(e.target); else if (e.target !== theDangRe) dungThu(e.target); });
  }, { threshold: [0, 0.75] }) : null;
  let theDangRe = null;

  // Thẻ mở trình xem video cho một mẫu. coChu: hiện mã và tên bên dưới khung. tuPhat: phát thử khi thẻ nằm trong tầm nhìn.
  let soThe = 0;
  function nutMau(m, danhSach, coChu, tuPhat = false, net = true) {
    const the = tao("div", "mau-nut"), b = tao("button", "mo"); b.type = "button";
    the._mau = m; soThe += 1;
    if (m.hien === "dong") the.classList.add("dong", soThe % 2 ? "kieu-1" : "kieu-2");
    b.setAttribute("aria-label", `Phát video mẫu ${m.ma}: ${m.ten}`);
    const k = khungAnh(m, net); k.firstChild.alt = ""; k.append(tao("span", "nhan-phat", "Đang phát thử"));
    the.append(k);
    if (coChu) the.append(tao("span", "ma-mau", m.ma), tao("span", "ten-mau", m.ten));
    the.append(b);
    b.addEventListener("click", () => moXem(danhSach(), m.ma));
    let hen = 0;
    the.addEventListener("pointerenter", e => { if (e.pointerType === "touch" || m.doan) return; theDangRe = the; hen = setTimeout(() => phatThu(the), 350); });
    the.addEventListener("pointerleave", () => { clearTimeout(hen); if (theDangRe === the) theDangRe = null; if (!the._giu && !(tuPhat && m.hien === "video")) dungThu(the); });
    if (tuPhat && m.hien === "video" && !m.doan && quanSat) quanSat.observe(the);
    return the;
  }

  // ---------- Đoạn video ngắn của studio (web/video-mau/<mã>.mp4) ----------
  // Mẫu nào có tệp thì tự phát không tiếng khi nằm trong màn hình, nhiều mẫu cùng lúc được vì tệp nhỏ.
  // Video chỉ được tải khi thẻ hiện ra lần đầu, tạm dừng khi ra khỏi màn hình.
  const duocPhatDoan = () => !itChuyenDong && !tietKiem && !mayYeu && !tamDung && !document.hidden && !$("xem").open;
  const quanSatDoan = "IntersectionObserver" in window ? new IntersectionObserver(muc => muc.forEach(e => {
    const the = e.target; let v = the.querySelector("video.doan");
    if (e.isIntersecting && duocPhatDoan()) {
      if (!v) {
        v = tao("video", "doan"); v.muted = true; v.defaultMuted = true; v.setAttribute("muted", ""); v.loop = true; v.playsInline = true; v.autoplay = true;
        v.preload = "auto"; v.setAttribute("aria-hidden", "true"); v.tabIndex = -1;
        v.addEventListener("playing", () => the.classList.add("co-doan"), { once: true });
        v.src = the._mau.doan; the.querySelector(".khung").append(v);
      }
      v.play().catch(() => {});
    } else if (v) v.pause();
  }), { threshold: 0.25 }) : null;
  function ganDoan(the) { if (the._mau.doan && quanSatDoan && !itChuyenDong && !tietKiem) quanSatDoan.observe(the); }
  function chayLaiDoan() {
    if (!duocPhatDoan()) return;
    document.querySelectorAll("video.doan").forEach(v => {
      const r = v.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth) v.play().catch(() => {});
    });
  }

  const maNoiBat = ["ST025", "ST029", "ST056"];
  let locNhom = "";
  // Mẫu đứng đầu danh sách nổi bật cũng đứng đầu thư viện (thứ tự ngành hàng trong menu vẫn theo mau.json).
  const dauTien = ds => { const k = ds.findIndex(m => m.ma === maNoiBat[0]); return k > 0 ? [ds[k], ...ds.slice(0, k), ...ds.slice(k + 1)] : ds; };
  const mauDangLoc = () => locNhom === "noi-bat" ? maNoiBat.map(ma => mau[ma]).filter(Boolean) : dauTien(cauHinh.mau.filter(m => !locNhom || m.nhom === locNhom));

  function veRay() {
    const ds = mauDangLoc(), ray = $("luoi-mau");
    dungTatCa();
    ray.replaceChildren(...ds.map(m => {
      const li = tao("li"), tuVan = tao("button", "tu-van-mau", "Tư vấn kiểu này ↗"); tuVan.type = "button";
      tuVan.setAttribute("aria-label", `Tư vấn theo mẫu ${m.ma}: ${m.ten}`);
      tuVan.addEventListener("click", () => chonTuVan(m));
      const the = nutMau(m, mauDangLoc, true, true, "nho");
      the.querySelector(".khung").append(tao("span", "nhan-nganh", m.nhom)); ganDoan(the);
      li.append(the, tao("p", "phong-cach-mau", m.kieu || m.nhom), tuVan); return li;
    }));
    ray.scrollLeft = 0;
    // Điện thoại: hiện 6 mẫu đầu, phần còn lại mở bằng một nút để trang không quá dài.
    const thuGon = ds.length > 6;
    ray.classList.toggle("thu-gon", thuGon);
    $("xem-them-mau").hidden = !thuGon; $("xem-them-mau").textContent = `Xem thêm ${ds.length - 6} mẫu`;
    $("dem-mau").textContent = locNhom === "noi-bat" ? `${ds.length} gợi ý để bắt đầu · ${cauHinh.mau.length} mẫu trong thư viện` : locNhom ? `${ds.length} mẫu · ${locNhom}` : `Tất cả ${ds.length} mẫu trong thư viện`;
    capNhatNutRay(); quanSatGiua();
  }
  function capNhatNutRay() {
    const ray = $("luoi-mau"), cacThe = [...ray.children];
    const coCuon = ray.scrollWidth > ray.clientWidth + 2;
    $("ray-huong-dan").hidden = !coCuon || cacThe.length < 2;
    if (coCuon && cacThe.length > 1) ray.setAttribute("aria-describedby", "ray-goi-y");
    else ray.removeAttribute("aria-describedby");
    $("ray-truoc").disabled = ray.scrollLeft <= 2;
    $("ray-sau").disabled = ray.scrollLeft + ray.clientWidth >= ray.scrollWidth - 2;
    if (cacThe.length) {
      const buoc = cacThe.length > 1 ? cacThe[1].offsetLeft - cacThe[0].offsetLeft : cacThe[0].offsetWidth;
      const viTri = Math.min(cacThe.length, Math.max(1, Math.round(ray.scrollLeft / Math.max(1, buoc)) + 1));
      $("ray-vi-tri").textContent = `${viTri}/${cacThe.length}`;
    }
  }

  // Màn hình đầu: tường mẫu đang chạy để khách thấy ngay nhiều kiểu video, không phải một mẫu duy nhất.
  // Máy tính: năm cột. Điện thoại: bốn cột ô nhỏ so le, trôi dọc xuống.
  // Mỗi cột được lặp hai lần để chạy liền mạch; nền ẩn với trình đọc màn hình và phím Tab.
  // Tường mẫu giờ là nền trôi phía sau điện thoại: chỉ để trang trí, nên ẩn với trình đọc màn hình và phím Tab
  // (thư viện mẫu bên dưới và chính chiếc điện thoại vẫn mở được từng mẫu).
  // nhe: điện thoại hoặc máy yếu dùng ảnh tường 180×320 (giải nén ~0,22MB thay vì ~0,5MB mỗi ô);
  // som: chỉ vài ô đầu mỗi cột tải ngay, các ô còn lại để trình duyệt tải khi gần tới.
  function oTuong(m, nhe = false, som = true) {
    const the = nutMau(m, () => cauHinh.mau, false, false, nhe ? "tuong" : "nho");
    the.classList.add("o-tuong");
    the.querySelector(".khung").append(tao("span", "nhan-nganh", m.nhom));
    the.querySelector("button").tabIndex = -1;
    const anh = the.querySelector("img"); anh.loading = som ? "eager" : "lazy"; anh.decoding = "async";
    ganDoan(the);
    return the;
  }
  function veTuong() {
    const ds = cauHinh.mau, soCot = 5;
    const mqDt = matchMedia("(max-width: 760px)");
    const dungTuong = () => {
      $("tuong-doc").replaceChildren(); $("tuong-ngang").replaceChildren();
      // Chỉ dựng tường cho loại màn hình đang xem (máy tính: cột dọc; điện thoại: hàng ngang) để không tải ảnh thừa.
      const laDt = mqDt.matches, nhe = laDt || mayYeu;
      // Tường đứng yên (máy yếu hoặc người xem chọn giảm chuyển động): không cần bản sao thứ hai để trôi liền mạch.
      const lanLap = (mayYeu || itChuyenDong) ? [0] : [0, 1];
      for (let c = 0; c < (laDt ? 0 : soCot); c += 1) {
        const cot = tao("div", "tuong-cot"), chay = tao("div", "tuong-chay");
        const cua = ds.filter((_, i) => i % soCot === c);
        if (!cua.length) continue;
        // A full loop must be taller than its viewport, even with smaller film-strip posters.
        const vong = Array.from({ length: Math.max(3, cua.length) }, (_, i) => cua[i % cua.length]);   // nửa vòng chỉ cần cao hơn khung
        lanLap.forEach(lan => vong.forEach((m, i) => chay.append(oTuong(m, nhe, lan === 0 && i < 3))));
        cot.append(chay); $("tuong-doc").append(cot);
      }
      // Distribute every sample over four mobile columns; repeat each half for a seamless loop.
      for (let c = 0; c < (laDt ? 4 : 0); c += 1) {
        const cot = tao("div", "tuong-cot"), chay = tao("div", "tuong-chay");
        const cua = ds.filter((_, i) => i % 4 === c);
        if (!cua.length) continue;
        const vong = Array.from({ length: Math.max(6, cua.length) }, (_, i) => cua[i % cua.length]);
        lanLap.forEach(lan => vong.forEach((m, i) => chay.append(oTuong(m, nhe, lan === 0 && i < 5))));
        cot.append(chay); $("tuong-ngang").append(cot);
      }
      // (Bỏ lớp tường thứ hai chỉ để vẽ viền: nó nhân đôi việc vẽ khi tường trôi. Viền giờ vẽ thẳng trên ô ảnh.)
    };
    dungTuong();
    // Xoay máy hoặc kéo cửa sổ qua ngưỡng 760px: dựng lại đúng loại tường.
    mqDt.addEventListener?.("change", dungTuong);
    document.querySelectorAll("[data-so-mau]").forEach(e => { e.textContent = ds.length; });
    document.querySelectorAll("[data-so-nganh]").forEach(e => { e.textContent = new Set(ds.map(m => m.nhom)).size; });
    $("tuong-dung").addEventListener("click", () => {
      tamDung = $("tuong").classList.toggle("dung");
      document.body.classList.toggle("dung-chuyen-dong", tamDung);
      if (tamDung) dungTatCa(); else chayLaiDoan();
      $("tuong-dung").setAttribute("aria-pressed", String(tamDung));
      $("tuong-dung").setAttribute("aria-label", tamDung ? "Chạy tiếp tự xoay" : "Dừng tự xoay");
      dtCapNhat();
    });
    veDienThoai(); ganXoay(); quetTieuDe(); ganMenuDangXem(); ganDungKhiKhuat();
  }
  // Đầu thư viện: tiêu đề "lấy nét" từng chữ khi cuộn tới; dòng "Ví dụ" tự gõ lần lượt các kiểu video có trong thư viện.
  function quetTieuDe() {
    const h2 = $("mau-tieu-de"), chu = $("kieu-chay-chu");
    if (!h2 || !chu) return;
    // tách tiêu đề thành từng chữ (giữ nguyên dấu xuống dòng) để làm hiệu ứng lấy nét lần lượt
    if (!h2.querySelector(".tu-net")) {
      let k = 0;
      [...h2.childNodes].forEach(n => {
        if (n.nodeType !== 3) return;
        const f = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(t => { if (!t) return; if (/^\s+$/.test(t)) f.append(t); else { const s = tao("span", "tu-net", t); s.style.setProperty("--i", k++); f.append(s); } });
        n.replaceWith(f);
      });
    }
    const vao = () => h2.classList.add("da-net");
    if (itChuyenDong || !("IntersectionObserver" in window)) vao();
    else { const io = new IntersectionObserver(ds => { if (ds.some(d => d.isIntersecting)) { vao(); io.disconnect(); } }, { threshold: .5 }); io.observe(h2); }

    const ds = [...new Set(dauTien(cauHinh.mau).map(m => m.kieu).filter(Boolean))];
    if (!ds.length) return;
    chu.textContent = ds[0];
    if (itChuyenDong || ds.length < 2) return;
    const cho = ms => new Promise(r => setTimeout(r, ms));
    const dangThay = () => { const r = chu.getBoundingClientRect(); return !tamDung && !document.hidden && r.bottom > 0 && r.top < innerHeight; };
    let i = 0;
    (async () => {
      for (;;) {
        await cho(2600);
        if (!dangThay()) continue;
        const cu = chu.textContent; chu.classList.remove("ve");
        for (let n = cu.length; n >= 0; n--) { chu.textContent = cu.slice(0, n); await cho(20); }
        i = (i + 1) % ds.length; const kieu = ds[i];
        for (let n = 1; n <= kieu.length; n++) { chu.textContent = kieu.slice(0, n); await cho(45); }
        chu.classList.add("ve");
      }
    })();
  }
  // Phần nào khuất khỏi màn hình thì dừng mọi hiệu ứng CSS bên trong (tường trôi, sóng âm, ánh kim…) để máy đỡ phải vẽ.
  function ganDungKhiKhuat() {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(ds => ds.forEach(d => d.target.classList.toggle("khuat", !d.isIntersecting)), { rootMargin: "120px 0px" });
    document.querySelectorAll("main > section").forEach(s => io.observe(s));
  }
  // Menu: đánh dấu mục ứng với phần khách đang xem (Trang chủ, Kiểu video = thư viện, Về B Productions, Blog).
  function ganMenuDangXem() {
    const muc = [...document.querySelectorAll(".dau-trang [data-phan]")];
    if (!muc.length || !("IntersectionObserver" in window)) return;
    const dat = id => muc.forEach(m => { const co = m.dataset.phan === id; m.classList.toggle("dang-xem", co); if (m.tagName === "A") { if (co) m.setAttribute("aria-current", "location"); else m.removeAttribute("aria-current"); } });
    const hien = new Map();
    const io = new IntersectionObserver(ds => {
      ds.forEach(d => hien.set(d.target.id, d.isIntersecting ? d.intersectionRect.height : 0));
      let tot = "", cao = 0; hien.forEach((h, id) => { if (h > cao) { cao = h; tot = id; } });
      dat(muc.some(m => m.dataset.phan === tot) ? tot : "");
    }, { threshold: [0, .15, .35, .6], rootMargin: "-90px 0px -35% 0px" });
    ["mo-dau", "mau", "ve-b-productions", "tu-van", "goc-chia-se"].forEach(id => { const s = $(id); if (s) io.observe(s); });
  }

  // ---------- Điện thoại ở màn hình đầu: lướt các video mẫu như đang xem TikTok ----------
  // Ảnh bìa hiện ngay cho nhanh; trang rảnh rồi thì phát video thật (không tiếng). Bấm vào máy là bật tiếng ngay trên máy.
  const DT_LUOT = mayYeu ? 6500 : 4000, DT_VIDEO = 13000;   // máy yếu: đổi mẫu thưa hơn
  const dt = { ds: [], i: 0, hen: 0, re: false, trongTam: true, canh: new Map(), video: false, tieng: false, yt: null, henTieng: 0, tatTay: false };
  const coModal = () => $("xem").open || $("bat-dau-hop").open || !!$("menu-dt")?.open;
  const dtDuocPhat = () => !tamDung && dt.trongTam && !document.hidden && !coModal();
  const dtTuLuot = () => dtDuocPhat() && !itChuyenDong && !dt.re && !dt.tieng;
  const dtChay = dtTuLuot;
  const laIOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const rutGon = so => new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 }).format(so);
  const soThat = v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
  function dtLenh(func, args = []) {
    try { dt.yt?.f?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), YT); } catch { /* khung đã bị gỡ */ }
  }
  function dtCanh(m) {
    let c = dt.canh.get(m.ma);
    if (c) return c;
    c = tao("div", "dt-mot"); const k = khungAnh(m, true), anh = k.querySelector("img");
    anh.alt = ""; anh.loading = "eager"; if (!dt.canh.size) anh.fetchPriority = "high";
    c.append(k); dt.canh.set(m.ma, c); $("dt-canh").append(c);
    return c;
  }
  function dtGoVideo() {
    const h = $("dt-video"); if (dt.yt?.f) choPhat.delete(dt.yt.f);
    h.replaceChildren(); h.classList.remove("hien"); $("dt-man").classList.remove("co-video"); dt.yt = null;
  }
  // Nạp video thật của mẫu vào màn hình máy: tệp riêng trong web/video-mau nếu có, không thì YouTube.
  function dtNapVideo(m, coTieng) {
    dtGoVideo();
    const yt = { ma: m.ma, tieng: coTieng, dangPhat: false, f: null, v: null, lenh: "playVideo" };
    if (m.doan) {
      const v = tao("video"); v.src = m.doan; v.playsInline = true; v.loop = !coTieng; v.muted = !coTieng; v.autoplay = true; v.preload = "auto";
      v.setAttribute("aria-hidden", "true"); v.tabIndex = -1; yt.v = v;
      v.addEventListener("playing", () => dtDangPhat(yt), { once: true });
      v.addEventListener("ended", () => { if (dt.tieng) dtXoay(1); });
      $("dt-video").append(v); dt.yt = yt; v.play().catch(() => {});
    } else if (m.id) {
      const f = tao("iframe"); f.title = `Video mẫu ${m.ma}`; f.tabIndex = -1; f.setAttribute("aria-hidden", "true");
      f.referrerPolicy = "strict-origin-when-cross-origin"; f.allow = "autoplay; encrypted-media";
      const lap = coTieng ? "" : `&loop=1&playlist=${encodeURIComponent(m.id)}`;
      f.src = `${YT}/embed/${encodeURIComponent(m.id)}?autoplay=1&mute=${coTieng ? 0 : 1}&controls=0&playsinline=1&rel=0&modestbranding=1&disablekb=1&iv_load_policy=3&fs=0&enablejsapi=1&origin=${encodeURIComponent(location.origin)}${lap}`;
      const hoi = () => { try { f.contentWindow.postMessage(JSON.stringify({ event: "listening", id: 2, channel: "widget" }), YT); } catch { /* đã gỡ */ } };
      f.addEventListener("load", () => { hoi(); setTimeout(hoi, 800); setTimeout(hoi, 2500); }, { once: true });
      yt.f = f; $("dt-video").append(f); dt.yt = yt;
    } else return;
    // Quá 8 giây chưa phát được (mạng chậm, YouTube bị chặn) thì bỏ, giữ ảnh bìa và lướt tiếp như cũ.
    setTimeout(() => {
      if (dt.yt !== yt || yt.dangPhat) return;
      dtGoVideo(); if (dt.tieng) { dt.tieng = false; dtVeTieng(); moXem(dt.ds, m.ma); }
      // Hai lần liền không phát được (mạng chặn YouTube) thì thôi tự phát, chỉ lướt ảnh bìa.
      dt.loi = (dt.loi || 0) + 1; if (dt.loi >= 2) dt.video = false;
      dtCapNhat();
    }, 8000);
  }
  function dtDangPhat(yt) {
    if (dt.yt !== yt || yt.dangPhat) return;
    yt.dangPhat = true; dt.loi = 0; dtVeTieng();
    // YouTube hiện nút (ⓘ, lùi, dừng, tới) vài giây đầu khi video bắt đầu chạy: giữ ảnh bìa đến khi các nút đó tự ẩn rồi mới hiện video.
    if (yt.v) $("dt-video").classList.add("hien");
    else setTimeout(() => { if (dt.yt === yt) $("dt-video").classList.add("hien"); }, 4500);
    $("dt-man").classList.add("co-video");
    if (!yt.tieng && dtDuocPhat()) dtThuTieng();
    if (!dtDuocPhat() && !yt.tieng) { if (yt.v) yt.v.pause(); else { yt.lenh = "pauseVideo"; dtLenh("pauseVideo"); } }
    dtCapNhat();
  }
  // Nghe trạng thái từ khung YouTube của điện thoại: đang phát, đã hết, đã bật tiếng hay chưa.
  window.addEventListener("message", e => {
    if (e.origin !== YT || !dt.yt?.f || e.source !== dt.yt.f.contentWindow || typeof e.data !== "string") return;
    let tin; try { tin = JSON.parse(e.data); } catch { return; }
    const info = tin?.info; if (!info) return;
    if (info.playerState === 1) dtDangPhat(dt.yt);
    if (dt.thu && dt.thu.yt === dt.yt) {
      if (info.muted === false) dt.thu.moTieng = true;
      // Trình duyệt chặn tiếng (dừng video lại): trả về không tiếng và phát tiếp ngay.
      if (info.playerState === 2 && !dt.tieng) { dt.thu = null; dtLenh("mute"); dtLenh("playVideo"); }
    }
    if (info.playerState === 0 && dt.tieng) dtXoay(1);
    // Đang nghe có tiếng: video gần hết thì chuyển sang mẫu kế (video không tiếng thì tự lặp, nên phải tự canh).
    if (dt.tieng && dt.yt && !dt.yt.daHet && typeof info.currentTime === "number" && typeof info.duration === "number" && info.duration > 3 && info.duration - info.currentTime < 0.7) {
      dt.yt.daHet = true; dtXoay(1);
    }
    if (info.muted === false && dt.tieng) clearTimeout(dt.henTieng);
  });
  // Thử bật tiếng tự động một lần: trình duyệt nào cho phép (khách hay nghe video trên trang) thì có tiếng ngay khi vào trang.
  function dtThuTieng() {
    if (dt.tieng || dt.tatTay || laIOS || dt.daThu || !dt.yt) return;
    dt.daThu = true; const yt = dt.yt;
    if (yt.v) {
      yt.v.muted = false;
      yt.v.play().then(() => { if (!yt.v.muted && !yt.v.paused && dt.yt === yt && !dt.tieng) { yt.v.loop = false; dtTiengDuoc(); } }).catch(() => { if (dt.tieng) return; yt.v.muted = true; yt.v.play().catch(() => {}); });
      return;
    }
    dt.thu = { yt, moTieng: false };
    dtLenh("unMute"); dtLenh("setVolume", [100]);
    setTimeout(() => {
      const t = dt.thu; dt.thu = null;
      if (!t || dt.yt !== t.yt) return;
      if (dt.tieng) return;                                      // khách đã tự bấm bật tiếng trong lúc thử
      if (t.moTieng) dtTiengDuoc(); else { dtLenh("mute"); dtLenh("playVideo"); }
    }, 1300);
  }
  function dtTiengDuoc() {
    dt.tieng = true; if (dt.yt) dt.yt.tieng = true;
    dtVeTieng(); dtCapNhat();
  }
  function dtVeTieng() {
    $("dt-nghe-chu").textContent = dt.tieng ? "Tắt tiếng" : "Bật tiếng";
    $("dt-man").classList.toggle("co-tieng", dt.tieng);
    $("dt-mo").setAttribute("aria-label", `${dt.tieng ? "Tắt tiếng" : "Bật tiếng"} video mẫu ${dt.ds[dt.i].ma}: ${dt.ds[dt.i].ten}`);
    $("dt-mo").setAttribute("aria-pressed", String(dt.tieng));
  }
  function dtBatTatTieng() {
    const m = dt.ds[dt.i];
    if (dt.tieng) {
      dt.tieng = false; dt.tatTay = true;
      if (dt.yt?.dangPhat && dt.video) { if (dt.yt.v) dt.yt.v.muted = true; else dtLenh("mute"); dt.yt.tieng = false; } else dtGoVideo();
    } else {
      // iPhone không cho trang tự phát video YouTube có tiếng: mở khung xem lớn để Quý khách hàng bấm phát.
      if (laIOS && !m.doan && !(dt.yt && dt.yt.ma === m.ma && dt.yt.dangPhat)) { dtGoVideo(); moXem(dt.ds, m.ma); return; }
      dt.tieng = true; dt.thu = null; dungTatCa();
      if (dt.yt && dt.yt.ma === m.ma && dt.yt.dangPhat) {
        if (dt.yt.v) { dt.yt.v.muted = false; dt.yt.v.loop = false; dt.yt.v.play().catch(() => {}); }
        else {
          dtLenh("unMute"); dtLenh("setVolume", [100]); dtLenh("playVideo");
          // iPhone có thể không cho bật tiếng hộ: nếu 1,5 giây sau YouTube vẫn báo đang tắt tiếng thì mở khung xem lớn.
          clearTimeout(dt.henTieng);
          if (laIOS) dt.henTieng = setTimeout(() => { if (dt.tieng && dt.yt?.ma === m.ma) { dt.tieng = false; dtVeTieng(); dtLenh("mute"); moXem(dt.ds, m.ma); } }, 1500);
        }
        dt.yt.tieng = true;
      } else dtNapVideo(m, true);
    }
    dtVeTieng(); dtCapNhat();
  }
  // ---------- Tim, bong bóng bình luận, mũi tên chia sẻ bay lên từ các nút bên phải điện thoại ----------
  // Chỉ là hiệu ứng trang trí, không kèm số lượt.
  function bayLen(loai) {
    const hop = $("dt-bay-len"); if (!hop || hop.childElementCount > 26) return;
    const nut = { tim: "dt-tim", "binh-luan": "dt-hoi", "chia-se": "dt-chia-se" }[loai], b = $(nut), ray = b.parentElement;
    const x = ray.offsetLeft + b.offsetLeft + b.offsetWidth / 2, y = ray.offsetTop + b.offsetTop + 14;
    const e = tao("span", `bay-len bay-${loai}`);
    e.style.left = `${x - 11}px`; e.style.top = `${y - 11}px`;
    e.style.setProperty("--x", `${Math.round(-70 + Math.random() * 60)}px`);
    e.style.setProperty("--y", `${Math.round(-150 - Math.random() * 110)}px`);
    e.style.setProperty("--r", `${Math.round((Math.random() - 0.5) * 60)}deg`);
    e.style.setProperty("--t", `${(1.5 + Math.random() * 0.9).toFixed(2)}s`);
    e.style.setProperty("--s", (0.7 + Math.random() * 0.6).toFixed(2));
    if (loai === "tim") e.style.setProperty("--c", ["#ff4d6d", "#ff8fa3", "#f2b01e", "#ff4d6d"][Math.floor(Math.random() * 4)]);
    hop.append(e); e.addEventListener("animationend", () => e.remove(), { once: true });
  }
  function batBay() {
    if (itChuyenDong || tietKiem || mayYeu) return;   // tim/bình luận bay lên tự động chỉ để trang trí: tắt trên máy yếu
    setInterval(() => {
      if (!dtDuocPhat()) return;                                   // dừng khi khách cuộn đi, mở khung xem hay bấm "Dừng chuyển động"
      if (Math.random() < 0.8) bayLen("tim");
      if (Math.random() < 0.35) bayLen("binh-luan");
      if (Math.random() < 0.35) bayLen("chia-se");
    }, 520);   // thưa hơn trước (220ms) để máy đỡ phải dựng lại trang liên tục
  }
  // Số dưới nút: từ 10.000 trở lên ghi gọn kiểu 10,1K (dấu phẩy thập phân như tiếng Việt), nhỏ hơn thì ghi đủ (2.123).
  const soNut = so => (so >= 10000 ? `${(Math.floor(so / 100) / 10).toFixed(1).replace(/\.0$/, "").replace(".", ",")}K` : new Intl.NumberFormat("vi-VN").format(so));
  function dtSoLieu(m) {
    const s = m.so_lieu || {}, dat = (id, v) => { $(id).textContent = soThat(v) ? soNut(soThat(v)) : ""; };
    dat("dt-so-tim", s.tim); dat("dt-so-bl", s.binh_luan); dat("dt-so-cs", s.chia_se);
    const nguon = $("dt-nguon"), coSo = soThat(s.xem) || soThat(s.tim);
    nguon.hidden = !coSo;
    if (coSo) {
      nguon.replaceChildren(`Số liệu bài đăng thật của mẫu ${m.ma} trên ${s.nen_tang || "mạng xã hội"}${s.ngay ? `, ngày ${s.ngay}` : ""}`);
      if (/^https:\/\//.test(s.nguon || "")) { const a = tao("a", "", "Xem bài đăng"); a.href = s.nguon; a.target = "_blank"; a.rel = "noopener"; nguon.append(" · ", a); }
    }
    // Nhãn nền tảng cạnh máy: mẫu có số lượt xem thật thì ghi số đó.
    document.querySelectorAll(".dt-nen-tang li").forEach(li => {
      li.textContent = li.dataset.ten || (li.dataset.ten = li.textContent);
      if (soThat(s.xem) && (s.nen_tang || "").toLowerCase() === li.dataset.ten.toLowerCase()) li.textContent = `${li.dataset.ten} · ${rutGon(soThat(s.xem))} lượt xem`;
    });
  }
  function dtHien(viTri, huong = 1) {
    const n = dt.ds.length; if (!n) return;
    viTri = ((viTri % n) + n) % n;
    const cu = dt.canh.get(dt.ds[dt.i].ma), m = dt.ds[viTri], moi = dtCanh(m);
    dungThu($("dt-phat"));
    if (cu && cu !== moi) {
      cu.classList.remove("hien", "ra-tren", "ra-duoi"); cu.classList.add(huong > 0 ? "ra-tren" : "ra-duoi");
      moi.classList.remove("ra-tren", "ra-duoi"); moi.classList.add(huong > 0 ? "cho-duoi" : "cho-tren");
      void moi.offsetWidth;                                   // để trình duyệt nhận vị trí xuất phát trước khi trượt
      moi.classList.remove("cho-duoi", "cho-tren");
    }
    moi.classList.add("hien");
    dt.i = viTri;
    const ke = dt.ds[(viTri + 1) % n];
    dtCanh(ke);                                                // tải sẵn ảnh mẫu kế tiếp
    // Chỉ giữ 3 cảnh: mẫu vừa trôi ra, mẫu đang xem, mẫu kế tiếp. Gỡ cảnh cũ hơn để trả bộ nhớ ảnh (nhất là máy yếu).
    const giu = new Set([cu && dt.ds.find(x => dt.canh.get(x.ma) === cu)?.ma, m.ma, ke.ma]);
    for (const [ma, c] of dt.canh) if (!giu.has(ma)) { const a = c.querySelector("img"); if (a) a.removeAttribute("src"); c.remove(); dt.canh.delete(ma); }
    $("dt-ma").textContent = m.ma; $("dt-dem").textContent = `${viTri + 1}/${n}`;
    const cham = $("dt-cham");
    if (cham) {
      if (cham.childElementCount !== n) cham.replaceChildren(...dt.ds.map(() => tao("i")));
      [...cham.children].forEach((c, k) => c.classList.toggle("hien", k === viTri));
    }
    // Hai máy hai bên: ảnh bìa của mẫu trước và mẫu kế.
    [["dt-ben-trai", dt.ds[(viTri - 1 + n) % n]], ["dt-ben-phai", dt.ds[(viTri + 1) % n]]].forEach(([id, mb]) => {
      const anh = $(id).querySelector("img"), src = `/anh-mau/nho/${encodeURIComponent(mb.ma)}.webp`;
      if (anh.getAttribute("src") !== src) { anh.classList.remove("doi"); void anh.offsetWidth; anh.src = src; anh.classList.add("doi"); }
    });
    $("dt-nganh").textContent = m.nhom; $("dt-ten").textContent = m.ten; $("dt-kieu").textContent = m.kieu || "";
    $("dt-tim").classList.toggle("da-thich", !!timCuaKhach[m.ma]); $("dt-tim").setAttribute("aria-label", "Thả tim cho mẫu này");
    dtSoLieu(m); if (!soThat(m.so_lieu?.tim) && timCuaKhach[m.ma]) $("dt-so-tim").textContent = timCuaKhach[m.ma];
    dtVeTieng();
    [$("dt-duoi"), $("dt-man")].forEach(e => { e.classList.remove("doi"); void e.offsetWidth; e.classList.add("doi"); });
    if (dt.video || dt.tieng) dtNapVideo(m, dt.tieng); else dtGoVideo();
    dtCapNhat();
  }
  function dtCapNhat() {
    clearTimeout(dt.hen);
    const tien = $("dt-tien"), duoc = dtDuocPhat(), luot = dtTuLuot(), choVideo = dt.yt && !dt.yt.dangPhat;
    $("dt-man").classList.toggle("dung", !luot);
    // Đang mở khung xem lớn, menu, hay cuộn khỏi màn hình đầu: tạm dừng video trên máy.
    if (dt.yt?.dangPhat) {
      if (dt.yt.v) { if (duoc) dt.yt.v.play().catch(() => {}); else dt.yt.v.pause(); }
      else { const lenh = duoc ? "playVideo" : "pauseVideo"; if (dt.yt.lenh !== lenh) { dt.yt.lenh = lenh; dtLenh(lenh); } }   // chỉ gửi khi đổi trạng thái, để YouTube không hiện lại nút của nó
    }
    tien.classList.remove("chay"); void tien.offsetWidth;
    if (luot) {
      // Video chưa chạy được (mạng chậm, bị chặn): vẫn chờ một lượt video rồi xoay tiếp, không đứng im.
      const tg = dt.yt?.dangPhat || choVideo ? DT_VIDEO : DT_LUOT;
      tien.style.animationDuration = `${tg}ms`; tien.classList.add("chay");
      dt.hen = setTimeout(() => dtXoay(1), tg);
    }
  }
  // Mỗi lần bấm tim là một tim của chính khách (như thả tim khi xem live): số dưới nút đếm tim khách đã thả, không phải số giả.
  const timCuaKhach = {};
  function dtThaTim() {
    const nut = $("dt-tim"), m = dt.ds[dt.i];
    timCuaKhach[m.ma] = (timCuaKhach[m.ma] || 0) + 1;
    nut.classList.add("da-thich"); nut.setAttribute("aria-label", `Thả tim cho mẫu này, Quý khách hàng đã thả ${timCuaKhach[m.ma]} tim`);
    if (!soThat(m.so_lieu?.tim)) { const so = $("dt-so-tim"); so.textContent = timCuaKhach[m.ma]; so.classList.remove("nay"); void so.offsetWidth; so.classList.add("nay"); }
    const cong = tao("span", "tim-cong", "+1"); $("dt-tim-bay").append(cong); setTimeout(() => cong.remove(), 900);
    if (itChuyenDong) return;
    const bay = $("dt-tim-bay");
    for (let k = 0; k < 6; k += 1) {
      const t = tao("span", "tim-bay"); t.style.setProperty("--x", `${Math.round((Math.random() - 0.5) * 120)}px`);
      t.style.setProperty("--r", `${Math.round((Math.random() - 0.5) * 50)}deg`); t.style.setProperty("--d", `${k * 70}ms`);
      t.style.setProperty("--c", Math.random() > 0.35 ? "#ff4d6d" : "#f2b01e");
      bay.append(t); setTimeout(() => t.remove(), 1700);
    }
  }
  async function dtChiaSe() {
    const m = dt.ds[dt.i], url = `${location.origin}/#mau`;
    const bao = chu => { const b = $("dt-bao"); b.textContent = chu; b.classList.add("hien"); clearTimeout(b._h); b._h = setTimeout(() => b.classList.remove("hien"), 2200); };
    try {
      if (navigator.share) { await navigator.share({ title: document.title, text: `Video mẫu ${m.ma}: ${m.ten}`, url }); return; }
      await navigator.clipboard.writeText(url); bao("Đã chép liên kết trang");
    } catch (err) { if (err?.name !== "AbortError") bao("Chưa chia sẻ được. Quý khách hàng vui lòng thử lại."); }
  }
  let dtBatDauVideo = () => {};
  // ---------- Xoay cụm điện thoại sang mẫu trước / kế ----------
  let dangXoay = false, choXoay = 0;   // choXoay: hướng khách vừa vuốt/bấm trong lúc máy đang xoay, làm ngay khi xoay xong
  const dtTuThe = dx => `perspective(1100px) translateX(${dx * .55}px) rotateY(${dx * .16}deg)`;
  function dtXoay(huong, dx = 0) {
    const may = $("dien-thoai");
    may.style.transform = "";
    if (dangXoay) { choXoay = huong; return; }
    if (itChuyenDong || !may.animate) { dtHien(dt.i + huong, huong); return; }
    dangXoay = true;
    const lech = `perspective(1100px) translateX(${-huong * 58}%) rotateY(${-huong * 78}deg) scale(.84)`;
    const vao = `perspective(1100px) translateX(${huong * 58}%) rotateY(${huong * 78}deg) scale(.84)`;
    may.animate([{ transform: dtTuThe(dx), opacity: 1 }, { transform: lech, opacity: .2 }], { duration: 210, easing: "cubic-bezier(.45,0,.9,.6)" }).finished
      .then(() => {
        dtHien(dt.i + huong, huong);
        ["dt-ben-trai", "dt-ben-phai"].forEach(id => $(id).querySelector("img")?.animate(
          [{ transform: `rotateY(${-huong * 70}deg)`, opacity: .35 }, { transform: "none", opacity: 1 }], { duration: 460, easing: "cubic-bezier(.2,.8,.2,1)" }));
        return may.animate([{ transform: vao, opacity: .2 }, { transform: "none", opacity: 1 }], { duration: 430, easing: "cubic-bezier(.16,.84,.24,1)" }).finished;
      })
      .catch(() => {})
      .finally(() => { dangXoay = false; if (choXoay) { const h = choXoay; choXoay = 0; dtXoay(h); } });
  }
  function veDienThoai() {
    // Cùng thứ tự với thư viện: mẫu đầu (ST025), rồi lần lượt từng nhóm ngành theo mau.json.
    dt.ds = dauTien(cauHinh.mau);
    if (!dt.ds.length) return;
    dtHien(0); batBay();
    $("dt-mo").addEventListener("click", () => { if (dt.vuot) { dt.vuot = false; return; } dtBatTatTieng(); });
    $("dt-xem-lon").addEventListener("click", () => { if (dt.tieng) { dt.tieng = false; dtVeTieng(); } dtGoVideo(); moXem(dt.ds, dt.ds[dt.i].ma); });
    $("dt-ben-trai").addEventListener("click", () => dtXoay(-1));
    $("dt-ben-phai").addEventListener("click", () => dtXoay(1));
    $("dt-tim").addEventListener("click", dtThaTim);
    // Tiếng chỉ bật khi khách bấm đúng vào video trên điện thoại hoặc nút "Bật tiếng" (không bật khi chạm chỗ khác).
    const chum = (loai, n) => { if (!itChuyenDong) for (let k = 0; k < n; k += 1) setTimeout(() => bayLen(loai), k * 70); };
    $("dt-hoi").addEventListener("click", () => { chum("binh-luan", 4); chonTuVan(dt.ds[dt.i]); });
    $("dt-chia-se").addEventListener("click", () => { chum("chia-se", 5); dtChiaSe(); });
    const may = $("dien-thoai");
    // Máy tính: rê chuột vào máy thì dừng lướt để xem kỹ mẫu đang hiện.
    may.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") { dt.re = true; dtCapNhat(); } });
    may.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") { dt.re = false; dtCapNhat(); } });
    // Vuốt (điện thoại) hoặc kéo chuột (máy tính) ngang trên cụm máy: máy giữa nghiêng theo tay, thả ra thì cả cụm xoay sang mẫu kế.
    // Vuốt dọc vẫn là cuộn trang (touch-action: pan-y trong CSS).
    const cum = may.closest(".dt-cum") || may;
    let keo = null;
    cum.addEventListener("pointerdown", e => {
      if (e.button > 0) return;
      keo = { x: e.clientX, y: e.clientY, dx: 0, id: e.pointerId, bat: false };
    });
    cum.addEventListener("pointermove", e => {
      if (!keo || e.pointerId !== keo.id) return;
      const dx = e.clientX - keo.x, dy = e.clientY - keo.y;
      if (!keo.bat) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { keo = null; return; }   // khách đang cuộn dọc
        if (Math.abs(dx) < 8) return;
        keo.bat = true; cum.setPointerCapture?.(e.pointerId); cum.classList.add("dang-keo");
      }
      keo.dx = Math.max(-170, Math.min(170, dx));
      may.style.transform = dtTuThe(keo.dx);
    });
    const tha = e => {
      if (!keo || (e && e.pointerId !== keo.id)) return;
      const { dx, bat } = keo; keo = null; cum.classList.remove("dang-keo");
      if (!bat) return;
      dt.vuot = true; setTimeout(() => { dt.vuot = false; }, 350);       // không coi cú vuốt là một lần chạm bật tiếng
      if (Math.abs(dx) > 42) dtXoay(dx < 0 ? 1 : -1, dx);
      else { may.style.transform = ""; if (!itChuyenDong) may.animate?.([{ transform: dtTuThe(dx) }, { transform: "none" }], { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" }); }
    };
    cum.addEventListener("pointerup", tha); cum.addEventListener("pointercancel", tha);
    cum.addEventListener("click", e => { if (dt.vuot) { e.stopPropagation(); e.preventDefault(); } }, true);
    cum.addEventListener("dragstart", e => e.preventDefault());
    // Bàn phím: đang ở trong cụm máy thì mũi tên trái/phải đổi mẫu.
    cum.addEventListener("keydown", e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); dtXoay(e.key === "ArrowRight" ? 1 : -1); } });
    if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { dt.trongTam = e.isIntersecting; dtCapNhat(); }, { threshold: 0.15 }).observe(may);
    document.addEventListener("visibilitychange", dtCapNhat);
    ["xem", "bat-dau-hop", "menu-dt"].forEach(id => $(id)?.addEventListener("close", dtCapNhat));
    // Trang đã rảnh và mạng không tiết kiệm dữ liệu: bắt đầu phát video thật (không tiếng) trên máy.
    const mang = navigator.connection;
    if (!itChuyenDong && !mayYeu && !/(^|-)2g$/.test(mang?.effectiveType || "")) {
      // Phát ngay khi trang dựng xong, để khách vừa vào đã thấy video chạy (và sẵn sàng bật tiếng khi khách chạm).
      dtBatDauVideo = () => { if (dt.video) return; dt.video = true; if (!dt.yt) dtNapVideo(dt.ds[dt.i], dt.tieng); };
      setTimeout(dtBatDauVideo, 300);
    }
  }


  // ---------- Menu đầu trang: "Kiểu video" mở bảng ngành hàng (máy tính), nút Menu mở trang menu (điện thoại) ----------
  function oKieu(nhom) {
    const ds = cauHinh.mau.filter(m => m.nhom === nhom), a = tao("a", "menu-kieu-o"); a.href = "#mau";
    const anh = tao("img"); anh.src = `/anh-mau/nho/${ds[0].ma}.webp`; anh.alt = ""; anh.loading = "lazy"; anh.width = 270; anh.height = 480;
    const chu = tao("span", "menu-kieu-chu"); chu.append(tao("span", "menu-kieu-ten", nhom), tao("span", "menu-kieu-so", `${ds.length} mẫu`));
    a.append(anh, chu);
    // Bấm vào ngành nào thì thư viện mẫu lọc sẵn ngành đó rồi mới cuộn tới.
    a.addEventListener("click", () => { dongMenu(); document.querySelector(`#loc-nganh [data-loc="${CSS.escape(nhom)}"]`)?.click(); });
    return a;
  }
  function dongMenu(traTieuDiem = false) {
    const nut = $("menu-kieu-nut"); if (!nut) return;
    $("menu-kieu").hidden = true; nut.setAttribute("aria-expanded", "false");
    if (traTieuDiem) nut.focus();
    if ($("menu-dt").open) $("menu-dt").close();
  }
  function veMenu() {
    const cacNhom = [...new Set(cauHinh.mau.map(m => m.nhom))];
    $("menu-kieu-luoi").append(...cacNhom.map(oKieu));
    $("menu-dt-kieu").append(...cacNhom.map(oKieu));
    const nut = $("menu-kieu-nut"), hop = $("menu-kieu"), lop = $("menu-co-con");
    const mo = () => { hop.hidden = false; nut.setAttribute("aria-expanded", "true"); };
    // Rê chuột đã mở thì cú bấm ngay sau đó không đóng lại.
    let moBangChuot = false, hen = 0;
    nut.addEventListener("click", () => { clearTimeout(hen); if (hop.hidden) mo(); else if (moBangChuot) moBangChuot = false; else dongMenu(); });
    lop.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") { clearTimeout(hen); hen = setTimeout(() => { if (hop.hidden) { moBangChuot = true; mo(); } }, 120); } });
    lop.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") { clearTimeout(hen); hen = setTimeout(() => dongMenu(), 260); } });
    lop.addEventListener("keydown", e => { if (e.key === "Escape" && !hop.hidden) { e.stopPropagation(); dongMenu(true); } });
    lop.addEventListener("focusout", e => { if (!lop.contains(e.relatedTarget)) dongMenu(); });
    document.addEventListener("click", e => { if (!hop.hidden && !lop.contains(e.target)) dongMenu(); });
    hop.addEventListener("click", e => { if (e.target.closest("a")) dongMenu(); });
    const hopDt = $("menu-dt");
    $("menu-mo").addEventListener("click", () => { hopDt.showModal(); dtCapNhat(); });
    $("menu-dong").addEventListener("click", () => hopDt.close());
    hopDt.addEventListener("click", e => { if (e.target === hopDt || e.target.closest("a")) hopDt.close(); });
    hopDt.addEventListener("close", () => { dtCapNhat(); if (!document.activeElement || document.activeElement === document.body) $("menu-mo").focus({ preventScroll: true }); });
  }

  // Tên nền tảng trong tiêu đề đổi lần lượt; nhãn nền tảng cạnh điện thoại sáng lên cùng lúc.
  function ganXoay() {
    const chu = [...document.querySelectorAll("#xoay > span")], nhan = [...document.querySelectorAll(".dt-nen-tang li")];
    if (!chu.length) return;
    let dang = 0;
    const dat = moi => {
      chu.forEach((c, k) => { c.classList.toggle("hien", k === moi); c.classList.toggle("ra", k === dang && k !== moi); });
      nhan.forEach((p, k) => p.classList.toggle("dang", k === moi));
      dang = moi;
    };
    dat(0);
    if (itChuyenDong) return;
    setInterval(() => { if (!tamDung && !document.hidden) dat((dang + 1) % chu.length); }, 2600);
  }

  // ---------- Đánh giá của khách: chỉ đánh giá thật trong danh_gia.json (máy chủ đã lọc); không có thì phần này ẩn ----------
  function veSao(so) {
    const w = tao("span", "sao"); w.setAttribute("role", "img"); w.setAttribute("aria-label", `${so} trên 5 sao`);
    for (let k = 0; k < 5; k += 1) { const s = tao("span", k < so ? "sao-1 day" : "sao-1"); s.style.setProperty("--k", k); w.append(s); }
    return w;
  }
  function veDanhGia() {
    const ds = cauHinh.danh_gia || [];
    $("danh-gia").hidden = !ds.length; if (!ds.length) return;
    const tb = ds.reduce((t, d) => t + d.sao, 0) / ds.length;
    const diem = tao("p", "dg-diem"); diem.append(tao("strong", "", tb.toLocaleString("vi-VN", { maximumFractionDigits: 1 })), "/5");
    $("dg-tong").replaceChildren(diem, veSao(Math.round(tb)), tao("p", "dg-so", `${ds.length} đánh giá từ khách đã làm video`));
    $("dg-ds").replaceChildren(...ds.map((d, i) => {
      const li = tao("li"); li.style.setProperty("--i", i);
      const ai = tao("p", "dg-ai"); ai.append(tao("strong", "", d.ten)); if (d.doanh_nghiep) ai.append(tao("span", "", d.doanh_nghiep));
      li.append(veSao(d.sao), tao("blockquote", "", d.noi_dung), ai);
      const duoi = tao("p", "dg-duoi");
      if (d.ngay) duoi.append(d.ngay);
      const m = mau[d.ma_mau];
      if (m) { const b = tao("button", "nut-chu", `Xem video ${m.ma}`); b.type = "button"; b.addEventListener("click", () => moXem(cauHinh.mau, m.ma)); duoi.append(b); }
      if (d.nguon) { const a = tao("a", "", "Xem đánh giá gốc"); a.href = d.nguon; a.target = "_blank"; a.rel = "noopener"; duoi.append(a); }
      if (duoi.childNodes.length) li.append(duoi);
      return li;
    }));
  }

  // ---------- Hiệu ứng khi cuộn: mỗi phần xuất hiện theo một kiểu riêng, chỉ một lần ----------
  // Không có JavaScript hoặc khách chọn giảm chuyển động thì mọi thứ hiện sẵn, không ẩn gì.
  function tachChu(el) {
    let i = 0;
    [...el.childNodes].forEach(n => {
      if (n.nodeType !== 3) return;
      const manh = n.textContent.split(/(\s+)/).map(t => {
        if (!t) return null;
        if (/^\s+$/.test(t)) return document.createTextNode(t);
        const s = tao("span", "tu", t); s.style.setProperty("--i", i); i += 1; return s;
      }).filter(Boolean);
      n.replaceWith(...manh);
    });
  }
  function ganHieuUng() {
    if (itChuyenDong || !("IntersectionObserver" in window)) return;
    document.documentElement.classList.add("hieu-ung");
    // Tiêu đề lớn: tách từng chữ (giữ cho các lớp hiệu ứng cũ); màn mở đầu hiện nay do can-doi.css điều khiển theo từng dòng.
    let thuTu = 0;
    document.querySelectorAll("#tieu-de-chinh .h1-dong").forEach(dong => {
      // Dòng "chất lượng cao" giữ nguyên một khối để dải màu chạy liền suốt cả dòng.
      const chu = dong.textContent.trim(), tu = dong.classList.contains("h1-nen") ? [chu] : chu.split(/\s+/);
      dong.replaceChildren(...tu.flatMap((t, k) => { const ngoai = tao("span", "h1-tu"), trong = tao("span", "", t); trong.dataset.chu = t; trong.style.setProperty("--i", thuTu); thuTu += 1; ngoai.append(trong); return k ? [" ", ngoai] : [ngoai]; }));
    });
    ["mau", "ve-b-productions", "danh-gia", "tu-van", "goc-chia-se"].forEach(id => { const h = $(id)?.querySelector("h2"); if (h) { tachChu(h); h.dataset.lo = ""; } });
    document.querySelectorAll("#luoi-mau, #loc, .nang-luc-goc, .thuong-hieu-dau, .so-sanh-bang, .so-sanh-chan, .tu-van-hop, .tv-xem-truoc, .bai-viet-luoi, .cam-ket-ds, .dg-ds, .dg-tong").forEach(e => { e.dataset.lo = ""; });
    const qs = new IntersectionObserver(ds => ds.forEach(e => { if (e.isIntersecting) { e.target.classList.add("lo"); qs.unobserve(e.target); } }),
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    document.querySelectorAll("[data-lo]").forEach(e => qs.observe(e));
  }

  // Máy tính: ở màn hình đầu, tiêu đề và cụm ba máy xoay theo con trỏ chuột (hướng cạnh của chữ nổi cũng đổi theo).
  function gan3D() {
    if (itChuyenDong || mayYeu || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const san = $("mo-dau"); let khung = 0, x = 0, y = 0;
    san.addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse") return;
      const r = san.getBoundingClientRect(); x = (e.clientX - r.left) / r.width * 2 - 1; y = (e.clientY - r.top) / r.height * 2 - 1;
      if (!khung) khung = requestAnimationFrame(() => { khung = 0; san.classList.add("theo-chuot"); san.style.setProperty("--mx", x.toFixed(3)); san.style.setProperty("--my", y.toFixed(3)); });
    }, { passive: true });
    san.addEventListener("pointerleave", () => { san.style.setProperty("--mx", "0"); san.style.setProperty("--my", "0"); });
  }

  // Máy tính: thẻ mẫu nghiêng theo chuột, có vệt sáng lướt trên mặt thẻ.
  function ganNghieng() {
    if (itChuyenDong || mayYeu || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const ray = $("luoi-mau"); let dang = null, khung = 0;
    const tha = () => { if (dang) { dang.classList.remove("nghieng"); dang.style.removeProperty("--rx"); dang.style.removeProperty("--ry"); dang = null; } };
    ray.addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse") return;
      const li = e.target.closest("#luoi-mau > li");
      if (li !== dang) { tha(); dang = li; }
      if (!li || khung) return;
      khung = requestAnimationFrame(() => {
        khung = 0; if (!dang) return;
        const r = dang.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        dang.style.setProperty("--rx", `${((0.5 - y) * 9).toFixed(2)}deg`); dang.style.setProperty("--ry", `${((x - 0.5) * 11).toFixed(2)}deg`);
        dang.style.setProperty("--gx", `${(x * 100).toFixed(0)}%`); dang.style.setProperty("--gy", `${(y * 100).toFixed(0)}%`);
        dang.classList.add("nghieng");
      });
    });
    ray.addEventListener("pointerleave", tha);
  }

  // Điện thoại: thẻ đang nằm giữa màn hình sáng viền và ảnh phóng nhẹ, để lướt thư viện có cảm giác "đang chạy".
  let qsGiua = null;
  function quanSatGiua() {
    if (itChuyenDong || !("IntersectionObserver" in window) || matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    qsGiua?.disconnect();
    qsGiua = new IntersectionObserver(ds => ds.forEach(e => e.target.classList.toggle("giua", e.isIntersecting)), { rootMargin: "-42% 0px -42% 0px" });
    [...$("luoi-mau").children].forEach(li => qsGiua.observe(li));
  }

  // ---------- Khung video minh họa ở phần để lại thông tin: tên sản phẩm khách gõ hiện ngay trên khung ----------
  const XT_MAC_DINH = "Sản phẩm của Quý khách hàng";
  let xtHen = 0, xtVong = 0;
  function xemTruocMau(m) {
    document.querySelectorAll(".tv-xt-anh").forEach(a => { a.src = a.closest(".tv-mini") ? `/anh-mau/nho/${m.ma}.webp` : `/anh-mau/${m.ma}.webp`; });
    clearInterval(xtVong);
  }
  function ganXemTruoc() {
    const o = $("tv-san-pham");
    const dat = () => {
      const chu = o.value.trim().slice(0, 48) || XT_MAC_DINH;
      document.querySelectorAll(".tv-xt-chu").forEach(p => {
        const s = p.firstElementChild; if (s.textContent === chu) return;
        s.textContent = chu; p.classList.remove("doi"); void p.offsetWidth; p.classList.add("doi");
      });
    };
    o.addEventListener("input", () => { clearTimeout(xtHen); xtHen = setTimeout(dat, 60); });
    $("form-tu-van").addEventListener("reset", () => setTimeout(dat, 0));
    if (itChuyenDong) return;
    // Chưa chọn mẫu nào thì khung đổi lần lượt vài mẫu nổi bật.
    const ds = maNoiBat.map(ma => mau[ma]).filter(Boolean); let i = 0;
    if (ds.length > 1) xtVong = setInterval(() => { if (tamDung || document.hidden || mauTuVan) return; i = (i + 1) % ds.length;
      document.querySelectorAll(".tv-xt-anh").forEach(a => { a.src = a.closest(".tv-mini") ? `/anh-mau/nho/${ds[i].ma}.webp` : `/anh-mau/${ds[i].ma}.webp`; }); }, mayYeu ? 7000 : 4200);
  }

  function veMau() {
    veTuong();
    document.addEventListener("visibilitychange", () => {
      document.body.classList.toggle("tam-dung-nen", document.hidden);
      if (document.hidden) dungTatCa(); else chayLaiDoan();
    });
    const cacNhom = [...new Set(cauHinh.mau.map(m => m.nhom))];
    const them = tao("button", "loc-them", "Ngành hàng"); them.type = "button"; them.id = "loc-them";
    them.setAttribute("aria-expanded", "false"); them.setAttribute("aria-controls", "loc-nganh");
    function dongNganh() { $("loc-nganh").hidden = true; them.setAttribute("aria-expanded", "false"); }
    function taoLoc(n) {
      const b = tao("button", "", n === "noi-bat" ? "Mẫu nổi bật" : n || "Tất cả"); b.type = "button"; b.dataset.loc = n;
      b.setAttribute("aria-pressed", String(n === locNhom));
      b.addEventListener("click", () => {
        locNhom = n;
        document.querySelectorAll("[data-loc]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        const laNganh = !!n && n !== "noi-bat";
        them.classList.toggle("co-chon", laNganh);
        them.setAttribute("aria-label", laNganh ? `Ngành hàng, đang chọn ${n}` : "Chọn ngành hàng");
        $("loc-dang-chon").textContent = laNganh ? `Đang xem: ${n}` : ""; $("loc-dang-chon").hidden = !laNganh;
        dongNganh(); veRay();
        if (laNganh) them.focus({ preventScroll: true });
      });
      return b;
    }
    ["", "noi-bat"].forEach(n => $("loc").append(taoLoc(n)));
    $("loc").append(them);
    cacNhom.forEach(n => $("loc-nganh").append(taoLoc(n)));
    them.addEventListener("click", () => { const mo = $("loc-nganh").hidden; $("loc-nganh").hidden = !mo; them.setAttribute("aria-expanded", String(mo)); });
    them.addEventListener("keydown", e => { if (e.key === "Escape") dongNganh(); });
    $("loc-nganh").addEventListener("keydown", e => { if (e.key === "Escape") { dongNganh(); them.focus(); } });
    const ray = $("luoi-mau");
    $("xem-them-mau").addEventListener("click", () => {
      ray.classList.remove("thu-gon"); $("xem-them-mau").hidden = true;
      ray.children[6]?.querySelector("button")?.focus({ preventScroll: true });
    });
    function cuonMau(huong) {
      const cacThe = [...ray.children];
      const buoc = cacThe.length > 1 ? cacThe[1].offsetLeft - cacThe[0].offsetLeft : ray.clientWidth;
      ray.scrollBy({ left: huong * buoc, behavior: itChuyenDong ? "instant" : "smooth" });
    }
    $("ray-truoc").addEventListener("click", () => cuonMau(-1));
    $("ray-sau").addEventListener("click", () => cuonMau(1));
    ray.addEventListener("scroll", capNhatNutRay, { passive: true }); window.addEventListener("resize", capNhatNutRay);
    veRay();
  }

  // ---------- Thanh nút dưới đáy màn hình điện thoại ----------
  let capNhatThanhDuoi = () => {};
  function ganThanhDuoi() {
    const thanh = $("thanh-duoi"), nutDau = document.querySelector(".hero-footer .hang-nut");
    if (!("IntersectionObserver" in window) || !nutDau) return;
    let quaNutDau = false, thayForm = false;
    capNhatThanhDuoi = () => {
      thanh.hidden = !(quaNutDau && !thayForm && !$("mo-dau").hidden);
      document.body.classList.toggle("co-thanh-duoi", !thanh.hidden);
    };
    new IntersectionObserver(([e]) => { quaNutDau = !e.isIntersecting && e.boundingClientRect.top < 0; capNhatThanhDuoi(); }).observe(nutDau);
    new IntersectionObserver(([e]) => { thayForm = e.isIntersecting; capNhatThanhDuoi(); }).observe($("tu-van"));
  }

  // ---------- Trình xem video ----------
  let dsXem = [], viTriXem = 0, kieuCho = "", xemPlayer = null;
  function xoaPlayerXem() {
    if (!xemPlayer) return;
    xemPlayer.hen.forEach(clearTimeout);
    xemPlayer.frame.remove(); xemPlayer = null;
  }
  window.addEventListener("message", e => {
    if (e.origin !== YT || !xemPlayer || e.source !== xemPlayer.frame.contentWindow) return;
    let tin; try { tin = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
    const p = xemPlayer;
    if (tin?.event === "onError") {
      p.khung.classList.remove("xem-san-sang");
      p.trangThai.textContent = "Chưa phát được video. Quý khách hàng có thể thử lại hoặc mở trên YouTube.";
      p.phat.textContent = "Thử phát lại";
      xoaPlayerXem(); return;
    }
    if (tin?.event === "onReady" || typeof tin?.info?.playerState === "number") {
      p.hen.forEach(clearTimeout); p.sanSang = true;
      p.khung.classList.add("xem-san-sang");
      p.frame.tabIndex = 0; p.frame.removeAttribute("aria-hidden");
      if (document.activeElement === p.phat) p.frame.focus({ preventScroll: true });
    }
  });
  function veXem() {
    xoaPlayerXem();
    const m = dsXem[viTriXem], khung = $("xem-khung");
    $("xem-ma").textContent = m.ma; $("xem-ten").textContent = m.ten;
    $("xem-dem").textContent = `Mẫu ${viTriXem + 1} trên ${dsXem.length}`;
    $("xem-nganh").textContent = m.nhom || "Video mẫu";
    $("xem-kieu").textContent = m.kieu || "";
    $("xem-ngoai").href = `https://www.youtube.com/watch?v=${encodeURIComponent(m.id)}`;
    khung.classList.remove("xem-san-sang"); khung.style.backgroundImage = "";
    const bia = khungAnh(m), duPhong = tao("div", "xem-du-phong"), phat = tao("button", "xem-phat", "Phát video"), trangThai = tao("p");
    bia.classList.add("xem-poster"); bia.querySelector("img").loading = "eager";
    phat.type = "button"; trangThai.setAttribute("role", "status");
    duPhong.append(phat, trangThai); khung.replaceChildren(bia, duPhong);
    const nap = () => {
      xoaPlayerXem(); khung.classList.remove("xem-san-sang");
      trangThai.textContent = "Đang tải video…";
      const f = tao("iframe");
      f.tabIndex = -1; f.setAttribute("aria-hidden", "true");
      f.referrerPolicy = "strict-origin-when-cross-origin";
      f.src = `${YT}/embed/${encodeURIComponent(m.id)}?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
      f.title = `Video mẫu ${m.ma}: ${m.ten}`; f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen"; f.allowFullscreen = true;
      const p = { frame: f, khung, trangThai, phat, sanSang: false, hen: [] }; xemPlayer = p;
      const hoi = () => { if (xemPlayer !== p || !f.isConnected) return; try { f.contentWindow.postMessage(JSON.stringify({ event: "listening", id: "popup", channel: "widget" }), YT); } catch { /* frame closed */ } };
      f.addEventListener("load", () => { hoi(); p.hen.push(setTimeout(hoi, 800), setTimeout(hoi, 2500)); }, { once: true });
      p.hen.push(setTimeout(() => {
        if (xemPlayer !== p || p.sanSang) return;
        trangThai.textContent = "Video chưa tải được. Quý khách hàng có thể thử lại hoặc mở trên YouTube.";
        phat.textContent = "Thử phát lại";
      }, 8000));
      khung.append(f);
    };
    phat.addEventListener("click", nap); nap();
    $("xem-truoc").disabled = viTriXem === 0; $("xem-sau").disabled = viTriXem === dsXem.length - 1;
    $("xem-chon").hidden = !$("phieu").hidden || !$("cam-on").hidden || !$("xem-form").hidden;
    $("xem-chi-tiet").hidden = !m.kieu || !$("cam-on").hidden;
  }
  function moXem(ds, ma) { dungTatCa(); dsXem = ds; viTriXem = Math.max(0, ds.findIndex(m => m.ma === ma)); veXem(); if (!$("xem").open) $("xem").showModal(); dtCapNhat(); }
  function chuyenXem(buoc) { const moi = viTriXem + buoc; if (moi < 0 || moi >= dsXem.length) return; viTriXem = moi; veXem(); }
  function ganXem() {
    const hop = $("xem"); let batDauX = null;
    $("xem-dong").addEventListener("click", () => hop.close());
    $("xem-truoc").addEventListener("click", () => chuyenXem(-1)); $("xem-sau").addEventListener("click", () => chuyenXem(1));
    hop.addEventListener("close", () => { xoaPlayerXem(); $("xem-khung").replaceChildren(); requestAnimationFrame(chayLaiDoan); });
    hop.addEventListener("click", e => { if (e.target === hop) hop.close(); });
    // Đang gõ trong form thì phím mũi tên và vuốt ngang là để sửa chữ, không phải để đổi mẫu.
    const trongForm = e => e.target.closest?.("#xem-form, input, textarea");
    hop.addEventListener("keydown", e => { if (trongForm(e)) return; if (e.key === "ArrowLeft") chuyenXem(-1); if (e.key === "ArrowRight") chuyenXem(1); });
    hop.addEventListener("touchstart", e => { batDauX = trongForm(e) ? null : e.touches[0].clientX; }, { passive: true });
    hop.addEventListener("touchend", e => { if (batDauX == null) return; const d = e.changedTouches[0].clientX - batDauX; batDauX = null; if (Math.abs(d) > 60) chuyenXem(d < 0 ? 1 : -1); }, { passive: true });
    $("xem-chon").addEventListener("click", () => {
      const vung = $("xem-form");
      if (!vung.hidden) { vung.querySelector("input, button")?.focus(); return; }
      vung.replaceChildren(formNhanh({ tieuDe: "Nhận phương án và báo giá theo mẫu này", nutGui: "Gửi cho tôi phương án và báo giá", layMau: () => dsXem[viTriXem] }));
      vung.hidden = false; $("xem-chon").hidden = true;
      if (matchMedia("(min-width: 761px)").matches) {
        const ben = vung.closest(".xem-ben");
        ben.scrollTo({ top: ben.scrollTop + vung.getBoundingClientRect().top - ben.getBoundingClientRect().top, behavior: itChuyenDong ? "instant" : "smooth" });
      } else vung.scrollIntoView({ block: "start", behavior: itChuyenDong ? "instant" : "smooth" });
      vung.querySelector("input")?.focus({ preventScroll: true });
    });
    hop.addEventListener("close", () => { $("xem-form").hidden = true; $("xem-form").replaceChildren(); });
    $("xem-chi-tiet").addEventListener("click", () => {
      kieuCho = dsXem[viTriXem].kieu; hop.close();
      if ($("phieu").hidden) batDau(); else { apDungKieuCho(); doiNhom(nhom.findIndex(n => n.id === cau.find(c => c.so === 11).nhom)); $("cau-11").scrollIntoView({ block: "start" }); }
    });
  }
  // Ghi kiểu video khách vừa chọn trong trình xem vào câu 11 (tối đa hai kiểu, giữ kiểu mới nhất).
  function apDungKieuCho() {
    if (!kieuCho) return;
    const cu = (traLoi["11.kieu"] || []).filter(x => x !== kieuCho);
    ghi("11.kieu", [...cu, kieuCho].slice(-2)); kieuCho = "";
  }

  // ---------- Vẽ phiếu ----------
  const khoa = (c, t) => `${c.so}.${t.id}`;
  const tenLuaChon = lc => typeof lc === "string" ? lc : lc.ten;
  const biBoQua = (c, t) => t.bo_qua_neu && traLoi[`${c.so}.${t.bo_qua_neu.truong}`] === t.bo_qua_neu.la;

  function veTruongChu(c, t) {
    const hop = tao("div", "truong"), id = `o-${c.so}-${t.id}`;
    const nhan = tao("label", "nhan", t.nhan); nhan.htmlFor = id;
    if (!t.bat_buoc) nhan.append(tao("span", "khong-bat-buoc", " (không bắt buộc)"));
    const o = tao(t.kieu === "doan" ? "textarea" : "input");
    o.id = id; if (t.kieu !== "doan") o.type = "text";
    o.placeholder = t.vi_du ? `Ví dụ: ${t.vi_du}` : ""; o.value = traLoi[khoa(c, t)] || ""; o.maxLength = t.kieu === "doan" ? 1500 : 300;
    if (t.kiem_tra === "lien_he") o.autocomplete = "tel";
    if (t.id === "ten") o.autocomplete = "name";
    o.addEventListener("input", () => { ghi(khoa(c, t), o.value.trim()); xoaLoi(c); });
    hop.append(nhan, o); return hop;
  }

  function veTruongChon(c, t) {
    const hop = tao("div", "truong"), k = khoa(c, t), nhieu = t.kieu === "nhieu";
    if (t.nhan) hop.append(tao("span", "nhan", t.nhan));
    const day = tao("div", t.dang_the ? "chon the" : "chon"); day.setAttribute("role", "group");
    if (t.nhan) day.setAttribute("aria-label", t.nhan);
    const nut = [];
    let oRieng = null;

    const dangChon = () => nhieu ? (traLoi[k] || []) : (traLoi[k] ? [traLoi[k]] : []);
    const capNhat = () => {
      const chon = dangChon(), day_ = nhieu && t.toi_da && chon.length + (oRieng && oRieng.value.trim() ? 1 : 0) >= t.toi_da;
      nut.forEach(({ b, ten, the }) => {
        const co = chon.includes(ten);
        b.setAttribute("aria-pressed", String(co)); b.disabled = !co && !!day_;
        if (the) the.classList.toggle("da-chon", co);
      });
    };

    t.lua_chon.forEach(lc => {
      const ten = tenLuaChon(lc), b = tao("button", "", ten); b.type = "button";
      b.addEventListener("click", () => {
        let chon = dangChon();
        if (!nhieu) { chon = chon.includes(ten) ? [] : [ten]; if (oRieng && chon.length) { oRieng.value = ""; ghi(k + ".khac", ""); } }
        else if (chon.includes(ten)) chon = chon.filter(x => x !== ten);
        else if (t.rieng === ten) { chon = [ten]; if (oRieng) { oRieng.value = ""; ghi(k + ".khac", ""); } }
        else chon = [...chon.filter(x => x !== t.rieng), ten];
        ghi(k, nhieu ? chon : (chon[0] || "")); capNhat(); xoaLoi(c);
        if (c.truong.some(x => x.bo_qua_neu?.truong === t.id)) veNhom(false);
      });
      let the = null;
      if (t.dang_the && lc.mau && mau[lc.mau]) {
        the = tao("div", "the-mau"); const xem = tao("button", "nut-chu", `Xem video mẫu ${lc.mau}`); xem.type = "button";
        const dsThe = () => t.lua_chon.map(x => mau[x.mau]).filter(Boolean);
        xem.addEventListener("click", () => moXem(dsThe(), lc.mau));
        the.append(nutMau(mau[lc.mau], dsThe, false), b, xem); day.append(the);
      } else day.append(b);
      nut.push({ b, ten, the });
    });
    hop.append(day);

    if (t.tu_dien) {
      oRieng = tao("input", "tu-dien"); oRieng.type = "text"; oRieng.maxLength = 300;
      oRieng.placeholder = "Hoặc Quý khách hàng tự điền câu trả lời khác"; oRieng.setAttribute("aria-label", "Câu trả lời khác của Quý khách hàng");
      oRieng.value = traLoi[k + ".khac"] || "";
      oRieng.addEventListener("input", () => {
        const chu = oRieng.value.trim();
        if (chu && !nhieu) ghi(k, "");
        if (chu && nhieu && t.rieng) ghi(k, dangChon().filter(x => x !== t.rieng));
        ghi(k + ".khac", chu); capNhat(); xoaLoi(c);
      });
      hop.append(oRieng);
    }
    capNhat(); return hop;
  }

  // Ảnh chụp điện thoại thường 3–10 MB: thu nhỏ còn cạnh dài 2560 px (JPEG) trước khi gửi, để gửi nhanh và không vượt giới hạn máy chủ.
  async function thuNhoAnh(tep) {
    const NGUONG = 3 * 1048576, CANH = 2560;
    if (tep.size <= NGUONG || !window.createImageBitmap) return tep;
    try {
      const bm = await createImageBitmap(tep, { imageOrientation: "from-image" });
      const ti = Math.min(1, CANH / Math.max(bm.width, bm.height));
      const c = document.createElement("canvas"); c.width = Math.round(bm.width * ti); c.height = Math.round(bm.height * ti);
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(bm, 0, 0, c.width, c.height); bm.close?.();
      const blob = await new Promise(xong => c.toBlob(xong, "image/jpeg", 0.86));
      if (!blob || blob.size >= tep.size) return tep;
      return new File([blob], tep.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
    } catch { return tep; }
  }

  function veOAnh() {
    const hop = tao("div", "o-anh"), id = "chon-anh";
    const nhan = tao("label", "nhan", `Gửi kèm ảnh sản phẩm, nếu có (tối đa ${cauHinh.anh.toi_da} ảnh; ảnh lớn được tự thu nhỏ)`); nhan.htmlFor = id;
    const o = tao("input", "an-tep"); o.type = "file"; o.id = id; o.accept = "image/jpeg,image/png,image/webp";
    const nutChon = tao("label", "nut-phu nut-chon-anh", "Chọn ảnh từ máy"); nutChon.htmlFor = id;
    const trangThai = tao("span", "trang-thai-anh");
    const ds = tao("ul", "ds-anh"), bao = tao("p", "loi-cau"); bao.hidden = true; bao.setAttribute("role", "alert");
    const veDs = () => {
      ds.replaceChildren(...anh.map(a => {
        const li = tao("li"), xoa = tao("button", "nut-chu", "Bỏ ảnh này"); xoa.type = "button";
        xoa.addEventListener("click", async () => { try { anh = (await goi(`/api/phieu/${maPhieu}/anh/${a.id}`, { method: "DELETE" })).anh; veDs(); } catch (e) { bao.textContent = e.message; bao.hidden = false; } });
        li.append(tao("span", "", a.ten), xoa); return li;
      }));
      o.disabled = anh.length >= cauHinh.anh.toi_da;
      nutChon.classList.toggle("tat", o.disabled);
      trangThai.textContent = anh.length ? `Đã gửi ${anh.length} trên ${cauHinh.anh.toi_da} ảnh` : "Chưa chọn ảnh nào";
    };
    o.addEventListener("change", async () => {
      const goc = o.files[0]; if (!goc) return;
      bao.hidden = true; o.disabled = true; trangThai.textContent = "Đang chuẩn bị ảnh…";
      const tep = await thuNhoAnh(goc);
      if (tep.size > cauHinh.anh.nang_nhat) {
        bao.textContent = `Ảnh nặng quá ${Math.floor(cauHinh.anh.nang_nhat / 1048576)} MB. Quý khách hàng vui lòng chọn ảnh nhẹ hơn.`; bao.hidden = false; o.value = ""; veDs(); return;
      }
      const form = new FormData(); form.append("anh", tep, tep.name);
      trangThai.textContent = "Đang gửi ảnh…";
      try { anh = (await goi(`/api/phieu/${maPhieu}/anh`, { method: "POST", body: form })).anh; }
      catch (e) { bao.textContent = e.message; bao.hidden = false; }
      o.value = ""; veDs();
    });
    const hang = tao("div", "hang-anh"); hang.append(nutChon, trangThai);
    veDs(); hop.append(nhan, o, hang, ds, bao); return hop;
  }

  function veCau(c) {
    const hop = tao("div", "cau"); hop.id = `cau-${c.so}`;
    const khung = tao("fieldset"), tieuDe = tao("legend");
    tieuDe.append(tao("span", "so-cau", String(c.so)), tao("span", "", c.cau));
    khung.append(tieuDe);
    if (c.goi_y) khung.append(tao("p", "goi-y", c.goi_y));
    c.truong.forEach(t => { if (!biBoQua(c, t)) khung.append(t.kieu === "chu" || t.kieu === "doan" ? veTruongChu(c, t) : veTruongChon(c, t)); });
    if (c.co_anh) khung.append(veOAnh());
    const loi = tao("p", "loi-cau"); loi.hidden = true; loi.setAttribute("role", "alert");
    khung.append(loi); hop.append(khung); return hop;
  }

  function veNhom(cuon = true) {
    const n = nhom[viTri], cuaNhom = cau.filter(c => c.nhom === n.id), cuoi = viTri === nhom.length - 1;
    $("ten-nhom").textContent = n.ten; $("mo-ta-nhom").textContent = n.mo_ta;
    $("cac-cau").replaceChildren(...cuaNhom.map(veCau));
    $("tien-do-nhom").textContent = `Phần ${viTri + 1} trên ${nhom.length}, câu ${cuaNhom[0].so} đến ${cuaNhom[cuaNhom.length - 1].so}`;
    $("tien-do-day").style.width = `${Math.round((cuaNhom[0].so - 1) / cau.length * 100)}%`;
    $("phieu-cac-buoc").replaceChildren(...nhom.map((buoc, i) => {
      const li = tao("li", i < viTri ? "da-qua" : ""), so = tao("span", "", i < viTri ? "✓" : String(i + 1).padStart(2, "0"));
      so.setAttribute("aria-hidden", "true");
      if (i === viTri) li.setAttribute("aria-current", "step");
      li.append(so, tao("span", "", buoc.ten)); return li;
    }));
    $("ket-thuc").hidden = !cuoi; $("tiep-tuc").textContent = cuoi ? "Gửi phiếu" : "Lưu và tiếp tục";
    $("quay-lai").textContent = viTri === 0 ? "Về trang đầu" : "Quay lại"; $("loi-phieu").hidden = true;
    if (cuon) { window.scrollTo({ top: 0 }); $("ten-nhom").focus({ preventScroll: true }); }
  }

  // ---------- Lưu và kiểm tra ----------
  function ghi(k, giaTri) {
    if (giaTri === "" || (Array.isArray(giaTri) && !giaTri.length)) delete traLoi[k]; else traLoi[k] = giaTri;
    lanSua += 1; canLuu = true; nhoBanNhap(); henLuuLai();
    $("tien-do-luu").textContent = "Chưa lưu lên máy chủ";
  }

  function luu() {
    clearTimeout(henLuu);
    if (!maPhieu || daGui || dangGui) return dangLuu;
    canLuu = true; nhoBanNhap();
    if (dangGuiLuu) return dangLuu;
    const phien = lanSua, than = JSON.stringify({ tra_loi: traLoi, nhom: nhom[viTri].id, dong_y_luu: true });
    dangGuiLuu = true;
    $("tien-do-luu").textContent = "Đang lưu";
    dangLuu = (async () => {
      let thanhCong = false;
      try {
        await goi(`/api/phieu/${maPhieu}`, { method: "PUT", body: than, signal: AbortSignal.timeout(15000) });
        thanhCong = true; choThu = 1500;
        if (phien === lanSua) { canLuu = false; $("tien-do-luu").textContent = "Đã lưu"; }
      } catch (e) {
        if (e.trangThai === 409) {
          daGui = true; canLuu = false; xoaBanNhap();
          $("tien-do-luu").textContent = "Phiếu đã gửi. Quý khách hàng vui lòng tải lại trang.";
        } else if (e.trangThai === 404) {
          // Giữ bản nháp cục bộ để người dùng có thể khôi phục thành phiếu mới.
          $("tien-do-luu").textContent = "Phiếu không còn trên máy chủ. Tải lại trang để khôi phục bản nháp.";
          canLuu = false;
        } else {
          $("tien-do-luu").textContent = "Chưa lưu lên máy chủ; sẽ tự thử lại khi có mạng.";
          choThu = e.trangThai === 429 ? 60000 : Math.min(choThu * 2, 30000);
        }
      } finally {
        dangGuiLuu = false; nhoBanNhap();
        if (canLuu && !daGui && !dangGui) henLuuLai(thanhCong ? 0 : choThu);
      }
    })();
    return dangLuu;
  }

  const SDT = /^(0|\+?84)\d{9,10}$/, EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
  function loiCuaCau(c) {
    for (const t of c.truong) {
      if (biBoQua(c, t)) continue;
      const k = khoa(c, t), co = (Array.isArray(traLoi[k]) ? traLoi[k].length : !!traLoi[k]) || !!traLoi[k + ".khac"];
      if (t.bat_buoc && !co) return t.nhan ? `Quý khách hàng vui lòng trả lời mục “${t.nhan}”.` : "Quý khách hàng vui lòng chọn hoặc điền một câu trả lời.";
      if (t.kiem_tra === "lien_he" && co) {
        const kenh = traLoi[`${c.so}.kenh`], v = traLoi[k];
        if ((kenh === "Zalo" || kenh === "Điện thoại") && !SDT.test(v.replace(/[\s.\-()]/g, ""))) return "Số điện thoại chưa đúng. Quý khách hàng vui lòng nhập đủ 10 số, ví dụ 0901 234 567.";
        if (kenh === "Email" && !EMAIL.test(v)) return "Địa chỉ email chưa đúng. Quý khách hàng vui lòng xem lại, ví dụ ten@gmail.com.";
      }
    }
    return "";
  }
  function xoaLoi(c) { const hop = $(`cau-${c.so}`); if (!hop) return; hop.classList.remove("co-loi"); hop.querySelector("fieldset > .loi-cau:last-child").hidden = true; }
  function baoLoi(c, chu) { const hop = $(`cau-${c.so}`), p = hop.querySelector("fieldset > .loi-cau:last-child"); hop.classList.add("co-loi"); p.textContent = chu; p.hidden = false; }

  function kiemTraNhom() {
    let dau = null;
    cau.filter(c => c.nhom === nhom[viTri].id).forEach(c => { const loi = loiCuaCau(c); if (loi) { baoLoi(c, loi); dau = dau || c; } });
    if (dau) { $(`cau-${dau.so}`).scrollIntoView({ block: "start" }); const o = $(`cau-${dau.so}`).querySelector("input, textarea, button"); if (o) o.focus({ preventScroll: true }); }
    return !dau;
  }

  async function gui() {
    const loi = $("loi-phieu");
    if (!$("dong-y").checked) { loi.textContent = "Quý khách hàng vui lòng đánh dấu ô đồng ý trước khi gửi."; loi.hidden = false; $("dong-y").focus(); return; }
    dangGui = true; nhoBanNhap();
    $("tiep-tuc").disabled = true; $("tiep-tuc").textContent = "Đang gửi phiếu";
    try {
      clearTimeout(henLuu); await dangLuu;
      const kq = await goi(`/api/phieu/${maPhieu}/gui`, { method: "POST", body: JSON.stringify({ tra_loi: traLoi, dong_y: true, trang_web: $("trang-web").value, tu_van: docTuVan()?.ma_gui || "" }) });
      daGui = true; canLuu = false; clearTimeout(henLuu); xoaBanNhap(); nho.xoa(KHOA_TU_VAN); hienCamOn(kq.tom_tat || []);
    } catch (e) {
      const thieu = e.chi_tiet?.thieu?.[0];
      if (thieu) { const c = cau.find(x => x.so === thieu.so); doiNhom(nhom.findIndex(n => n.id === c.nhom), { thayThe: true }); baoLoi(c, thieu.thong_bao); $(`cau-${c.so}`).scrollIntoView({ block: "start" }); }
      else { loi.textContent = e.message; loi.hidden = false; }
    } finally { dangGui = false; if (canLuu && !daGui) henLuuLai(); $("tiep-tuc").disabled = false; if (!$("phieu").hidden) $("tiep-tuc").textContent = viTri === nhom.length - 1 ? "Gửi phiếu" : "Lưu và tiếp tục"; }
  }

  // ---------- Chuyển màn ----------
  function hien(man) {
    document.body.classList.toggle("man-phieu", man === "phieu");
    document.body.classList.toggle("man-cam-on", man === "cam-on");
    ["mo-dau", "mau", "ve-b-productions", "danh-gia", "tu-van", "goc-chia-se", "phieu", "cam-on"].forEach(id => { $(id).hidden = man === "dau" ? (id === "phieu" || id === "cam-on") : id !== man; });
    $("danh-gia").hidden = man !== "dau" || !(cauHinh.danh_gia || []).length;
    if (man !== "dau") dongMenu();
    document.querySelectorAll(".dau-trang nav").forEach(n => { n.hidden = man !== "dau"; });
    if (man !== "dau") dungTatCa();
    capNhatThanhDuoi();
  }

  // Mỗi phần của phiếu có một mục lịch sử riêng. URL không chứa mã phiếu hay câu trả lời.
  function urlTrangDau() {
    return location.pathname + location.search + (/^#(?:phieu\/|da-gui$)/.test(location.hash) ? "" : location.hash);
  }
  function ghiTrangDau() {
    gocLichSu = urlTrangDau(); doSauLichSu = 0;
    history.replaceState({ ...history.state, bpPhieu: { v: 1, man: "dau", luot: luotPhieu, doSau: 0, goc: gocLichSu } }, "", gocLichSu);
  }
  function ghiNhom(thayThe = false) {
    let cu = history.state?.bpPhieu;
    if (cu?.luot !== luotPhieu || cu.man !== "phieu") { ghiTrangDau(); cu = history.state.bpPhieu; }
    if (!thayThe && cu.man === "phieu" && cu.nhom === nhom[viTri].id) return;
    const doSau = thayThe && cu.man === "phieu" ? cu.doSau : doSauLichSu + 1;
    const trang = { v: 1, man: "phieu", luot: luotPhieu, nhom: nhom[viTri].id, doSau, goc: gocLichSu,
      truoc: thayThe ? cu.truoc : cu.man === "phieu" ? cu.nhom : null };
    history[thayThe ? "replaceState" : "pushState"]({ ...history.state, bpPhieu: trang }, "", location.pathname + location.search + `#phieu/${nhom[viTri].id}`);
    doSauLichSu = doSau;
  }
  function doiNhom(viTriMoi, { ghi = true, thayThe = false } = {}) {
    viTri = Math.max(0, Math.min(nhom.length - 1, viTriMoi));
    if (ghi) ghiNhom(thayThe);
    hien("phieu"); veNhom(); lanSua += 1; canLuu = true; nhoBanNhap(); luu();
  }
  function veTrangDau() {
    hien("dau");
    requestAnimationFrame(() => {
      const dich = document.getElementById(location.hash.slice(1));
      if (dich) dich.scrollIntoView({ block: "start", behavior: "instant" }); else window.scrollTo({ top: 0, behavior: "instant" });
    });
  }
  function theoLichSu() {
    $("xem").close(); $("bat-dau-hop").close();
    const trang = history.state?.bpPhieu, truoc = doSauLichSu;
    const dungLuot = trang?.v === 1 && trang.luot === luotPhieu;
    doSauLichSu = dungLuot ? trang.doSau : 0;
    if (dungLuot && trang.man === "phieu") {
      if (daGui) {
        // Bỏ qua các bước chỉnh sửa của phiếu đã gửi, cả khi Back lẫn Forward.
        const khoang = doSauLichSu > truoc && doSauDaGui > doSauLichSu ? doSauDaGui - doSauLichSu : -doSauLichSu;
        if (khoang) history.go(khoang); else veTrangDau();
        return;
      }
      const viTriMoi = nhom.findIndex(n => n.id === trang.nhom);
      if (maPhieu && !canTaiPhieu && viTriMoi >= 0) {
        gocLichSu = trang.goc; $("dong-y-luu").checked = true; doiNhom(viTriMoi, { ghi: false }); return;
      }
      ghiTrangDau();
    }
    if (dungLuot && trang.man === "cam-on" && daGui) { hienCamOn(ketQuaDaGui, false); return; }
    veTrangDau();
  }
  function khoiTaoLichSu() {
    const trang = history.state?.bpPhieu;
    if (trang?.v === 1 && trang.man === "cam-on") {
      luotPhieu = trang.luot; doSauLichSu = trang.doSau; doSauDaGui = trang.doSau; gocLichSu = trang.goc; daGui = true;
      hienCamOn([], false);
    } else if (trang?.v === 1 && trang.man === "phieu" && trang.luot === luotPhieu && maPhieu && !canTaiPhieu && nhom.some(n => n.id === trang.nhom)) {
      doSauLichSu = trang.doSau; gocLichSu = trang.goc;
      theoLichSu();
    } else {
      ghiTrangDau();
    }
    window.addEventListener("popstate", theoLichSu);
  }
  function hienCamOn(dong, ghi = true) {
    ketQuaDaGui = dong;
    $("dang-do").hidden = true; $("dong-y-luu").checked = false;
    document.querySelectorAll("[data-bat-dau]").forEach(b => { b.textContent = b.dataset.nhanGoc || "Gửi yêu cầu chi tiết →"; });
    $("tom-tat").replaceChildren(...dong.map(d => { const hop = tao("div"); hop.append(tao("dt", "", `${d.so == null ? "" : d.so + ". "}${d.cau}`), tao("dd", "", d.tra_loi)); return hop; }));
    $("tom-tat").hidden = !dong.length; $("cam-on-co-tom-tat").hidden = !dong.length;
    if (ghi) {
      doSauLichSu += 1; doSauDaGui = doSauLichSu;
      history.pushState({ ...history.state, bpPhieu: { v: 1, man: "cam-on", luot: luotPhieu, doSau: doSauLichSu, goc: gocLichSu } }, "", location.pathname + location.search + "#da-gui");
    }
    hien("cam-on"); window.scrollTo({ top: 0 }); $("cam-on-tieu-de").focus({ preventScroll: true });
  }

  async function batDau() {
    const loi = $("loi-mo-dau"); loi.hidden = true;
    if (canTaiPhieu) {
      await khoiPhuc();
      if (canTaiPhieu) {
        loi.textContent = "Chưa tải được phiếu cũ. Quý khách hàng vui lòng kiểm tra mạng rồi thử lại."; loi.hidden = false; return;
      }
    }
    if (!$("dong-y-luu").checked) {
      dungTatCa();
      if (!$("bat-dau-hop").open) $("bat-dau-hop").showModal();
      return;
    }
    $("bat-dau-hop").close();
    document.querySelectorAll("[data-bat-dau]").forEach(b => { b.disabled = true; });
    try {
      if (daGui) { maPhieu = ""; traLoi = {}; anh = []; viTri = 0; daGui = false; canLuu = false; ketQuaDaGui = []; $("dong-y").checked = false; }
      if (!maPhieu) {
        maPhieu = (await goi("/api/phieu", { method: "POST", body: JSON.stringify({ nguon: nguon(), dong_y_luu: true }) })).id;
        luotPhieu = crypto.randomUUID(); nho.ghi(KHOA_PHIEU, maPhieu);
        dienTuTuVan();
      }
      apDungKieuCho(); doiNhom(viTri);
    } catch (e) { loi.textContent = e.message; loi.hidden = false; $("mo-dau").scrollIntoView(); }
    finally { document.querySelectorAll("[data-bat-dau]").forEach(b => { b.disabled = false; }); }
  }

  async function khoiPhuc() {
    const ma = nho.doc(KHOA_PHIEU); if (!ma) return;
    const nhap = docBanNhap(ma);
    if (typeof nhap?.luot === "string" && /^[a-f0-9-]{36}$/.test(nhap.luot)) luotPhieu = nhap.luot;
    let p;
    try {
      p = await goi(`/api/phieu/${ma}`);
      canTaiPhieu = false;
      if (p.da_gui) { xoaBanNhap(); maPhieu = ""; return; }
    } catch (e) {
      if (e.trangThai === 404) {
        // Cơ sở dữ liệu được thay mới: không bỏ mất nội dung đang lưu trên thiết bị.
        nho.xoa(KHOA_PHIEU); maPhieu = ""; canTaiPhieu = false;
        if (nhap) {
          traLoi = nhap.tra_loi; viTri = Math.max(0, nhom.findIndex(n => n.id === nhap.nhom)); canLuu = true;
          $("dang-do").textContent = "Phiếu cũ không còn trên máy chủ. Bấm bắt đầu để tạo phiếu mới từ bản nháp trên thiết bị này.";
          $("dang-do").hidden = false;
        }
        return;
      }
      if (!nhap) {
        canTaiPhieu = true;
        $("dang-do").textContent = "Chưa tải được phiếu đang dở. Quý khách hàng vui lòng kiểm tra mạng rồi tải lại trang.";
        $("dang-do").hidden = false;
        // Không tạo phiếu khác thay cho phiếu đang có khi mạng chưa phục hồi.
        maPhieu = ma;
        return;
      }
      p = { tra_loi: nhap.tra_loi, nhom_dang_dung: nhap.nhom, anh: [] };
      canLuu = true;
    }
    maPhieu = ma; traLoi = p.tra_loi || {}; anh = p.anh || [];
    viTri = Math.max(0, nhom.findIndex(n => n.id === p.nhom_dang_dung));
    if (nhap?.can_luu) {
      traLoi = nhap.tra_loi; viTri = Math.max(0, nhom.findIndex(n => n.id === nhap.nhom)); canLuu = true;
    }
    const so = new Set(Object.keys(traLoi).map(k => k.split(".")[0])).size;
    if (so) {
      $("dang-do").textContent = `Quý khách hàng đang điền dở một phiếu, đã trả lời ${so} trên ${cau.length} câu. Bấm “Tiếp tục điền phiếu” để làm tiếp từ chỗ đang dừng.`; $("dang-do").hidden = false;
      document.querySelectorAll("[data-bat-dau]").forEach(b => { b.textContent = "Tiếp tục điền phiếu"; });
    }
  }

  // Tư vấn nhanh không lưu khi gõ; chỉ gửi khi khách chủ động xác nhận.
  let mauTuVan = "", maGuiNhanh = "";
  const KHOA_TU_VAN = "bp-tu-van";
  function docTuVan() {
    try {
      const t = JSON.parse(nho.doc(KHOA_TU_VAN));
      return t && /^[a-f0-9]{48}$/.test(t.ma_gui) && Date.now() - t.luc < 7 * 864e5 ? t : null;
    } catch { return null; }
  }
  // Mở phiếu chi tiết sau khi đã gửi tư vấn nhanh: điền sẵn những gì khách đã cho biết, khách không phải gõ lại.
  function dienTuTuVan() {
    const t = docTuVan(); if (!t) return;
    const san = { "1.san_pham": t.san_pham, "19.kenh": t.kenh, "19.dia_chi": t.lien_he, ...(t.them || {}), ...(t.bo_sung || {}) };
    if (t.kieu) san["11.kieu"] = [t.kieu];
    Object.entries(san).forEach(([k, v]) => { if (v && (Array.isArray(v) ? v.length : true) && !traLoi[k]) traLoi[k] = v; });
    lanSua += 1; canLuu = true; nhoBanNhap();
  }
  // Ba câu bấm một lần lấy từ chính bộ câu hỏi, để câu chữ và lựa chọn luôn khớp với phiếu chi tiết.
  const CAU_BO_SUNG = [["han", 17, "han"], ["ngan_sach", 18, "ngan_sach"], ["noi_dang", 7, "noi_dang"]];
  let boSung = {};
  function veBoSung() {
    boSung = {}; $("bs-ten").value = ""; $("bs-loi").hidden = true; $("form-bo-sung").hidden = false; $("bs-xong").hidden = true;
    const daCo = docTuVan()?.them || {};   // câu nào khách đã trả lời ở phần gợi ý thì không hỏi lại
    $("bs-cau").replaceChildren(...CAU_BO_SUNG.filter(([, so, id]) => !daCo[`${so}.${id}`]).map(([ten, so, id]) => {
      const c = cau.find(x => x.so === so), t = c?.truong.find(x => x.id === id); if (!t) return tao("span");
      const hop = tao("div", "truong"), day = tao("div", "chon"), nhieu = t.kieu === "nhieu";
      hop.append(tao("span", "nhan", c.cau)); day.setAttribute("role", "group"); day.setAttribute("aria-label", c.cau);
      t.lua_chon.map(tenLuaChon).forEach(lc => {
        const b = tao("button", "", lc); b.type = "button"; b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", () => {
          const co = b.getAttribute("aria-pressed") === "true";
          if (!nhieu) day.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", "false"));
          b.setAttribute("aria-pressed", String(!co));
          const chon = [...day.querySelectorAll('button[aria-pressed="true"]')].map(x => x.textContent);
          boSung[ten] = nhieu ? chon : (chon[0] || "");
        });
        day.append(b);
      });
      hop.append(day); return hop;
    }));
  }
  function ganBoSung() {
    $("form-bo-sung").addEventListener("submit", async e => {
      e.preventDefault();
      const t = docTuVan(), du = { ...boSung, ten: $("bs-ten").value.trim() };
      Object.keys(du).forEach(k => { if (!du[k] || (Array.isArray(du[k]) && !du[k].length)) delete du[k]; });
      if (!t || !Object.keys(du).length) { $("bs-loi").textContent = "Quý khách hàng chưa chọn hoặc điền câu nào."; $("bs-loi").hidden = false; return; }
      $("bs-gui").disabled = true; $("bs-gui").textContent = "Đang gửi…";
      try {
        await goi("/api/tu-van/bo-sung", { method: "POST", body: JSON.stringify({ ...du, ma_gui: t.ma_gui }), signal: AbortSignal.timeout(15000) });
        const daCo = { "19.ten": du.ten, "17.han": du.han, "18.ngan_sach": du.ngan_sach, "7.noi_dang": du.noi_dang };
        Object.keys(daCo).forEach(k => { if (!daCo[k]) delete daCo[k]; });
        nho.ghi(KHOA_TU_VAN, JSON.stringify({ ...t, bo_sung: { ...(t.bo_sung || {}), ...daCo } }));
        $("form-bo-sung").hidden = true; $("bs-xong").hidden = false; $("bs-xong").focus?.();
      } catch (err) { $("bs-loi").textContent = err.trangThai ? err.message : "Chưa gửi được. Quý khách hàng vui lòng kiểm tra mạng rồi thử lại."; $("bs-loi").hidden = false; }
      finally { $("bs-gui").disabled = false; $("bs-gui").textContent = "Gửi thêm thông tin"; }
    });
  }
  function chonTuVan(m) {
    maGuiNhanh = "";
    if (m) { mauTuVan = m.ma; $("tv-mau-ten").textContent = `${m.ma} · ${m.ten}`; $("tv-mau").hidden = false; xemTruocMau(m); }
    $("tv-thanh-cong").hidden = true; $("form-tu-van").hidden = false;
    $("tu-van").scrollIntoView({ block: "start", behavior: itChuyenDong ? "instant" : "smooth" });
    $("tv-san-pham").focus({ preventScroll: true });
  }
  const taoMaGui = () => [...crypto.getRandomValues(new Uint8Array(24))].map(v => v.toString(16).padStart(2, "0")).join("");
  function loiNhanh(sanPham, lienHe, dongY) {
    if (!sanPham) return ["san-pham", "Quý khách hàng vui lòng cho biết tên sản phẩm."];
    if (!/^(?:0\d{9}|\+?84\d{9})$/.test(lienHe.replace(/[\s.\-()]/g, ""))) return ["lien-he", "Quý khách hàng vui lòng kiểm tra số điện thoại, ví dụ 0901 234 567."];
    if (!dongY) return ["dong-y", "Quý khách hàng vui lòng đánh dấu ô đồng ý để chúng tôi liên hệ."];
    return null;
  }
  async function guiNhanh(du) {
    const kq = await goi("/api/tu-van", { method: "POST", body: JSON.stringify({ ...du, dong_y: true, nguon: nguon() }), signal: AbortSignal.timeout(15000) });
    if (kq.da_gui !== true) throw new Error("Chưa xác nhận được yêu cầu. Quý khách hàng vui lòng thử lại.");
  }
  const loiMang = err => err.trangThai ? err.message : "Chưa gửi được. Quý khách hàng vui lòng kiểm tra mạng rồi thử lại; thông tin đang điền vẫn còn.";
  // Gửi xong ở bất kỳ đâu: ghi nhớ để điền sẵn phiếu chi tiết, và chuyển phần tư vấn sang bước hỏi thêm.
  function sauKhiGuiNhanh(du) {
    nho.ghi(KHOA_TU_VAN, JSON.stringify({ ma_gui: du.ma_gui, san_pham: du.san_pham, lien_he: du.lien_he, kenh: du.kenh,
      kieu: mau[du.ma_mau]?.kieu || "", them: du.them || {}, luc: Date.now() }));
    $("tv-san-pham-da-gui").textContent = du.san_pham; $("tv-kenh-da-gui").textContent = du.kenh === "Zalo" ? "Zalo" : "điện thoại";
    mauTuVan = ""; maGuiNhanh = ""; $("tv-mau").hidden = true;
    $("form-tu-van").reset(); $("form-tu-van").hidden = true; veBoSung(); $("tv-thanh-cong").hidden = false;
  }

  // Form ngắn đặt ngay tại chỗ khách đang hứng thú nhất (kết quả gợi ý, khung xem video), không bắt khách cuộn đi nơi khác.
  let soFormNhanh = 0;
  function formNhanh({ tieuDe, nutGui, layMau, layThem }) {
    soFormNhanh += 1;
    const id = `fn${soFormNhanh}`, cu = docTuVan(), f = tao("form", "form-nhanh"); f.noValidate = true;
    const o = (nhan, kieu, ten, giaTri, viDu, tuDong) => {
      const hop = tao("div", "truong"), l = tao("label", "nhan", nhan), i = tao("input"); l.htmlFor = `${id}-${ten}`;
      i.id = `${id}-${ten}`; i.type = kieu; i.maxLength = ten === "lien-he" ? 30 : 300; i.placeholder = viDu; i.value = giaTri || "";
      if (tuDong) i.autocomplete = tuDong; if (kieu === "tel") i.inputMode = "tel";
      hop.append(l, i); return [hop, i];
    };
    const [hopSp, sp] = o("Sản phẩm của Quý khách hàng", "text", "san-pham", cu?.san_pham, "Ví dụ: son dưỡng, cà phê, ứng dụng…");
    const [hopDt, dt] = o("Số điện thoại", "tel", "lien-he", cu?.lien_he, "0901 234 567", "tel");
    const kenh = tao("fieldset", "truong tv-kenh"); kenh.append(tao("legend", "nhan", "Nhận phương án qua"));
    const chonKenh = tao("div", "chon-nho");
    [["Zalo", "Zalo"], ["Điện thoại", "Gọi điện"]].forEach(([gt, chu], i) => {
      const l = tao("label"), r = tao("input"); r.type = "radio"; r.name = `${id}-kenh`; r.value = gt; r.checked = cu ? cu.kenh === gt : i === 0;
      l.append(r, tao("span", "", chu)); chonKenh.append(l);
    });
    kenh.append(chonKenh);
    const dongY = tao("label", "dong-y tv-dong-y"), hop = tao("input"), chuDongY = tao("span"); hop.type = "checkbox";
    const linkCs = tao("a", "", "Cách dùng thông tin"); linkCs.href = "/chinh-sach"; linkCs.target = "_blank"; linkCs.rel = "noopener";
    chuDongY.append(`Tôi đồng ý gửi thông tin này để ${cauHinh.studio} tư vấn và liên hệ lại. `, linkCs); dongY.append(hop, chuDongY);
    const bay = tao("label", "an-di"); bay.setAttribute("aria-hidden", "true"); const bayO = tao("input"); bayO.type = "text"; bayO.tabIndex = -1; bayO.autocomplete = "off"; bay.append("Trang web", bayO);
    const loi = tao("p", "bao-loi"); loi.hidden = true; loi.setAttribute("role", "alert");
    const nut = tao("button", "nut tv-gui", nutGui); nut.type = "submit";
    f.append(tao("h4", "", tieuDe), hopSp, hopDt, kenh, dongY, bay, loi, nut,
      tao("p", "form-goi-y", `Chúng tôi phản hồi trong ${cauHinh.hen_phan_hoi}.`));
    let maGui = "";
    f.addEventListener("input", () => { maGui = ""; loi.hidden = true; });
    f.addEventListener("submit", async e => {
      e.preventDefault(); loi.hidden = true;
      const sai = loiNhanh(sp.value.trim(), dt.value.trim(), hop.checked);
      if (sai) { loi.textContent = sai[1]; loi.hidden = false; ({ "san-pham": sp, "lien-he": dt, "dong-y": hop })[sai[0]].focus(); return; }
      maGui = maGui || taoMaGui();
      const m = layMau?.(), du = { san_pham: sp.value.trim(), lien_he: dt.value.trim(), kenh: f.querySelector(`input[name="${id}-kenh"]:checked`)?.value || "Zalo",
        ma_mau: m?.ma || "", them: layThem?.() || {}, ma_gui: maGui, trang_web: bayO.value };
      const truong = [...f.querySelectorAll("input, button")]; truong.forEach(x => { x.disabled = true; }); nut.textContent = "Đang gửi…";
      try {
        await guiNhanh(du); sauKhiGuiNhanh(du);
        const xong = tao("div", "form-nhanh xong"); xong.setAttribute("role", "status"); xong.tabIndex = -1;
        const them = tao("button", "nut-phu", "Trả lời thêm 2 câu để báo giá sát hơn"); them.type = "button";
        them.addEventListener("click", () => { if ($("xem").open) $("xem").close(); $("tu-van").scrollIntoView({ block: "start" }); $("bs-ten").focus({ preventScroll: true }); });
        xong.append(tao("span", "dau-xong", "✓"), tao("h4", "", "Chúng tôi đã nhận yêu cầu của Quý khách hàng."),
          tao("p", "", `Chúng tôi sẽ gửi phương án và báo giá cho ${du.san_pham} qua ${du.kenh === "Zalo" ? "Zalo" : "điện thoại"} trong ${cauHinh.hen_phan_hoi}.`), them);
        f.replaceWith(xong); xong.focus({ preventScroll: true });
      } catch (err) { loi.textContent = loiMang(err); loi.hidden = false; }
      finally { truong.forEach(x => { x.disabled = false; }); nut.textContent = nutGui; }
    });
    return f;
  }

  function ganTuVan() {
    $("tv-bo-mau").addEventListener("click", () => { mauTuVan = ""; maGuiNhanh = ""; $("tv-mau").hidden = true; });
    const form = $("form-tu-van"), nutGoc = $("tv-gui").innerHTML;
    form.addEventListener("input", () => { maGuiNhanh = ""; $("tv-loi").hidden = true; });
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const sanPham = $("tv-san-pham").value.trim(), lienHe = $("tv-lien-he").value.trim(), loi = $("tv-loi");
      loi.hidden = true;
      const sai = loiNhanh(sanPham, lienHe, $("tv-dong-y").checked);
      if (sai) { loi.textContent = sai[1]; loi.hidden = false; ({ "san-pham": $("tv-san-pham"), "lien-he": $("tv-lien-he"), "dong-y": $("tv-dong-y") })[sai[0]].focus(); return; }
      if (!maGuiNhanh) maGuiNhanh = taoMaGui();
      const kenh = form.querySelector('input[name="kenh"]:checked')?.value || "Zalo";
      const du = { san_pham: sanPham, lien_he: lienHe, kenh, ma_mau: mauTuVan, them: {}, ma_gui: maGuiNhanh, trang_web: $("tv-trang-web").value };
      const truong = [...form.querySelectorAll("input, button")]; truong.forEach(o => { o.disabled = true; }); $("tv-gui").textContent = "Đang gửi yêu cầu…";
      try { await guiNhanh(du); sauKhiGuiNhanh(du); $("tv-cam-on").focus(); }
      catch (err) { loi.textContent = loiMang(err); loi.hidden = false; }
      finally { truong.forEach(o => { o.disabled = false; }); $("tv-gui").innerHTML = nutGoc; }
    });
    $("bat-dau-huy").addEventListener("click", () => $("bat-dau-hop").close());
    $("bat-dau-nhanh").addEventListener("click", () => { $("bat-dau-hop").close(); $("tu-van").scrollIntoView({ block: "start" }); $("tv-san-pham").focus({ preventScroll: true }); });
    $("bat-dau-xac-nhan").addEventListener("click", () => {
      if (!$("dong-y-luu").checked) {
        $("loi-dong-y-luu").textContent = "Quý khách hàng vui lòng đồng ý lưu bản nháp trước khi bắt đầu."; $("loi-dong-y-luu").hidden = false; $("dong-y-luu").focus(); return;
      }
      $("loi-dong-y-luu").hidden = true; batDau();
    });
  }

  async function khoiDong() {
    // Bộ câu hỏi và danh sách mẫu được máy chủ gắn sẵn vào trang; chỉ gọi thêm khi phần gắn sẵn bị thiếu.
    try { cauHinh = JSON.parse($("cau-hinh").textContent); } catch { cauHinh = null; }
    try { if (!cauHinh || !cauHinh.bo_cau_hoi) cauHinh = await goi("/api/cau-hinh"); }
    catch (e) { const loi = $("loi-mo-dau"); loi.textContent = "Trang chưa tải được bộ câu hỏi. Quý khách hàng vui lòng tải lại trang."; loi.hidden = false; return; }
    nhom = cauHinh.bo_cau_hoi.nhom; cau = cauHinh.bo_cau_hoi.cau_hoi;
    document.querySelectorAll("[data-bat-dau]").forEach(b => { b.dataset.nhanGoc = b.textContent; });
    cauHinh.mau.forEach(m => { mau[m.ma] = m; });
    document.querySelectorAll("[data-studio]").forEach(e => { e.textContent = cauHinh.studio; });
    document.querySelectorAll("[data-hen]").forEach(e => { e.textContent = cauHinh.hen_phan_hoi; });
    if (cauHinh.lien_he) {
      $("lien-he-studio").textContent = cauHinh.lien_he; $("lien-he-studio").hidden = false;
      if (cauHinh.lien_he_url?.startsWith("tel:")) {
        $("lien-he-studio").href = cauHinh.lien_he_url;
        $("goi-studio").href = cauHinh.lien_he_url; $("goi-studio").textContent = `Gọi trực tiếp ${cauHinh.lien_he}`; $("goi-studio").hidden = false;
      }
    }
    if (cauHinh.zalo) { ["link-zalo", "zalo-cam-on"].forEach(id => { $(id).href = cauHinh.zalo; $(id).hidden = false; }); }
    veMau(); ganXem(); ganTuVan(); ganBoSung(); ganThanhDuoi(); veMenu(); ganXemTruoc(); veDanhGia(); ganHieuUng(); ganNghieng(); gan3D();
    await khoiPhuc(); khoiTaoLichSu();
    document.querySelectorAll("[data-bat-dau]").forEach(b => b.addEventListener("click", batDau));
    $("tiep-tuc").addEventListener("click", async () => {
      if (!kiemTraNhom()) return;
      if (viTri === nhom.length - 1) return gui();
      doiNhom(viTri + 1);
    });
    $("quay-lai").addEventListener("click", () => {
      const trang = history.state?.bpPhieu;
      if (trang?.luot === luotPhieu && trang.man === "phieu") {
        if (viTri === 0) { history.go(-trang.doSau); return; }
        if (trang.truoc === nhom[viTri - 1].id) { history.back(); return; }
      }
      if (viTri > 0) doiNhom(viTri - 1); else { ghiTrangDau(); veTrangDau(); }
    });
    $("in-phieu").addEventListener("click", () => window.print());
    window.addEventListener("pagehide", nhoBanNhap);
    window.addEventListener("online", () => { if (canLuu && !$("phieu").hidden) { choThu = 1500; luu(); } });
    try { if (!sessionStorage.getItem("bp-da-xem")) { sessionStorage.setItem("bp-da-xem", "1"); fetch("/api/luot-xem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nguon: nguon() }) }).catch(() => {}); } } catch { /* bỏ qua */ }
  }

  khoiDong();
})();
