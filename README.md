# Biblioteca Audiovisual Comercial Inmobiliaria

Sistema web que centraliza el material audiovisual y comercial de los proyectos inmobiliarios
(brochures, renders, planos, videos, fichas, listas de precios…) para que el equipo de ventas
trabaje siempre con la versión vigente.

- **Una sola fuente de información:** cada material es un único registro. Al reemplazar un archivo
  se conserva el registro, sube la versión y se retira el archivo anterior.
- **Tiempo real:** lo que cambia el administrador aparece al instante en la pantalla de todos, con un
  aviso y una etiqueta de “Nuevo” o “Actualizado”.
- **Dos niveles de acceso:** administrador (gestiona todo) y usuario comercial (ve, descarga y
  comparte). El equipo puede entrar con una cuenta compartida o con cuentas individuales.

---

## 1. Arquitectura

```
Navegador (Next.js + React)
   │  sesión, datos, archivos y canal en tiempo real
   ▼
Supabase
   ├─ Auth       correo + contraseña
   ├─ Postgres   proyectos, tipologías, materiales, historial  (permisos con RLS)
   ├─ Realtime   avisa de cada cambio a todas las pantallas abiertas
   └─ Storage    bucket privado "materiales" con los archivos pesados

Servidor de Next.js (solo donde hace falta la clave secreta)
   ├─ /api/admin/users   crear, editar y eliminar usuarios
   └─ /r/<token>         enlace público para compartir un material con un cliente
```

| Capa | Tecnología |
|---|---|
| Interfaz | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Base de datos, autenticación, tiempo real y archivos | Supabase |
| Despliegue sugerido | Vercel (aplicación) + Supabase (datos) |

La base de datos **no guarda archivos**, solo su ruta dentro del almacenamiento.

### Modelo de datos

| Tabla | Contenido |
|---|---|
| `profiles` | Una fila por cuenta: nombre, rol (`admin` / `comercial`), si es cuenta compartida, si está activa |
| `projects` | Nombre, descripción, ubicación, estado, información comercial, portada |
| `typologies` | Tipos de departamento de un proyecto: área, dormitorios, baños, descripción |
| `resources` | Cada material: categoría, nombre, ruta del archivo (o enlace externo), formato, tamaño, versión, token para compartir y, opcionalmente, su tipología |
| `activity_log` | Historial: qué se agregó, modificó, reemplazó o eliminó, cuándo y quién |

El historial lo escriben **triggers de la base de datos**, no la aplicación, así que no se puede omitir
ni falsear desde el navegador.

### Estructura del almacenamiento

```
materiales/                                  (bucket privado)
└── {id-proyecto}/
    ├── portada-{fecha}.webp                 portada del proyecto
    └── {id-material}/
        ├── {fecha}-{nombre-original}        archivo vigente
        └── thumb-{fecha}.webp               miniatura (solo imágenes)
```

Los archivos se sirven con enlaces firmados temporales. Las miniaturas y portadas se generan en el
navegador al subir, para que las galerías carguen rápido.

### Reglas de seguridad

Definidas en `supabase/migrations/0001_init.sql`:

- **Leer** proyectos, tipologías, materiales y archivos: solo usuarios con sesión y cuenta activa.
- **Crear, modificar y eliminar:** solo administradores (se valida en la base de datos y en el
  almacenamiento, no únicamente en la interfaz).
- **Historial y lista de usuarios:** solo administradores.
- **Registros no autorizados:** una cuenta que no fue creada por un administrador queda inactiva y no
  puede ver nada.
- **Clave secreta (`service_role`):** vive solo en el servidor.

---

## 2. Puesta en marcha

### Paso 1 · Crear el proyecto en Supabase

1. Crea una cuenta en <https://supabase.com> y un proyecto nuevo.
2. Abre **SQL Editor**, ejecuta en orden los archivos de `supabase/migrations` y pulsa **Run** en
   cada uno. Esto crea tablas, permisos, el bucket de archivos y activa el tiempo real.
3. En **Authentication → Sign In / Providers**, desactiva **Allow new users to sign up**. Los usuarios
   se crean desde la propia aplicación.

### Paso 2 · Crear el primer administrador

En **Authentication → Users → Add user → Create new user**, escribe tu correo y una contraseña y deja
marcado **Auto Confirm User**.

> El **primer** usuario del sistema queda automáticamente como administrador. Los demás se crean desde
> la pantalla **Usuarios** de la aplicación.

### Paso 3 · Configurar las claves

