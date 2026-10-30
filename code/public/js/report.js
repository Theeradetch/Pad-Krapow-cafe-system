// report.js - หน้ารายงานยอดขายรายวัน/ช่วงวันที่ (FR-06) และรายเดือน (FR-07)
'use strict';

const state = { branchId: null, tab: 'daily' };

document.addEventListener('DOMContentLoaded', async () => {
  const { branchId } = await initShell('report', (newBranchId) => {
    state.branchId = newBranchId;
    refresh();
  });
  state.branchId = branchId;

  const today = todayStr();
  document.getElementById('from').value = today;
  document.getElementById('to').value = today;
  document.getElementById('month').value = today.slice(0, 7);

  document.getElementById('tab-daily').addEventListener('click', () => switchTab('daily'));
  document.getElementById('tab-monthly').addEventListener('click', () => switchTab('monthly'));

  document.getElementById('daily-form').addEventListener('submit', (e) => { e.preventDefault(); loadDaily(); });
  document.getElementById('monthly-form').addEventListener('submit', (e) => { e.preventDefault(); loadMonthly(); });
  document.querySelectorAll('[data-range]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = todayStr();
      const r = btn.dataset.range;
      let from = t;
      let to = t;
      if (r === 'yesterday') { from = shiftDate(t, -1); to = from; }
      if (r === '7') from = shiftDate(t, -6);
      document.getElementById('from').value = from;
      document.getElementById('to').value = to;
      loadDaily();
    });
  });

  loadDaily();
});

function switchTab(tab) {
  state.tab = tab;
  for (const t of ['daily', 'monthly']) {
    const active = t === tab;
    const btn = document.getElementById(`tab-${t}`);
    btn.setAttribute('aria-selected', String(active));
    btn.setAttribute('aria-pressed', String(active));
    document.getElementById(`panel-${t}`).classList.toggle('hidden', !active);
  }
  refresh();
}

function refresh() {
  if (state.tab === 'daily') loadDaily();
  else loadMonthly();
}

async function loadDaily() {
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const errorEl = document.getElementById('daily-error');
  errorEl.textContent = '';
  if (!from || !to) { errorEl.textContent = 'กรุณาเลือกวันที่ให้ครบ'; return; }
  if (to < from) { errorEl.textContent = 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น'; return; }

  try {
    const q = `branchId=${state.branchId}&from=${from}&to=${to}`;
    const r = await api(`/api/reports/sales?${q}`);
    document.getElementById('d-total').textContent = bahtFixed(r.totalSales);
    document.getElementById('d-orders').textContent = r.orderCount.toLocaleString('th-TH');
    document.getElementById('d-avg').textContent = bahtFixed(r.averagePerOrder);
    document.getElementById('d-range').textContent = from === to ? `(${fmtDate(from)})` : `(${fmtDate(from)} – ${fmtDate(to)})`;
    document.getElementById('d-rows').innerHTML = r.items.length === 0
      ? '<tr><td colspan="4" class="muted">ยังไม่มียอดขายในช่วงนี้</td></tr>'
      : r.items.map((it, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${esc(it.name)}</strong> ${i === 0 ? '<span class="badge badge-top">★ ขายดีที่สุด</span>' : ''}</td>
          <td class="num">${it.quantitySold.toLocaleString('th-TH')}</td>
          <td class="num">${bahtFixed(it.sales)}</td>
        </tr>`).join('');
    await loadOrders(to);
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

async function loadOrders(date) {
  document.getElementById('o-date').textContent = fmtDate(date);
  const tbody = document.getElementById('o-rows');
  try {
    const { orders } = await api(`/api/orders?branchId=${state.branchId}&date=${date}`);
    tbody.innerHTML = orders.length === 0
      ? '<tr><td colspan="4" class="muted">ไม่มีออเดอร์</td></tr>'
      : orders.map((o) => `
        <tr>
          <td><a href="receipt.html?id=${o.orderId}">#${o.orderId}</a></td>
          <td>${esc(o.createdAt.slice(11, 16))}</td>
          <td>${esc(PAYMENT_LABELS[o.paymentMethod] || o.paymentMethod)}</td>
          <td class="num">${bahtFixed(o.totalAmount)}</td>
        </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="muted">${esc(err.message)}</td></tr>`;
  }
}

async function loadMonthly() {
  const month = document.getElementById('month').value;
  const errorEl = document.getElementById('monthly-error');
  errorEl.textContent = '';
  if (!month) { errorEl.textContent = 'กรุณาเลือกเดือน'; return; }

  try {
    const r = await api(`/api/reports/monthly?branchId=${state.branchId}&month=${month}`);
    document.getElementById('m-total').textContent = bahtFixed(r.totalSales);
    document.getElementById('m-orders').textContent = r.orderCount.toLocaleString('th-TH');
    document.getElementById('m-avg').textContent = bahtFixed(r.averagePerOrder);
    document.getElementById('m-top').innerHTML = r.topMenus.length === 0
      ? '<tr><td colspan="4" class="muted">ยังไม่มียอดขายในเดือนนี้</td></tr>'
      : r.topMenus.map((it, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${esc(it.name)}</strong></td>
          <td class="num">${it.quantitySold.toLocaleString('th-TH')}</td>
          <td class="num">${bahtFixed(it.sales)}</td>
        </tr>`).join('');
    renderChart(month, r.daily);
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

function renderChart(month, daily) {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const byDate = new Map(daily.map((d) => [d.date, d]));
  const max = Math.max(1, ...daily.map((d) => d.sales));
  const chart = document.getElementById('m-chart');
  const labels = document.getElementById('m-chart-labels');
  chart.innerHTML = '';
  labels.innerHTML = '';
  for (let d = 1; d <= days; d += 1) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const info = byDate.get(date);
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = `${info ? Math.max(2, (info.sales / max) * 100) : 0}%`;
    bar.title = `${fmtDate(date)}: ${info ? `${bahtFixed(info.sales)} บาท (${info.orderCount} ออเดอร์)` : 'ไม่มียอดขาย'}`;
    chart.appendChild(bar);
    const label = document.createElement('span');
    label.textContent = d === 1 || d % 5 === 0 ? String(d) : '';
    labels.appendChild(label);
  }
  chart.setAttribute('aria-label', `กราฟยอดขายรายวัน เดือน ${month} ยอดสูงสุดวันละ ${bahtFixed(max)} บาท`);
}

function fmtDate(d) {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
