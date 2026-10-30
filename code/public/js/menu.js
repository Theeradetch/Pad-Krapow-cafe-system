// menu.js - หน้าจัดการเมนู (owner) และเติมสต็อก (ทุกบทบาท) — FR-05, FR-08, US-06
'use strict';

const state = { user: null, branchId: null, items: [], categories: [], search: '', lowOnly: false };

document.addEventListener('DOMContentLoaded', async () => {
  const { user, branchId } = await initShell('menu', (newBranchId) => {
    state.branchId = newBranchId;
    load();
  });
  state.user = user;
  state.branchId = branchId;

  const isOwner = user.role === 'owner';
  document.getElementById('add-btn').classList.toggle('hidden', !isOwner);
  document.getElementById('add-btn').addEventListener('click', () => openMenuForm());
  document.getElementById('role-note').textContent = isOwner
    ? 'การลบเมนูจะซ่อนเมนูออกจากหน้าขาย แต่ประวัติการขายในรายงานยังอยู่ครบ'
    : 'บาริสต้าเติม/ปรับสต็อกได้ ส่วนการเพิ่ม แก้ไข และลบเมนูทำได้เฉพาะเจ้าของร้าน';

  document.getElementById('menu-search').addEventListener('input', (e) => {
    state.search = e.target.value.trim().toLowerCase();
    render();
  });
  document.getElementById('low-only').addEventListener('change', (e) => {
    state.lowOnly = e.target.checked;
    render();
  });

  try {
    state.categories = (await api('/api/menu/categories')).categories;
  } catch (err) {
    toast(err.message, 'err');
  }
  load();
});

async function load() {
  try {
    const { items } = await api(`/api/menu?branchId=${state.branchId}`);
    state.items = items;
    render();
  } catch (err) {
    toast(err.message, 'err');
  }
}

function render() {
  const isOwner = state.user.role === 'owner';
  const rows = state.items.filter((m) =>
    (!state.search || m.name.toLowerCase().includes(state.search)) && (!state.lowOnly || m.isLowStock));

  const tbody = document.getElementById('menu-rows');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted">ไม่พบเมนู</td></tr>';
  } else {
    tbody.innerHTML = rows.map((m) => {
      let stock = `${m.stockQuantity}`;
      if (m.stockQuantity === 0) stock += ' <span class="badge badge-out">หมด</span>';
      else if (m.isLowStock) stock += ' <span class="badge badge-warn">⚠ ใกล้หมด</span>';
      return `
        <tr data-id="${m.menuId}">
          <td><strong>${esc(m.name)}</strong></td>
          <td>${esc(m.categoryName)}</td>
          <td class="num">${bahtFixed(m.price)}</td>
          <td class="num">${stock}</td>
          <td class="num">${m.lowStockThreshold}</td>
          <td class="actions">
            <button type="button" class="btn btn-sm btn-brand" data-act="stock">＋ เติม/ปรับสต็อก</button>
            ${isOwner ? '<button type="button" class="btn btn-sm" data-act="edit">✎ แก้ไข</button>' : ''}
            ${isOwner ? '<button type="button" class="btn btn-sm btn-danger" data-act="delete">🗑 ลบ</button>' : ''}
          </td>
        </tr>`;
    }).join('');
    tbody.querySelectorAll('tr[data-id]').forEach((tr) => {
      const item = state.items.find((m) => m.menuId === Number(tr.dataset.id));
      tr.querySelector('[data-act="stock"]').addEventListener('click', () => openStockForm(item));
      tr.querySelector('[data-act="edit"]')?.addEventListener('click', () => openMenuForm(item));
      tr.querySelector('[data-act="delete"]')?.addEventListener('click', () => deleteMenu(item));
    });
  }

  const low = state.items.filter((m) => m.isLowStock);
  const alertBox = document.getElementById('low-stock-alert');
  alertBox.classList.toggle('hidden', low.length === 0);
  alertBox.innerHTML = low.length
    ? `<span aria-hidden="true">⚠</span><div><strong>ต้องเติมสต็อก ${low.length} รายการ:</strong> ${low
      .map((m) => `${esc(m.name)} (${m.stockQuantity === 0 ? 'หมด' : `เหลือ ${m.stockQuantity}`})`).join(', ')}</div>`
    : '';
}