Copia `.env.example` como `.env.local` y complétalo con los valores de
**Project Settings → API Keys** (y la URL de **Project Settings → Data API**):

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto, p. ej. `https://abcd1234.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (`anon` o `publishable`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta (`service_role` o `secret`). **No la compartas ni la subas al repositorio.** |
| `NEXT_PUBLIC_APP_NAME` | Opcional. Nombre que se muestra en la aplicación |

Sin `SUPABASE_SERVICE_ROLE_KEY` la biblioteca funciona, pero no la pantalla **Usuarios** ni los
enlaces públicos para compartir.

### Paso 4 · Ejecutar

```bash
npm install
```

```bash
npm run dev
```

Abre <http://localhost:3000> e ingresa con el administrador del paso 2.

### Paso 5 · Dar acceso al equipo de ventas

En **Usuarios → Nuevo usuario**:

- **Cuenta compartida (recomendada para empezar):** crea un usuario comercial, por ejemplo
  `ventas@tuinmobiliaria.com`, y marca **Cuenta compartida por el equipo**. Entrega ese correo y
  contraseña a todos los asesores.
- **Cuentas individuales:** crea un usuario comercial por asesor cuando lo necesites. Ambas
  modalidades pueden convivir.

Las cuentas comerciales nunca pueden modificar nada, así que toda modificación queda registrada a
nombre del administrador que la hizo.

---

## 3. Despliegue (Vercel)

1. Crea el proyecto remoto de Supabase y ejecuta, en orden, todas las migraciones de
   `supabase/migrations`. Crea el primer administrador en **Authentication → Users** después de
   aplicar las migraciones.
2. Sube el repositorio a GitHub e impórtalo en <https://vercel.com>. Si `package.json` está dentro
   de una carpeta del repositorio, selecciona esa carpeta como **Root Directory**.
3. En **Project Settings → Environment Variables**, configura para los entornos que usarás
   (Production y, si corresponde, Preview):

   | Variable | Requerida | Nota |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL HTTPS del proyecto remoto de Supabase; no uses localhost. |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | Clave pública (`anon` o `publishable`). |
   | `SUPABASE_SERVICE_ROLE_KEY` | Sí para todas las funciones | Clave secreta (`service_role` o `secret`); nunca uses el prefijo `NEXT_PUBLIC_`. |
   | `NEXT_PUBLIC_APP_NAME` | No | Nombre que se muestra en la aplicación. |

   Las variables `NEXT_PUBLIC_*` quedan incorporadas al bundle durante el build; vuelve a desplegar
   después de cambiarlas. El build valida que las tres claves requeridas estén configuradas y que
   la URL sea HTTPS y remota, sin mostrar los valores.
4. Deja los valores predeterminados de Vercel para Next.js y usa `npm run build` como comando de
   build. Este comando ejecuta ESLint antes de compilar. No hace falta crear un `vercel.json`.
5. Después del primer despliegue, en Supabase **Authentication → URL Configuration**, configura
   **Site URL** con el dominio de producción y agrega los dominios de producción/preview de Vercel
   a **Redirect URLs**.

Funciona igual en cualquier servidor con Node.js 20 o superior:

```bash
npm run build
```

```bash
npm start
```

---

## 4. Uso

| Pantalla | Qué hace |
|---|---|
| **Panel** | Totales, accesos rápidos a proyectos y últimos archivos actualizados |
| **Proyectos** | Tarjetas con portada y estado. El administrador crea, edita y elimina |
| **Proyecto → Biblioteca** | Material por categoría, en galería o lista. Vista previa, descarga y enlace para compartir |
| **Proyecto → Tipologías** | Tipos de departamento con área, dormitorios, baños, plano, renders y archivos relacionados |
| **Proyecto → Información** | Información comercial y ficha del proyecto |
| **Buscar** | Búsqueda global (proyectos, tipologías y materiales) con filtros por proyecto, categoría y tipo de archivo. Atajo: `/` o `Ctrl + K` |
| **Historial** (admin) | Cada alta, modificación, reemplazo y eliminación con fecha y responsable |
| **Usuarios** (admin) | Cuentas, roles, cuenta compartida, cambio de contraseña y suspensión de acceso |

**Vista previa:** las imágenes se abren en galería a pantalla completa; los PDF y los videos se ven
dentro del sistema; los enlaces de YouTube, Vimeo y Matterport se reproducen incrustados. Otros
formatos (PowerPoint, Excel…) se descargan.

**Compartir:** cada material tiene un enlace público `/r/<token>` que el asesor puede enviar a un
cliente sin que este necesite cuenta. El enlace siempre abre la versión vigente y deja de funcionar si
el material se elimina.

**Reemplazar un archivo:** menú `⋯` del material → **Reemplazar archivo**. Se conservan el registro y
el enlace para compartir, la versión aumenta y el archivo anterior se borra del almacenamiento.

### Tiempo real

La aplicación mantiene un canal abierto con Supabase Realtime. El indicador **En vivo** de la barra
superior muestra su estado. Si la red bloquea ese canal, la aplicación consulta el servidor cada
30 segundos y al volver a la pestaña, de modo que nadie se queda con información antigua.

---

## 5. Límites a tener en cuenta

- **Tamaño por archivo:** lo define Supabase en **Storage → Settings** (50 MB en el plan gratuito;
  ampliable en planes de pago). Para videos más pesados, súbelos a YouTube o Vimeo y regístralos como
  **Enlace externo**.
- **Espacio y transferencia:** el plan gratuito incluye 1 GB de almacenamiento. Para una biblioteca
  con muchos renders y videos conviene el plan Pro.
- **Vista previa de PDF en celulares:** muchos navegadores móviles no muestran PDF incrustados; en
  ese caso el sistema ofrece el botón **Abrir PDF**.

---

## 6. Estructura del código

```
supabase/migrations/0001_init.sql   esquema, permisos (RLS), almacenamiento y tiempo real
src/proxy.ts                        renueva la sesión y protege las rutas privadas
src/app/login                       inicio de sesión
src/app/(app)                       pantallas privadas (panel, proyectos, buscar, historial, usuarios)
src/app/r/[token]                   enlace público para compartir
src/app/api/admin/users             gestión de usuarios (servidor)
src/components/data-provider.tsx    datos en memoria + sincronización en tiempo real + avisos
src/components/viewer.tsx           visor de imágenes, PDF, video y enlaces
src/lib/files.ts                    subida con progreso, miniaturas, enlaces firmados, descarga
src/lib/search.ts                   buscador
```

### Desarrollo con Supabase local (opcional)

Con Docker instalado puedes levantar un Supabase completo en tu equipo; las migraciones se aplican
solas:

```bash
npx supabase start
```

Usa la URL y las claves que imprime el comando en `.env.local`.

---

## 7. Posibles ampliaciones

El modelo está preparado para crecer sin convertirse en un CRM: disponibilidad de departamentos y
precios por tipología (nuevas tablas ligadas a `typologies`), o subidas reanudables para videos muy
pesados.
