// Trang nhân viên: đăng nhập, xem số liệu, đọc phiếu, tải Excel.
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const tao = (the, lop, chu) => { const e = document.createElement(the); if (lop) e.className = lop; if (chu != null) e.textContent = chu; return e; };

  async function goi(duong, tuy = {}) {
    const r = await fetch(duong, { cache: "no-store", credentials: "same-origin", ...tuy, headers: tuy.body ? { "Content-Type": "application/json" } : undefined });
    let du = {};
    try { du = await r.json(); } catch { /* không có nội dung */ }
    if (!r.ok) { const loi = new Error(du.loi?.thong_bao || "Chưa kết nối được máy chủ."); loi.ma = r.status; throw loi; }
    return du;
  }

  let trang = 1, luotTai = 0;
  const phanTram = (a, b) => b ? `${Math.round(a / b * 100)}%` : "chưa có";

  function ve(du) {
    trang = du.trang;
    $("phan-trang").textContent = `Trang ${du.trang}/${du.so_trang} · ${du.tong} phiếu`;
    $("trang-truoc").disabled = du.trang <= 1; $("trang-sau").disabled = du.trang >= du.so_trang;
    const tk = du.thong_ke;
    $("so-lieu").replaceChildren(...[
      [tk.mo_trang, "lượt mở trang"], [tk.bat_dau, "phiếu đã bắt đầu"], [`${tk.da_gui} (${phanTram(tk.da_gui, tk.bat_dau)})`, "phiếu đã gửi"],
      [tk.cho_lien_he, "phiếu chờ liên hệ"],
    ].map(([so, nhan]) => { const li = tao("li"); li.append(tao("strong", "", String(so)), tao("span", "", nhan)); return li; }));

    $("bang-dung").tBodies[0].replaceChildren(...tk.dung_o_nhom.map(d => { const tr = tao("tr"); tr.append(tao("td", "", d.nhom), tao("td", "", String(d.so))); return tr; }));
    $("bang-nguon").tBodies[0].replaceChildren(...(tk.theo_nguon.length ? tk.theo_nguon : [{ nguon: "Chưa có dữ liệu", xem: 0, gui: 0 }]).map(d => { const tr = tao("tr"); tr.append(tao("td", "", d.nguon), tao("td", "", String(d.xem)), tao("td", "", String(d.gui))); return tr; }));

    $("trong").hidden = du.phieu.length > 0;
    $("ds-phieu").replaceChildren(...du.phieu.map(p => {
      const d = tao("details"), s = tao("summary");
      const c1 = tao("span"); c1.append(tao("b", "", p.san_pham || "Chưa ghi tên sản phẩm"), tao("small", "", p.loai === "tu-van-nhanh" ? "Yêu cầu tư vấn nhanh" : p.thuong_hieu || ""));
      const c2 = tao("span", "phu"); c2.append(tao("span", "", p.ten || "Chưa có tên"), tao("small", "", [p.kenh, p.lien_he].filter(Boolean).join(": ")));
      const c3 = tao("span", "phu"); c3.append(tao("span", "", p.gui_luc || p.tao_luc), tao("small", "", `Nguồn: ${p.nguon}`));
      const nhanTt = tao("span");
      const veNhan = () => { nhanTt.className = `nhan-tt ${!p.gui_luc ? "do" : p.lien_he_luc ? "xong" : "gui"}`; nhanTt.textContent = !p.gui_luc ? "Đang dở" : p.lien_he_luc ? "Đã liên hệ" : "Chờ liên hệ"; };
      veNhan(); s.append(c1, c2, c3, nhanTt);
      const ct = tao("div", "chi-tiet"), dl = tao("dl", "tom-tat");
      p.tom_tat.forEach(t => { const hop = tao("div"); hop.append(tao("dt", "", `${t.so == null ? "" : t.so + ". "}${t.cau}`), tao("dd", "", t.tra_loi)); dl.append(hop); });
      if (p.gui_luc) {
        const nut = tao("button", "nut nho"), ghiChu = tao("span", "ghi-chu"), hang = tao("div", "hang-nut lien-he"); nut.type = "button";
        const veNut = () => { nut.textContent = p.lien_he_luc ? "Bỏ đánh dấu đã liên hệ" : "Đánh dấu đã liên hệ"; ghiChu.textContent = p.lien_he_luc ? `Đã liên hệ lúc ${p.lien_he_luc}` : ""; };
        nut.addEventListener("click", async () => {
          nut.disabled = true;
          try { p.lien_he_luc = (await goi(`/api/nhan-vien/phieu/${p.id}/lien-he`, { method: "POST", body: JSON.stringify({ da_lien_he: !p.lien_he_luc }) })).lien_he_luc; veNut(); veNhan(); await tai(); }
          catch (e) { ghiChu.textContent = e.message; }
          nut.disabled = false;
        });
        veNut(); hang.append(nut, ghiChu); ct.append(hang);
      }
      ct.append(dl);
      const xoa = tao("button", "nut-chu", "Xóa phiếu và ảnh đính kèm"); xoa.type = "button";
      xoa.addEventListener("click", async () => {
        if (!confirm("Xóa vĩnh viễn phiếu này và toàn bộ ảnh đính kèm? Anh chị nên tải Excel trước nếu cần giữ thông tin.")) return;
        xoa.disabled = true;
        try { await goi(`/api/nhan-vien/phieu/${p.id}`, { method: "DELETE", body: JSON.stringify({ xac_nhan: true }) }); await tai(); }
        catch (e) { $("loi-tai").textContent = e.message; $("loi-tai").hidden = false; }
        finally { xoa.disabled = false; }
      });
      ct.append(xoa);
      if (p.so_anh) {
        const khu = tao("div", "anh-khach"); ct.append(khu);
        d.addEventListener("toggle", async () => {
          if (!d.open || khu.childElementCount) return;
          try { (await goi(`/api/nhan-vien/phieu/${p.id}/anh`)).anh.forEach(a => { const lk = tao("a"), i = tao("img"); lk.href = `/api/nhan-vien/anh/${a.id}`; lk.target = "_blank"; lk.rel = "noopener"; i.src = lk.href; i.alt = a.ten; i.loading = "lazy"; lk.append(i); khu.append(lk); }); } catch { /* bỏ qua */ }
        });
      }
      d.append(s, ct); return d;
    }));
  }

  async function tai() {
    const lan = ++luotTai;
    const q = new URLSearchParams({ trang: String(trang), tim: $("tim-phieu").value.trim(), trang_thai: $("trang-thai").value });
    $("loi-tai").hidden = true;
    try {
      const du = await goi(`/api/nhan-vien/phieu?${q}`);
      if (lan !== luotTai) return;
      ve(du); $("bang").hidden = false; $("form-dang-nhap").hidden = true; $("dang-xuat").hidden = false;
    } catch (e) {
      if (lan !== luotTai) return;
      if (e.ma === 401) {
        $("bang").hidden = true; $("ds-phieu").replaceChildren(); $("dang-xuat").hidden = true; $("form-dang-nhap").hidden = false;
      } else {
        const loi = $("bang").hidden ? $("loi-dang-nhap") : $("loi-tai"); loi.textContent = e.message; loi.hidden = false;
        if ($("bang").hidden) $("form-dang-nhap").hidden = false;
      }
    }
  }
  $("loc-phieu").addEventListener("submit", e => { e.preventDefault(); trang = 1; tai(); });
  $("trang-truoc").addEventListener("click", () => { trang = Math.max(1, trang - 1); tai(); });
  $("trang-sau").addEventListener("click", () => { trang += 1; tai(); });

  $("form-dang-nhap").addEventListener("submit", async ev => {
    ev.preventDefault(); $("loi-dang-nhap").hidden = true;
    try { await goi("/api/nhan-vien/dang-nhap", { method: "POST", body: JSON.stringify({ mat_khau: $("mat-khau").value }) }); $("mat-khau").value = ""; await tai(); }
    catch (e) { $("loi-dang-nhap").textContent = e.message; $("loi-dang-nhap").hidden = false; }
  });
  $("dang-xuat").addEventListener("click", async () => { try { await goi("/api/nhan-vien/dang-xuat", { method: "POST", body: "{}" }); } finally { tai(); } });
  tai();
})();
