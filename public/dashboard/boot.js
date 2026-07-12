/* Nạp dữ liệu real-time cho dashboard.
   1) Lấy dữ liệu lần đầu từ /api/data
   2) Tải app.js (app.js tự vẽ toàn bộ biểu đồ khi load)
   3) Poll lại /api/data định kỳ để cập nhật (Cloudflare edge không có SSE nền) */
(function () {
  var POLL_MS = 20000; // khớp REFRESH_MS phía server
  var stampEl = document.getElementById('dataStamp');
  var dotEl = document.getElementById('liveDot');

  function setStamp(text, live) {
    if (stampEl) stampEl.textContent = text;
    if (dotEl) dotEl.style.background = live ? 'var(--green)' : 'var(--red)';
  }

  function applyData(d) {
    window.LT_DATA = d.LT_DATA || [];
    window.COST_DATA = d.COST_DATA || { dates: [], costKg: [] };
    window.PROD_DATA = d.PROD_DATA || [];
    window.NOTES_DATA = d.NOTES_DATA || {};
  }

  function rerender() {
    try {
      if (window.buildLT) window.buildLT();
      if (window.buildCost) window.buildCost();
      if (window.buildProd) window.buildProd();
    } catch (e) {
      console.error('render error', e);
    }
  }

  function nowText() {
    return 'Cập nhật ' + new Date().toLocaleTimeString('vi-VN');
  }

  function fetchData() {
    return fetch('/api/data', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (r.status === 401) {
          window.location.href = '/login';
          throw new Error('unauthorized');
        }
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      });
  }

  function startPolling() {
    setInterval(function () {
      fetchData()
        .then(function (d) {
          if (d && d.LT_DATA) {
            applyData(d);
            rerender();
            setStamp(nowText(), true);
          }
        })
        .catch(function (e) {
          if (e && e.message === 'unauthorized') return;
          setStamp('Mất kết nối, đang thử lại…', false);
        });
    }, POLL_MS);
  }

  function loadApp() {
    var s = document.createElement('script');
    s.src = '/dashboard/app.js';
    s.onload = function () {
      setStamp(nowText(), true);
      startPolling();
    };
    s.onerror = function () {
      setStamp('Lỗi tải giao diện', false);
    };
    document.head.appendChild(s);
  }

  fetch('/api/data', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    .then(function (r) {
      if (r.status === 401) {
        window.location.href = '/login';
        throw new Error('unauthorized');
      }
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    })
    .then(function (d) {
      applyData(d);
      loadApp();
    })
    .catch(function (e) {
      if (e && e.message === 'unauthorized') return;
      console.error('load data failed', e);
      setStamp('Không tải được dữ liệu', false);
    });
})();
