/* Nạp dữ liệu real-time cho dashboard, có chọn kho.
   1) Lấy danh sách kho -> dựng bộ chọn
   2) Lấy dữ liệu kho đang chọn từ /api/data?wh=...
   3) Tải app.js (vẽ biểu đồ), rồi poll lại định kỳ + đổi khi chọn kho khác */
(function () {
  var POLL_MS = 20000;
  var current = null;
  var whList = [];
  var appLoaded = false;

  function applySla() {
    for (var i = 0; i < whList.length; i++) {
      if (whList[i].key === current && whList[i].sla) { window.SLA = whList[i].sla; return; }
    }
  }
  var sel = document.getElementById('whSelect');
  var stampEl = document.getElementById('dataStamp');
  var dotEl = document.getElementById('liveDot');

  function setStamp(text, live) {
    if (stampEl) stampEl.textContent = text;
    if (dotEl) dotEl.style.background = live ? 'var(--green)' : 'var(--red)';
  }
  function nowText() { return 'Cập nhật ' + new Date().toLocaleTimeString('vi-VN'); }

  function applyData(d) {
    window.LT_DATA = d.LT_DATA || [];
    window.COST_DATA = d.COST_DATA || { dates: [], costKg: [] };
    window.PROD_DATA = d.PROD_DATA || [];
    window.NOTES_DATA = d.NOTES_DATA || {};
    window.HR_DATA = d.HR_DATA || { dates: [], fl: [] };
  }

  function json(url) {
    return fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (r.status === 401) { window.location.href = '/login'; throw new Error('unauthorized'); }
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      });
  }

  function ensureApp(cb) {
    if (appLoaded) { cb(); return; }
    var s = document.createElement('script');
    s.src = '/dashboard/app.js';
    s.onload = function () { appLoaded = true; cb(); };
    s.onerror = function () { setStamp('Lỗi tải giao diện', false); };
    document.head.appendChild(s);
  }

  function refresh() {
    if (!current) return;
    applySla();
    json('/api/data?wh=' + encodeURIComponent(current))
      .then(function (d) {
        applyData(d);
        if (!appLoaded) ensureApp(function () { setStamp(nowText(), true); });
        else { if (window.rebuildAll) window.rebuildAll(); setStamp(nowText(), true); }
      })
      .catch(function (e) {
        if (e && e.message === 'unauthorized') return;
        setStamp('Không tải được dữ liệu', false);
      });
  }

  // Khởi động: lấy danh sách kho -> dựng dropdown -> nạp kho đầu tiên.
  json('/api/warehouses')
    .then(function (j) {
      var list = (j && j.warehouses) || [];
      if (!list.length) { setStamp('Chưa cấu hình kho', false); return; }
      whList = list;
      if (sel) {
        sel.innerHTML = list.map(function (w) {
          return '<option value="' + w.key + '">' + w.name + '</option>';
        }).join('');
        current = list[0].key;
        sel.value = current;
        sel.onchange = function () { current = sel.value; setStamp('Đang tải…', true); refresh(); };
      } else {
        current = list[0].key;
      }
      refresh();
      setInterval(refresh, POLL_MS);
    })
    .catch(function (e) {
      if (e && e.message === 'unauthorized') return;
      setStamp('Không tải được danh sách kho', false);
    });
})();
