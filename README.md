# MR26 Asambleas 🗳️

Sistema de registro de asistencia para asambleas mediante código QR.
**Campaña Mario Ruiz · #MarioRuiz26**

[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-002F6C?style=for-the-badge&logo=github)](https://gerardocll95.github.io/MR26Asambleas/)

---

## 🌐 URL del Sistema

| Página | URL |
|--------|-----|
| Login | https://gerardocll95.github.io/MR26Asambleas/login.html |
| Dashboard | https://gerardocll95.github.io/MR26Asambleas/dashboard.html |
| Asambleas | https://gerardocll95.github.io/MR26Asambleas/asambleas.html |
| Asistentes | https://gerardocll95.github.io/MR26Asambleas/asistencia.html |
| Monitor Live | https://gerardocll95.github.io/MR26Asambleas/monitor.html |
| Registro (público) | https://gerardocll95.github.io/MR26Asambleas/registro.html?id=ID_ASAMBLEA |

---

## ✨ Características

- **🔐 Autenticación** — Firebase Auth Email/Password para el panel admin
- **📋 Asambleas** — Crear, editar, activar/desactivar y eliminar asambleas
- **📱 Código QR** — Generación automática de QR por asamblea, descarga PNG y copia de enlace
- **✅ Registro público** — Formulario accesible desde QR, sin login requerido
- **🔄 Tiempo real** — Firestore `onSnapshot()` para actualización instantánea
- **👁️ Monitor Live** — Pantalla para supervisores con feed en vivo y pantalla completa
- **📥 Exportar XLSX** — Descarga lista de asistentes en Excel con SheetJS
- **🔍 Búsqueda** — Por nombre, DNI y filtro por asamblea
- **📵 Anti-duplicado** — No permite registrar el mismo DNI dos veces por asamblea

---

## 🏗️ Tecnologías

| Tecnología | Uso |
|-----------|-----|
| HTML5 + CSS3 | Estructura y estilos |
| JavaScript Vanilla | Lógica de la aplicación |
| Firebase Firestore | Base de datos en tiempo real |
| Firebase Authentication | Login administrador |
| QRCode.js | Generación de códigos QR |
| SheetJS XLSX | Exportación a Excel |
| GitHub Pages | Hosting estático gratuito |

---

## 📁 Estructura de Archivos

```
MR26Asambleas/
├── index.html          → Redirect a login
├── login.html          → Autenticación admin
├── dashboard.html      → Panel principal con estadísticas
├── asambleas.html      → Gestión de asambleas + QR
├── asistencia.html     → Tabla de asistentes + exportar
├── registro.html       → Formulario público (QR)
├── monitor.html        → Monitor en vivo para supervisores
├── css/
│   └── styles.css      → Sistema de diseño completo
├── js/
│   ├── firebase-config.js  → Configuración Firebase
│   ├── auth.js             → Login, logout, guard
│   ├── dashboard.js        → Stats y últimos registros
│   ├── asambleas.js        → CRUD asambleas + QR
│   ├── asistencia.js       → Tabla tiempo real + filtros
│   ├── registro.js         → Formulario registro público
│   ├── monitor.js          → Monitor live supervisor
│   ├── export.js           → Exportación XLSX
│   └── qr.js               → Generación códigos QR
└── images/
    ├── logo.jpg            → Logo Mario Ruiz
    └── mr.png              → Foto Mario Ruiz
```

---

## 🔥 Configuración Firebase

### Reglas de Firestore

Configurar en Firebase Console → Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Asambleas: cualquiera puede leer, solo admin puede escribir
    match /asambleas/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Asistencias: cualquiera puede crear, solo admin puede leer/editar/borrar
    match /asistencias/{id} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }
  }
}
```

### Crear usuario administrador

1. Ve a **Firebase Console → Authentication → Users**
2. Haz clic en **"Add user"**
3. Ingresa email y contraseña del administrador

---

## 🚀 Despliegue en GitHub Pages

1. Subir todos los archivos al repositorio `MR26Asambleas`
2. Ve a **Settings → Pages**
3. Source: **Deploy from a branch**
4. Branch: **main** / **/ (root)**
5. Guardar → esperar ~2 minutos

> ⚠️ GitHub Pages sirve archivos estáticos. No se necesita servidor backend.

---

## 📊 Modelo de Datos

### Colección `asambleas`
```json
{
  "nombre": "Asamblea Distrital Lima Norte",
  "fecha": "2026-06-20",
  "estado": "activa",
  "createdAt": "Timestamp"
}
```

### Colección `asistencias`
```json
{
  "asambleaId": "id_de_la_asamblea",
  "nombres": "Juan Pérez García",
  "dni": "12345678",
  "celular": "987654321",
  "baseDireccion": "Base Los Olivos",
  "observacion": "",
  "fechaRegistro": "Timestamp"
}
```

---

## 🎨 Paleta de Colores

| Color | HEX | Uso |
|-------|-----|-----|
| Azul Oscuro | `#002F6C` | Color primario, sidebar, títulos |
| Rojo | `#E30613` | Acento, botones CTA, badges |
| Blanco | `#FFFFFF` | Fondo principal |
| Gris claro | `#F0F4F8` | Fondo de página |

---

## 📱 Uso del Sistema

### Para el Administrador
1. Ingresar en `login.html` con email/contraseña
2. Crear asambleas en `asambleas.html`
3. Generar y compartir el QR de cada asamblea
4. Ver asistentes en `asistencia.html` o `monitor.html`
5. Exportar a Excel con el botón **"Exportar XLSX"**

### Para el Asistente (ciudadano)
1. Escanear el código QR con el celular
2. Llenar el formulario (nombres, DNI, celular, base)
3. Enviar → confirmación instantánea

---

*Desarrollado para la Campaña Mario Ruiz · MR26 · #MarioRuiz26*
