/**
 * qr.js
 * Generación de códigos QR usando QRCode.js
 */

/**
 * generateQR(containerId, url, size)
 * Genera un QR en el contenedor indicado
 * @param {string} containerId - ID del elemento DOM destino
 * @param {string} url - URL a codificar
 * @param {number} size - Tamaño en píxeles (default 200)
 */
export function generateQR(containerId, url, size = 200) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = ''; // Limpiar QR anterior
  // QRCode.js está cargado globalmente desde CDN
  new QRCode(container, {
    text: url,
    width: size,
    height: size,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });
}

/**
 * downloadQR(containerId, filename)
 * Descarga el QR generado como PNG
 * @param {string} containerId - ID del contenedor del QR
 * @param {string} filename - Nombre del archivo PNG a descargar
 */
export function downloadQR(containerId, filename = 'qr-asamblea.png') {
  const container = document.getElementById(containerId);
  if (!container) return;

  // QRCode.js puede generar canvas o img
  const canvas = container.querySelector('canvas');
  const img    = container.querySelector('img');

  if (canvas) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } else if (img) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = img.src;
    link.click();
  }
}

/**
 * getQRDataURL(containerId)
 * Retorna el data URL del QR generado (para embed)
 * @param {string} containerId
 * @returns {string|null}
 */
export function getQRDataURL(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  const canvas = container.querySelector('canvas');
  if (canvas) return canvas.toDataURL('image/png');
  const img = container.querySelector('img');
  if (img) return img.src;
  return null;
}
