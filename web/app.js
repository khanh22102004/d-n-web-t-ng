// Trang khách: khám phá mẫu, tư vấn nhanh hoặc điền phiếu chi tiết có lưu bản nháp.
(() => {
  "use strict";
  const KHOA_PHIEU = "bp-phieu", KHOA_NHAP = "bp-ban-nhap";
  const $ = id => document.getElementById(id);
  const tao = (the, lop, chu) => { const e = document.createElement(the); if (lop) e.className = lop; if (chu != null) e.textContent = chu; return e; };
  const nho = { doc: k => { try { return localStorage.getItem(k) || ""; } catch { return ""; } }, ghi: (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } }, xoa: k => { try { localStorage.removeItem(k); } catch { /* bỏ qua */ } } };

  const itChuyenDong = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tietKiem = !!(navigator.connection && navigator.connection.saveData);
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
    if (!r.ok) { const loi = new Error(du.loi?.thong_bao || "Chưa kết nối được máy chủ. Anh chị vui lòng thử lại."); loi.chi_tiet = du.loi; loi.trangThai = r.status; throw loi; }
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
    const k = tao("div", "khung"), i = tao("img"), taiCho = `/anh-mau/${m.ma}.jpg`;
    i.alt = `Mẫu ${m.ma}: ${m.ten}`; i.loading = "lazy"; i.decoding = "async"; i.width = 360; i.height = 640;
    const anhRieng = typeof m.anh_bia === "string" && m.anh_bia.startsWith("/anh-mau/") && !m.anh_bia.includes("..") && !/[?#]/.test(m.anh_bia) ? m.anh_bia : "";
    let daDuPhong = false;
    i.addEventListener("error", () => {
      if (!daDuPhong && i.getAttribute("src") !== taiCho) { daDuPhong = true; i.src = taiCho; }
      else { i.hidden = true; k.classList.add("thieu-anh"); }
    });
    i.addEventListener("load", () => { i.hidden = false; k.classList.remove("thieu-anh"); });
    i.src = anhRieng || (net === "nho" ? `/anh-mau/nho/${m.ma}.webp` : taiCho);
    if (!anhRieng && net === true && m.id && !tietKiem) {
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
  const duocPhat = () => !itChuyenDong && !tietKiem && !tamDung && !$("xem").open && !$("bat-dau-hop").open && !document.hidden;

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
  const duocPhatDoan = () => !itChuyenDong && !tietKiem && !tamDung && !document.hidden && !$("xem").open;
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

  const maNoiBat = ["ST029", "ST025", "ST056"];
  let locNhom = "";
  const mauDangLoc = () => locNhom === "noi-bat" ? maNoiBat.map(ma => mau[ma]).filter(Boolean) : cauHinh.mau.filter(m => !locNhom || m.nhom === locNhom);

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
    capNhatNutRay();
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
  // Máy tính: ba cột trôi dọc ngược chiều nhau. Điện thoại: một hàng trôi ngang.
  // Mỗi cột hoặc hàng được lặp hai lần để chạy liền mạch; bản lặp ẩn với trình đọc màn hình và phím Tab.
  // Tường mẫu giờ là nền trôi phía sau điện thoại: chỉ để trang trí, nên ẩn với trình đọc màn hình và phím Tab
  // (thư viện mẫu bên dưới và chính chiếc điện thoại vẫn mở được từng mẫu).
  function oTuong(m) {
    const the = nutMau(m, () => cauHinh.mau, false, false, "nho");
    the.classList.add("o-tuong");
    the.querySelector(".khung").append(tao("span", "nhan-nganh", m.nhom));
    the.querySelector("button").tabIndex = -1;
    const anh = the.querySelector("img"); anh.loading = "eager";
    ganDoan(the);
    return the;
  }
  function veTuong() {
    const ds = cauHinh.mau, soCot = 3;
    for (let c = 0; c < soCot; c += 1) {
      const cot = tao("div", "tuong-cot"), chay = tao("div", "tuong-chay");
      const cua = ds.filter((_, i) => i % soCot === c);
      [0, 1].forEach(() => cua.forEach(m => chay.append(oTuong(m))));
      cot.append(chay); $("tuong-doc").append(cot);
    }
    // Điện thoại: hai hàng trôi ngược chiều nhau, chéo phía sau máy.
    [ds, [...ds].reverse()].forEach(thuTu => {
      const hang = tao("div", "tuong-chay");
      [0, 1].forEach(() => thuTu.forEach(m => hang.append(oTuong(m))));
      $("tuong-ngang").append(hang);
    });
    document.querySelectorAll("[data-so-mau]").forEach(e => { e.textContent = ds.length; });
    document.querySelectorAll("[data-so-nganh]").forEach(e => { e.textContent = new Set(ds.map(m => m.nhom)).size; });
    $("tuong-dung").addEventListener("click", () => {
      tamDung = $("tuong").classList.toggle("dung");
      document.body.classList.toggle("dung-chuyen-dong", tamDung);
      if (tamDung) dungTatCa(); else chayLaiDoan();
      $("tuong-dung").setAttribute("aria-pressed", String(tamDung));
      $("tuong-dung").setAttribute("aria-label", tamDung ? "Chạy tiếp chuyển động" : "Dừng chuyển động");
      dtCapNhat();
    });
    veDienThoai(); ganXoay(); veDaiChu();
  }

  // ---------- Điện thoại ở màn hình đầu: lướt lần lượt các video mẫu như đang xem TikTok ----------
  // Mỗi mẫu hiện khoảng 4 giây rồi trượt lên mẫu kế. Bấm vào máy để xem có tiếng; rê chuột vào thì phát thử thật.
  const DT_LUOT = 4000;
  const dt = { ds: [], i: 0, hen: 0, re: false, trongTam: true, canh: new Map(), henPhat: 0 };
  const dtChay = () => !itChuyenDong && !tamDung && !dt.re && dt.trongTam && !document.hidden && !$("xem").open && !$("bat-dau-hop").open;
  function dtCanh(m) {
    let c = dt.canh.get(m.ma);
    if (c) return c;
    c = tao("div", "dt-mot"); const k = khungAnh(m, true), anh = k.querySelector("img");
    anh.alt = ""; anh.loading = "eager"; if (!dt.canh.size) anh.fetchPriority = "high";
    if (m.doan && !tietKiem && !itChuyenDong) {
      const v = tao("video", "doan"); v.muted = true; v.defaultMuted = true; v.setAttribute("muted", ""); v.loop = true; v.playsInline = true;
      v.preload = "metadata"; v.src = m.doan; v.setAttribute("aria-hidden", "true"); v.tabIndex = -1;
      v.addEventListener("playing", () => c.classList.add("co-doan"), { once: true }); k.append(v);
    }
    c.append(k); dt.canh.set(m.ma, c); $("dt-canh").append(c);
    return c;
  }
  function dtHien(viTri, huong = 1) {
    const n = dt.ds.length; if (!n) return;
    viTri = ((viTri % n) + n) % n;
    const cu = dt.canh.get(dt.ds[dt.i].ma), m = dt.ds[viTri], moi = dtCanh(m);
    dungThu($("dt-phat"));
    if (cu && cu !== moi) {
      cu.classList.remove("hien", "ra-tren", "ra-duoi"); cu.classList.add(huong > 0 ? "ra-tren" : "ra-duoi");
      cu.querySelector("video")?.pause();
      moi.classList.remove("ra-tren", "ra-duoi"); moi.classList.add(huong > 0 ? "cho-duoi" : "cho-tren");
      void moi.offsetWidth;                                   // để trình duyệt nhận vị trí xuất phát trước khi trượt
      moi.classList.remove("cho-duoi", "cho-tren");
    }
    moi.classList.add("hien");
    const v = moi.querySelector("video"); if (v && dtChay()) { v.currentTime = 0; v.play().catch(() => {}); }
    dt.i = viTri;
    dtCanh(dt.ds[(viTri + 1) % n]);                            // tải sẵn mẫu kế tiếp
    $("dt-ma").textContent = m.ma; $("dt-dem").textContent = `${viTri + 1}/${n}`;
    $("dt-nganh").textContent = m.nhom; $("dt-ten").textContent = m.ten; $("dt-kieu").textContent = m.kieu || "";
    $("dt-mo").setAttribute("aria-label", `Phát video mẫu ${m.ma}: ${m.ten}, có tiếng`);
    [$("dt-duoi"), $("dt-man")].forEach(e => { e.classList.remove("doi"); void e.offsetWidth; e.classList.add("doi"); });
    dtCapNhat();
  }
  function dtCapNhat() {
    clearTimeout(dt.hen);
    const chay = dtChay(), tien = $("dt-tien");
    $("dt-man").classList.toggle("dung", !chay);
    tien.classList.remove("chay"); void tien.offsetWidth;
    if (chay) { tien.classList.add("chay"); dt.hen = setTimeout(() => dtHien(dt.i + 1, 1), DT_LUOT); }
  }
  function veDienThoai() {
    const uuTien = maNoiBat.map(ma => mau[ma]).filter(Boolean);
    dt.ds = [...uuTien, ...cauHinh.mau.filter(m => !maNoiBat.includes(m.ma))];
    if (!dt.ds.length) return;
    $("dt-tien").style.animationDuration = `${DT_LUOT}ms`;
    dtHien(0);
    $("dt-mo").addEventListener("click", () => { if (dt.vuot) { dt.vuot = false; return; } moXem(dt.ds, dt.ds[dt.i].ma); });
    $("dt-truoc").addEventListener("click", () => dtHien(dt.i - 1, -1));
    $("dt-sau").addEventListener("click", () => dtHien(dt.i + 1, 1));
    const may = $("dien-thoai");
    // Máy tính: rê chuột vào máy thì dừng lướt và phát thử video thật (không tiếng) của mẫu đang hiện.
    may.addEventListener("pointerenter", e => {
      if (e.pointerType !== "mouse") return;
      dt.re = true; dtCapNhat();
      clearTimeout(dt.henPhat);
      dt.henPhat = setTimeout(() => { const p = $("dt-phat"); p._mau = dt.ds[dt.i]; if (!p._mau.doan) phatThu(p); }, 450);
    });
    may.addEventListener("pointerleave", e => {
      if (e.pointerType !== "mouse") return;
      clearTimeout(dt.henPhat); dungThu($("dt-phat")); dt.re = false; dtCapNhat();
    });
    // Điện thoại: vuốt ngang trên máy để đổi mẫu (vuốt dọc vẫn là cuộn trang).
    let x0 = null, y0 = null;
    may.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    may.addEventListener("touchend", e => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { dt.vuot = true; setTimeout(() => { dt.vuot = false; }, 400); dtHien(dt.i + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); }
    }, { passive: true });
    if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { dt.trongTam = e.isIntersecting; dtCapNhat(); }, { threshold: 0.15 }).observe(may);
    document.addEventListener("visibilitychange", dtCapNhat);
    $("xem").addEventListener("close", dtCapNhat);
    $("bat-dau-hop").addEventListener("close", dtCapNhat);
  }

  // Tên nền tảng trong tiêu đề đổi lần lượt; nhãn nền tảng cạnh điện thoại sáng lên cùng lúc.
  function ganXoay() {
    const chu = [...document.querySelectorAll("#xoay > span")], nhan = [...document.querySelectorAll(".dt-nen-tang li")];
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

  // Dải chữ chạy dưới màn hình đầu: các ngành hàng đã có mẫu.
  function veDaiChu() {
    const cacNhom = [...new Set(cauHinh.mau.map(m => m.nhom))];
    const muc = [...cacNhom, "Video dọc 9:16", "TikTok", "Facebook", "Instagram"];
    const mot = () => muc.flatMap(t => [tao("span", "dai-chu-muc", t), tao("span", "dai-chu-sao", "✦")]);
    $("dai-chu").append(...mot(), ...mot());
  }

  function veMau() {
    veTuong();
    document.addEventListener("visibilitychange", () => { if (document.hidden) dungTatCa(); else chayLaiDoan(); });
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

  // ---------- Gợi ý kiểu video: 3 câu bấm một lần, rồi gợi ý mẫu ----------
  // Câu hỏi và lựa chọn lấy từ cau_hoi.json (câu 2, 7, 4) để câu trả lời ghép thẳng vào yêu cầu tư vấn.
  // Bảng dưới đây quyết định mẫu nào được gợi ý; sửa khi có thêm mẫu mới.
  const CAU_GOI_Y = [[2, "nhom"], [7, "noi_dang"], [4, "muc_dich"]];
  const NGANH_CUA_MAU = { "Mỹ phẩm, làm đẹp": "Làm đẹp", "Đồ ăn, thức uống": "Đồ ăn, thức uống", "Ứng dụng, phần mềm": "Ứng dụng", "Cửa hàng, dịch vụ": "Trường học, dịch vụ" };
  const KIEU_THEO_NGANH = { "Thời trang": ["Người mẫu giới thiệu sản phẩm", "Người thật, đời thường"] };
  const KIEU_THEO_MUC_DICH = {
    "Bán hàng": ["Người mẫu giới thiệu sản phẩm", "Video vui, gây chú ý"],
    "Giới thiệu thương hiệu": ["Chỉ có sản phẩm, sang trọng", "Người thật, đời thường"],
    "Ra mắt sản phẩm mới": ["Chỉ có sản phẩm, sang trọng", "Video vui, gây chú ý"],
    "Thông báo khuyến mãi": ["Video vui, gây chú ý", "Hoạt hình"],
  };
  let goiY = { buoc: 0, tra_loi: {} }, goiYChon = null;
  function mauGoiY(tl) {
    const nganh = tl["2.nhom"], mucDich = tl["4.muc_dich"];
    const diem = m => (NGANH_CUA_MAU[nganh] === m.nhom ? 3 : 0) + ((KIEU_THEO_NGANH[nganh] || []).includes(m.kieu) ? 2 : 0)
      + ((KIEU_THEO_MUC_DICH[mucDich] || []).includes(m.kieu) ? 2 : 0) + (m.nhom === "Tuyển dụng" ? -3 : 0) + (m.hien === "video" || m.doan ? 0.5 : 0);
    return cauHinh.mau.map((m, i) => ({ m, d: diem(m), i })).sort((a, b) => b.d - a.d || a.i - b.i).slice(0, 3).map(x => x.m);
  }
  const chuGoiY = tl => [tl["2.nhom"], ...(tl["7.noi_dang"] || []), tl["4.muc_dich"]].filter(Boolean).join(", ");
  function veGoiY() {
    const than = $("goi-y-than");
    if (goiY.buoc < CAU_GOI_Y.length) {
      const [so, id] = CAU_GOI_Y[goiY.buoc], c = cau.find(x => x.so === so), t = c.truong.find(x => x.id === id);
      const tieuDe = tao("h3", "", c.cau); tieuDe.tabIndex = -1;
      const day = tao("div", "chon"); day.setAttribute("role", "group"); day.setAttribute("aria-label", c.cau);
      t.lua_chon.map(tenLuaChon).forEach(lc => {
        const b = tao("button", "", lc); b.type = "button";
        b.addEventListener("click", () => {
          goiY.tra_loi[`${so}.${id}`] = t.kieu === "nhieu" ? [lc] : lc; goiY.buoc += 1; veGoiY();
          than.querySelector("h3")?.focus({ preventScroll: true });
        });
        day.append(b);
      });
      const hang = tao("div", "goi-y-buoc"); hang.append(tao("span", "", `Câu ${goiY.buoc + 1} trên ${CAU_GOI_Y.length}`));
      if (goiY.buoc > 0) { const lui = tao("button", "nut-chu", "Quay lại câu trước"); lui.type = "button"; lui.addEventListener("click", () => { goiY.buoc -= 1; veGoiY(); }); hang.append(lui); }
      const thanh = tao("div", "goi-y-thanh"), day2 = tao("div"); day2.style.width = `${goiY.buoc / CAU_GOI_Y.length * 100}%`; thanh.append(day2);
      than.replaceChildren(hang, thanh, tieuDe, day);
      return;
    }
    const ds = mauGoiY(goiY.tra_loi); let chon = ds[0];
    const tieuDe = tao("h3", "", "Những mẫu hợp với sản phẩm của anh chị"); tieuDe.tabIndex = -1;
    const tomTat = tao("p", "goi-y-tom-tat", `Anh chị đã chọn: ${chuGoiY(goiY.tra_loi)}. Bấm vào ảnh để xem video có tiếng.`);
    const luoi = tao("ul", "goi-y-ket-qua"), nutChon = [];
    ds.forEach(m => {
      const li = tao("li"), the = nutMau(m, () => ds, true, false, "nho"), b = tao("button", "nut-chu chon-mau", "Chọn mẫu này"); b.type = "button";
      the.querySelector(".khung").append(tao("span", "nhan-nganh", m.nhom)); ganDoan(the);
      b.addEventListener("click", () => { chon = m; nutChon.forEach(([x, mx]) => { x.setAttribute("aria-pressed", String(mx === m)); x.textContent = mx === m ? "Đã chọn" : "Chọn mẫu này"; x.closest("li").classList.toggle("da-chon", mx === m); }); });
      nutChon.push([b, m]); li.append(the, b); luoi.append(li);
    });
    nutChon.forEach(([x, mx]) => { x.setAttribute("aria-pressed", String(mx === chon)); x.textContent = mx === chon ? "Đã chọn" : "Chọn mẫu này"; x.closest("li").classList.toggle("da-chon", mx === chon); });
    const form = formNhanh({ tieuDe: "Nhận phương án và báo giá theo mẫu anh chị chọn", nutGui: "Gửi cho tôi phương án và báo giá",
      layMau: () => chon, layThem: () => ({ ...goiY.tra_loi }) });
    const lai = tao("button", "nut-chu", "Trả lời lại 3 câu"); lai.type = "button";
    lai.addEventListener("click", () => { goiY = { buoc: 0, tra_loi: {} }; veGoiY(); than.querySelector("h3")?.focus({ preventScroll: true }); });
    than.replaceChildren(tieuDe, tomTat, luoi, form, lai);
  }

  // ---------- Thanh nút dưới đáy màn hình điện thoại ----------
  let capNhatThanhDuoi = () => {};
  function ganThanhDuoi() {
    const thanh = $("thanh-duoi"), nutDau = document.querySelector(".hero-footer .hang-nut");
    if (!("IntersectionObserver" in window) || !nutDau) return;
    let quaNutDau = false, thayForm = false, thayGoiY = false;
    capNhatThanhDuoi = () => {
      thanh.hidden = !(quaNutDau && !thayForm && !thayGoiY && !$("mo-dau").hidden);
      document.body.classList.toggle("co-thanh-duoi", !thanh.hidden);
    };
    new IntersectionObserver(([e]) => { quaNutDau = !e.isIntersecting && e.boundingClientRect.top < 0; capNhatThanhDuoi(); }).observe(nutDau);
    new IntersectionObserver(([e]) => { thayForm = e.isIntersecting; capNhatThanhDuoi(); }).observe($("tu-van"));
    new IntersectionObserver(([e]) => { thayGoiY = e.isIntersecting; capNhatThanhDuoi(); }, { rootMargin: "-25% 0px -25% 0px" }).observe($("goi-y-than"));
  }

  // ---------- Trình xem video ----------
  let dsXem = [], viTriXem = 0, kieuCho = "";
  function veXem() {
    const m = dsXem[viTriXem], khung = $("xem-khung"), f = tao("iframe");
    $("xem-ma").textContent = m.ma; $("xem-ten").textContent = m.ten;
    $("xem-dem").textContent = `Mẫu ${viTriXem + 1} trên ${dsXem.length}`;
    f.referrerPolicy = "strict-origin-when-cross-origin";
    f.src = `${YT}/embed/${encodeURIComponent(m.id)}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
    f.title = `Video mẫu ${m.ma}: ${m.ten}`; f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen"; f.allowFullscreen = true;
    khung.style.backgroundImage = `url("/anh-mau/${m.ma}.jpg")`; khung.replaceChildren(f);
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
    hop.addEventListener("close", () => { $("xem-khung").replaceChildren(); requestAnimationFrame(chayLaiDoan); });
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
      vung.scrollIntoView({ block: "start", behavior: itChuyenDong ? "instant" : "smooth" }); vung.querySelector("input")?.focus({ preventScroll: true });
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
      oRieng.placeholder = "Hoặc anh chị tự điền câu trả lời khác"; oRieng.setAttribute("aria-label", "Câu trả lời khác của anh chị");
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
        bao.textContent = `Ảnh nặng quá ${Math.floor(cauHinh.anh.nang_nhat / 1048576)} MB. Anh chị vui lòng chọn ảnh nhẹ hơn.`; bao.hidden = false; o.value = ""; veDs(); return;
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
          $("tien-do-luu").textContent = "Phiếu đã gửi. Anh chị vui lòng tải lại trang.";
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
      if (t.bat_buoc && !co) return t.nhan ? `Anh chị vui lòng trả lời mục “${t.nhan}”.` : "Anh chị vui lòng chọn hoặc điền một câu trả lời.";
      if (t.kiem_tra === "lien_he" && co) {
        const kenh = traLoi[`${c.so}.kenh`], v = traLoi[k];
        if ((kenh === "Zalo" || kenh === "Điện thoại") && !SDT.test(v.replace(/[\s.\-()]/g, ""))) return "Số điện thoại chưa đúng. Anh chị vui lòng nhập đủ 10 số, ví dụ 0901 234 567.";
        if (kenh === "Email" && !EMAIL.test(v)) return "Địa chỉ email chưa đúng. Anh chị vui lòng xem lại, ví dụ ten@gmail.com.";
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
    if (!$("dong-y").checked) { loi.textContent = "Anh chị vui lòng đánh dấu ô đồng ý trước khi gửi."; loi.hidden = false; $("dong-y").focus(); return; }
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
    ["mo-dau", "mau", "cach-lam", "tu-van", "hoi-dap", "phieu", "cam-on"].forEach(id => { $(id).hidden = man === "dau" ? (id === "phieu" || id === "cam-on") : id !== man; });
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
        loi.textContent = "Chưa tải được phiếu cũ. Anh chị vui lòng kiểm tra mạng rồi thử lại."; loi.hidden = false; return;
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
        $("dang-do").textContent = "Chưa tải được phiếu đang dở. Anh chị vui lòng kiểm tra mạng rồi tải lại trang.";
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
      $("dang-do").textContent = `Anh chị đang điền dở một phiếu, đã trả lời ${so} trên ${cau.length} câu. Bấm “Tiếp tục điền phiếu” để làm tiếp từ chỗ đang dừng.`; $("dang-do").hidden = false;
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
      if (!t || !Object.keys(du).length) { $("bs-loi").textContent = "Anh chị chưa chọn hoặc điền câu nào."; $("bs-loi").hidden = false; return; }
      $("bs-gui").disabled = true; $("bs-gui").textContent = "Đang gửi…";
      try {
        await goi("/api/tu-van/bo-sung", { method: "POST", body: JSON.stringify({ ...du, ma_gui: t.ma_gui }), signal: AbortSignal.timeout(15000) });
        const daCo = { "19.ten": du.ten, "17.han": du.han, "18.ngan_sach": du.ngan_sach, "7.noi_dang": du.noi_dang };
        Object.keys(daCo).forEach(k => { if (!daCo[k]) delete daCo[k]; });
        nho.ghi(KHOA_TU_VAN, JSON.stringify({ ...t, bo_sung: { ...(t.bo_sung || {}), ...daCo } }));
        $("form-bo-sung").hidden = true; $("bs-xong").hidden = false; $("bs-xong").focus?.();
      } catch (err) { $("bs-loi").textContent = err.trangThai ? err.message : "Chưa gửi được. Anh chị vui lòng kiểm tra mạng rồi thử lại."; $("bs-loi").hidden = false; }
      finally { $("bs-gui").disabled = false; $("bs-gui").textContent = "Gửi thêm thông tin"; }
    });
  }
  function chonTuVan(m, traLoiGoiY) {
    maGuiNhanh = "";
    if (traLoiGoiY) { goiYChon = traLoiGoiY; $("tv-goi-y").textContent = `Anh chị đã chọn: ${chuGoiY(traLoiGoiY)}.`; $("tv-goi-y").hidden = false; }
    if (m) { mauTuVan = m.ma; $("tv-mau-ten").textContent = `${m.ma} · ${m.ten}`; $("tv-mau").hidden = false; }
    $("tv-thanh-cong").hidden = true; $("form-tu-van").hidden = false;
    $("tu-van").scrollIntoView({ block: "start", behavior: itChuyenDong ? "instant" : "smooth" });
    $("tv-san-pham").focus({ preventScroll: true });
  }
  const taoMaGui = () => [...crypto.getRandomValues(new Uint8Array(24))].map(v => v.toString(16).padStart(2, "0")).join("");
  function loiNhanh(sanPham, lienHe, dongY) {
    if (!sanPham) return ["san-pham", "Anh chị vui lòng cho biết tên sản phẩm."];
    if (!/^(?:0\d{9}|\+?84\d{9})$/.test(lienHe.replace(/[\s.\-()]/g, ""))) return ["lien-he", "Anh chị vui lòng kiểm tra số điện thoại, ví dụ 0901 234 567."];
    if (!dongY) return ["dong-y", "Anh chị vui lòng đánh dấu ô đồng ý để chúng tôi liên hệ."];
    return null;
  }
  async function guiNhanh(du) {
    const kq = await goi("/api/tu-van", { method: "POST", body: JSON.stringify({ ...du, dong_y: true, nguon: nguon() }), signal: AbortSignal.timeout(15000) });
    if (kq.da_gui !== true) throw new Error("Chưa xác nhận được yêu cầu. Anh chị vui lòng thử lại.");
  }
  const loiMang = err => err.trangThai ? err.message : "Chưa gửi được. Anh chị vui lòng kiểm tra mạng rồi thử lại; thông tin đang điền vẫn còn.";
  // Gửi xong ở bất kỳ đâu: ghi nhớ để điền sẵn phiếu chi tiết, và chuyển phần tư vấn sang bước hỏi thêm.
  function sauKhiGuiNhanh(du) {
    nho.ghi(KHOA_TU_VAN, JSON.stringify({ ma_gui: du.ma_gui, san_pham: du.san_pham, lien_he: du.lien_he, kenh: du.kenh,
      kieu: mau[du.ma_mau]?.kieu || "", them: du.them || {}, luc: Date.now() }));
    $("tv-san-pham-da-gui").textContent = du.san_pham; $("tv-kenh-da-gui").textContent = du.kenh === "Zalo" ? "Zalo" : "điện thoại";
    goiYChon = null; mauTuVan = ""; maGuiNhanh = ""; $("tv-goi-y").hidden = true; $("tv-mau").hidden = true;
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
    const [hopSp, sp] = o("Sản phẩm của anh chị", "text", "san-pham", cu?.san_pham, "Ví dụ: son dưỡng, cà phê, ứng dụng…");
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
      tao("p", "form-goi-y", `Chúng tôi phản hồi trong ${cauHinh.hen_phan_hoi}. Thông tin chỉ được gửi khi anh chị bấm nút.`));
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
        xong.append(tao("span", "dau-xong", "✓"), tao("h4", "", "Chúng tôi đã nhận yêu cầu của anh chị."),
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
      const du = { san_pham: sanPham, lien_he: lienHe, kenh, ma_mau: mauTuVan, them: goiYChon || {}, ma_gui: maGuiNhanh, trang_web: $("tv-trang-web").value };
      const truong = [...form.querySelectorAll("input, button")]; truong.forEach(o => { o.disabled = true; }); $("tv-gui").textContent = "Đang gửi yêu cầu…";
      try { await guiNhanh(du); sauKhiGuiNhanh(du); $("tv-cam-on").focus(); }
      catch (err) { loi.textContent = loiMang(err); loi.hidden = false; }
      finally { truong.forEach(o => { o.disabled = false; }); $("tv-gui").innerHTML = nutGoc; }
    });
    $("bat-dau-huy").addEventListener("click", () => $("bat-dau-hop").close());
    $("bat-dau-nhanh").addEventListener("click", () => { $("bat-dau-hop").close(); $("tu-van").scrollIntoView({ block: "start" }); $("tv-san-pham").focus({ preventScroll: true }); });
    $("bat-dau-xac-nhan").addEventListener("click", () => {
      if (!$("dong-y-luu").checked) {
        $("loi-dong-y-luu").textContent = "Anh chị vui lòng đồng ý lưu bản nháp trước khi bắt đầu."; $("loi-dong-y-luu").hidden = false; $("dong-y-luu").focus(); return;
      }
      $("loi-dong-y-luu").hidden = true; batDau();
    });
  }

  async function khoiDong() {
    // Bộ câu hỏi và danh sách mẫu được máy chủ gắn sẵn vào trang; chỉ gọi thêm khi phần gắn sẵn bị thiếu.
    try { cauHinh = JSON.parse($("cau-hinh").textContent); } catch { cauHinh = null; }
    try { if (!cauHinh || !cauHinh.bo_cau_hoi) cauHinh = await goi("/api/cau-hinh"); }
    catch (e) { const loi = $("loi-mo-dau"); loi.textContent = "Trang chưa tải được bộ câu hỏi. Anh chị vui lòng tải lại trang."; loi.hidden = false; return; }
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
    veMau(); veGoiY(); ganXem(); ganTuVan(); ganBoSung(); ganThanhDuoi();
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
