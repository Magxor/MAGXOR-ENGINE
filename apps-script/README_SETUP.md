# Magxor Engine — Setup del backend (Apps Script)

El Sheet queda **privado** (Restringido). Solo este script lo lee.

## 1. Crear base
1. Crea un Google Sheet nuevo.
2. `Extensiones > Apps Script` → borra el contenido → pega `Code.gs`.
3. Ejecuta `setupMagxor()` (acepta permisos). Mira `Registros`: copia tu `READ_TOKEN`.
4. Ejecuta `crearAdmin("admin", "CLAVE_FUERTE")` para tu usuario inicial.
5. `Implementar > Nueva implementación > Aplicación web`:
   - Ejecutar como: **Yo**
   - Acceso: **Cualquiera**
   - Copia la URL `/exec`.

## 2. Conectar la tienda
- En la tienda (Admin → Conexión o `.env`):
  - `VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec`
  - `VITE_READ_TOKEN=<READ_TOKEN del paso 3>`
- Login admin: usuario/clave del paso 4. Nunca se expone `CREDENCIALES`.

## 3. Hojas auto-creadas
`INVENTARIO | RESEÑAS | CLIENTES | PEDIDOS | DATOS | CREDENCIALES`
- `CREDENCIALES`: `USUARIO | PASS_HASH | SALT | ACTIVO | ROL` (hash SHA256, nunca en claro).
- `DATOS`: config + color + logo/splash + SEO (ver encabezados en `Code.gs`).

## 4. Mantenimiento
- Rotar lectura: ejecuta `rotarReadToken()` y actualiza `VITE_READ_TOKEN`.
- Cambiar clave: `cambiarClave("admin", "NUEVA")` desde el editor (o Admin → Cambiar credenciales, que actualiza usuario + clave juntos).
- Admin pass (sección sensible): `setAdminPass("admin", "NUEVA")`. Nunca pegues la clave en claro en el Sheet.
- Tiendas existentes: tras actualizar `Code.gs`, ejecuta `migrarSeguridad()` una vez (agrega columnas sin borrar datos).
- Colores: se gestionan desde el panel Admin (Preset de Color + HEX primario/secundario) → columnas `COLOR_PRESET`, `COLOR_PRIMARIO`, `COLOR_SECUNDARIO`. La columna legacy `PALETA DE COLORES` solo se lee por compatibilidad con tiendas viejas. `MODO_OSCURO` fue eliminado (el dark mode es un toggle local del visitante).

## 5. Control maestro de cuenta (DATOS)
- `ESTADO_CUENTA`: `SI` (normal) | `ATRASO` (tienda visible + aviso de pago, admin entra con alerta) | `NO` (tienda y login suspendidos).
- Con `NO` y `SUSPENSION_IMAGE_URL` y/o `SUSPENSION_MENSAJE` cargados: pantalla de suspensión completa con ese contenido.
- Con `NO` y ambas celdas vacías: la tienda se sigue viendo como vidriera pero queda **muda**: sin botones de WhatsApp, sin contacto/horarios, sin reseñas, sin newsletter y sin envío de carritos (los intentos de checkout se registran como carritos perdidos). El endpoint igualmente rechaza pedidos/reseñas (clientes de newsletter sí se aceptan).
- **Carritos perdidos**: todo intento de pedido bloqueado por estado `NO`/`ATRASO` queda en `AUDIT_LOG` como `carrito_perdido` con cliente, teléfono, productos, total y entrega. El checkout bloqueado en el navegador se registra con la acción pública `logLostCart` (no crea pedidos).
- Acciones endpoint: `health, getConfig, getProducts, getReviews, addOrder, addReview, addClient` (+ admin con `session`: `sessionPing, listOrders, listClients, updateOrderStatus, updateOrderDetail, deleteOrder, updateClientContact, deleteClient, add/update/delete Product, updateConfig, changeCredentials, verifyAdminPass, listUsers, createUser, deleteUser, updateUser` — gestión de usuarios requiere además `adminPass`).
