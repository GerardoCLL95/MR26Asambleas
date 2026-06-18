/**
 * asistencia.js
 * Flujo en 2 pasos:
 *   1. Mostrar grid de asambleas para seleccionar
 *   2. Mostrar asistentes de esa asamblea en tiempo real
 */

import { db } from './firebase-config.js';
import { requireAuth, setupLogout, setupSidebar } from './auth.js';
import { exportToXLSX } from './export.js';
import {
  collection,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// ── Colecciones ──
const colAsistencias = collection(db, 'asistencias');
const colAsambleas   = collection(db, 'asambleas');

// ── Estado local ──
let allAsambleas      = [];
let asistenciasActual = [];   // solo de la asamblea seleccionada
let asambleaActual    = null; // objeto asamblea seleccionada
let unsubscribe       = null; // para cancelar onSnapshot anterior
let searchNombre      = '';
let searchDNI         = '';

// ── Toast ──
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

// ── Formatear fecha/hora ──
function formatDateTime(ts) {
  if (!ts) return { fecha: '—', hora: '—' };
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return {
    fecha: d.toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric' }),
    hora:  d.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' })
  };
}

function formatFecha(fechaStr) {
  if (!fechaStr) return '';
  const [y, m, d] = fechaStr.split('-');
  return `${d}/${m}/${y}`;
}

function escapeHTML(str) {
  return String(str || '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ══════════════════════════════════════════
// PASO 1: Cargar y mostrar grid de asambleas
// ══════════════════════════════════════════
async function loadAsambleas() {
  try {
    const snap = await getDocs(query(colAsambleas, orderBy('createdAt', 'desc')));
    allAsambleas = [];
    snap.forEach(doc => allAsambleas.push({ id: doc.id, ...doc.data() }));

    document.getElementById('asambleas-loading').style.display = 'none';

    if (allAsambleas.length === 0) {
      document.getElementById('asambleas-empty').style.display = 'block';
      return;
    }

    renderAsambleasGrid();
  } catch (err) {
    showToast('Error al cargar asambleas', 'error');
    console.error(err);
  }
}

function renderAsambleasGrid() {
  const grid = document.getElementById('asambleas-grid');
  if (!grid) return;
  grid.style.display = 'grid';

  grid.innerHTML = allAsambleas.map(a => {
    const estadoBadge = a.estado === 'activa'
      ? '<span class="badge badge-success">Activa</span>'
      : '<span class="badge badge-danger">Inactiva</span>';
    return `
      <div class="asamblea-select-card" data-id="${a.id}" onclick="selectAsamblea('${a.id}')">
        <div class="asamblea-card-icon">📋</div>
        <div class="asamblea-card-info">
          <div class="asamblea-card-nombre">${escapeHTML(a.nombre)}</div>
          <div class="asamblea-card-fecha">📅 ${formatFecha(a.fecha)}</div>
          <div style="margin-top:8px;">${estadoBadge}</div>
        </div>
        <div class="asamblea-card-arrow">›</div>
      </div>
    `;
  }).join('');
}

// ══════════════════════════════════════════
// PASO 2: Seleccionar asamblea y escuchar
// ══════════════════════════════════════════
window.selectAsamblea = function(id) {
  const asamblea = allAsambleas.find(a => a.id === id);
  if (!asamblea) return;
  asambleaActual = asamblea;

  // Actualizar UI de encabezado
  const badge  = document.getElementById('asamblea-selected-badge');
  const fechaEl= document.getElementById('asamblea-selected-fecha');
  const title  = document.getElementById('asistentes-title');
  if (badge)   badge.textContent  = asamblea.nombre;
  if (fechaEl) fechaEl.textContent = `📅 ${formatFecha(asamblea.fecha)}`;
  if (title)   title.textContent  = `Asistentes · ${asamblea.nombre}`;

  // Mostrar paso 2, ocultar paso 1
  document.getElementById('step-seleccionar').style.display = 'none';
  document.getElementById('step-asistentes').style.display  = 'block';
  document.getElementById('btn-exportar').style.display     = 'flex';

  // Resetear búsquedas
  searchNombre = ''; searchDNI = '';
  const sn = document.getElementById('search-nombre');
  const sd = document.getElementById('search-dni');
  if (sn) sn.value = '';
  if (sd) sd.value = '';

  // Cancelar listener anterior
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }

  // Escuchar asistencias de esta asamblea
  listenAsistencias(id);
};

// ── Volver al paso 1 ──
function volverAGrid() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  asambleaActual = null;
  asistenciasActual = [];

  document.getElementById('step-asistentes').style.display  = 'none';
  document.getElementById('step-seleccionar').style.display = 'block';
  document.getElementById('btn-exportar').style.display     = 'none';
}

// ── Listener en tiempo real de asistencias ──
function listenAsistencias(asambleaId) {
  const q = query(
    colAsistencias,
    where('asambleaId', '==', asambleaId)
  );

  unsubscribe = onSnapshot(q, (snap) => {
    asistenciasActual = [];
    snap.forEach(doc => asistenciasActual.push({ id: doc.id, ...doc.data() }));
    
    // Ordenar en memoria para no requerir índice compuesto en Firestore
    asistenciasActual.sort((a, b) => {
      const tA = a.fechaRegistro?.seconds || (a.fechaRegistro?.toDate ? a.fechaRegistro.toDate().getTime() : 0) || 0;
      const tB = b.fechaRegistro?.seconds || (b.fechaRegistro?.toDate ? b.fechaRegistro.toDate().getTime() : 0) || 0;
      return tB - tA;
    });
    
    renderTabla();
  }, (err) => {
    showToast('Error al cargar asistentes', 'error');
    console.error(err);
  });
}

// ── Obtener datos filtrados ──
function getFiltered() {
  return asistenciasActual.filter(a => {
    if (searchNombre && !a.nombres?.toLowerCase().includes(searchNombre.toLowerCase())) return false;
    if (searchDNI    && !a.dni?.includes(searchDNI)) return false;
    return true;
  });
}

// ── Renderizar tabla ──
function renderTabla() {
  const tbody = document.getElementById('tbody-asistencia');
  if (!tbody) return;
  const data = getFiltered();

  // Contadores
  const totalEl    = document.getElementById('count-asistentes');
  const filtradoEl = document.getElementById('count-filtrado');
  if (totalEl)    totalEl.textContent    = asistenciasActual.length;
  if (filtradoEl) filtradoEl.textContent = data.length;

  if (data.length === 0) {
    const msg = asistenciasActual.length === 0
      ? 'No hay asistentes registrados en esta asamblea aún.'
      : 'No se encontraron resultados para la búsqueda.';
    tbody.innerHTML = `<tr class="empty-row"><td colspan="9">${msg}</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((a, i) => {
    const { fecha, hora } = formatDateTime(a.fechaRegistro);
    
    let presencialBtn = '';
    if (a.verificado === true) {
      // Estado: Presente
      presencialBtn = `
        <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
          <span class="badge badge-success" style="font-size:11px; font-weight:700;">✓ Presente</span>
          <button class="btn btn-outline btn-xs" style="padding:2px 6px; font-size:10px;" title="Volver a pendiente" onclick="toggleCheckIn('${a.id}', null)">Rectificar</button>
        </div>`;
    } else if (a.verificado === false) {
      // Estado: Ausente (No asistió)
      presencialBtn = `
        <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
          <span class="badge badge-danger" style="font-size:11px; font-weight:700;">✕ Ausente</span>
          <button class="btn btn-outline btn-xs" style="padding:2px 6px; font-size:10px;" title="Volver a pendiente" onclick="toggleCheckIn('${a.id}', null)">Rectificar</button>
        </div>`;
    } else {
      // Estado: Pendiente
      presencialBtn = `
        <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
          <button class="btn btn-success btn-xs" style="padding:4px 8px; font-size:11px; font-weight:700;" onclick="toggleCheckIn('${a.id}', true)">✓ Asistió</button>
          <button class="btn btn-danger btn-xs" style="padding:4px 8px; font-size:11px; font-weight:700;" onclick="toggleCheckIn('${a.id}', false)">✕ No asistió</button>
        </div>`;
    }

    return `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${escapeHTML(a.nombres)}</strong></td>
        <td>${escapeHTML(a.dni)}</td>
        <td>${escapeHTML(a.celular)}</td>
        <td>${escapeHTML(a.baseDireccion)}</td>
        <td class="text-muted">${escapeHTML(a.observacion) || '—'}</td>
        <td>${fecha}</td>
        <td>${hora}</td>
        <td>${presencialBtn}</td>
      </tr>
    `;
  }).join('');
}

// ── Confirmar check-in presencial ──
window.toggleCheckIn = async function(asistenciaId, nuevoEstado) {
  try {
    await updateDoc(doc(db, 'asistencias', asistenciaId), {
      verificado: nuevoEstado
    });
    
    let msg = 'Asistente puesto en Pendiente';
    if (nuevoEstado === true) msg = 'Asistencia física confirmada (Presente)';
    if (nuevoEstado === false) msg = 'Marcado como no asistió (Ausente)';
    
    showToast(msg, 'success');
  } catch (err) {
    showToast('Error al actualizar verificación', 'error');
    console.error(err);
  }
};

// ── Exportar XLSX de la asamblea actual ──
function exportar() {
  if (!asambleaActual) return;
  // Solo exportar los registros que han sido verificados físicamente (verificado === true)
  const data = getFiltered().filter(a => a.verificado === true);
  if (data.length === 0) {
    showToast('No hay asistentes confirmados (Presente) para exportar', 'warning');
    return;
  }
  exportToXLSX(data, asambleaActual.nombre, asambleaActual.fecha);
  showToast(`Exportando ${data.length} asistentes confirmados...`, 'info');
}

// ── Añadir estilos de las tarjetas de asamblea ──
function injectCardStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .asamblea-select-card {
      background: #fff;
      border: 1.5px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(0,47,108,0.06);
    }
    .asamblea-select-card:hover {
      border-color: var(--navy);
      box-shadow: 0 4px 20px rgba(0,47,108,0.15);
      transform: translateY(-2px);
    }
    .asamblea-select-card:active {
      transform: translateY(0);
    }
    .asamblea-card-icon {
      font-size: 32px;
      flex-shrink: 0;
      width: 52px; height: 52px;
      background: var(--navy-soft);
      border-radius: var(--radius);
      display: flex; align-items: center; justify-content: center;
    }
    .asamblea-card-info { flex: 1; }
    .asamblea-card-nombre {
      font-size: 15px; font-weight: 700;
      color: var(--navy);
      margin-bottom: 4px;
    }
    .asamblea-card-fecha {
      font-size: 12px;
      color: var(--text-muted);
    }
    .asamblea-card-arrow {
      font-size: 24px;
      color: var(--navy);
      font-weight: 700;
      flex-shrink: 0;
    }
    @keyframes pulse {
      0%, 100% { opacity:1; transform:scale(1); }
      50% { opacity:0.4; transform:scale(0.8); }
    }
  `;
  document.head.appendChild(style);
}

// ── Punto de entrada ──
requireAuth(async () => {
  setupLogout();
  setupSidebar();
  injectCardStyles();

  await loadAsambleas();

  // Búsqueda por nombre
  document.getElementById('search-nombre')?.addEventListener('input', e => {
    searchNombre = e.target.value.trim();
    renderTabla();
  });

  // Búsqueda por DNI
  document.getElementById('search-dni')?.addEventListener('input', e => {
    searchDNI = e.target.value.replace(/\D/g, '');
    renderTabla();
  });

  // Botón exportar
  document.getElementById('btn-exportar')?.addEventListener('click', exportar);

  // Botón volver
  document.getElementById('btn-volver')?.addEventListener('click', volverAGrid);
});
