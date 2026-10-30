// pos.js - หน้ารับออเดอร์ (US-01 ถึง US-06)
'use strict';

const POLL_MS = 3000; // NFR-04: สต็อกบนทุกเครื่องต้องตรงกันภายใน 3 วินาที

const state = {
  branchId: null,
  menus: new Map(), // menuId -> menu
  category: 'all',
  search: '',
  cart: new Map(), // menuId -> quantity (เรียงตามลำดับที่เพิ่ม)
  payment: null,
  submitting: false,
};

const el = {};

document.addEventListener('DOMContentLoaded', async () => {
  for (const id of ['menu-grid', 'category-tabs', 'menu-search', 'cart-body', 'cart-count', 'cart-total',
    'confirm-btn', 'clear-btn', 'confirm-hint', 'low-stock-alert', 'pay-options', 'sync-status']) {
    el[id] = document.getElementById(id);
  }

  const { branchId } = await initShell('pos', (newBranchId) => {
    state.branchId = newBranchId;
    state.cart.clear();
    state.category = 'all';
    loadMenu();
  });
  state.branchId = branchId;

  el['menu-search'].addEventListener('input', (e) => {
    state.search = e.target.value.trim().toLowerCase();
    renderMenu();
  });
  el['pay-options'].addEventListener('change', (e) => {
    state.payment = e.target.value;
    renderCart();
  });
  el['clear-btn'].addEventListener('click', () => {
    if (state.cart.size === 0) return;
    state.cart.clear();
    resetPayment();
    renderAll();
    toast('ล้างตะกร้าแล้ว');
  });
  el['confirm-btn'].addEventListener('click', submitOrder);

  await loadMenu();
  setInterval(() => {
    if (!document.hidden && !state.submitting) loadMenu({ silent: true });
  }, POLL_MS);
});

async function loadMenu({ silent = false } = {}) {
  try {
    const { items } = await api(`/api/menu?branchId=${state.branchId}`);
    state.menus = new Map(items.map((m) => [m.menuId, m]));
    // เมนูที่ถูกปิดการขายระหว่างนั้น ให้เอาออกจากตะกร้า
    for (const id of [...state.cart.keys()]) {
      if (!state.menus.has(id)) state.cart.delete(id);
    }
    el['sync-status'].textContent = `อัปเดตสต็อกล่าสุด ${new Date().toLocaleTimeString('th-TH')}`;
    renderAll();
  } catch (err) {
    el['sync-status'].textContent = 'ไม่สามารถอัปเดตสต็อกได้';
    if (!silent) toast(err.message, 'err');
  }
}

// วาดหน้าจอใหม่ทั้งหมด (เรียกทุก 3 วินาทีจากการ poll) โดยไม่ทำให้ผู้ใช้เสียตำแหน่งที่กำลังพิมพ์/โฟกัส
function renderAll() {
  const active = document.activeElement;
  const typingQty = active && active.tagName === 'INPUT' && el['cart-body'].contains(active);
  const focusedCard = active && active.classList && active.classList.contains('menu-card') ? active.dataset.id : null;
  const focusedTab = active && active.classList && active.classList.contains('tab') ? active.dataset.cat : null;

  renderTabs();
  renderMenu();
  if (!typingQty) renderCart();
  renderLowStock();

  if (focusedCard) el['menu-grid'].querySelector(`.menu-card[data-id="${focusedCard}"]`)?.focus();
  if (focusedTab) el['category-tabs'].querySelector(`.tab[data-cat="${focusedTab}"]`)?.focus();
}

function renderTabs() {
  const cats = new Map();
  for (const m of state.menus.values()) cats.set(m.categoryId, m.categoryName);
  const tabs = [['all', 'ทั้งหมด'], ...[...cats.entries()]];
  if (state.category !== 'all' && !cats.has(state.category)) state.category = 'all';
  el['category-tabs'].innerHTML = tabs.map(([id, name]) => `
    <button type="button" class="tab" data-cat="${id}" aria-pressed="${String(id) === String(state.category)}">${esc(name)}</button>`).join('');
  el['category-tabs'].querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.category = btn.dataset.cat === 'all' ? 'all' : Number(btn.dataset.cat);
      renderTabs();
      renderMenu();
    });
  });
}

