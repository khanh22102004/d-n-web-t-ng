/* Đổi ngôn ngữ Việt / Nhật / Anh cho trang khách.
   Cách làm: dịch chữ hiển thị theo từ điển (khóa là câu tiếng Việt); câu trả lời khách chọn vẫn lưu bằng tiếng Việt,
   nên trang nhân viên và file Excel không đổi. Đổi ngôn ngữ thì tải lại trang để mọi hiệu ứng chạy với chữ mới.
   Từ điển (khoảng 30 KB khi nén) nằm riêng ở tu-dien.js và chỉ tải khi khách chọn tiếng Nhật hoặc tiếng Anh:
   khách đọc tiếng Việt (phần lớn) không phải tải. app.js chờ từ điển (window.BP_CHO_DICH) rồi mới dựng phần động.
   Hai tệp này do /tmp/i18n/tao.py sinh ra từ bảng dịch; sửa bản dịch thì sửa bảng rồi sinh lại. */
(() => {
  "use strict";
  const DS = ["vi", "ja", "en"], KHOA = "bp-ngon-ngu";
  let nn = "vi";
  try { nn = localStorage.getItem(KHOA) || "vi"; } catch (e) {}
  const q = new URLSearchParams(location.search).get("lang");
  if (DS.includes(q)) { nn = q; try { localStorage.setItem(KHOA, q); } catch (e) {} }
  if (!DS.includes(nn)) nn = "vi";
  document.documentElement.lang = nn;
  window.BP_NN = nn;

  let T = {}, P = [];
  const vt = nn === "ja" ? 0 : 1;
  const gon = s => s.replace(/\s+/g, " ").trim();
  function dich(s) {
    if (nn === "vi" || s == null) return s;
    const k = gon(String(s));
    if (!k) return s;
    const v = T[k];
    if (v !== undefined) return v[vt];
    for (const [re, ja, en] of P) {
      const m = k.match(re);
      if (m) return (vt ? en : ja).replace(/\{(\d)\}/g, (_, i) => { const g = m[i] || ""; const t = T[gon(g)]; return t !== undefined ? t[vt] : g; });
    }
    return s;
  }
  window.dichChu = dich;

  function ganNut() {
    document.querySelectorAll("[data-doi-nn]").forEach(b => {
      const dung = b.dataset.doiNn === nn;
      b.setAttribute("aria-pressed", String(dung));
      b.addEventListener("click", () => {
        if (b.dataset.doiNn === nn) return;
        try { localStorage.setItem(KHOA, b.dataset.doiNn); } catch (e) {}
        const u = new URL(location.href); u.searchParams.set("lang", b.dataset.doiNn); location.replace(u.href);
      });
    });
  }
  // Bản đồ ở chân trang: máy mạnh tự tải khi cuộn gần tới; máy yếu chỉ tải khi khách bấm "Xem bản đồ" (Google Maps khá nặng).
  function ganBanDo() {
    const c = navigator.connection, yeu = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (c && c.saveData);
    document.querySelectorAll("[data-ban-do]").forEach(k => {
      const mo = () => {
        if (k.querySelector("iframe")) return;
        const f = document.createElement("iframe");
        // Có mã địa điểm Google (data-ban-do-cid) thì mở đúng ghim "B Productions Đà Nẵng"; không thì tìm theo địa chỉ.
        const cid = /^\d+$/.test(k.dataset.banDoCid || "") ? k.dataset.banDoCid : "";
        f.src = cid ? "https://www.google.com/maps?cid=" + cid + "&hl=" + nn + "&z=17&output=embed"
          : "https://www.google.com/maps?q=" + encodeURIComponent(k.dataset.banDo) + "&hl=" + nn + "&z=16&output=embed";
        f.title = dich("Bản đồ đến B PRODUCTIONS"); f.loading = "lazy"; f.referrerPolicy = "no-referrer-when-downgrade"; f.allowFullscreen = true;
        k.appendChild(f);
        const nut = k.querySelector(".ban-do-nut"); if (nut) nut.remove();
      };
      const nut = k.querySelector(".ban-do-nut"); if (nut) nut.addEventListener("click", mo);
      if (!yeu && "IntersectionObserver" in window) {
        const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); mo(); } }, { rootMargin: "300px" });
        io.observe(k);
      }
    });
  }
  const khiSan = f => { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", f); else f(); };
  khiSan(ganNut); khiSan(ganBanDo);
  if (nn === "vi") return;
  // Tải từ điển; không tải được thì trang vẫn chạy bằng tiếng Việt.
  window.BP_CHO_DICH = new Promise(xong => {
    const s = document.createElement("script");
    s.src = "/tu-dien.js?v=cb7519f7fc";
    s.onload = () => { const d = window.BP_TU_DIEN || {}; T = d.T || {}; P = (d.P || []).map(([r, ja, en]) => [new RegExp(r), ja, en]); xong(true); };
    s.onerror = () => xong(false);
    document.head.append(s);
  });

  const THUOC_TINH = ["placeholder", "aria-label", "title", "alt", "data-nhan", "data-goi-y"];
  const boQua = el => !el || !!el.closest("script,style,textarea,[data-khong-dich]");
  const coChuNhat = s => /[\u3040-\u30ff\u3400-\u9fff\uff00-\uffef]/.test(s);
  function dichChuNut(n) {
    const s = n.nodeValue;
    if (!s || !/\S/.test(s) || boQua(n.parentElement)) return;
    let t = dich(s);
    if (t === s) { if (nn === "ja" && gon(s) === ".") t = "。"; else return; }
    const truoc = s.match(/^\s*/)[0], sau = s.match(/\s*$/)[0];
    const moi = nn === "ja" && (coChuNhat(t) || t === "") ? t : truoc + t + sau;
    if (moi !== s) n.nodeValue = moi;
  }
  function dichThuocTinh(el) {
    if (boQua(el)) return;
    for (const a of THUOC_TINH) {
      const v = el.getAttribute(a);
      if (v) { const t = dich(v); if (t !== v) el.setAttribute(a, t); }
    }
  }
  function quet(goc) {
    if (goc.nodeType === 3) return dichChuNut(goc);
    if (goc.nodeType !== 1) return;
    dichThuocTinh(goc);
    const w = document.createTreeWalker(goc, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) dichChuNut(n); else dichThuocTinh(n); }
  }
  window.BP_CHO_DICH.then(co => khiSan(() => {
    if (!co) return;
    document.title = dich(document.title);
    const md = document.querySelector('meta[name="description"]');
    if (md) md.content = dich(md.content);
    quet(document.body);
    new MutationObserver(ds => {
      for (const d of ds) {
        if (d.type === "childList") d.addedNodes.forEach(quet);
        else if (d.type === "characterData") dichChuNut(d.target);
        else if (d.type === "attributes") dichThuocTinh(d.target);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: THUOC_TINH });
  }));
})();
