/**
 * dashboard.js
 * Lógica del panel principal: estadísticas y últimos registros
 */

import { db } from './firebase-config.js';
import { requireAuth, setupLogout, setupSidebar } from './auth.js';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// ── Mostrar toast ──
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-msg">${msg}</span>
    <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>
  `;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); }, 4000);
}

// ── Formatear fecha relativa ──
function timeAgo(date) {
  if (!date) return '';
  const now = new Date();
  const d = date.toDate ? date.toDate() : new Date(date);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60)   return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff/60)}m`;
  if (diff < 86400)return `hace ${Math.floor(diff/3600)}h`;
  return d.toLocaleDateString('es-PE');
}

// ── Referencias Firestore ──
const colAsambleas  = collection(db, 'asambleas');
const colAsistencias = collection(db, 'asistencias');

// Cache de datos
let asambleasMap  = {};
let allAsambleas  = [];
let allAsistencias= [];

// ── Inicializar dashboard ──
function initDashboard() {
  // Escuchar asambleas en tiempo real
  onSnapshot(colAsambleas, (snap) => {
    allAsambleas = [];
    asambleasMap = {};
    snap.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      allAsambleas.push(data);
      asambleasMap[doc.id] = data;
    });
    updateStats();
    renderAsambleaBar();
  });

  // Escuchar asistencias en tiempo real
  const qAsist = query(colAsistencias, orderBy('fechaRegistro', 'desc'));
  onSnapshot(qAsist, (snap) => {
    allAsistencias = [];
    snap.forEach(doc => allAsistencias.push({ id: doc.id, ...doc.data() }));
    updateStats();
    renderRecentList();
    renderAsambleaBar();
  });
}

// ── Actualizar contadores ──
function updateStats() {
  const elAsambleas  = document.getElementById('stat-asambleas');
  const elAsistentes = document.getElementById('stat-asistentes');
  const elActivas    = document.getElementById('stat-activas');
  const elHoy        = document.getElementById('stat-hoy');

  if (elAsambleas)  elAsambleas.textContent  = allAsambleas.length;
  if (elAsistentes) elAsistentes.textContent = allAsistencias.length;

  // Asambleas activas
  const activas = allAsambleas.filter(a => a.estado === 'activa').length;
  if (elActivas) elActivas.textContent = activas;

  // Registros hoy
  const hoy = new Date();
  hoy.setHours(0,0,0,0);
  const hoyCount = allAsistencias.filter(a => {
    if (!a.fechaRegistro) return false;
    const d = a.fechaRegistro.toDate ? a.fechaRegistro.toDate() : new Date(a.fechaRegistro);
    return d >= hoy;
  }).length;
  if (elHoy) elHoy.textContent = hoyCount;
}

// ── Renderizar lista de últimos registros ──
function renderRecentList() {
  const list = document.getElementById('recent-list');
  if (!list) return;
  const recent = allAsistencias.slice(0, 10);
  if (recent.length === 0) {
    list.innerHTML = '<p class="text-muted text-center mt-16">No hay registros aún.</p>';
    return;
  }
  list.innerHTML = recent.map(a => {
    const asamblea = asambleasMap[a.asambleaId];
    const initials = (a.nombres || 'N').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
    return `
      <div class="recent-item">
        <div class="recent-avatar">${initials}</div>
        <div class="recent-info">
          <div class="recent-name">${a.nombres || '-'}</div>
          <div class="recent-meta">DNI ${a.dni || '-'} · ${asamblea?.nombre || 'Sin asamblea'}</div>
        </div>
        <div class="recent-time">${timeAgo(a.fechaRegistro)}</div>
      </div>
    `;
  }).join('');
}

// ── Renderizar barras por asamblea ──
function renderAsambleaBar() {
  const el = document.getElementById('asamblea-bars');
  if (!el) return;
  if (allAsambleas.length === 0) {
    el.innerHTML = '<p class="text-muted text-center mt-16">No hay asambleas creadas.</p>';
    return;
  }
  // Contar asistencias por asamblea
  const counts = {};
  allAsistencias.forEach(a => {
    counts[a.asambleaId] = (counts[a.asambleaId] || 0) + 1;
  });
  const max = Math.max(...Object.values(counts), 1);
  const sorted = [...allAsambleas].sort((a,b) => (counts[b.id]||0) - (counts[a.id]||0)).slice(0, 8);

  el.innerHTML = sorted.map(asamblea => {
    const count = counts[asamblea.id] || 0;
    const pct   = Math.round((count / max) * 100);
    return `
      <div class="asamblea-bar-item">
        <div class="asamblea-bar-header">
          <span class="asamblea-bar-name">${asamblea.nombre}</span>
          <span class="asamblea-bar-count">${count} asistente${count !== 1 ? 's' : ''}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Punto de entrada ──
requireAuth(() => {
  setupLogout();
  setupSidebar();
  initDashboard();
});