function renderMenu() {
  const list = [...state.menus.values()].filter((m) =>
    (state.category === 'all' || m.categoryId === state.category) &&
    (!state.search || m.name.toLowerCase().includes(state.search)));

  if (list.length === 0) {
    el['menu-grid'].innerHTML = '<p class="muted">ไม่พบเมนู</p>';
    return;
  }
  el['menu-grid'].innerHTML = list.map((m) => {
    const out = m.stockQuantity === 0;
    const inCart = state.cart.get(m.menuId) || 0;
    let stockText = `เหลือ ${m.stockQuantity}`;
    if (out) stockText = '<span class="badge badge-out">หมด</span>';
    else if (m.isLowStock) stockText = `เหลือ ${m.stockQuantity} <span class="badge badge-warn">⚠ ใกล้หมด</span>`;
    return `
      <button type="button" class="menu-card ${out ? 'out' : ''} ${m.isLowStock && !out ? 'low' : ''}"
        data-id="${m.menuId}" aria-disabled="${out}"
        aria-label="${esc(m.name)} ราคา ${baht(m.price)} บาท ${out ? 'หมดสต็อก' : `เหลือ ${m.stockQuantity}`}">
        <span class="name">${esc(m.name)}</span>
        <span class="price">${baht(m.price)} บาท</span>
        ${inCart ? `<span class="in-cart">ในตะกร้า ${inCart}</span>` : ''}
        <span class="stock">${stockText}</span>
      </button>`;
  }).join('');
  el['menu-grid'].querySelectorAll('.menu-card').forEach((card) => {
    card.addEventListener('click', () => addToCart(Number(card.dataset.id)));
  });
}

function addToCart(menuId) {
  const m = state.menus.get(menuId);
  if (!m) return;
  if (m.stockQuantity === 0) {
    toast(`${m.name} หมดสต็อก ไม่สามารถสั่งได้ กรุณาเลือกเมนูอื่น`, 'err');
    return;
  }
  const current = state.cart.get(menuId) || 0;
  if (current >= m.stockQuantity) {
    toast(`${m.name} เหลือในสต็อกเพียง ${m.stockQuantity}`, 'warn');
    return;
  }
  state.cart.set(menuId, current + 1);
  renderMenu();
  renderCart();
}

function setQuantity(menuId, qty) {
  const m = state.menus.get(menuId);
  if (!m) return;
  if (!Number.isInteger(qty) || qty < 1) qty = 1;
  if (qty > m.stockQuantity) {
    toast(`${m.name} เหลือในสต็อกเพียง ${m.stockQuantity}`, 'warn');
    qty = Math.max(1, m.stockQuantity);
  }
  state.cart.set(menuId, qty);
  renderMenu();
  renderCart();
}

function removeFromCart(menuId) {
  state.cart.delete(menuId);
  renderMenu();
  renderCart();
}

// ยอดรวมฝั่งหน้าจอ (คิดเป็นสตางค์) — ยอดจริงคำนวณซ้ำที่ server จากราคาในฐานข้อมูล
function cartTotal() {
  let satang = 0;
  for (const [id, qty] of state.cart) {
    const m = state.menus.get(id);
    if (m) satang += Math.round(m.price * 100) * qty;
  }
  return satang / 100;
}

function cartProblems() {
  const problems = [];
  for (const [id, qty] of state.cart) {
    const m = state.menus.get(id);
    if (m && qty > m.stockQuantity) problems.push(m);
  }
  return problems;
}

