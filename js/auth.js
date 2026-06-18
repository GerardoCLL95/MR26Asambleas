/**
 * auth.js
 * Manejo de autenticación Firebase: login, logout, guard de páginas admin
 */

import { auth } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

// ── Toast helper (importado dinámicamente si existe) ──
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-msg">${msg}</span>
    <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ── Ocultar loader de página ──
function hideLoader() {
  const loader = document.getElementById('page-loader');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 300);
  }
}

/**
 * requireAuth()
 * Verificar que el usuario esté autenticado.
 * Si no lo está, redirigir a login.html
 */
export function requireAuth(callback) {
  onAuthStateChanged(auth, (user) => {
    hideLoader();
    if (user) {
      // Mostrar email en sidebar si existe el elemento
      const userNameEl = document.querySelector('.user-name');
      if (userNameEl) userNameEl.textContent = user.email;
      const avatarEl = document.querySelector('.user-avatar');
      if (avatarEl) avatarEl.textContent = user.email.charAt(0).toUpperCase();
      if (callback) callback(user);
    } else {
      window.location.href = 'login.html';
    }
  });
}

/**
 * setupLogout()
 * Conectar botón de cierre de sesión
 */
export function setupLogout() {
  const btn = document.getElementById('btn-logout');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try {
      await signOut(auth);
      window.location.href = 'login.html';
    } catch (e) {
      showToast('Error al cerrar sesión', 'error');
    }
  });
}

/**
 * loginWithEmail(email, password)
 * Iniciar sesión con email y contraseña
 */
export async function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

// ── Setup sidebar responsive (toggle mobile) ──
export function setupSidebar() {
  const btnMenu   = document.getElementById('btn-menu');
  const sidebar   = document.querySelector('.sidebar');
  const overlay   = document.querySelector('.sidebar-overlay');

  if (!btnMenu || !sidebar) return;

  btnMenu.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });
}
