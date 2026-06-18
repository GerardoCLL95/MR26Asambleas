/**
 * registro.js
 * Formulario público de registro de asistencia via QR
 * Valida asamblea, previene DNI duplicado, guarda en Firestore
 */

import { db } from './firebase-config.js';
import {
  collection,
  doc,
  getDoc,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// ── Referencia a elementos del DOM ──
const pageLoader         = document.getElementById('page-loader');
const errorStateEl       = document.getElementById('error-state');
const formStateEl        = document.getElementById('form-state');
const formInnerEl        = document.getElementById('registro-form-inner');
const successStateEl     = document.getElementById('success-state');
const asambleaBadgeEl    = document.getElementById('asamblea-badge');

// ── Ocultar loader ──
function hideLoader() {
  if (pageLoader) {
    pageLoader.classList.add('hidden');
    setTimeout(() => { if (pageLoader) pageLoader.style.display = 'none'; }, 300);
  }
}

// ── Mostrar pantalla de error ──
function showErrorScreen(title, subtitle) {
  hideLoader();
  const titleEl = document.getElementById('error-title');
  const subEl   = document.getElementById('error-sub');
  if (titleEl) titleEl.textContent = title;
  if (subEl)   subEl.textContent   = subtitle;
  if (errorStateEl) errorStateEl.style.display = 'block';
  if (asambleaBadgeEl) asambleaBadgeEl.style.display = 'none';
}

// ── Mostrar pantalla de éxito ──
function showSuccessScreen(nombres) {
  if (formInnerEl) formInnerEl.style.display = 'none';
  const nameEl = document.getElementById('success-name');
  if (nameEl) nameEl.textContent = nombres;
  if (successStateEl) {
    successStateEl.style.display = 'block';
    successStateEl.classList.add('show');
  }
}

// ── Validar / limpiar errores de campo ──
function setFieldError(inputId, errorId, msg) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);
  if (msg) {
    input?.classList.add('is-invalid');
    if (error) { error.textContent = msg; error.classList.add('show'); }
  } else {
    input?.classList.remove('is-invalid');
    if (error) error.classList.remove('show');
  }
}
function clearAllErrors() {
  document.querySelectorAll('.form-control').forEach(el => el.classList.remove('is-invalid'));
  document.querySelectorAll('.form-error').forEach(el => el.classList.remove('show'));
  const genErr = document.getElementById('form-general-error');
  if (genErr) genErr.style.display = 'none';
}

// ── Validar formulario ──
function validateForm(data) {
  let valid = true;
  clearAllErrors();
  if (!data.nombres || data.nombres.length < 3) {
    setFieldError('input-nombres','error-nombres','Nombre completo obligatorio (mínimo 3 caracteres)');
    valid = false;
  }
  if (!data.dni) {
    setFieldError('input-dni','error-dni','El DNI es obligatorio');
    valid = false;
  } else if (!/^\d{8}$/.test(data.dni)) {
    setFieldError('input-dni','error-dni','El DNI debe tener exactamente 8 dígitos numéricos');
    valid = false;
  }
  if (!data.celular) {
    setFieldError('input-celular','error-celular','El celular es obligatorio');
    valid = false;
  } else if (!/^\d{9,}$/.test(data.celular)) {
    setFieldError('input-celular','error-celular','El celular debe tener mínimo 9 dígitos numéricos');
    valid = false;
  }
  if (!data.baseDireccion || data.baseDireccion.length < 2) {
    setFieldError('input-base','error-base','La Base / Dirección es obligatoria');
    valid = false;
  }
  return valid;
}

