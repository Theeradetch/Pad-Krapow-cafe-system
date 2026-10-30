// index.js - หน้าแรก: ถ้า login แล้วไปหน้าขาย ถ้ายังไปหน้า login
'use strict';
(function redirect() {
  let token = null;
  try { token = localStorage.getItem('pk_token'); } catch { /* ignore */ }
  window.location.replace(token ? 'pos.html' : 'login.html');
})();
