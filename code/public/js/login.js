// login.js - หน้าเข้าสู่ระบบ
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const button = document.getElementById('login-btn');
  document.getElementById('username').focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value;
    if (!username || !password) {
      errorEl.textContent = 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน';
      return;
    }
    errorEl.textContent = '';
    button.disabled = true;
    button.textContent = 'กำลังเข้าสู่ระบบ...';
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: { username, password } });
      store.set('pk_token', data.token);
      store.set('pk_user', JSON.stringify(data.user));
      store.set('pk_branch', String(data.user.branchId));
      window.location.href = 'pos.html';
    } catch (err) {
      errorEl.textContent = err.message;
      form.password.value = '';
      form.password.focus();
    } finally {
      button.disabled = false;
      button.textContent = 'เข้าสู่ระบบ';
    }
  });
});