// ── Verificar DNI duplicado en la asamblea ──
async function isDuplicado(asambleaId, dni) {
  const q = query(
    collection(db, 'asistencias'),
    where('asambleaId', '==', asambleaId),
    where('dni', '==', dni)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

// ── Estado del botón de envío ──
function setLoading(loading) {
  const btn = document.getElementById('btn-registrar');
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spinner-sm"></span> Registrando...'
    : '✅ Registrar asistencia';
}

// ── Principal ──
async function initRegistro() {
  const params = new URLSearchParams(window.location.search);
  const asambleaId = params.get('id');

  if (!asambleaId) {
    showErrorScreen('Asamblea no encontrada', 'No se proporcionó un ID de asamblea. Escanea el código QR correcto.');
    return;
  }

  try {
    const asambleaSnap = await getDoc(doc(db, 'asambleas', asambleaId));

    if (!asambleaSnap.exists()) {
      showErrorScreen('Asamblea no encontrada', 'La asamblea que buscas no existe o fue eliminada.');
      return;
    }

    const asamblea = { id: asambleaSnap.id, ...asambleaSnap.data() };

    if (asamblea.estado !== 'activa') {
      showErrorScreen(
        'Asamblea no disponible',
        `La asamblea "${asamblea.nombre}" no está recibiendo registros en este momento.`
      );
      return;
    }

    // Mostrar nombre de la asamblea en el badge
    document.querySelectorAll('.asamblea-name').forEach(el => { el.textContent = asamblea.nombre; });
    const fechaEl = document.getElementById('asamblea-fecha');
    if (fechaEl && asamblea.fecha) {
      const [y, m, d] = asamblea.fecha.split('-');
      fechaEl.textContent = `📅 ${d}/${m}/${y}`;
    }
    document.title = `Registro — ${asamblea.nombre}`;

    hideLoader();
    if (formStateEl) formStateEl.style.display = 'block';
    if (asambleaBadgeEl) asambleaBadgeEl.style.display = 'block';

    // Solo dígitos en DNI y Celular
    document.getElementById('input-dni')?.addEventListener('input', e => {
      e.target.value = e.target.value.replace(/\D/g, '');
    });
    document.getElementById('input-celular')?.addEventListener('input', e => {
      e.target.value = e.target.value.replace(/\D/g, '');
    });

    // Envío del formulario
    document.getElementById('form-registro')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        nombres:       document.getElementById('input-nombres').value.trim(),
        dni:           document.getElementById('input-dni').value.trim(),
        celular:       document.getElementById('input-celular').value.trim(),
        baseDireccion: document.getElementById('input-base').value.trim(),
        observacion:   document.getElementById('input-obs').value.trim()
      };

      if (!validateForm(data)) return;

      setLoading(true);
      try {
        const dup = await isDuplicado(asambleaId, data.dni);
        if (dup) {
          setFieldError('input-dni','error-dni','Este DNI ya se encuentra registrado en esta asamblea.');
          setLoading(false);
          return;
        }

        await addDoc(collection(db, 'asistencias'), {
          asambleaId,
          nombres:       data.nombres,
          dni:           data.dni,
          celular:       data.celular,
          baseDireccion: data.baseDireccion,
          observacion:   data.observacion,
          fechaRegistro: serverTimestamp()
        });

        showSuccessScreen(data.nombres);
      } catch (err) {
        console.error(err);
        const genErr = document.getElementById('form-general-error');
        if (genErr) {
          genErr.textContent = 'Error al registrar. Por favor intenta nuevamente.';
          genErr.style.display = 'block';
        }
      } finally {
        setLoading(false);
      }
    });

  } catch (err) {
    console.error(err);
    showErrorScreen('Error de conexión', 'No se pudo conectar. Verifica tu internet e intenta nuevamente.');
  }
}

// ── Botón "registrar otro" ──
document.getElementById('btn-otro')?.addEventListener('click', () => {
  if (successStateEl) {
    successStateEl.style.display = 'none';
    successStateEl.classList.remove('show');
  }
  if (formInnerEl) formInnerEl.style.display = 'block';
  document.getElementById('form-registro')?.reset();
  clearAllErrors();
});

// ── Inicializar ──
initRegistro();
