// Trang nhân viên: đăng nhập, xem số liệu, đọc phiếu, lọc theo loại video, tích chọn nhiều phiếu để tải Excel hoặc xóa.
// Xóa là chuyển vào thùng rác (giữ 30 ngày, khôi phục được); đánh dấu đã liên hệ phải xác nhận và được ghi vào lịch sử phiếu.
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const tao = (the, lop, chu) => { const e = document.createElement(the); if (lop) e.className = lop; if (chu != null) e.textContent = chu; return e; };

  async function goi(duong, tuy = {}) {
    let r;
    try { r = await fetch(duong, { cache: "no-store", credentials: "same-origin", ...tuy, headers: tuy.body ? { "Content-Type": "application/json" } : undefined }); }
    catch { throw new Error("Chưa kết nối được máy chủ. Anh chị vui lòng kiểm tra mạng rồi thử lại."); }
    let du = {};
    try { du = await r.json(); } catch { /* không có nội dung */ }
    if (!r.ok) { const loi = new Error(du.loi?.thong_bao || "Chưa kết nối được máy chủ."); loi.ma = r.status; throw loi; }
    return du;
  }

  let trang = 1, luotTai = 0, tongDangLoc = 0, locDangDung = { tim: "", trang_thai: "", bo: "" };
  // Phiếu đã tích chọn, giữ khi chuyển trang danh sách (mã phiếu -> tên để hiện khi hỏi xác nhận).
  const daChon = new Map();
  const coLoc = () => !!(locDangDung.tim || locDangDung.bo || (locDangDung.trang_thai && locDangDung.trang_thai !== "da-xoa"));
  const trongThungRac = () => locDangDung.trang_thai === "da-xoa";
  const khoaLoc = () => JSON.stringify(locDangDung);
  // "Chọn tất cả" chọn mọi phiếu khớp bộ lọc (mọi trang), không chỉ trang đang xem. Ghi lại bộ lọc lúc bấm.
  let chonTatCaLoc = "";

  function capNhatChon() {
    const n = daChon.size, tren = [...$("ds-phieu").querySelectorAll(".nv-tich input")], rac = trongThungRac();
    $("so-da-chon").textContent = n ? `Đã chọn ${n} phiếu` : "Chưa chọn phiếu nào";
    $("xuat-da-chon").disabled = !n; $("xoa-da-chon").disabled = !n; $("khoi-phuc-da-chon").disabled = !n; $("bo-chon").hidden = !n;
    const ca = $("chon-ca-trang");
    ca.checked = tongDangLoc > 0 && chonTatCaLoc === khoaLoc() && n >= tongDangLoc && tren.every(i => i.checked);
    ca.indeterminate = !ca.checked && n > 0;
    ca.disabled = !tongDangLoc;
    $("chon-ca-chu").textContent = rac ? `Chọn tất cả ${tongDangLoc} phiếu trong thùng rác` : `Chọn tất cả ${tongDangLoc} phiếu${coLoc() ? " đang lọc" : ""}`;
    $("khoi-phuc-da-chon").hidden = !rac;
    $("xoa-da-chon").textContent = rac ? "Xóa vĩnh viễn phiếu đã chọn" : "Xóa phiếu đã chọn";
    $("xoa-dang-loc").textContent = rac ? `Xóa vĩnh viễn hết ${tongDangLoc} phiếu trong thùng rác`
      : coLoc() ? `Xóa hết ${tongDangLoc} phiếu đang lọc` : `Xóa hết ${tongDangLoc} phiếu trong danh sách`;
    $("xoa-dang-loc").disabled = !tongDangLoc;
  }
  function bao(chu, loi = false) { const p = $("nv-bao"); p.textContent = chu; p.classList.toggle("loi", loi); p.hidden = !chu; }

  // Tải file Excel của các phiếu đã chọn hoặc đang lọc (máy chủ trả file, trang tự lưu về máy).
  async function taiExcel(than, ten) {
    let r;
    try { r = await fetch("/api/nhan-vien/xuat-excel", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(than) }); }
    catch { throw new Error("Chưa kết nối được máy chủ. Anh chị vui lòng kiểm tra mạng rồi thử lại."); }
    if (!r.ok) { let du = {}; try { du = await r.json(); } catch { /* không có nội dung */ } const loi = new Error(du.loi?.thong_bao || "Chưa tải được file Excel."); loi.ma = r.status; throw loi; }
    const url = URL.createObjectURL(await r.blob()), a = tao("a");
    a.href = url; a.download = `${ten}-${new Date().toISOString().slice(0, 10)}.xlsx`; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function xuat(than, ten, nut) {
    nut.disabled = true; const chu = nut.textContent; nut.textContent = "Đang tạo file Excel…";
    try { await taiExcel(than, ten); bao("Đã tải file Excel."); }
    catch (e) { if (e.ma === 401) return tai(); bao(e.message, true); }
    finally { nut.disabled = false; nut.textContent = chu; capNhatChon(); }
  }
  // Xóa nhiều phiếu: hỏi lại ngay trên trang, ghi rõ số phiếu. Ở danh sách: chuyển vào thùng rác (khôi phục được 30 ngày).
  // Trong thùng rác: xóa vĩnh viễn cùng ảnh, gợi ý tải Excel trước.
  function hoiXoa({ so, moTa, than, ten }) {
    const hop = $("nv-xac-nhan"), vinhVien = trongThungRac();
    $("xn-chu").textContent = vinhVien
      ? `Xóa vĩnh viễn ${so} phiếu ${moTa} cùng toàn bộ ảnh đính kèm và lịch sử? Xóa rồi không lấy lại được. Anh chị nên tải Excel các phiếu này trước.`
      : `Xóa ${so} phiếu ${moTa}? Phiếu và ảnh đính kèm chuyển vào Thùng rác, khôi phục được trong 30 ngày.`;
    $("xn-xoa").textContent = vinhVien ? `Xóa vĩnh viễn ${so} phiếu` : `Xóa ${so} phiếu`;
    $("xn-xuat").hidden = !vinhVien;
    $("xn-xuat").onclick = () => xuat(than, ten, $("xn-xuat"));
    $("xn-huy").onclick = () => { hop.hidden = true; };
    $("xn-xoa").onclick = async () => {
      $("xn-xoa").disabled = true;
      try {
        const kq = await goi(`/api/nhan-vien/phieu/${vinhVien ? "xoa-vinh-vien" : "xoa-nhieu"}`, { method: "POST", body: JSON.stringify({ ...than, xac_nhan: true }) });
        daChon.clear(); chonTatCaLoc = ""; hop.hidden = true;
        bao(vinhVien ? `Đã xóa vĩnh viễn ${kq.da_xoa} phiếu.` : `Đã chuyển ${kq.da_xoa} phiếu vào thùng rác.`); await tai();
      } catch (e) {
        hop.hidden = true; bao(e.message, true);
        if (e.ma === 409 || e.ma === 401) await tai();
      } finally { $("xn-xoa").disabled = false; }
    };
    bao(""); hop.hidden = false; (vinhVien ? $("xn-xuat") : $("xn-xoa")).focus();
  }
  async function khoiPhuc(than, nut) {
    nut.disabled = true;
    try {
      const kq = await goi("/api/nhan-vien/phieu/khoi-phuc", { method: "POST", body: JSON.stringify({ ...than, xac_nhan: true }) });
      than.ma?.forEach(m => daChon.delete(m)); chonTatCaLoc = ""; bao(`Đã khôi phục ${kq.da_khoi_phuc} phiếu về danh sách.`); await tai();
    } catch (e) { bao(e.message, true); if (e.ma === 401) await tai(); }
    finally { nut.disabled = false; }
  }

  // Hỏi xác nhận ngay tại chỗ (trong phiếu đang mở): một câu hỏi, vài ô nhập không bắt buộc, nút đồng ý và Hủy.
  // Trả về giá trị các ô khi đồng ý, null khi hủy (bấm Hủy hoặc phím Esc).
  let soHoi = 0;
  function hoiTaiCho(sauNut, { chu, dongY, nguyHiem = false, truong = [] }) {
    sauNut.closest(".chi-tiet")?.querySelector(".nv-hoi")?.remove();
    return new Promise(xong => {
      const hop = tao("div", `nv-hoi${nguyHiem ? " nguy-hiem" : ""}`), id = `nv-hoi-${++soHoi}`, cau = tao("p", "", chu);
      hop.setAttribute("role", "group"); cau.id = id; hop.setAttribute("aria-labelledby", id); hop.append(cau);
      const o = truong.map(t => {
        const nhan = tao("label", "nv-hoi-o"), vao = tao(t.dai ? "textarea" : "input");
        if (!t.dai) vao.type = "text";
        vao.maxLength = t.toiDa || 200; vao.value = t.giaTri || ""; vao.placeholder = t.goiY || ""; if (t.dai) vao.rows = 2;
        nhan.append(tao("span", "", t.nhan), vao); hop.append(nhan); return vao;
      });
      const hang = tao("div", "hang-nut"), ok = tao("button", `nut nho${nguyHiem ? " nut-xoa" : ""}`, dongY), huy = tao("button", "nut-chu", "Hủy");
      ok.type = huy.type = "button"; hang.append(ok, huy); hop.append(hang);
      const dong = gt => { hop.remove(); sauNut.focus({ preventScroll: true }); xong(gt); };
      ok.addEventListener("click", () => dong(o.map(v => v.value.trim())));
      huy.addEventListener("click", () => dong(null));
      hop.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); dong(null); } });
      (sauNut.closest(".hang-nut") || sauNut).after(hop);
      (o[0] || ok).focus();
    });
  }
  // Tên nhân viên ghi vào lịch sử: nhớ trên máy này để lần sau khỏi gõ lại.
  const tenNhanVien = { lay: () => { try { return localStorage.getItem("nv-ten") || ""; } catch { return ""; } },
    luu: t => { try { if (t) localStorage.setItem("nv-ten", t); } catch { /* bỏ qua */ } } };
  const NGAY_GIU = 30;
  function conLai(xoaLuc) {
    const d = new Date(xoaLuc.replace(" ", "T") + "+07:00");
    return Number.isNaN(d.getTime()) ? NGAY_GIU : Math.max(0, Math.ceil(NGAY_GIU - (Date.now() - d.getTime()) / 864e5));
  }
  function veLichSu(p) {
    const khoi = tao("section", "lich-su"), ds = tao("ol");
    khoi.setAttribute("aria-label", "Lịch sử xử lý phiếu"); khoi.append(tao("h4", "", "Lịch sử"));
    [...(p.lich_su || []), p.gui_luc ? { luc: p.gui_luc, ten_viec: "Khách gửi phiếu" } : { luc: p.tao_luc, ten_viec: "Khách bắt đầu điền phiếu" }]
      .forEach(x => {
        const li = tao("li"), gio = tao("time", "", ngayGio(x.luc)); gio.dateTime = x.luc.replace(" ", "T");
        const viec = tao("span", "viec", x.ten_viec + (x.nguoi ? ` · ${x.nguoi}` : ""));
        li.append(gio, viec); if (x.ghi_chu) li.append(tao("span", "ghi-chu-ls", x.ghi_chu)); ds.append(li);
      });
    khoi.append(ds); return khoi;
  }

  // Nút chép link: chép được thì báo "Đã chép"; trình duyệt chặn thì chọn sẵn chữ trong ô để nhân viên tự chép.
  function ganChep(o, nut) {
    nut.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(o.value); nut.textContent = "Đã chép"; setTimeout(() => { nut.textContent = "Chép link"; }, 2000); }
      catch { o.focus(); o.select(); }
    });
  }
  // Mã QR và link trang điền phiếu (/phieu) theo tên miền đang mở; link riêng từng loại video (/phieu/<loại>).
  function veLoai(loai) {
    if ($("loc-bo").options.length > 1) return;
    loai.forEach(l => { const o = tao("option", "", l.ten); o.value = l.id; $("loc-bo").append(o); });
    $("link-chung").value = new URL("/phieu", location.origin).href; ganChep($("link-chung"), $("chep-link-chung"));
    loai.forEach(l => {
      const li = tao("li"), o = tao("input"), nut = tao("button", "nut nho", "Chép link"), qr = tao("a", "nut-chu", "Mã QR"); nut.type = "button";
      o.type = "text"; o.readOnly = true; o.value = new URL(`/phieu/${l.id}`, location.origin).href; o.setAttribute("aria-label", `Link phiếu ${l.ten}`);
      qr.href = `/ma-qr.png?tai=1&loai=${encodeURIComponent(l.id)}`; qr.download = ""; qr.setAttribute("aria-label", `Tải ảnh mã QR phiếu ${l.ten}`);
      ganChep(o, nut);
      li.append(tao("span", "", l.ten), o, nut, qr); $("ds-link").append(li);
    });
  }
  const phanTram = (a, b) => b ? `${Math.round(a / b * 100)}%` : "chưa có";
  const ngayGio = chu => { const d = new Date(chu); return Number.isNaN(d.getTime()) ? chu : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(d); };

  function ve(du) {
    const dangMo = new Set([...$("ds-phieu").querySelectorAll("details[open]")].map(d => d.dataset.phieu));
    trang = du.trang; tongDangLoc = du.tong; veLoai(du.loai || []);
    $("phan-trang").textContent = `Trang ${du.trang}/${du.so_trang} · ${du.tong} phiếu`;
    $("trang-truoc").disabled = du.trang <= 1; $("trang-sau").disabled = du.trang >= du.so_trang;
    const tk = du.thong_ke;
    $("so-lieu").replaceChildren(...[
      [tk.mo_trang, "lượt mở trang"], [tk.bat_dau, "phiếu đã bắt đầu"], [tk.da_gui, "phiếu đã gửi", tk.bat_dau ? `${phanTram(tk.da_gui, tk.bat_dau)} số phiếu đã bắt đầu` : "Chưa có phiếu đã bắt đầu"],
      [tk.cho_lien_he, "phiếu chờ liên hệ"],
    ].map(([so, nhan, ghiChu]) => { const li = tao("li"); li.append(tao("strong", "", new Intl.NumberFormat("vi-VN").format(so)), tao("span", "", nhan)); if (ghiChu) li.append(tao("small", "", ghiChu)); return li; }));

    $("bang-dung").tBodies[0].replaceChildren(...tk.dung_o_nhom.map(d => { const tr = tao("tr"); tr.append(tao("td", "", d.nhom), tao("td", "", String(d.so))); return tr; }));
    $("bang-nguon").tBodies[0].replaceChildren(...(tk.theo_nguon.length ? tk.theo_nguon : [{ nguon: "Chưa có dữ liệu", xem: 0, gui: 0 }]).map(d => { const tr = tao("tr"); tr.append(tao("td", "", d.nguon), tao("td", "", String(d.xem)), tao("td", "", String(d.gui))); return tr; }));

    $("trong").hidden = du.phieu.length > 0;
    $("ds-phieu").replaceChildren(...du.phieu.map(p => {
      const d = tao("details"), s = tao("summary");
      d.dataset.phieu = p.id;
      const c1 = tao("span"); c1.append(tao("b", "", p.san_pham || "Chưa ghi tên sản phẩm hoặc đơn vị"),
        tao("small", "", p.loai === "tu-van-nhanh" ? "Yêu cầu tư vấn nhanh" : [p.ten_bo, p.thuong_hieu].filter(Boolean).join(" · ")));
      const c2 = tao("span", "phu"); c2.append(tao("span", "", p.ten || "Chưa có tên"), tao("small", "", [p.kenh, p.lien_he].filter(Boolean).join(": ")));
      const c3 = tao("span", "phu"), luc = p.gui_luc || p.tao_luc; c3.append(tao("span", "", ngayGio(luc)), tao("small", "", `Nguồn: ${p.nguon}`)); c3.title = luc;
      const nhanTt = tao("span");
      const veNhan = () => {
        nhanTt.className = `nhan-tt ${p.xoa_luc ? "xoa" : !p.gui_luc ? "do" : p.lien_he_luc ? "xong" : "gui"}`;
        nhanTt.textContent = p.xoa_luc ? "Đã xóa" : !p.gui_luc ? "Đang dở" : p.lien_he_luc ? "Đã liên hệ" : "Chờ liên hệ";
      };
      veNhan(); s.append(c1, c2, c3, nhanTt);
      const ct = tao("div", "chi-tiet"), dl = tao("dl", "tom-tat");
      p.tom_tat.forEach(t => { const hop = tao("div"); hop.append(tao("dt", "", `${t.so == null ? "" : t.so + ". "}${t.cau}`), tao("dd", "", t.tra_loi)); dl.append(hop); });
      const tenKhach = p.ten || p.san_pham || "khách này", cachLienHe = [p.kenh, p.lien_he].filter(Boolean).join(": ");
      if (p.xoa_luc) {
        // Phiếu trong thùng rác: khôi phục, hoặc xóa vĩnh viễn (khách yêu cầu xóa thông tin)
        const hang = tao("div", "hang-nut thung-rac-phieu"), kp = tao("button", "nut nho", "Khôi phục phiếu này"), vv = tao("button", "nut-chu nut-nguy-hiem", "Xóa vĩnh viễn");
        kp.type = vv.type = "button";
        const n = conLai(p.xoa_luc);
        hang.append(kp, vv, tao("span", "ghi-chu", `Đã xóa lúc ${ngayGio(p.xoa_luc)} · tự xóa hẳn sau ${n} ngày nữa`));
        kp.addEventListener("click", () => khoiPhuc({ ma: [p.id] }, kp));
        vv.addEventListener("click", async () => {
          if (!await hoiTaiCho(vv, { chu: `Xóa vĩnh viễn phiếu của ${tenKhach} cùng ảnh đính kèm và lịch sử? Xóa rồi không lấy lại được.`, dongY: "Xóa vĩnh viễn", nguyHiem: true })) return;
          vv.disabled = true;
          try { await goi("/api/nhan-vien/phieu/xoa-vinh-vien", { method: "POST", body: JSON.stringify({ ma: [p.id], xac_nhan: true }) }); daChon.delete(p.id); bao("Đã xóa vĩnh viễn 1 phiếu."); await tai(); }
          catch (e) { bao(e.message, true); } finally { vv.disabled = false; }
        });
        ct.append(hang);
      } else if (p.gui_luc) {
        // Đánh dấu đã liên hệ: hỏi xác nhận (ai liên hệ, ghi chú), ghi vào lịch sử. Bỏ đánh dấu cũng hỏi lại.
        const nut = tao("button", "nut nho"), ghiChu = tao("span", "ghi-chu"), hang = tao("div", "hang-nut lien-he"); nut.type = "button";
        const veNut = () => { nut.textContent = p.lien_he_luc ? "Bỏ đánh dấu đã liên hệ" : "Đánh dấu đã liên hệ"; ghiChu.textContent = p.lien_he_luc ? `Đã liên hệ lúc ${ngayGio(p.lien_he_luc)}` : ""; };
        nut.addEventListener("click", async () => {
          const danhDau = !p.lien_he_luc;
          const tl = await hoiTaiCho(nut, danhDau
            ? { chu: `Xác nhận đã liên hệ với ${tenKhach}${cachLienHe ? ` (${cachLienHe})` : ""}?`, dongY: "Xác nhận đã liên hệ",
                truong: [{ nhan: "Người liên hệ", giaTri: tenNhanVien.lay(), toiDa: 60, goiY: "Tên nhân viên" },
                         { nhan: "Ghi chú (không bắt buộc)", dai: true, toiDa: 500, goiY: "Ví dụ: gọi Zalo, hẹn gửi báo giá thứ Sáu" }] }
            : { chu: `Bỏ đánh dấu đã liên hệ? Phiếu của ${tenKhach} trở lại mục Chờ liên hệ.`, dongY: "Bỏ đánh dấu",
                truong: [{ nhan: "Người thực hiện", giaTri: tenNhanVien.lay(), toiDa: 60, goiY: "Tên nhân viên" },
                         { nhan: "Lý do (không bắt buộc)", dai: true, toiDa: 500, goiY: "Ví dụ: đánh dấu nhầm, khách chưa nghe máy" }] });
          if (!tl) return;
          tenNhanVien.luu(tl[0]); nut.disabled = true;
          try {
            const kq = await goi(`/api/nhan-vien/phieu/${p.id}/lien-he`, { method: "POST", body: JSON.stringify({ da_lien_he: danhDau, xac_nhan: true, nguoi: tl[0], ghi_chu: tl[1] }) });
            p.lien_he_luc = kq.lien_he_luc; p.lich_su = kq.lich_su; veNut(); veNhan(); ct.querySelector(".lich-su")?.replaceWith(veLichSu(p));
            bao(danhDau ? "Đã ghi nhận đã liên hệ." : "Đã bỏ đánh dấu, phiếu trở lại mục Chờ liên hệ.");
            await tai(); document.querySelector(`[data-phieu="${CSS.escape(p.id)}"] .lien-he button`)?.focus({ preventScroll: true });
          } catch (e) { ghiChu.textContent = e.message; }
          nut.disabled = false;
        });
        veNut(); hang.append(nut, ghiChu); ct.append(hang);
      }
      ct.append(dl);
      if (p.so_anh) {
        const khu = tao("div", "anh-khach"); ct.append(khu);
        d.addEventListener("toggle", async () => {
          if (!d.open || khu.childElementCount) return;
          try { (await goi(`/api/nhan-vien/phieu/${p.id}/anh`)).anh.forEach(a => { const lk = tao("a"), i = tao("img"); lk.href = `/api/nhan-vien/anh/${a.id}`; lk.target = "_blank"; lk.rel = "noopener"; i.src = lk.href; i.alt = a.ten; i.loading = "lazy"; lk.append(i); khu.append(lk); }); } catch { /* bỏ qua */ }
        });
      }
      ct.append(veLichSu(p));   // sau ảnh khách gửi: lịch sử, rồi nút xóa phiếu ở cuối
      if (!p.xoa_luc) {
        const xoa = tao("button", "nut-chu nut-nguy-hiem", "Xóa phiếu"); xoa.type = "button";
        xoa.addEventListener("click", async () => {
          if (!await hoiTaiCho(xoa, { chu: `Xóa phiếu của ${tenKhach}? Phiếu và ảnh đính kèm chuyển vào Thùng rác, khôi phục được trong 30 ngày.`, dongY: "Xóa phiếu", nguyHiem: true })) return;
          xoa.disabled = true;
          try {
            await goi(`/api/nhan-vien/phieu/${p.id}`, { method: "DELETE", body: JSON.stringify({ xac_nhan: true, nguoi: tenNhanVien.lay() }) });
            daChon.delete(p.id); bao(`Đã chuyển phiếu của ${tenKhach} vào thùng rác.`); await tai();
          } catch (e) { $("loi-tai").textContent = e.message; $("loi-tai").hidden = false; }
          finally { xoa.disabled = false; }
        });
        ct.append(xoa);
      }
      d.append(s, ct); d.open = dangMo.has(p.id);
      const hang = tao("div", "nv-hang"), tich = tao("label", "nv-tich"), o = tao("input"); o.type = "checkbox"; o.checked = daChon.has(p.id);
      o.addEventListener("change", () => { if (o.checked) daChon.set(p.id, p.ten || p.san_pham); else daChon.delete(p.id); capNhatChon(); });
      tich.append(o, tao("span", "an-di", `Chọn phiếu ${p.ten || p.san_pham || ngayGio(p.tao_luc)}`));
      hang.append(tich, d); return hang;
    }));
    capNhatChon();
  }

  async function tai() {
    const lan = ++luotTai;
    $("nv-trang-thai").hidden = false; $("nv-trang-thai").textContent = $("bang").hidden ? "Đang tải khu vực nhân viên…" : "Đang cập nhật danh sách…";
    $("bang").setAttribute("aria-busy", "true");
    locDangDung = { tim: $("tim-phieu").value.trim(), trang_thai: $("trang-thai").value, bo: $("loc-bo").value };
    const q = new URLSearchParams({ trang: String(trang), ...locDangDung });
    $("loi-tai").hidden = true;
    try {
      const du = await goi(`/api/nhan-vien/phieu?${q}`);
      if (lan !== luotTai) return;
      ve(du); $("bang").hidden = false; $("form-dang-nhap").hidden = true; $("dang-xuat").hidden = false;
      const rac = du.thong_ke.thung_rac || 0;
      $("mo-thung-rac").textContent = rac ? `Thùng rác (${rac})` : "Thùng rác"; $("mo-thung-rac").hidden = trongThungRac();
      $("nv-thung-rac").hidden = !trongThungRac();
    } catch (e) {
      if (lan !== luotTai) return;
      if (e.ma === 401) {
        $("bang").hidden = true; $("ds-phieu").replaceChildren(); $("dang-xuat").hidden = true; $("form-dang-nhap").hidden = false;
      } else {
        const loi = $("bang").hidden ? $("loi-dang-nhap") : $("loi-tai"); loi.textContent = e.message; loi.hidden = false;
        if ($("bang").hidden) $("form-dang-nhap").hidden = false;
      }
    } finally { if (lan === luotTai) { $("nv-trang-thai").hidden = true; $("bang").removeAttribute("aria-busy"); } }
  }
  $("loc-phieu").addEventListener("submit", e => { e.preventDefault(); trang = 1; tai(); });
  $("dat-lai-loc").addEventListener("click", () => { $("tim-phieu").value = ""; $("trang-thai").value = ""; $("loc-bo").value = ""; trang = 1; tai(); });
  $("loc-bo").addEventListener("change", () => { trang = 1; tai(); });
  $("mo-thung-rac").addEventListener("click", () => { $("trang-thai").value = "da-xoa"; trang = 1; tai(); });
  $("ra-thung-rac").addEventListener("click", () => { $("trang-thai").value = ""; trang = 1; tai(); });
  $("trang-thai").addEventListener("change", () => { trang = 1; tai(); });
  // Chọn tất cả: lấy mã mọi phiếu khớp bộ lọc ở máy chủ (mọi trang). Bỏ tích: bỏ chọn hết.
  $("chon-ca-trang").addEventListener("change", async () => {
    const ca = $("chon-ca-trang");
    if (!ca.checked) { daChon.clear(); chonTatCaLoc = ""; $("ds-phieu").querySelectorAll(".nv-tich input").forEach(o => { o.checked = false; }); capNhatChon(); return; }
    ca.disabled = true; const loc = { ...locDangDung };
    try {
      const kq = await goi(`/api/nhan-vien/phieu/ma?${new URLSearchParams(loc)}`);
      kq.ma.forEach(x => daChon.set(x.id, x.ten)); chonTatCaLoc = JSON.stringify(loc);
      $("ds-phieu").querySelectorAll(".nv-tich input").forEach(o => { o.checked = true; });
      if (kq.qua_nhieu) bao("Đã chọn 1000 phiếu mới nhất (tối đa mỗi lần). Làm xong nhóm này rồi chọn tiếp.");
    } catch (e) { ca.checked = false; bao(e.message, true); if (e.ma === 401) await tai(); }
    capNhatChon();
  });
  $("khoi-phuc-da-chon").addEventListener("click", () => khoiPhuc({ ma: [...daChon.keys()] }, $("khoi-phuc-da-chon")));
  $("bo-chon").addEventListener("click", () => { daChon.clear(); chonTatCaLoc = ""; $("ds-phieu").querySelectorAll(".nv-tich input").forEach(o => { o.checked = false; }); capNhatChon(); });
  $("xuat-da-chon").addEventListener("click", () => xuat({ ma: [...daChon.keys()] }, "phieu-da-chon", $("xuat-da-chon")));
  $("xoa-da-chon").addEventListener("click", () => hoiXoa({ so: daChon.size, moTa: "đã chọn", than: { ma: [...daChon.keys()] }, ten: "phieu-da-chon" }));
  $("xoa-dang-loc").addEventListener("click", () => hoiXoa({ so: tongDangLoc, moTa: trongThungRac() ? "trong thùng rác" : coLoc() ? "đang lọc" : "trong toàn bộ danh sách",
    than: { loc: { ...locDangDung }, so_du_kien: tongDangLoc }, ten: coLoc() ? "phieu-dang-loc" : "tat-ca-phieu" }));
  $("trang-truoc").addEventListener("click", () => { trang = Math.max(1, trang - 1); tai(); });
  $("trang-sau").addEventListener("click", () => { trang += 1; tai(); });

  $("form-dang-nhap").addEventListener("submit", async ev => {
    ev.preventDefault(); $("loi-dang-nhap").hidden = true;
    $("nv-dang-nhap-nut").disabled = true; $("nv-dang-nhap-nut").textContent = "Đang đăng nhập…"; $("mat-khau").removeAttribute("aria-invalid");
    try { await goi("/api/nhan-vien/dang-nhap", { method: "POST", body: JSON.stringify({ mat_khau: $("mat-khau").value }) }); $("mat-khau").value = ""; await tai(); }
    catch (e) { $("loi-dang-nhap").textContent = e.message; $("loi-dang-nhap").hidden = false; $("mat-khau").setAttribute("aria-invalid", "true"); $("mat-khau").focus(); }
    finally { $("nv-dang-nhap-nut").disabled = false; $("nv-dang-nhap-nut").textContent = "Đăng nhập"; }
  });
  $("dang-xuat").addEventListener("click", async () => { try { await goi("/api/nhan-vien/dang-xuat", { method: "POST", body: "{}" }); } finally { tai(); } });

  // Các thẻ: yêu cầu của khách, bộ câu hỏi, video mẫu. Thẻ đang mở hiện ra (sau khi đăng nhập) thì báo sự kiện "nv-mo-the"
  // để tệp của thẻ đó (sua-cau-hoi.js, sua-video-mau.js) tải dữ liệu lần đầu. Địa chỉ #bo-cau-hoi, #video-mau mở thẳng thẻ.
  const cacThe = [...document.querySelectorAll('.nv-the [role="tab"]')], DIA_CHI = { "khu-cau-hoi": "#bo-cau-hoi", "khu-video": "#video-mau", "khu-bao-mat": "#bao-mat" };
  const theDangMo = () => cacThe.find(b => b.getAttribute("aria-selected") === "true");
  function baoThe() { if (!$("bang").hidden) document.dispatchEvent(new CustomEvent("nv-mo-the", { detail: theDangMo().getAttribute("aria-controls") })); }
  function moThe(t, dua = false) {
    cacThe.forEach(b => { const chon = b === t; b.setAttribute("aria-selected", String(chon)); b.tabIndex = chon ? 0 : -1; $(b.getAttribute("aria-controls")).hidden = !chon; });
    history.replaceState(null, "", DIA_CHI[t.getAttribute("aria-controls")] || location.pathname + location.search);
    if (dua) t.focus();
    baoThe();
  }
  cacThe.forEach((t, i) => {
    t.addEventListener("click", () => moThe(t));
    t.addEventListener("keydown", e => {
      const n = cacThe.length, k = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
      if (k === undefined) return;
      e.preventDefault(); moThe(cacThe[k], true);
    });
  });
  new MutationObserver(baoThe).observe($("bang"), { attributes: true, attributeFilter: ["hidden"] });

  // Thẻ Bảo mật: tình trạng cài đặt (đạt / cần làm, cách sửa) và 15 lần đăng nhập gần nhất. Tải lại mỗi lần mở thẻ.
  document.addEventListener("nv-mo-the", async e => {
    if (e.detail !== "khu-bao-mat") return;
    const tt = $("bm-trang-thai"); tt.hidden = false; tt.textContent = "Đang tải…";
    try {
      const du = await goi("/api/nhan-vien/bao-mat");
      $("bm-cai-dat").replaceChildren(...du.cai_dat.map(c => {
        const li = tao("li", c.dat ? "dat" : "can-lam"), dau = tao("div", "bm-dau");
        dau.append(tao("span", `bm-nhan ${c.dat ? "dat" : "can-lam"}`, c.dat ? "Đạt" : "Cần làm"), tao("b", "", c.ten));
        li.append(dau); if (!c.dat) li.append(tao("p", "", c.cach)); return li;
      }));
      const can = du.cai_dat.filter(c => !c.dat).length;
      tt.textContent = can ? `Còn ${can} cài đặt cần làm.` : "Các cài đặt bảo mật đều đạt.";
      $("bm-dn-tom-tat").textContent = `${du.sai_24h} lần nhập sai mật khẩu trong 24 giờ qua. Một địa chỉ nhập sai ${du.gioi_han.mot_may} lần trong ${du.gioi_han.phut} phút thì bị chặn ${du.gioi_han.phut} phút.`;
      $("bm-dang-nhap").replaceChildren(...(du.dang_nhap.length ? du.dang_nhap.map(d => {
        const tr = tao("tr"), kq = tao("td"); kq.append(tao("span", `bm-nhan ${d.thanh_cong ? "dat" : "can-lam"}`, d.thanh_cong ? "Đăng nhập" : "Sai mật khẩu"));
        tr.append(tao("td", "", ngayGio(d.luc)), kq, tao("td", "", d.thiet_bi), tao("td", "", d.ip)); return tr;
      }) : [(() => { const tr = tao("tr"), td = tao("td", "", "Chưa có lần đăng nhập nào được ghi."); td.colSpan = 4; tr.append(td); return tr; })()]));
    } catch (err) { if (err.ma === 401) return tai(); tt.textContent = err.message; }
  });
  const theTuDiaChi = cacThe.find(b => DIA_CHI[b.getAttribute("aria-controls")] === location.hash);
  if (theTuDiaChi) moThe(theTuDiaChi);
  tai();
})();