function renderCart() {
  const lines = [...state.cart.entries()];
  const count = lines.reduce((s, [, q]) => s + q, 0);
  el['cart-count'].textContent = `${count} ชิ้น`;
  el['cart-total'].textContent = baht(cartTotal());

  if (lines.length === 0) {
    el['cart-body'].innerHTML = '<div class="cart-empty">ยังไม่มีรายการ<br>แตะที่เมนูเพื่อเพิ่มลงตะกร้า</div>';
  } else {
    el['cart-body'].innerHTML = lines.map(([id, qty]) => {
      const m = state.menus.get(id);
      const over = qty > m.stockQuantity;
      return `
        <div class="cart-line" data-id="${id}">
          <div><div class="name">${esc(m.name)}</div><div class="unit">${baht(m.price)} บาท / หน่วย</div></div>
          <div class="line-total">${baht(Math.round(m.price * 100) * qty / 100)}</div>
          <div class="controls">
            <div class="qty">
              <button type="button" data-act="dec" aria-label="ลดจำนวน ${esc(m.name)}" ${qty <= 1 ? 'disabled' : ''}>−</button>
              <input type="number" inputmode="numeric" min="1" max="${m.stockQuantity}" value="${qty}" aria-label="จำนวน ${esc(m.name)}">
              <button type="button" data-act="inc" aria-label="เพิ่มจำนวน ${esc(m.name)}" ${qty >= m.stockQuantity ? 'disabled' : ''}>+</button>
            </div>
            <span class="spacer"></span>
            <button type="button" class="btn btn-sm btn-danger" data-act="remove" aria-label="ลบ ${esc(m.name)} ออกจากตะกร้า">🗑 ลบ</button>
          </div>
          ${over ? `<div class="line-warn">⚠ สต็อกเหลือ ${m.stockQuantity} กรุณาลดจำนวน</div>` : ''}
        </div>`;
    }).join('');
    el['cart-body'].querySelectorAll('.cart-line').forEach((line) => {
      const id = Number(line.dataset.id);
      line.querySelector('[data-act="dec"]').addEventListener('click', () => setQuantity(id, state.cart.get(id) - 1));
      line.querySelector('[data-act="inc"]').addEventListener('click', () => setQuantity(id, state.cart.get(id) + 1));
      line.querySelector('[data-act="remove"]').addEventListener('click', () => removeFromCart(id));
      line.querySelector('input').addEventListener('change', (e) => setQuantity(id, Number(e.target.value)));
    });
  }

  // ปุ่มยืนยันกดได้เมื่อข้อมูลครบเท่านั้น (Error Prevention ตาม wk10 Input Design)
  let hint = '';
  if (lines.length === 0) hint = 'เพิ่มเมนูอย่างน้อย 1 รายการ';
  else if (cartProblems().length > 0) hint = 'มีรายการที่เกินสต็อก กรุณาแก้จำนวน';
  else if (!state.payment) hint = 'เลือกวิธีชำระเงินก่อนยืนยัน';
  el['confirm-hint'].textContent = hint;
  el['confirm-btn'].disabled = Boolean(hint) || state.submitting;
}

function renderLowStock() {
  const low = [...state.menus.values()].filter((m) => m.isLowStock);
  const box = el['low-stock-alert'];
  if (low.length === 0) {
    box.classList.add('hidden');
    return;
  }
  const names = low.map((m) => `${esc(m.name)} (${m.stockQuantity === 0 ? 'หมด' : `เหลือ ${m.stockQuantity}`})`).join(', ');
  box.innerHTML = `<span aria-hidden="true">⚠</span><div><strong>วัตถุดิบใกล้หมด ${low.length} รายการ:</strong> ${names}
    — <a href="menu.html">ไปเติมสต็อก</a></div>`;
  box.classList.remove('hidden');
}

function resetPayment() {
  state.payment = null;
  el['pay-options'].querySelectorAll('input').forEach((r) => { r.checked = false; });
}

async function submitOrder() {
  if (state.submitting || el['confirm-btn'].disabled) return;
  state.submitting = true;
  el['confirm-btn'].textContent = 'กำลังบันทึก...';
  renderCart();

  const body = {
    branchId: state.branchId,
    paymentMethod: state.payment,
    items: [...state.cart.entries()].map(([menuId, quantity]) => ({ menuId, quantity })),
  };
  try {
    const result = await api('/api/orders', { method: 'POST', body });
    state.cart.clear();
    resetPayment();
    toast(`บันทึกออเดอร์ #${result.orderId} สำเร็จ ยอด ${baht(result.totalAmount)} บาท`, 'ok');
    await loadMenu();
    if (result.lowStockMenuIds.length > 0) {
      const names = result.lowStockMenuIds.map((id) => state.menus.get(id)?.name).filter(Boolean).join(', ');
      toast(`⚠ วัตถุดิบใกล้หมด: ${names}`, 'warn');
    }
    showReceipt(result.orderId);
  } catch (err) {
    toast(err.message, 'err');
    await loadMenu({ silent: true });
  } finally {
    state.submitting = false;
    el['confirm-btn'].textContent = '✓ ยืนยันออเดอร์';
    renderCart();
  }
}

async function showReceipt(orderId) {
  try {
    const order = await api(`/api/orders/${orderId}`);
    openModal({
      title: 'ใบเสร็จ',
      body: renderReceipt(order),
      onClose: () => document.body.classList.remove('printing-receipt'),
      actions: [
        {
          label: '🖨 พิมพ์ใบเสร็จ',
          onClick: () => {
            document.body.classList.add('printing-receipt');
            window.print();
            document.body.classList.remove('printing-receipt');
          },
        },
        { label: 'รับออเดอร์ถัดไป', className: 'btn-primary', onClick: ({ close }) => close() },
      ],
    });
  } catch (err) {
    toast(err.message, 'err');
  }
}
