/**
 * asambleas.js
 * CRUD de asambleas + generación de QR
 */

import { db } from './firebase-config.js';
import { requireAuth, setupLogout, setupSidebar } from './auth.js';
import { generateQR, downloadQR } from './qr.js';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// ── URL base del proyecto para QR (detectado dinámicamente) ──
const getBaseUrl = () => {
  const origin = window.location.origin;
  let pathname = window.location.pathname;
  if (pathname.includes('/')) {
    pathname = pathname.substring(0, pathname.lastIndexOf('/')) + '/registro.html?id=';
  } else {
    pathname = '/registro.html?id=';
  }
  return origin + pathname;
};

// ── Colección ──
const colAsambleas = collection(db, 'asambleas');

// ── Estado local ──
let asambleas = [];
let editingId  = null;

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

// ── Helpers UI ──
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spinner-sm"></span> Guardando...'
    : btn.dataset.label || 'Guardar';
}

// ── Formatear fecha para mostrar ──
function formatFecha(fechaStr) {
  if (!fechaStr) return '-';
  const [y, m, d] = fechaStr.split('-');
  return `${d}/${m}/${y}`;
}

// ── Escuchar asambleas en tiempo real ──
function listenAsambleas() {
  const q = query(colAsambleas, orderBy('createdAt', 'desc'));
  onSnapshot(q, (snap) => {
    asambleas = [];
    snap.forEach(doc => asambleas.push({ id: doc.id, ...doc.data() }));
    renderTable();
    updateCounter();
  }, (err) => {
    showToast('Error al cargar asambleas', 'error');
    console.error(err);
  });
}

// ── Renderizar tabla ──
function renderTable() {
  const tbody = document.getElementById('tbody-asambleas');
  if (!tbody) return;
  if (asambleas.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="6">No hay asambleas. ¡Crea la primera!</td>
      </tr>`;
    return;
  }
  tbody.innerHTML = asambleas.map((a, i) => {
    const badge = a.estado === 'activa'
      ? '<span class="badge badge-success">Activa</span>'
      : '<span class="badge badge-danger">Inactiva</span>';
    return `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${escapeHTML(a.nombre)}</strong></td>
        <td>${formatFecha(a.fecha)}</td>
        <td>${badge}</td>
        <td>
          <div class="action-btns">
            <button class="btn btn-outline btn-sm" title="Ver QR"
              onclick="openQRModal('${a.id}', '${escapeAttr(a.nombre)}')">
              📱 QR
            </button>
            <button class="btn btn-outline btn-sm" title="Editar"
              onclick="editAsamblea('${a.id}')">✏️</button>
            <button class="btn btn-${a.estado === 'activa' ? 'warning' : 'success'} btn-sm" title="Cambiar estado"
              onclick="toggleEstado('${a.id}', '${a.estado}')">
              ${a.estado === 'activa' ? '⏸️' : '▶️'}
            </button>
            <button class="btn btn-danger btn-sm" title="Eliminar"
              onclick="confirmDelete('${a.id}', '${escapeAttr(a.nombre)}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ── Actualizar contador header ──
function updateCounter() {
  const el = document.getElementById('count-asambleas');
  if (el) el.textContent = asambleas.length;
}

// ── Abrir modal QR ──
window.openQRModal = function(id, nombre) {
  const url = getBaseUrl() + id;
  document.getElementById('qr-modal-title').textContent = `QR: ${nombre}`;
  document.getElementById('qr-link').value = url;
  // Limpiar QR anterior y generar nuevo
  openModal('modal-qr');
  // Esperar un tick para que el modal esté visible antes de generar QR
  setTimeout(() => generateQR('qr-display', url, 220), 50);
};

// ── Descargar QR ──
window.downloadQRBtn = function() {
  const title = document.getElementById('qr-modal-title').textContent.replace('QR: ', '');
  downloadQR('qr-display', `QR_${title.replace(/\s+/g,'_')}.png`);
  showToast('QR descargado', 'success');
};

// ── Copiar enlace ──
window.copyLink = function() {
  const link = document.getElementById('qr-link').value;
  navigator.clipboard.writeText(link).then(() => {
    showToast('Enlace copiado al portapapeles', 'success');
  }).catch(() => {
    document.getElementById('qr-link').select();
    document.execCommand('copy');
    showToast('Enlace copiado', 'success');
  });
};

// ── Abrir modal edición ──
window.editAsamblea = function(id) {
  const a = asambleas.find(x => x.id === id);
  if (!a) return;
  editingId = id;
  document.getElementById('form-modal-title').textContent = 'Editar Asamblea';
  document.getElementById('input-nombre').value = a.nombre || '';
  document.getElementById('input-fecha').value  = a.fecha  || '';
  document.getElementById('input-estado').value = a.estado || 'activa';
  clearErrors();
  openModal('modal-form');
};

// ── Toggle estado ──
window.toggleEstado = async function(id, estadoActual) {
  const nuevoEstado = estadoActual === 'activa' ? 'inactiva' : 'activa';
  try {
    await updateDoc(doc(db, 'asambleas', id), { estado: nuevoEstado });
    showToast(`Asamblea ${nuevoEstado === 'activa' ? 'activada' : 'desactivada'}`, 'success');
  } catch (e) {
    showToast('Error al cambiar estado', 'error');
    console.error(e);
  }
};

// ── Confirmar eliminación ──
window.confirmDelete = function(id, nombre) {
  document.getElementById('delete-nombre').textContent = nombre;
  document.getElementById('btn-confirm-delete').onclick = () => deleteAsamblea(id);
  openModal('modal-confirm');
};

async function deleteAsamblea(id) {
  const btn = document.getElementById('btn-confirm-delete');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span> Eliminando...';
  }
  try {
    // 1. Buscar y eliminar todas las asistencias de esta asamblea
    const colAsistencias = collection(db, 'asistencias');
    const q = query(colAsistencias, where('asambleaId', '==', id));
    const snap = await getDocs(q);

    if (!snap.empty) {
      // Usar batch para eliminar en lote (máx 500 por batch)
      const batches = [];
      let batch = writeBatch(db);
      let count = 0;
      snap.forEach(docSnap => {
        batch.delete(docSnap.ref);
        count++;
        if (count === 490) {
          batches.push(batch.commit());
          batch = writeBatch(db);
          count = 0;
        }
      });
      if (count > 0) batches.push(batch.commit());
      await Promise.all(batches);
    }

    // 2. Eliminar la asamblea
    await deleteDoc(doc(db, 'asambleas', id));

    const total = snap.size;
    showToast(
      total > 0
        ? `Asamblea eliminada junto con ${total} registro${total > 1 ? 's' : ''} de asistencia`
        : 'Asamblea eliminada',
      'success'
    );
    closeModal('modal-confirm');
  } catch (e) {
    showToast('Error al eliminar: ' + e.message, 'error');
    console.error(e);
  }
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = 'Sí, eliminar';
  }
}

