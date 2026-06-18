/**
 * export.js
 * Exportación de asistentes a Excel XLSX usando SheetJS
 */

/**
 * exportToXLSX(data, asambleaNombre, asambleaFecha)
 * Genera y descarga un archivo Excel con la lista de asistentes
 * @param {Array} data - Array de objetos asistencia
 * @param {string} asambleaNombre - Nombre de la asamblea (para el filename)
 * @param {string} asambleaFecha  - Fecha de la asamblea (para el filename)
 */
export function exportToXLSX(data, asambleaNombre = 'Asamblea', asambleaFecha = '') {
  if (!data || data.length === 0) {
    showToastExport('No hay datos para exportar', 'warning');
    return;
  }

  // XLSX está cargado globalmente desde CDN
  if (typeof XLSX === 'undefined') {
    showToastExport('Error: librería XLSX no disponible', 'error');
    return;
  }

  // Preparar filas
  const rows = data.map((a, i) => ({
    'N°':              i + 1,
    'Nombres y Apellidos': a.nombres || '',
    'DNI':             a.dni || '',
    'Celular':         a.celular || '',
    'Base/Dirección':  a.baseDireccion || '',
    'Observación':     a.observacion || '',
    'Fecha':           a.fechaRegistro
      ? formatDate(a.fechaRegistro.toDate ? a.fechaRegistro.toDate() : new Date(a.fechaRegistro))
      : '',
    'Hora':            a.fechaRegistro
      ? formatTime(a.fechaRegistro.toDate ? a.fechaRegistro.toDate() : new Date(a.fechaRegistro))
      : ''
  }));

  // Crear workbook y worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Ajustar anchos de columna
  const colWidths = [
    { wch: 5 },   // N°
    { wch: 35 },  // Nombres
    { wch: 12 },  // DNI
    { wch: 14 },  // Celular
    { wch: 30 },  // Base/Dirección
    { wch: 30 },  // Observación
    { wch: 14 },  // Fecha
    { wch: 10 }   // Hora
  ];
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Asistentes');

  // Nombre del archivo sanitizado
  const nombre = sanitizeFilename(asambleaNombre);
  const fecha  = sanitizeFilename(asambleaFecha);
  const filename = `Asamblea_${nombre}${fecha ? '_' + fecha : ''}.xlsx`;

  XLSX.writeFile(wb, filename);
}

// ── Helpers ──
function formatDate(date) {
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatTime(date) {
  return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}
function sanitizeFilename(str) {
  return str.replace(/[^a-zA-Z0-9\-_.ÁÉÍÓÚáéíóúÑñ ]/g, '').trim().replace(/ /g, '_');
}
function showToastExport(msg, type) {
  const container = document.getElementById('toast-container');
  if (!container) { alert(msg); return; }
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-msg">${msg}</span>
    <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>
  `;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); }, 4000);
}
