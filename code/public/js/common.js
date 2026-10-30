// common.js - ฟังก์ชันที่ใช้ร่วมกันทุกหน้า: เรียก API, login state, เมนูด้านข้าง, toast, modal, ใบเสร็จ
'use strict';

const PAYMENT_LABELS = { cash: 'เงินสด', transfer: 'โอนเงิน', promptpay: 'QR พร้อมเพย์' };
const ROLE_LABELS = { owner: 'เจ้าของร้าน', barista: 'บาริสต้า' };

// ---------- localStorage (ห่อ try/catch เพราะบางเบราว์เซอร์ปิดไว้) ----------
const store = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

function getUser() {
  try { return JSON.parse(store.get('pk_user') || 'null'); } catch { return null; }
}

function logout() {
  store.remove('pk_token');
  store.remove('pk_user');
  window.location.href = 'login.html';
}

function requireLogin() {
  const user = getUser();
  if (!store.get('pk_token') || !user) {
    window.location.href = 'login.html';
    throw new Error('not logged in');
  }
  return user;
}

// ---------- เรียก API ----------
class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  const token = store.get('pk_token');
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ต/WiFi แล้วลองใหม่');
  }
  if (res.status === 401 && path !== '/api/auth/login') {
    logout();
    throw new ApiError(401, 'กรุณาเข้าสู่ระบบใหม่');
  }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* ไม่ใช่ JSON */ }
  if (!res.ok) {
    throw new ApiError(res.status, (data && data.error) || `เกิดข้อผิดพลาด (${res.status})`, data && data.details);
  }
  return data;
}

// ---------- จัดรูปแบบข้อมูล ----------
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function baht(n) {
  return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function bahtFixed(n) {
  return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function thaiDateTime(sqlDateTime) {
  // "2026-10-30 14:05:00" -> "30/10/2026 14:05"
  const [d, t = ''] = String(sqlDateTime).split(' ');
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y} ${t.slice(0, 5)}`.trim();
}

function todayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
}

function shiftDate(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// ---------- Toast ----------
function toast(message, type = '') {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), type === 'err' ? 6000 : 3500);
}

// ---------- Modal ----------
// openModal({ title, body: HTMLElement|string, actions: [{label, className, onClick}] })
function openModal({ title, body, actions = [], onClose } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-head">
        <h2 id="modal-title">${esc(title)}</h2>
        <button type="button" class="icon-btn" data-close aria-label="ปิด">×</button>
      </div>
      <div class="modal-body"></div>
      <div class="modal-foot"></div>
    </div>`;
  const bodyEl = backdrop.querySelector('.modal-body');
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body) bodyEl.appendChild(body);

  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    if (onClose) onClose();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  backdrop.querySelector('[data-close]').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

  const foot = backdrop.querySelector('.modal-foot');
  actions.forEach((a) => {
    const btn = document.createElement('button');
    btn.type = a.type || 'button';
    btn.className = `btn ${a.className || ''}`;
    btn.textContent = a.label;
    btn.addEventListener('click', () => a.onClick({ close, button: btn, body: bodyEl }));
    foot.appendChild(btn);
  });

  document.body.appendChild(backdrop);
  const focusable = bodyEl.querySelector('input, select, button') || foot.querySelector('button');
  if (focusable) focusable.focus();
  return { close, body: bodyEl, root: backdrop };
}

function confirmDialog(message, { okLabel = 'ยืนยัน', danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    openModal({
      title: 'ยืนยันการทำรายการ',
      body: `<p>${esc(message)}</p>`,
      onClose: () => { if (!answered) resolve(false); },
      actions: [
        { label: 'ยกเลิก', onClick: ({ close }) => close() },
        {
          label: okLabel,
          className: danger ? 'btn-danger' : 'btn-primary',
          onClick: ({ close }) => { answered = true; resolve(true); close(); },
        },
      ],
    });
  });
}

