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
- Cambiar clave: `cambiarClave("admin", "NUEVA")` o desde Admin → Cambiar contraseña.
- Admin pass (sección sensible): `setAdminPass("admin", "NUEVA")`. Nunca pegues la clave en claro en el Sheet.
- Tiendas existentes: tras actualizar `Code.gs`, ejecuta `migrarSeguridad()` una vez (agrega columnas sin borrar datos).

## 5. Control maestro de cuenta (DATOS)
- `ESTADO_CUENTA`: `SI` (normal) | `ATRASO` (tienda visible + aviso de pago, admin entra con alerta) | `NO` (tienda y login suspendidos, se muestra `SUSPENSION_IMAGE_URL` + `SUSPENSION_MENSAJE`).
- Con `NO`, el endpoint también rechaza pedidos/reseñas/clientes nuevos.
- Acciones endpoint: `health, getConfig, getProducts, getReviews, addOrder, addReview, addClient` (+ admin con `session`: `listOrders, listClients, updateOrderStatus, deleteOrder, updateClientContact, deleteClient, add/update/delete Product, updateConfig, changePassword`).
