// Trang nhân viên, thẻ "Bộ câu hỏi": xem và sửa câu hỏi của từng loại video.
// Bấm "Lưu và áp dụng" là khách thấy ngay; mỗi lần lưu là một bản trong lịch sử, khôi phục được.
// Máy chủ kiểm lại mọi thay đổi (kiem_bo trong may_chu.py); ở đây chỉ chặn sớm các lỗi dễ thấy.
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const tao = (the, lop, chu) => { const e = document.createElement(the); if (lop) e.className = lop; if (chu != null) e.textContent = chu; return e; };
  const nut = (chu, lop = "nut-chu") => { const b = tao("button", lop, chu); b.type = "button"; return b; };

  async function goi(duong, tuy = {}) {
    let r;
    try { r = await fetch(duong, { cache: "no-store", credentials: "same-origin", ...tuy, headers: tuy.body ? { "Content-Type": "application/json" } : undefined }); }
    catch { throw new Error("Chưa kết nối được máy chủ. Anh chị vui lòng kiểm tra mạng rồi thử lại."); }
    let du = {};
    try { du = await r.json(); } catch { /* không có nội dung */ }
    if (!r.ok) {
      const loi = new Error(r.status === 401 ? "Phiên đăng nhập đã hết. Anh chị tải lại trang để đăng nhập lại." : du.loi?.thong_bao || "Chưa kết nối được máy chủ.");
      loi.ma = r.status; throw loi;
    }
    return du;
  }

  let du = null;            // dữ liệu máy chủ: bo, lich_su, khoa, kieu_o, dang_dung_goc
  let ban = null;           // bản đang sửa
  let banLuu = "";          // bản đã lưu (JSON), để biết còn thay đổi chưa lưu
  let soDaLuu = new Set();  // số các câu đã có trên máy chủ; câu mới chưa lưu thì còn đổi được cách trả lời
  let loai = "", daTai = false, dem = 0;
  const dangMo = new Set(); // số câu đang mở để sửa

  const sao = x => JSON.parse(JSON.stringify(x));
  const theoSo = so => ban.cau_hoi.find(c => c.so === so);
  const loaiDang = () => ban.loai.find(l => l.id === loai);
  const tenLc = lc => typeof lc === "string" ? lc : lc.ten;
  const coThayDoi = () => !!ban && JSON.stringify(ban) !== banLuu;
  const maMoi = () => `sc-o-${++dem}`;
  const luc = s => { const m = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)/.exec(s || ""); return m ? `${m[4]}:${m[5]} ngày ${m[3]}/${m[2]}/${m[1]}` : s; };
  const ngan = (s, n = 70) => s.length > n ? `${s.slice(0, n - 1)}…` : s;
  const dungO = so => ban.loai.filter(l => l.cau.includes(so));

  function bao(chu, loi = false) { const p = $("sc-bao"); p.textContent = chu; p.classList.toggle("loi", loi); p.hidden = !chu; }
  function baoLuu(chu) { $("sc-luu-loi").textContent = chu; $("sc-luu-loi").hidden = !chu; }
  function capNhatLuu() { $("sc-luu").hidden = !coThayDoi(); baoLuu(""); }   // sửa tiếp thì bỏ câu báo lỗi lưu cũ

  // ---------- Hai thẻ: yêu cầu của khách / bộ câu hỏi ----------
  const the = { phieu: $("the-phieu"), "cau-hoi": $("the-cau-hoi") };
  function moThe(ten, dua = false) {
    const cauHoi = ten === "cau-hoi";
    the.phieu.setAttribute("aria-selected", String(!cauHoi)); the["cau-hoi"].setAttribute("aria-selected", String(cauHoi));
    the.phieu.tabIndex = cauHoi ? -1 : 0; the["cau-hoi"].tabIndex = cauHoi ? 0 : -1;
    $("khu-phieu").hidden = cauHoi; $("khu-cau-hoi").hidden = !cauHoi;
    history.replaceState(null, "", cauHoi ? "#bo-cau-hoi" : location.pathname + location.search);
    if (dua) the[ten].focus();
    if (cauHoi && !daTai && !$("bang").hidden) taiBo();
  }
  Object.entries(the).forEach(([ten, b]) => {
    b.addEventListener("click", () => moThe(ten));
    b.addEventListener("keydown", e => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      moThe(e.key === "Home" ? "phieu" : e.key === "End" ? "cau-hoi" : ten === "phieu" ? "cau-hoi" : "phieu", true);
    });
  });
  // Khu vực nhân viên chỉ hiện sau khi đăng nhập (nhan-vien.js): lúc đó mới tải bộ câu hỏi.
  new MutationObserver(() => { if (!$("bang").hidden && !$("khu-cau-hoi").hidden && !daTai) taiBo(); })
    .observe($("bang"), { attributes: true, attributeFilter: ["hidden"] });
  if (location.hash === "#bo-cau-hoi") moThe("cau-hoi");
  window.addEventListener("beforeunload", e => { if (coThayDoi()) { e.preventDefault(); e.returnValue = ""; } });

  // ---------- Tải và hiện ----------
  async function taiBo() {
    daTai = true; $("sc-loi-tai").hidden = true; $("sc-dang-dung").textContent = "Đang tải bộ câu hỏi…";
    try { nhan(await goi("/api/nhan-vien/bo-cau-hoi")); }
    catch (e) { daTai = false; $("sc-dang-dung").textContent = ""; $("sc-loi-tai").textContent = e.message; $("sc-loi-tai").hidden = false; }
  }
  function nhan(d) {
    du = d; ban = sao(d.bo); banLuu = JSON.stringify(ban); soDaLuu = new Set(ban.cau_hoi.map(c => c.so));
    if (!ban.loai.some(l => l.id === loai)) loai = ban.bo_mac_dinh;
    const ls = du.lich_su[0];
    $("sc-dang-dung").textContent = du.dang_dung_goc
      ? (ls ? `Khách đang thấy bản gốc (khôi phục lúc ${luc(ls.tao_luc)}).` : "Khách đang thấy bản gốc, chưa sửa lần nào.")
      : `Khách đang thấy bản sửa lúc ${luc(ls.tao_luc)}${ls.ghi_chu ? `: ${ls.ghi_chu}` : ""}.`;
    veChonLoai(); veLichSu(); ve(); capNhatLuu();
    $("sc-khung").hidden = false; $("sc-lich-su-hop").hidden = false;
  }
  function veChonLoai() {
    $("sc-loai").replaceChildren(...ban.loai.map(l => { const o = tao("option", "", `${l.ten} (${l.cau.length} câu)`); o.value = l.id; return o; }));
    $("sc-loai").value = loai;
  }
  $("sc-loai").addEventListener("change", () => { loai = $("sc-loai").value; dangMo.clear(); bao(""); ve(); });
  $("sc-ten-loai").addEventListener("input", () => {
    loaiDang().ten = $("sc-ten-loai").value; $("sc-loai").selectedOptions[0].textContent = `${loaiDang().ten} (${loaiDang().cau.length} câu)`;
    capNhatLuu();
  });
  $("sc-mo-ta-loai").addEventListener("input", () => { loaiDang().mo_ta = $("sc-mo-ta-loai").value; capNhatLuu(); });
  $("sc-mo-het").addEventListener("click", () => {
    const moHet = $("sc-mo-het").dataset.mo !== "1";
    loaiDang().cau.forEach(so => { if (moHet) dangMo.add(so); else dangMo.delete(so); });
    ve();
  });

  // Lựa chọn đang làm điều kiện hiện câu, hiện ô khác: chưa đổi tên hay xóa được (máy chủ cũng chặn).
  function luaChonDieuKien() {
    const m = new Map(), them = (k, v) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(v); };
    ban.cau_hoi.forEach(c => {
      if (c.hien_khi) them(c.hien_khi.khoa, c.hien_khi.co);
      c.truong.forEach(t => { if (t.chi_khi) them(t.chi_khi.khoa, t.chi_khi.co); if (t.bo_qua_neu) them(`${c.so}.${t.bo_qua_neu.truong}`, t.bo_qua_neu.la); });
    });
    return m;
  }
  function tomTat(c) {
    return c.truong.map(t => {
      const dau = (c.truong.length > 1 && t.nhan ? `${t.nhan}: ` : "") + du.kieu_o[t.kieu];
      if (t.lua_chon) return `${dau}: ${t.lua_chon.map(tenLc).filter(Boolean).join(", ") || "chưa có lựa chọn"}`;
      return t.vi_du ? `${dau} (ví dụ: ${t.vi_du})` : dau;
    }).join("; ");
  }

  // Vẽ lại phần của loại đang chọn. sau(): việc làm sau khi vẽ, như đưa con trỏ vào ô vừa thêm.
  function ve(sau) {
    const l = loaiDang();
    if (document.activeElement !== $("sc-ten-loai")) $("sc-ten-loai").value = l.ten;
    if (document.activeElement !== $("sc-mo-ta-loai")) $("sc-mo-ta-loai").value = l.mo_ta || "";
    $("sc-xem").href = `/phieu/${l.id}`;
    const khoa = new Set([...du.khoa.cau_khong_bo["*"], ...(du.khoa.cau_khong_bo[l.id] || [])]);
    const cauLoai = l.cau.map(theoSo), dk = luaChonDieuKien();
    $("sc-dem").textContent = `${cauLoai.length} câu, chia ${new Set(cauLoai.map(c => c.nhom)).size} phần`;
    const moHet = cauLoai.length > 0 && cauLoai.every(c => dangMo.has(c.so));
    $("sc-mo-het").textContent = moHet ? "Thu gọn tất cả câu" : "Mở tất cả câu"; $("sc-mo-het").dataset.mo = moHet ? "1" : "";
    let stt = 0;
    $("sc-ds").replaceChildren(...ban.nhom.filter(n => n.id !== "loai-video").map(n => {
      const ds = cauLoai.filter(c => c.nhom === n.id), khoi = tao("section", "sc-phan");
      khoi.dataset.nhom = n.id;
      khoi.append(tao("h3", "", n.ten));
      if (!ds.length) khoi.append(tao("p", "sc-trong", "Loại này chưa có câu nào ở phần này, nên phiếu bỏ qua phần này."));
      ds.forEach((c, i) => khoi.append(theCau(c, ++stt, i, ds, khoa, l, dk)));
      khoi.append(oThem(n, l));
      return khoi;
    }));
    if (sau) sau();
  }

  function theCau(c, stt, i, ds, khoa, l, dk) {
    const d = tao("details", "sc-cau"), s = tao("summary"), moi = !soDaLuu.has(c.so), chung = dungO(c.so);
    d.dataset.so = c.so; d.open = dangMo.has(c.so);
    d.addEventListener("toggle", () => { if (d.open) dangMo.add(c.so); else dangMo.delete(c.so); });
    const chu = tao("b", "", c.cau || "Câu mới, chưa có chữ"), tom = tao("small", "", tomTat(c)), giua = tao("span", "sc-tom");
    giua.append(chu, tom);
    const nhan = tao("span", "sc-nhan-ds");
    if (moi) nhan.append(tao("span", "sc-nhan moi", "Câu mới, chưa lưu"));
    if (c.hien_khi) nhan.append(tao("span", "sc-nhan", "Có điều kiện"));
    if (chung.length > 1) nhan.append(tao("span", "sc-nhan", `Dùng chung ${chung.length} loại`));
    s.append(tao("span", "sc-stt", `Câu ${stt}`), giua, nhan);
    const capTom = () => { chu.textContent = c.cau || "Câu mới, chưa có chữ"; tom.textContent = tomTat(c); capNhatLuu(); };
    d.append(s, thanCau(c, i, ds, khoa, l, dk, chung, moi, capTom));
    return d;
  }

  function oChu(nhan, giaTri, toiDa, khiDoi, { doan = false, buoc = false } = {}) {
    const hop = tao("div", "sc-o"), id = maMoi(), l = tao("label", "nhan", nhan), o = tao(doan ? "textarea" : "input");
    l.htmlFor = id; o.id = id; o.maxLength = toiDa; o.value = giaTri;
    if (doan) o.rows = 2; else o.type = "text";
    if (buoc) o.required = true;
    o.addEventListener("input", () => khiDoi(o.value));
    hop.append(l, o); return hop;
  }
  function oTich(nhan, bat, khiDoi, khoa = "") {
    const l = tao("label", "sc-tich"), o = tao("input"); o.type = "checkbox"; o.checked = bat; o.disabled = !!khoa;
    o.addEventListener("change", () => khiDoi(o.checked));
    l.append(o, tao("span", "", nhan));
    if (khoa) l.append(tao("small", "", khoa));
    return l;
  }

  function thanCau(c, i, ds, khoa, l, dk, chung, moi, capTom) {
    const than = tao("div", "sc-than");
    than.append(oChu("Câu hỏi", c.cau, 300, v => { c.cau = v; capTom(); }, { doan: true, buoc: true }),
      oChu("Gợi ý nhỏ dưới câu hỏi (không bắt buộc)", c.goi_y || "", 300, v => { if (v) c.goi_y = v; else delete c.goi_y; capTom(); }));
    if (chung.length > 1) than.append(tao("p", "sc-ghi", `Câu này dùng chung cho ${chung.length} loại: ${chung.map(x => x.ten).join(", ")}. Sửa chữ hay lựa chọn ở đây là sửa cho cả ${chung.length} loại.`));
    if (c.hien_khi) {
      const goc = theoSo(Number(c.hien_khi.khoa.split(".")[0]));
      than.append(tao("p", "sc-ghi", `Câu này chỉ hiện khi khách chọn “${c.hien_khi.co}” ở câu “${goc ? ngan(goc.cau) : ""}”.`));
    }
    c.truong.forEach(t => than.append(oTraLoi(c, t, moi, dk, capTom)));

    const thaoTac = tao("div", "sc-thao-tac");
    const len = nut("Đưa lên"), xuong = nut("Đưa xuống");
    len.disabled = i === 0; xuong.disabled = i === ds.length - 1;
    const doi = k => { const a = l.cau.indexOf(c.so), b = l.cau.indexOf(ds[i + k].so); [l.cau[a], l.cau[b]] = [l.cau[b], l.cau[a]];
      ve(() => { const ds2 = [...document.querySelectorAll(`.sc-cau[data-so="${c.so}"] .sc-thao-tac button`)].slice(0, 2);
        (k < 0 ? [ds2[0], ds2[1]] : [ds2[1], ds2[0]]).find(b => b && !b.disabled)?.focus(); }); capNhatLuu(); };
    len.addEventListener("click", () => doi(-1)); xuong.addEventListener("click", () => doi(1));
    len.setAttribute("aria-label", `Đưa câu “${ngan(c.cau, 40)}” lên trên`); xuong.setAttribute("aria-label", `Đưa câu “${ngan(c.cau, 40)}” xuống dưới`);
    thaoTac.append(len, xuong);
    if (moi) {
      const xoa = nut("Xóa câu mới này", "nut-chu nut-nguy-hiem");
      xoa.addEventListener("click", () => {
        ban.cau_hoi = ban.cau_hoi.filter(x => x.so !== c.so); ban.loai.forEach(x => { x.cau = x.cau.filter(so => so !== c.so); });
        dangMo.delete(c.so); ve(); capNhatLuu(); bao("Đã xóa câu mới chưa lưu.");
      });
      thaoTac.append(xoa);
    } else {
      const bo = nut("Bỏ khỏi loại này", "nut-chu nut-nguy-hiem");
      if (khoa.has(c.so)) {
        bo.disabled = true;
        thaoTac.append(bo, tao("small", "sc-ghi-nho", c.so === 19 ? "Câu liên hệ: loại nào cũng cần." : "Phần tư vấn nhanh và chọn mẫu ở trang chủ dùng câu này."));
      } else {
        bo.addEventListener("click", () => {
          // Câu chỉ hiện theo câu này (ví dụ thông tin buổi quay theo "Quay thực tế") cũng bỏ theo, vì sẽ không bao giờ hiện nữa.
          const theo = l.cau.map(theoSo).filter(x => x.hien_khi && x.hien_khi.khoa.startsWith(`${c.so}.`));
          const bo2 = new Set([c.so, ...theo.map(x => x.so)]);
          l.cau = l.cau.filter(so => !bo2.has(so)); bo2.forEach(so => dangMo.delete(so));
          ve(); capNhatLuu(); veChonLoai();
          bao(`Đã bỏ câu “${ngan(c.cau, 50)}” khỏi loại ${l.ten}${theo.length ? ` cùng câu “${ngan(theo[0].cau, 40)}” (câu đó chỉ hiện theo câu này)` : ""}. Câu vẫn còn trong kho, thêm lại được ở cuối phần.`);
        });
        thaoTac.append(bo);
      }
    }
    than.append(thaoTac);
    return than;
  }

  function oTraLoi(c, t, moi, dk, capTom) {
    const hop = tao("fieldset", "sc-truong"), khoaO = `${c.so}.${t.id}`;
    hop.append(tao("legend", "", c.truong.length > 1 ? `${t.nhan || "Ô trả lời"} (${du.kieu_o[t.kieu]})` : moi ? "Ô trả lời" : `Cách trả lời: ${du.kieu_o[t.kieu]}`));
    if (moi) {
      const id = maMoi(), nhan = tao("label", "nhan", "Cách trả lời"), chon = tao("select");
      nhan.htmlFor = id; chon.id = id;
      Object.entries(du.kieu_o).forEach(([k, ten]) => { const o = tao("option", "", ten); o.value = k; chon.append(o); });
      chon.value = t.kieu;
      chon.addEventListener("change", () => {
        t.kieu = chon.value;
        if (["mot", "nhieu"].includes(t.kieu)) { if (!t.lua_chon) t.lua_chon = ["", ""]; delete t.vi_du; }
        else { delete t.lua_chon; delete t.tu_dien; delete t.rieng; }
        if (t.kieu !== "nhieu") delete t.toi_da;
        ve(() => document.querySelector(`.sc-cau[data-so="${c.so}"] select`)?.focus()); capNhatLuu();
      });
      const o = tao("div", "sc-o"); o.append(nhan, chon); hop.append(o);
    }
    if (c.truong.length > 1) hop.append(oChu("Tên ô (hiện phía trên ô)", t.nhan || "", 150, v => { if (v) t.nhan = v; else delete t.nhan; capTom(); }));
    if (["chu", "doan"].includes(t.kieu)) hop.append(oChu("Chữ mẫu mờ trong ô (không bắt buộc)", t.vi_du || "", 150, v => { if (v) t.vi_du = v; else delete t.vi_du; capTom(); }));
    if (t.lua_chon) hop.append(dsLuaChon(c, t, khoaO, dk, capTom));
    const coDinh = du.khoa.bat_buoc_co_dinh.includes(khoaO);
    const tich = tao("div", "sc-tich-ds");
    tich.append(oTich("Bắt buộc trả lời", !!t.bat_buoc, v => { t.bat_buoc = v; capNhatLuu(); }, coDinh ? "Ô liên hệ luôn bắt buộc." : ""));
    if (t.lua_chon) tich.append(oTich("Có ô cho khách tự ghi câu trả lời khác", !!t.tu_dien, v => { if (v) t.tu_dien = true; else delete t.tu_dien; capNhatLuu(); }));
    hop.append(tich);
    if (t.kieu === "nhieu") {
      const id = maMoi(), o = tao("div", "sc-o sc-o-so"), nhan = tao("label", "nhan", "Chọn tối đa (để trống: không giới hạn)"), so = tao("input");
      nhan.htmlFor = id; so.id = id; so.type = "number"; so.min = "1"; so.max = "20"; so.inputMode = "numeric"; so.value = t.toi_da || "";
      so.addEventListener("input", () => { const v = parseInt(so.value, 10); if (v >= 1 && v <= 20) t.toi_da = v; else delete t.toi_da; capNhatLuu(); });
      o.append(nhan, so); hop.append(o);
    }
    return hop;
  }

  function dsLuaChon(c, t, khoaO, dk, capTom) {
    const hop = tao("div", "sc-lc");
    hop.append(tao("p", "nhan", "Các lựa chọn"));
    if (du.khoa.lua_chon_co_dinh.includes(khoaO) || t.lua_chon.some(x => typeof x !== "string")) {
      const ul = tao("ul", "sc-lc-khoa"); t.lua_chon.forEach(x => ul.append(tao("li", "", tenLc(x))));
      hop.append(ul, tao("p", "sc-ghi-nho", t.lua_chon.some(x => typeof x !== "string")
        ? "Mỗi lựa chọn gắn với một video mẫu nên chưa sửa ở đây."
        : "Trang dùng các lựa chọn này để kiểm tra số điện thoại, email và tư vấn nhanh nên chưa sửa ở đây."));
      return hop;
    }
    const dangDung = dk.get(khoaO) || new Set(), ol = tao("ol");
    t.lua_chon.forEach((x, j) => {
      const li = tao("li"), id = maMoi(), o = tao("input"), nhan = tao("label", "an-di", `Lựa chọn ${j + 1}`);
      nhan.htmlFor = id; o.id = id; o.type = "text"; o.maxLength = 80; o.value = x;
      const khoa = dangDung.has(x) && x !== "";
      let cu = x;
      o.readOnly = khoa;
      o.addEventListener("input", () => { if (t.rieng === cu) t.rieng = o.value; t.lua_chon[j] = o.value; cu = o.value; capTom(); });
      const bo = nut("Bỏ"); bo.disabled = khoa; bo.setAttribute("aria-label", `Bỏ lựa chọn ${x || j + 1}`);
      bo.addEventListener("click", () => {
        t.lua_chon.splice(j, 1); if (t.rieng === x) delete t.rieng;
        ve(() => document.querySelector(`.sc-cau[data-so="${c.so}"] .sc-lc li:nth-child(${Math.max(1, j)}) input`)?.focus()); capNhatLuu();
      });
      li.append(nhan, o, bo);
      if (khoa) li.append(tao("small", "sc-ghi-nho", "Đang dùng để hiện câu hoặc ô khác"));
      if (t.rieng && t.rieng === x) li.append(tao("small", "sc-ghi-nho", "Chọn mục này thì bỏ các mục khác"));
      ol.append(li);
    });
    const them = nut("Thêm lựa chọn");
    them.disabled = t.lua_chon.length >= 20;
    them.addEventListener("click", () => { t.lua_chon.push(""); ve(() => document.querySelector(`.sc-cau[data-so="${c.so}"] .sc-lc li:last-child input`)?.focus()); capNhatLuu(); });
    hop.append(ol, them);
    return hop;
  }

  // Thêm câu vào cuối một phần: câu mới hoàn toàn, hoặc câu có sẵn trong kho (đang dùng ở loại khác hoặc đã bỏ trước đây).
  function chenVaoLoai(l, so, nhomId) {
    const thuTu = ban.nhom.map(x => x.id), vt = thuTu.indexOf(nhomId);
    let o = l.cau.findIndex(s => thuTu.indexOf(theoSo(s).nhom) > vt);
    if (o < 0) o = l.cau.length;
    l.cau.splice(o, 0, so);
  }
  function oThem(n, l) {
    const hop = tao("div", "sc-them"), moi = nut(`Thêm câu mới vào phần “${n.ten}”`, "nut nho nut-phu");
    moi.addEventListener("click", () => {
      const so = Math.max(du.khoa.so_cau_moi - 1, ...ban.cau_hoi.map(c => c.so)) + 1;
      ban.cau_hoi.push({ so, nhom: n.id, cau: "", truong: [{ id: "tra_loi", kieu: "mot", bat_buoc: true, lua_chon: ["", ""] }] });
      chenVaoLoai(l, so, n.id); dangMo.add(so); veChonLoai();
      ve(() => document.querySelector(`.sc-cau[data-so="${so}"] textarea`)?.focus()); capNhatLuu();
    });
    hop.append(moi);
    const coSan = ban.cau_hoi.filter(c => c.nhom === n.id && !l.cau.includes(c.so) && soDaLuu.has(c.so));
    if (coSan.length) {
      const id = maMoi(), nhan = tao("label", "an-di", `Câu có sẵn để thêm vào phần ${n.ten}`), chon = tao("select"), them = nut("Thêm câu có sẵn", "nut nho nut-phu");
      nhan.htmlFor = id; chon.id = id;
      coSan.forEach(c => { const dung = dungO(c.so); const o = tao("option", "", `${ngan(c.cau, 80)} (${dung.length ? `đang dùng ở ${dung.length} loại` : "chưa dùng ở loại nào"})`); o.value = c.so; chon.append(o); });
      them.addEventListener("click", () => {
        const so = Number(chon.value); chenVaoLoai(l, so, n.id); dangMo.add(so); veChonLoai();
        ve(() => document.querySelector(`.sc-cau[data-so="${so}"] summary`)?.focus()); capNhatLuu();
        bao(`Đã thêm câu “${ngan(theoSo(so).cau, 50)}” vào loại ${l.ten}.`);
      });
      const hang = tao("div", "sc-co-san"); hang.append(nhan, chon, them); hop.append(hang);
    }
    return hop;
  }

  // ---------- Lưu, bỏ thay đổi, lịch sử ----------
  // Chặn sớm lỗi dễ thấy và mở đúng câu bị lỗi; máy chủ vẫn kiểm đầy đủ.
  function kiemTruoc() {
    for (const l of ban.loai) if (!l.ten.trim()) return { loi: "Tên loại video không được để trống.", loai: l.id };
    for (const c of ban.cau_hoi) {
      const o = dungO(c.so)[0];
      if (!o) continue;
      if (c.cau.trim().length < 3) return { loi: `Có câu hỏi chưa ghi chữ ở loại ${o.ten}.`, loai: o.id, so: c.so };
      for (const t of c.truong) {
        if (!t.lua_chon || t.lua_chon.some(x => typeof x !== "string")) continue;
        const ds = t.lua_chon.map(x => x.trim()).filter(Boolean);
        if (ds.length < 2) return { loi: `Câu “${ngan(c.cau, 50)}” cần ít nhất hai lựa chọn có chữ.`, loai: o.id, so: c.so };
        if (new Set(ds).size !== ds.length) return { loi: `Câu “${ngan(c.cau, 50)}” có hai lựa chọn trùng nhau.`, loai: o.id, so: c.so };
      }
    }
    return null;
  }
  async function luu() {
    const k = kiemTruoc();
    if (k) {
      if (k.loai !== loai) { loai = k.loai; veChonLoai(); }
      if (k.so) dangMo.add(k.so);
      ve(() => (k.so ? document.querySelector(`.sc-cau[data-so="${k.so}"] textarea`) : $("sc-ten-loai"))?.focus());
      baoLuu(k.loi); return;
    }
    const b = $("sc-luu-nut"); b.disabled = true; b.textContent = "Đang lưu…"; baoLuu("");
    try {
      // Gửi bản sao đã bỏ các ô lựa chọn để trống; bản đang sửa giữ nguyên nếu lưu chưa được.
      const gui = sao(ban);
      gui.cau_hoi.forEach(c => c.truong.forEach(t => { if (t.lua_chon && t.lua_chon.every(x => typeof x === "string")) t.lua_chon = t.lua_chon.map(x => x.trim()).filter(Boolean); }));
      const d = await goi("/api/nhan-vien/bo-cau-hoi", { method: "PUT", body: JSON.stringify({ bo: gui, phien_ban: du.bo.phien_ban, ghi_chu: $("sc-ghi-chu").value.trim() }) });
      $("sc-ghi-chu").value = ""; nhan(d); bao("Đã lưu. Khách mở phiếu từ bây giờ sẽ thấy bộ câu hỏi mới.");
    } catch (e) {
      baoLuu(e.ma === 409 ? `${e.message} Bấm “Bỏ thay đổi” để tải bản mới nhất.` : e.message);
    } finally { b.disabled = false; b.textContent = "Lưu và áp dụng"; }
  }
  $("sc-luu-nut").addEventListener("click", luu);
  $("sc-bo-doi").addEventListener("click", async () => {
    if (!confirm("Bỏ mọi thay đổi chưa lưu và tải lại bộ câu hỏi đang dùng?")) return;
    dangMo.clear(); bao(""); daTai = false; await taiBo();
  });

  function veLichSu() {
    const ds = du.lich_su;
    $("sc-lich-su").replaceChildren(...(ds.length ? ds.map((b, i) => {
      const li = tao("li");
      li.append(tao("span", "sc-ls-luc", luc(b.tao_luc)), tao("span", "sc-ls-chu", b.ghi_chu || "Không ghi chú"));
      if (i === 0) li.append(tao("span", "sc-nhan", "Khách đang thấy"));
      else { const k = nut("Khôi phục bản này"); k.addEventListener("click", () => khoiPhuc(b.id, `bản lúc ${luc(b.tao_luc)}`)); li.append(k); }
      return li;
    }) : [tao("li", "sc-trong", "Chưa có lần sửa nào.")]));
    $("sc-ve-goc").disabled = du.dang_dung_goc;
  }
  async function khoiPhuc(ma, ten) {
    if (!confirm(`Khôi phục ${ten}? Khách sẽ thấy bản này ngay.${coThayDoi() ? " Các thay đổi chưa lưu sẽ bị bỏ." : ""}`)) return;
    try {
      nhan(await goi("/api/nhan-vien/bo-cau-hoi/khoi-phuc", { method: "POST", body: JSON.stringify({ ma, phien_ban: du.bo.phien_ban }) }));
      dangMo.clear(); ve(); bao(`Đã khôi phục ${ten}. Khách mở phiếu từ bây giờ sẽ thấy bản này.`);
    } catch (e) { bao(e.ma === 409 ? `${e.message} Bấm “Bỏ thay đổi” hoặc tải lại trang.` : e.message, true); }
  }
  $("sc-ve-goc").addEventListener("click", () => khoiPhuc("goc", "bản gốc"));
})();