// ── Validar formulario ──
function validateForm() {
  let valid = true;
  const nombre = document.getElementById('input-nombre').value.trim();
  const fecha  = document.getElementById('input-fecha').value.trim();

  clearErrors();
  if (!nombre) { showError('error-nombre', 'El nombre es obligatorio'); valid = false; }
  if (!fecha)  { showError('error-fecha',  'La fecha es obligatoria');  valid = false; }
  return valid;
}
function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.add('show'); }
  const input = el?.previousElementSibling;
  if (input) input.classList.add('is-invalid');
}
function clearErrors() {
  document.querySelectorAll('.form-error').forEach(el => {
    el.classList.remove('show');
    el.previousElementSibling?.classList.remove('is-invalid');
  });
}

// ── Guardar asamblea (crear o editar) ──
async function saveAsamblea() {
  if (!validateForm()) return;
  const btn = document.getElementById('btn-save-asamblea');
  setLoading(btn, true);
  const nombre = document.getElementById('input-nombre').value.trim();
  const fecha  = document.getElementById('input-fecha').value.trim();
  const estado = document.getElementById('input-estado').value;

  try {
    if (editingId) {
      await updateDoc(doc(db, 'asambleas', editingId), { nombre, fecha, estado });
      showToast('Asamblea actualizada', 'success');
    } else {
      await addDoc(colAsambleas, { nombre, fecha, estado, createdAt: serverTimestamp() });
      showToast('Asamblea creada', 'success');
    }
    closeModal('modal-form');
    editingId = null;
    document.getElementById('form-asamblea').reset();
  } catch (e) {
    showToast('Error al guardar: ' + e.message, 'error');
    console.error(e);
  }
  setLoading(btn, false);
}

// ── Helpers escape HTML ──
function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(str) {
  return String(str).replace(/'/g, "\\'");
}

// ── Punto de entrada ──
requireAuth(() => {
  setupLogout();
  setupSidebar();
  listenAsambleas();

  // Botón nueva asamblea
  document.getElementById('btn-nueva-asamblea')?.addEventListener('click', () => {
    editingId = null;
    document.getElementById('form-modal-title').textContent = 'Nueva Asamblea';
    document.getElementById('form-asamblea').reset();
    clearErrors();
    openModal('modal-form');
  });

  // Guardar asamblea
  document.getElementById('btn-save-asamblea')?.addEventListener('click', saveAsamblea);
  document.getElementById('btn-save-asamblea').dataset.label = 'Guardar';

  // Cerrar modales
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.closeModal;
      closeModal(target);
      if (target === 'modal-form') { editingId = null; }
    });
  });

  // Cerrar modal al hacer click en backdrop
  document.querySelectorAll('.modal-backdrop').forEach(bd => {
    bd.addEventListener('click', (e) => {
      if (e.target === bd) {
        bd.classList.remove('open');
        editingId = null;
      }
    });
  });
});
