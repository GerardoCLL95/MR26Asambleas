/**
 * monitor.js
 * Monitor en tiempo real de asistentes para supervisores
 * Utiliza Firestore onSnapshot para actualización automática
 */

import { db } from './firebase-config.js';
import { requireAuth, setupLogout } from './auth.js';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// ── Estado ──
let asambleas       = [];
let asambleasMap    = {};
let asistencias     = [];
let asambleaActual  = null;
let unsubscribe     = null;
let newEntryIds     = new Set(); // IDs de entradas nuevas para animación

// ── Colecciones ──
const colAsambleas   = collection(db, 'asambleas');
const colAsistencias = collection(db, 'asistencias');

// ── Ocultar loader ──
function hideLoader() {
  const l = document.getElementById('page-loader');
  if (l) { l.classList.add('hidden'); setTimeout(()=>l.remove(), 300); }
}

// ── Formatear hora ──
function formatTime(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

// ── Formatear fecha corta ──
function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric' });
}

// ── Obtener iniciales ──
function getInitials(nombre) {
  return (nombre || 'N').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
}

// ── Cargar asambleas para el select ──
async function loadAsambleas() {
  const snap = await getDocs(query(colAsambleas, orderBy('createdAt','desc')));
  asambleas = [];
  asambleasMap = {};
  snap.forEach(doc => {
    const data = { id: doc.id, ...doc.data() };
    asambleas.push(data);
    asambleasMap[doc.id] = data;
  });

  const sel = document.getElementById('sel-asamblea');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Selecciona una asamblea —</option>';
  asambleas.forEach(a => {
    const badge = a.estado === 'activa' ? '🟢' : '🔴';
    sel.innerHTML += `<option value="${a.id}">${badge} ${escapeHTML(a.nombre)}</option>`;
  });
}

// ── Suscribirse a asistencias de una asamblea ──
function listenAsamblea(asambleaId) {
  // Cancelar suscripción anterior
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }

  if (!asambleaId) {
    asistencias = [];
    renderFeed();
    updateStats(0, 0);
    return;
  }

  asambleaActual = asambleasMap[asambleaId];

  // Mostrar nombre asamblea
  const nameEl = document.getElementById('monitor-asamblea-name');
  if (nameEl) {
    nameEl.textContent = asambleaActual?.nombre || '—';
  }

  const q = query(
    colAsistencias,
    where('asambleaId', '==', asambleaId),
    orderBy('fechaRegistro', 'desc')
  );

  unsubscribe = onSnapshot(q, (snap) => {
    const prev = new Set(asistencias.map(a => a.id));
    asistencias = [];
    snap.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      asistencias.push(data);
      // Marcar como nuevo si no estaba antes
      if (!prev.has(doc.id) && prev.size > 0) {
        newEntryIds.add(doc.id);
        setTimeout(() => newEntryIds.delete(doc.id), 5000);
      }
    });

    renderFeed();
    updateStats(asistencias.length, contarHoy());
    updateLastTime();
  }, (err) => {
    console.error('Monitor error:', err);
  });
}

// ── Contar registros de hoy ──
function contarHoy() {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  return asistencias.filter(a => {
    if (!a.fechaRegistro) return false;
    const d = a.fechaRegistro.toDate ? a.fechaRegistro.toDate() : new Date(a.fechaRegistro);
    return d >= hoy;
  }).length;
}

// ── Actualizar estadísticas ──
function updateStats(total, hoy) {
  const totalEl = document.getElementById('monitor-total');
  const hoyEl   = document.getElementById('monitor-hoy');
  if (totalEl) totalEl.textContent = total;
  if (hoyEl)   hoyEl.textContent   = hoy;
}

// ── Actualizar hora del último registro ──
function updateLastTime() {
  const el = document.getElementById('monitor-last');
  if (!el) return;
  if (asistencias.length === 0) { el.textContent = '—'; return; }
  const ultimo = asistencias[0];
  el.textContent = formatTime(ultimo.fechaRegistro);
}

// ── Renderizar feed de asistentes ──
function renderFeed() {
  const feed    = document.getElementById('monitor-feed');
  const emptyEl = document.getElementById('monitor-empty');
  if (!feed) return;

  if (asistencias.length === 0) {
    feed.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'flex';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  feed.innerHTML = asistencias.map((a, i) => {
    const isNew = newEntryIds.has(a.id);
    return `
      <div class="monitor-entry${isNew ? ' entry-new' : ''}">
        <div class="entry-number">${asistencias.length - i}</div>
        <div class="entry-avatar">${getInitials(a.nombres)}</div>
        <div class="entry-info">
          <div class="entry-name">${escapeHTML(a.nombres || '—')}</div>
          <div class="entry-meta">
            DNI: ${escapeHTML(a.dni || '—')} &nbsp;·&nbsp;
            ${escapeHTML(a.baseDireccion || '—')}
          </div>
        </div>
        <div class="entry-time">${formatTime(a.fechaRegistro)}</div>
      </div>
    `;
  }).join('');
}

// ── Actualizar reloj del monitor ──
function updateClock() {
  const el = document.getElementById('monitor-clock');
  if (el) {
    el.textContent = new Date().toLocaleTimeString('es-PE', {
      hour:'2-digit', minute:'2-digit', second:'2-digit'
    });
  }
}
setInterval(updateClock, 1000);
updateClock();

// ── Escape HTML ──
function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ── Punto de entrada ──
requireAuth(async () => {
  setupLogout();
  hideLoader();

  await loadAsambleas();

  // Cambio de asamblea seleccionada
  document.getElementById('sel-asamblea')?.addEventListener('change', (e) => {
    listenAsamblea(e.target.value);
  });

  // Auto-seleccionar primera asamblea activa
  const primeraActiva = asambleas.find(a => a.estado === 'activa');
  if (primeraActiva) {
    const sel = document.getElementById('sel-asamblea');
    if (sel) { sel.value = primeraActiva.id; listenAsamblea(primeraActiva.id); }
  }

  // Botón pantalla completa
  document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  });

  // Recargar asambleas periódicamente (por si se crean nuevas)
  setInterval(loadAsambleas, 60000);
});