function openStockForm(item) {
  const form = document.createElement('form');
  form.noValidate = true;
  form.innerHTML = `
    <p>สต็อกปัจจุบันของ <strong>${esc(item.name)}</strong>: <strong>${item.stockQuantity}</strong></p>
    <div class="field">
      <label for="stock-mode">ประเภท</label>
      <select class="input" id="stock-mode">
        <option value="restock">เติมสต็อก (+)</option>
        <option value="adjust">ปรับลด เช่น ของเสีย/นับไม่ตรง (−)</option>
      </select>
    </div>
    <div class="field">
      <label for="stock-amount">จำนวน</label>
      <input class="input" id="stock-amount" type="number" inputmode="numeric" min="1" step="1" value="10" required>
      <div class="field-error" id="stock-error" role="alert"></div>
    </div>`;
  const modal = openModal({
    title: 'เติม / ปรับสต็อก',
    body: form,
    actions: [
      { label: 'ยกเลิก', onClick: ({ close }) => close() },
      { label: 'บันทึก', className: 'btn-primary', onClick: () => submit() },
    ],
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });

  async function submit() {
    const amount = Number(form.querySelector('#stock-amount').value);
    const mode = form.querySelector('#stock-mode').value;
    const errorEl = form.querySelector('#stock-error');
    if (!Number.isInteger(amount) || amount <= 0) {
      errorEl.textContent = 'กรุณากรอกจำนวนเต็มมากกว่า 0';
      return;
    }
    if (mode === 'adjust' && amount > item.stockQuantity) {
      errorEl.textContent = `ปรับลดได้ไม่เกิน ${item.stockQuantity}`;
      return;
    }
    try {
      const change = mode === 'restock' ? amount : -amount;
      const updated = await api(`/api/menu/${item.menuId}/stock`, { method: 'PATCH', body: { change, reason: mode } });
      modal.close();
      toast(`${item.name}: สต็อกคงเหลือ ${updated.stockQuantity}`, 'ok');
      load();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  }
}

function openMenuForm(item = null) {
  const editing = Boolean(item);
  const form = document.createElement('form');
  form.noValidate = true;
  form.innerHTML = `
    <div class="field">
      <label for="f-name">ชื่อเมนู</label>
      <input class="input" id="f-name" maxlength="100" required value="${esc(item?.name || '')}">
    </div>
    <div class="field">
      <label for="f-category">หมวดหมู่</label>
      <select class="input" id="f-category">
        ${state.categories.map((c) => `<option value="${c.categoryId}" ${item?.categoryId === c.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label for="f-price">ราคา (บาท)</label>
      <input class="input" id="f-price" type="number" inputmode="decimal" min="0" step="0.01" required value="${item ? item.price : ''}">
    </div>
    ${editing ? '' : `
    <div class="field">
      <label for="f-stock">สต็อกเริ่มต้น</label>
      <input class="input" id="f-stock" type="number" inputmode="numeric" min="0" step="1" value="0">
    </div>`}
    <div class="field">
      <label for="f-threshold">แจ้งเตือนเมื่อสต็อกต่ำกว่า</label>
      <input class="input" id="f-threshold" type="number" inputmode="numeric" min="0" step="1" value="${item ? item.lowStockThreshold : 10}">
    </div>
    <div class="field-error" id="form-error" role="alert"></div>`;

  const modal = openModal({
    title: editing ? `แก้ไขเมนู: ${item.name}` : 'เพิ่มเมนูใหม่',
    body: form,
    actions: [
      { label: 'ยกเลิก', onClick: ({ close }) => close() },
      { label: 'บันทึก', className: 'btn-primary', onClick: () => submit() },
    ],
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });

  async function submit() {
    const errorEl = form.querySelector('#form-error');
    const name = form.querySelector('#f-name').value.trim();
    const price = Number(form.querySelector('#f-price').value);
    const threshold = Number(form.querySelector('#f-threshold').value);
    const categoryId = Number(form.querySelector('#f-category').value);
    const priceRaw = form.querySelector('#f-price').value;
    if (!name) { errorEl.textContent = 'กรุณากรอกชื่อเมนู'; return; }
    if (priceRaw === '' || !Number.isFinite(price) || price < 0) { errorEl.textContent = 'ราคาต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป'; return; }
    if (!Number.isInteger(threshold) || threshold < 0) { errorEl.textContent = 'ค่าขั้นต่ำต้องเป็นจำนวนเต็มตั้งแต่ 0'; return; }

    const body = { name, price, categoryId, lowStockThreshold: threshold };
    try {
      if (editing) {
        await api(`/api/menu/${item.menuId}`, { method: 'PATCH', body });
      } else {
        const stock = Number(form.querySelector('#f-stock').value);
        if (!Number.isInteger(stock) || stock < 0) { errorEl.textContent = 'สต็อกต้องเป็นจำนวนเต็มตั้งแต่ 0'; return; }
        await api('/api/menu', { method: 'POST', body: { ...body, branchId: state.branchId, stockQuantity: stock } });
      }
      modal.close();
      toast(editing ? 'บันทึกการแก้ไขแล้ว' : `เพิ่มเมนู ${name} แล้ว`, 'ok');
      load();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  }
}

async function deleteMenu(item) {
  const ok = await confirmDialog(`ต้องการลบเมนู "${item.name}" ออกจากหน้าขายหรือไม่? (ประวัติการขายยังอยู่)`, {
    okLabel: 'ลบเมนู',
    danger: true,
  });
  if (!ok) return;
  try {
    await api(`/api/menu/${item.menuId}`, { method: 'DELETE' });
    toast(`ลบ ${item.name} แล้ว`, 'ok');
    load();
  } catch (err) {
    toast(err.message, 'err');
  }
}
