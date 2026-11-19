# Muro de fotos · Terminal Puerto Rosario

Sitio para el evento: el público sube fotos, el administrador las aprueba y el presentador las proyecta a pantalla completa en un muro que se renueva solo. Identidad visual según el Manual de Marca Digital TPR.

## Estructura

```
public/                  Sitio estático (lo que ve el navegador)
  index.html             Página pública: subir foto
  admin.html             /admin → moderación (aprobar / rechazar / eliminar)
  presentador.html       /presentador → presentación a pantalla completa
  css/estilos.css        Paleta, tipografía Montserrat y componentes de marca
  js/                    Lógica del front (subida, moderación, muro)
  assets/                Logos oficiales (color y blanco)
netlify/functions/       API serverless
  subir.js               POST  /api/subir            (público)
  login.js               POST  /api/login            (admin / presentador)
  imagen.js              GET   /api/imagen?id=       (aprobadas: público)
  admin-fotos.js         GET   /api/admin-fotos      (admin)
  admin-accion.js        POST  /api/admin-accion     (admin: moderar / eliminar)
  fotos-aprobadas.js     GET   /api/fotos-aprobadas  (presentador)
netlify/lib/util.js      Sesiones firmadas, verificación de contraseñas, Blobs
netlify.toml             Configuración de Netlify
```

Las fotos se guardan en **Netlify Blobs** (almacenamiento incluido en Netlify, sin base de datos externa).

## Puesta en marcha

### 1. Subir el proyecto a Netlify

Recomendado: **subir la carpeta a un repositorio de GitHub** y en Netlify elegir *Add new site → Import an existing project*. Así Netlify instala las dependencias (`@netlify/blobs`) y compila las funciones.

Alternativa por terminal (requiere Node 18 o superior):

```bash
npm install
npx netlify-cli login
npx netlify-cli deploy --build --prod
```

> No conviene arrastrar la carpeta al panel de "Netlify Drop": no instala las dependencias de las funciones.

### 2. Configurar las variables de entorno (obligatorio)

En Netlify: **Site configuration → Environment variables → Add a variable**:

| Variable | Qué es |
|---|---|
| `ADMIN_PASSWORD` | Contraseña del rol administrador |
| `PRESENTER_PASSWORD` | Contraseña del rol presentador |
| `SESSION_SECRET` | Texto aleatorio de 32+ caracteres para firmar las sesiones (podés generarlo con `openssl rand -hex 32`) |

Las contraseñas **no están en el código**: viven solo en Netlify. Después de cargarlas, volvé a hacer un deploy para que tengan efecto.

### 3. Usar el sitio

- **Público:** la URL principal (`/`). Cualquiera puede subir una foto.
- **Administrador:** `/admin`. Pestañas Pendientes / Aprobadas / Rechazadas. Solo las fotos **aprobadas** llegan al presentador.
- **Presentador:** `/presentador`. Botón *Iniciar presentación en pantalla completa*. Esc o "Salir" cierran la presentación.

## Comportamiento de la presentación

- Si hay hasta 48 fotos aprobadas, **todas aparecen a la vez** en un muro que se reordena cada pocos segundos.
- Si hay más, las fotos rotan: entra una nueva y sale una visible, así todas terminan apareciendo.
- Las fotos aprobadas nuevas se suman solas (el presentador consulta cada 20 segundos).
- El **logo TPR** (versión blanca, según el manual) aparece y desaparece periódicamente sobre el muro.
- La pantalla se mantiene encendida mientras dura la presentación, en navegadores que lo soportan.

## Seguridad y privacidad

- Contraseñas solo en variables de entorno, comparadas en tiempo constante.
- Sesiones firmadas (HMAC) que vencen a las 12 horas.
- Las fotos **pendientes o rechazadas no son públicas**: solo las ve el administrador o el presentador con sesión.
- Las fotos aprobadas sí pueden verse con su enlace; no se listan en ninguna página pública.
- Las fotos se pueden eliminar desde el panel de administración. Al terminar el evento, conviene borrar todas las fotos desde el panel de Netlify (Blobs, store `fotos-evento`).
- Límites: 5 MB por foto; el navegador la reduce a 1600 px antes de subirla.

## Ajustes útiles

- Cantidad máxima de fotos simultáneas: `MAX_TILES` en `public/js/presentador.js`.
- Velocidad de rotación: `ROTACION_MS`. Frecuencia del logo: `LOGO_CICLO_MS` y `LOGO_VISIBLE_MS`.
- Colores y tipografías: variables al inicio de `public/css/estilos.css`.

## Desarrollo local

```bash
npm install
npx netlify-cli dev
```

Crear un archivo `.env` local (no se sube al repositorio) con `ADMIN_PASSWORD`, `PRESENTER_PASSWORD` y `SESSION_SECRET`.
