/**
 * firebase-config.js
 * Configuración e inicialización de Firebase para MR26 Asambleas
 * Exporta las instancias de Firestore y Authentication listas para usar
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

// Configuración del proyecto Firebase mr26asambleas
const firebaseConfig = {
  apiKey: "AIzaSyDae4Z1DjBuiaxdC1eUUX5yi90IM0N1CcI",
  authDomain: "mr26asambleas.firebaseapp.com",
  projectId: "mr26asambleas",
  storageBucket: "mr26asambleas.firebasestorage.app",
  messagingSenderId: "476620759970",
  appId: "1:476620759970:web:e51bafd5b4d235750048fb",
  measurementId: "G-LVMQ473VDL"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar instancias de servicios
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