// ---------- ใบเสร็จ ----------
function renderReceipt(order) {
  const rows = order.items.map((it) => `
    <tr>
      <td>${esc(it.name)}</td>
      <td class="num">${it.quantity}</td>
      <td class="num">${bahtFixed(it.unitPrice)}</td>
      <td class="num">${bahtFixed(it.subtotal)}</td>
    </tr>`).join('');
  return `
    <div class="receipt">
      <div class="shop">
        <h2>Pad-Krapow Cafe</h2>
        <div>${esc(order.branchName)}</div>
      </div>
      <div class="meta">
        <span class="muted">เลขที่ออเดอร์</span><strong>#${order.orderId}</strong>
        <span class="muted">วันเวลา</span><span>${esc(thaiDateTime(order.createdAt))}</span>
        <span class="muted">พนักงาน</span><span>${esc(order.employeeName)}</span>
      </div>
      <table>
        <thead><tr><th>เมนู</th><th class="num">จำนวน</th><th class="num">ราคา/หน่วย</th><th class="num">รวม</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="sum"><span>ยอดสุทธิ</span><span>${bahtFixed(order.totalAmount)} บาท</span></div>
      <div class="meta">
        <span class="muted">ชำระโดย</span><span>${esc(PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod)}</span>
        <span class="muted">สถานะ</span><span>ชำระแล้ว</span>
      </div>
      <p class="thanks">ขอบคุณที่ใช้บริการ ☕</p>
    </div>`;
}

// ---------- โครงหน้า: แถบบน + เมนูด้านข้าง + ตัวเลือกสาขา ----------
const NAV = [
  { key: 'pos', href: 'pos.html', icon: '🛒', label: 'ขายสินค้า' },
  { key: 'menu', href: 'menu.html', icon: '📋', label: 'เมนูและสต็อก' },
  { key: 'report', href: 'report.html', icon: '📊', label: 'รายงานยอดขาย' },
];

function getSelectedBranchId(user) {
  if (user.role !== 'owner') return user.branchId;
  const saved = Number(store.get('pk_branch'));
  return Number.isInteger(saved) && saved > 0 ? saved : user.branchId;
}

// สร้างแถบบนและเมนูด้านข้าง คืนค่า branchId ที่เลือกอยู่ เมื่อเปลี่ยนสาขาจะเรียก onBranchChange(branchId)
async function initShell(activeKey, onBranchChange) {
  const user = requireLogin();
  const topbar = document.getElementById('topbar');
  const sidenav = document.getElementById('sidenav');

  topbar.innerHTML = `
    <div class="logo"><span class="logo-mark" aria-hidden="true">☕</span><span>Pad-Krapow Cafe POS</span></div>
    <label class="branch-picker"><span>สาขา</span><select id="branch-select" aria-label="เลือกสาขา"></select></label>
    <div class="spacer"></div>
    <div class="user">
      <div><div>พนักงาน: <strong>${esc(user.name)}</strong></div><div class="role">${esc(ROLE_LABELS[user.role] || user.role)}</div></div>
      <button type="button" class="btn" id="logout-btn">ออกจากระบบ</button>
    </div>`;
  sidenav.setAttribute('aria-label', 'เมนูหลัก');
  sidenav.innerHTML = NAV.map((n) => `
    <a href="${n.href}" class="${n.key === activeKey ? 'active' : ''}" ${n.key === activeKey ? 'aria-current="page"' : ''}>
      <span class="icon" aria-hidden="true">${n.icon}</span>${esc(n.label)}
    </a>`).join('');
  document.getElementById('logout-btn').addEventListener('click', logout);

  const select = document.getElementById('branch-select');
  let branchId = getSelectedBranchId(user);
  try {
    const { branches } = await api('/api/branches');
    if (!branches.some((b) => b.branchId === branchId)) branchId = user.branchId;
    select.innerHTML = branches
      .map((b) => `<option value="${b.branchId}" ${b.branchId === branchId ? 'selected' : ''}>${esc(b.name)}</option>`)
      .join('');
  } catch (err) {
    toast(err.message, 'err');
  }
  // บาริสต้าใช้ได้เฉพาะสาขาของตัวเอง จึงล็อกตัวเลือกไว้
  if (user.role !== 'owner') {
    select.disabled = true;
    select.title = 'บาริสต้าใช้งานได้เฉพาะสาขาของตัวเอง';
  }
  select.addEventListener('change', () => {
    branchId = Number(select.value);
    store.set('pk_branch', String(branchId));
    if (onBranchChange) onBranchChange(branchId);
  });
  return { user, branchId };
}
