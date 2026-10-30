// receipt.js - แสดงใบเสร็จย้อนหลังจากเลขที่ออเดอร์ (receipt.html?id=123)
'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  requireLogin();
  const box = document.getElementById('receipt-box');
  document.getElementById('print-btn').addEventListener('click', () => window.print());

  const id = new URLSearchParams(window.location.search).get('id');
  if (!/^\d+$/.test(id || '')) {
    box.innerHTML = '<p class="alert alert-danger">ไม่ได้ระบุเลขที่ออเดอร์</p>';
    return;
  }
  try {
    const order = await api(`/api/orders/${id}`);
    box.innerHTML = renderReceipt(order);
    document.title = `ใบเสร็จ #${order.orderId} | Pad-Krapow Cafe POS`;
  } catch (err) {
    box.innerHTML = `<p class="alert alert-danger">${esc(err.message)}</p>`;
  }
});
