# MeynaPOS - Presentacion Tecnica del Proyecto

Documento preparado para una exposicion tecnica de 30 a 45 minutos.

Proyecto: **MeynaPOS**
Slogan: **"Tecnologia para crecer juntos"**
Tipo de sistema: **POS web e inventario para pequenos y medianos negocios**
Version de referencia: **v1.0.0-beta**
Repositorio: **ARWAWINGUMU/MeynaPos**

---

## 1. Descripcion General del Sistema

MeynaPOS es un sistema web de punto de venta e inventario construido para negocios pequenos y medianos. El sistema permite administrar ventas, productos, inventario, clientes, usuarios, compras, reportes, configuracion del negocio, moneda, descuentos, imagenes persistentes y lectura de codigos de barras o codigos QR mediante lectores USB tipo teclado.

La aplicacion esta dividida en dos proyectos principales:

- **frontend/**: aplicacion React + TypeScript creada con Vite.
- **backend/**: API REST construida con FastAPI, SQLAlchemy y PostgreSQL.

El flujo principal del sistema es:

1. El usuario inicia sesion desde el frontend.
2. El backend valida credenciales, estado de bloqueo, CAPTCHA y rol.
3. El backend devuelve un JWT.
4. El frontend guarda la sesion en `localStorage`.
5. Las peticiones posteriores usan el token mediante un interceptor de Axios.
6. El backend valida permisos por rol antes de ejecutar operaciones sensibles.
7. Los modulos consumen endpoints REST para mostrar y modificar datos reales de PostgreSQL.

El sistema implementa funcionalidades clave:

- Autenticacion JWT.
- Roles Administrador y Cajero.
- Bloqueo automatico por intentos fallidos.
- Gestion de usuarios.
- Gestion de productos.
- Gestion de categorias.
- Gestion de inventario.
- Ventas con carrito, descuentos, impuestos y pagos.
- Clientes e historial de compras.
- Reimpresion y descarga de facturas.
- Reportes comerciales.
- Configuracion del negocio y moneda.
- Imagenes persistentes de productos y logo.
- Lectura de codigos de barras y QR por dispositivos HID USB.
- Docker Compose para despliegue local.
- CI con GitHub Actions.

No es un prototipo solamente visual: el proyecto tiene backend real, base de datos relacional, migraciones, servicios, repositorios, pruebas, seguridad basica, contenedores y comunicacion completa frontend-backend.

---

## 2. Tecnologias Utilizadas y Justificacion

### Frontend

**React 18**

React se utiliza para construir una interfaz modular basada en componentes reutilizables. En MeynaPOS cada modulo de pantalla se encuentra separado en paginas y componentes. Esto permite mantener el layout general, reutilizar tablas, modales y formularios, y escalar nuevas secciones sin reescribir la interfaz.

Archivos reales relacionados:

- `frontend/src/App.tsx`
- `frontend/src/routes/AppRoutes.tsx`
- `frontend/src/layouts/AppLayout.tsx`
- `frontend/src/pages/POSPage.tsx`
- `frontend/src/pages/ProductsPage.tsx`
- `frontend/src/pages/InventoryPage.tsx`
- `frontend/src/pages/CustomersPage.tsx`
- `frontend/src/pages/UsersPage.tsx`

**TypeScript**

TypeScript agrega tipado estatico. En el proyecto se usa para definir contratos de autenticacion, ventas, productos, clientes, configuracion, reportes y respuestas del backend.

Archivos reales:

- `frontend/src/types/auth.ts`
- `frontend/src/types/product.ts`
- `frontend/src/types/customer.ts`
- `frontend/src/types/sale.ts`
- `frontend/src/types/settings.ts`
- `frontend/src/types/user.ts`

**Vite**

Vite es el empaquetador de frontend. Permite desarrollo rapido y build optimizado para produccion. El archivo principal es:

- `frontend/vite.config.ts`

**TailwindCSS**

TailwindCSS se usa para estilos utilitarios. El proyecto mantiene una identidad visual verde, azul suave, blanco y tonos modernos tipo fintech/POS.

Archivos:

- `frontend/tailwind.config.js`
- `frontend/src/index.css`

**Axios**

Axios se usa como cliente HTTP. El proyecto centraliza la comunicacion con el backend en una instancia reutilizable que agrega automaticamente el JWT.

Archivo principal:

- `frontend/src/services/api.ts`

**React Router DOM**

React Router maneja navegacion y rutas privadas. El usuario autenticado entra al dashboard general, y las secciones internas cambian dentro del layout principal sin abrir nuevas pestanas.

Archivos:

- `frontend/src/routes/AppRoutes.tsx`
- `frontend/src/routes/PrivateRoute.tsx`
- `frontend/src/routes/RoleGuard.tsx`

**Lucide React**

Lucide se usa para iconos de interfaz: sidebar, acciones, botones, tarjetas e indicadores visuales.

**Recharts**

Recharts se usa en reportes y dashboard para graficas visuales.

**jsPDF**

jsPDF se usa para descargar facturas en PDF desde el frontend.

Archivo relacionado:

- `frontend/src/utils/receipt.ts`

### Backend

**Python 3.12**

Python se eligio por su productividad, claridad y ecosistema robusto para APIs, pruebas y manejo de datos.

**FastAPI**

FastAPI es el framework principal del backend. Permite construir endpoints REST con validacion automatica mediante Pydantic, inyeccion de dependencias, documentacion OpenAPI y buen rendimiento.

Archivos reales:

- `backend/main.py`
- `backend/app/api/router.py`
- `backend/app/api/routes/auth.py`
- `backend/app/api/routes/products.py`
- `backend/app/api/routes/sales.py`
- `backend/app/api/routes/users.py`

**SQLAlchemy**

SQLAlchemy es el ORM usado para mapear modelos Python a tablas PostgreSQL. Se usa con sesiones por request, repositorios y relaciones declarativas.

Archivos:

- `backend/app/models/*.py`
- `backend/app/repositories/*.py`
- `backend/app/database/session.py`

**PostgreSQL**

PostgreSQL es la base de datos relacional. Es adecuada para ventas, inventario, pagos, usuarios y reportes porque soporta relaciones, restricciones, transacciones y tipos numericos precisos.

**Pydantic**

Pydantic define DTOs de entrada y salida. En MeynaPOS valida datos como productos, ventas, descuentos, usuarios, clientes y configuracion.

Archivos:

- `backend/app/schemas/product.py`
- `backend/app/schemas/sale.py`
- `backend/app/schemas/user.py`
- `backend/app/schemas/customer.py`
- `backend/app/schemas/setting.py`

**Alembic**

Alembic controla migraciones de base de datos.

Archivos:

- `backend/alembic/env.py`
- `backend/alembic/versions/0001_initial_schema.py`
- `backend/alembic/versions/0002_sales_disc.py`
- `backend/alembic/versions/0003_products_qr_code.py`
- `backend/alembic/versions/0004_category_status.py`

**JWT**

JWT se usa para autenticacion stateless. El backend emite tokens firmados y el frontend los envia en el header `Authorization`.

Archivo:

- `backend/app/core/security.py`

**Pytest**

Pytest se usa para pruebas unitarias e integracion de backend.

Carpeta:

- `backend/app/tests/`

### DevOps

**Docker**

Docker empaqueta backend, frontend y base de datos en contenedores reproducibles.

Archivos:

- `backend/Dockerfile`
- `frontend/Dockerfile`
- `docker-compose.yml`

**GitHub Actions**

El pipeline de CI ejecuta pruebas y builds en cada push o pull request a `main` o `develop`.

Archivo:

- `.github/workflows/ci.yml`

---

## 3. Configuracion y Estructura del Frontend

El frontend se encuentra en `frontend/` y sigue una organizacion modular:

```text
frontend/
  src/
    assets/
    components/
    context/
    hooks/
    layouts/
    pages/
    routes/
    services/
    types/
    utils/
    App.tsx
    main.tsx
    index.css
  Dockerfile
  nginx.conf
  package.json
  vite.config.ts
```

### Configuracion principal

**`frontend/package.json`**

Define scripts y dependencias. Los scripts principales son:

- `npm run dev`: servidor local de desarrollo.
- `npm run build`: compilacion TypeScript y build de Vite.
- `npm run preview`: vista previa del build.

**`frontend/vite.config.ts`**

Configura Vite para React.

**`frontend/nginx.conf`**

Permite servir la SPA en produccion y redirigir rutas internas a `index.html`. Esto evita errores al refrescar rutas como `/dashboard` o `/ventas`.

### Componentes

Los componentes reutilizables viven en:

```text
frontend/src/components/
```

Componentes reales:

- `AuthErrorMessage.tsx`: muestra errores de autenticacion sin usar `alert()`.
- `BarcodeScannerInput.tsx`: componente/hook visual para lectura de codigos.
- `MetricTile.tsx`: tarjeta reutilizable para metricas.
- `ProductTable.tsx`: tabla de productos.
- `ReusableForm.tsx`: base para formularios.
- `ReusableModal.tsx`: modal reutilizable.
- `ReusableTable.tsx`: tabla reutilizable.
- `TurnstileWidget.tsx`: integracion visual con Cloudflare Turnstile.

### Paginas

Las paginas principales estan en:

```text
frontend/src/pages/
```

Paginas reales:

- `LoginPage.tsx`
- `DashboardPage.tsx`
- `POSPage.tsx`
- `ProductsPage.tsx`
- `InventoryPage.tsx`
- `PurchasesPage.tsx`
- `CustomersPage.tsx`
- `ReportsPage.tsx`
- `SettingsPage.tsx`
- `UsersPage.tsx`
- `UnderConstructionPage.tsx`

### Layout

El layout principal esta en:

- `frontend/src/layouts/AppLayout.tsx`

Este layout contiene:

- Sidebar.
- Header.
- Logo MeynaPOS.
- Nombre del usuario.
- Rol.
- Boton de cerrar sesion.
- Navegacion interna.
- Contenedor central para las paginas.

La decision arquitectonica importante es que las paginas no abren pestanas nuevas ni reemplazan la aplicacion completa: cambian dentro del layout usando React Router.

### Rutas

Archivos:

- `frontend/src/routes/AppRoutes.tsx`
- `frontend/src/routes/PrivateRoute.tsx`
- `frontend/src/routes/RoleGuard.tsx`

`PrivateRoute` protege rutas que requieren sesion.

`RoleGuard` restringe modulos de administrador, por ejemplo usuarios, configuracion o administracion de productos segun permisos.

Flujo real:

```text
/login
  -> LoginPage

/
  -> PrivateRoute
  -> AppLayout
  -> dashboard, ventas, productos, inventario, compras, clientes, usuarios, reportes, configuracion
```

Despues del login exitoso, el usuario es redirigido al dashboard general, no a un modulo secundario.

### Servicios

Los servicios estan en:

```text
frontend/src/services/
```

El archivo central es:

- `api.ts`

Responsabilidades:

- Definir `baseURL`.
- Agregar JWT en cada request.
- Capturar respuestas `401`.
- Limpiar sesion si el token expiro.
- Disparar evento global `meynapos:unauthorized`.

Servicios por modulo:

- `authService.ts`
- `productService.ts`
- `salesService.ts`
- `customerService.ts`
- `categoryService.ts`
- `settingsService.ts`
- `userService.ts`
- `dashboardService.ts`
- `purchaseService.ts`
- `reportService.ts`

### Hooks

Hooks reales:

- `useBarcodeScanner.ts`
- `useBusinessSettings.ts`

`useBarcodeScanner` captura caracteres rapidos enviados por lectores USB tipo teclado, detecta `Enter` como final del escaneo y evita interferir con escritura manual.

`useBusinessSettings` carga configuracion del negocio, incluida moneda, impuestos y logo.

### Estado global

El estado global principal esta en:

- `frontend/src/context/AuthContext.tsx`

Responsabilidades:

- Cargar sesion desde `localStorage`.
- Guardar token, nombre y rol.
- Verificar expiracion del JWT.
- Cerrar sesion automaticamente si el token ya no es valido.
- Exponer `login`, `logout`, `isAuthenticated`, `user` y `role`.

### Estilos

Archivos:

- `frontend/src/index.css`
- `frontend/tailwind.config.js`

El proyecto usa TailwindCSS para mantener consistencia visual y evitar CSS duplicado.

### Comunicacion con API

El frontend no accede directamente a la base de datos. Siempre consume la API REST:

```text
React Page
  -> Service TypeScript
  -> Axios Instance
  -> FastAPI endpoint
  -> Service backend
  -> Repository
  -> PostgreSQL
```

---

## 4. Configuracion y Estructura del Backend

El backend se encuentra en `backend/`.

```text
backend/
  app/
    api/
      routes/
      router.py
    core/
    database/
    dependencies/
    middleware/
    models/
    repositories/
    schemas/
    services/
    tests/
    utils/
  alembic/
    versions/
  Dockerfile
  docker-entrypoint.sh
  requirements.txt
  alembic.ini
  main.py
```

### Punto de entrada

Archivo:

- `backend/main.py`

Responsabilidades:

- Crear instancia FastAPI.
- Configurar ciclo de vida.
- Crear tablas y preparar datos iniciales en arranque.
- Configurar CORS.
- Registrar middleware de logging.
- Incluir rutas bajo `/api`.
- Exponer `/health`.
- Servir archivos estaticos desde `/media`.

### Configuracion

Archivo:

- `backend/app/core/config.py`

Responsabilidades:

- Leer variables de entorno.
- Definir `DATABASE_URL`.
- Definir `SECRET_KEY`.
- Definir expiracion del token.
- Definir CORS.
- Definir configuracion de media:
  - `MEDIA_ROOT`
  - `MEDIA_URL_PREFIX`
  - `MAX_UPLOAD_SIZE_BYTES`

### Routers y controllers

FastAPI usa routers como capa de entrada HTTP. En el proyecto funcionan como controladores:

```text
backend/app/api/routes/
  auth.py
  categories.py
  customers.py
  dashboard.py
  inventory.py
  products.py
  purchases.py
  reports.py
  sales.py
  settings.py
  users.py
```

Ejemplo de responsabilidad:

- Validar request con Pydantic.
- Obtener dependencias como `Session` o usuario autenticado.
- Validar rol si aplica.
- Llamar al servicio correspondiente.
- Devolver DTO de respuesta.

### Services

Los servicios contienen reglas de negocio:

```text
backend/app/services/
```

Servicios reales:

- `AuthService`
- `CategoryService`
- `CustomerService`
- `DashboardService`
- `FileStorageService`
- `ProductService`
- `PurchaseService`
- `ReportService`
- `SaleService`
- `SettingService`
- `UserService`

Ejemplo: `SaleService` no confia en el frontend para calcular descuentos. Recalcula subtotal, impuesto, descuento y total final en backend usando `Decimal`.

### Repositories

Los repositorios encapsulan SQLAlchemy:

```text
backend/app/repositories/
```

Repositorios reales:

- `BusinessSettingRepository`
- `CategoryRepository`
- `ProductRepository`
- `ReportRepository`
- `SaleRepository`
- `UserRepository`

Su funcion es aislar las consultas de base de datos del resto de la aplicacion.

### Models

Los modelos SQLAlchemy representan tablas:

```text
backend/app/models/
```

Modelos reales:

- `BusinessSetting`
- `Category`
- `Customer`
- `Inventory`
- `Payment`
- `Product`
- `Purchase`
- `PurchaseDetail`
- `Role`
- `Sale`
- `SaleDetail`
- `Session`
- `Supplier`
- `SystemSetting`
- `User`

### Schemas

Los schemas Pydantic son DTOs:

```text
backend/app/schemas/
```

Schemas reales:

- `auth.py`
- `category.py`
- `customer.py`
- `dashboard.py`
- `product.py`
- `purchase.py`
- `report.py`
- `sale.py`
- `setting.py`
- `user.py`

Estos separan el modelo interno de la representacion HTTP.

### Database

Archivos:

- `backend/app/database/session.py`
- `backend/app/database/base.py`
- `backend/app/database/seed.py`
- `backend/app/database/prepare_database.py`
- `backend/app/database/runtime_schema.py`

`session.py` contiene el `DatabaseManager`, implementado como Singleton.

`prepare_database.py` se ejecuta en el entrypoint Docker. Se encarga de esperar PostgreSQL, aplicar migraciones, crear tablas si corresponde y sembrar datos iniciales.

### Middleware

Archivo:

- `backend/app/middleware/logging.py`

El middleware registra requests HTTP, util para trazabilidad y diagnostico.

### Flujo de request en backend

```text
HTTP Request
  -> FastAPI Router
  -> Dependencies
  -> Pydantic Schema Validation
  -> Service
  -> Repository
  -> SQLAlchemy Session
  -> PostgreSQL
  -> Repository result
  -> Service business response
  -> Pydantic response
  -> HTTP Response
```

---

## 5. Base de Datos Relacional

La base de datos usa PostgreSQL y SQLAlchemy. Las migraciones viven en Alembic.

### Tablas principales

| Tabla | Modelo | Clave primaria | Descripcion |
|---|---|---:|---|
| `roles` | `Role` | `id` | Roles del sistema: ADMIN y CASHIER |
| `users` | `User` | `id` | Usuarios autenticables |
| `sessions` | `Session` | `id` | Modelo para sesiones/JTI |
| `categories` | `Category` | `id` | Categorias de productos |
| `products` | `Product` | `id` | Catalogo de productos |
| `inventory` | `Inventory` | `id` | Stock por producto |
| `customers` | `Customer` | `id` | Clientes |
| `suppliers` | `Supplier` | `id` | Proveedores |
| `sales` | `Sale` | `id` | Cabecera de venta |
| `sale_details` | `SaleDetail` | `id` | Detalle de productos vendidos |
| `payments` | `Payment` | `id` | Pago asociado a venta |
| `purchases` | `Purchase` | `id` | Compras o ingresos de mercancia |
| `purchase_details` | `PurchaseDetail` | `id` | Detalle de compras |
| `business_settings` | `BusinessSetting` | `id` | Configuracion del negocio |
| `system_settings` | `SystemSetting` | `id` | Configuracion legacy/clave valor |

### Relaciones importantes

**Usuario y rol**

```text
roles.id 1 ---- N users.role_id
```

Un usuario pertenece a un rol. El rol define permisos de acceso.

**Producto y categoria**

```text
categories.id 1 ---- N products.category_id
```

Una categoria puede tener muchos productos. Una categoria asociada a productos no debe eliminarse fisicamente; se desactiva o se impide la operacion.

**Producto e inventario**

```text
products.id 1 ---- 1 inventory.product_id
```

Cada producto tiene un registro de inventario.

**Venta y detalle**

```text
sales.id 1 ---- N sale_details.sale_id
products.id 1 ---- N sale_details.product_id
```

Una venta contiene multiples lineas. Cada linea apunta a un producto.

**Venta y pago**

```text
sales.id 1 ---- 1 payments.sale_id
```

Cada venta tiene un pago asociado.

**Venta, cliente y cajero**

```text
customers.id 1 ---- N sales.customer_id
users.id     1 ---- N sales.cashier_id
```

Esto permite construir historial por cliente y reportes por cajero.

**Compra y detalle**

```text
purchases.id 1 ---- N purchase_details.purchase_id
products.id  1 ---- N purchase_details.product_id
```

El modulo de compras incrementa inventario.

### Restricciones relevantes

El proyecto valida unicidad en base de datos y/o servicios para:

- `users.username`
- `users.email`
- `categories.name`
- `products.barcode`
- `products.qr_code`
- `products.sku`
- `customers.document_number`
- `sales.invoice_number`

### Uso de Numeric y Decimal

Para dinero, el backend evita `float` y usa `Decimal`/`Numeric`. Esto es importante porque los valores monetarios no deben sufrir errores de precision binaria.

Campos relevantes:

- `Product.price`
- `Product.cost`
- `Sale.subtotal`
- `Sale.tax_amount`
- `Sale.discount_value`
- `Sale.discount_amount`
- `Sale.total`
- `Payment.amount`
- `Purchase.total`

### Migraciones Alembic

Migraciones reales:

- `0001_initial_schema.py`: esquema inicial.
- `0002_sales_disc.py`: descuentos en ventas y moneda.
- `0003_products_qr_code.py`: codigo QR en productos.
- `0004_category_status.py`: estado activo/inactivo en categorias.

---

## 6. Arbol Real del Proyecto

Resumen de estructura real:

```text
POS/
  .github/
    workflows/
      ci.yml
  backend/
    alembic/
      versions/
        0001_initial_schema.py
        0002_sales_disc.py
        0003_products_qr_code.py
        0004_category_status.py
    app/
      api/
        routes/
      core/
      database/
      dependencies/
      middleware/
      models/
      repositories/
      schemas/
      services/
      tests/
      utils/
    Dockerfile
    docker-entrypoint.sh
    main.py
    requirements.txt
  frontend/
    src/
      assets/
      components/
      context/
      hooks/
      layouts/
      pages/
      routes/
      services/
      types/
      utils/
    Dockerfile
    nginx.conf
    package.json
    vite.config.ts
  docs/
    TECHNICAL_DOCUMENTATION.md
    TECHNICAL_PRESENTATION.md
  docker-compose.yml
  README.md
  .env.example
  .gitignore
```

### Explicacion por carpeta

**`.github/workflows/`**

Contiene CI. `ci.yml` instala dependencias, ejecuta pruebas backend, construye backend Docker, instala frontend, ejecuta build y construye frontend Docker.

**`backend/app/api/routes/`**

Define endpoints HTTP. Cada archivo representa un modulo funcional.

**`backend/app/core/`**

Contiene configuracion, logging y seguridad.

**`backend/app/database/`**

Gestiona conexion, sesiones, seed inicial, preparacion de base de datos y ajustes de esquema.

**`backend/app/dependencies/`**

Define dependencias de FastAPI, especialmente usuario autenticado y validacion de roles.

**`backend/app/models/`**

Define modelos SQLAlchemy.

**`backend/app/repositories/`**

Encapsula consultas a base de datos.

**`backend/app/schemas/`**

Define DTOs Pydantic.

**`backend/app/services/`**

Implementa reglas de negocio.

**`backend/app/tests/`**

Contiene pruebas de autenticacion, productos, ventas, categorias, clientes y media uploads.

**`frontend/src/components/`**

Componentes reutilizables.

**`frontend/src/context/`**

Estado global de autenticacion.

**`frontend/src/hooks/`**

Hooks reutilizables, como lectura de escaner y configuracion del negocio.

**`frontend/src/layouts/`**

Layout principal compartido.

**`frontend/src/pages/`**

Pantallas del sistema.

**`frontend/src/routes/`**

Rutas privadas y proteccion por rol.

**`frontend/src/services/`**

Servicios HTTP por modulo.

**`frontend/src/utils/`**

Utilidades transversales como formato monetario, JWT, media URLs y recibos.

---

## 7. APIs y Comunicacion Frontend-Backend

La API sigue estilo REST y expone recursos bajo `/api`.

### Autenticacion

**POST `/api/auth/login`**

Request:

```json
{
  "username": "admin",
  "password": "password",
  "captcha_token": "token"
}
```

Response:

```json
{
  "access_token": "jwt",
  "token_type": "bearer",
  "full_name": "Admin User",
  "role": "ADMIN"
}
```

Validaciones:

- Usuario requerido.
- Contrasena requerida.
- CAPTCHA cuando esta configurado.
- Usuario activo.
- Usuario no bloqueado.
- Password correcto.

### Productos

Endpoints reales:

- `GET /api/products`
- `GET /api/products/barcode/{barcode}`
- `POST /api/products`
- `PUT /api/products/{product_id}`
- `DELETE /api/products/{product_id}`
- `POST /api/products/{product_id}/image`

Uso:

- Listar y buscar productos.
- Crear productos.
- Actualizar productos.
- Desactivar productos.
- Buscar por codigo de barras o QR.
- Cargar imagen persistente.

### Categorias

Endpoints:

- `GET /api/categories`
- `POST /api/categories`
- `PUT /api/categories/{category_id}`
- `PATCH /api/categories/{category_id}/activate`
- `PATCH /api/categories/{category_id}/deactivate`

Reglas:

- Nombre unico.
- Solo administrador crea o modifica.
- Cajero puede consultar.

### Ventas

Endpoints:

- `POST /api/sales`
- `GET /api/sales`

Request conceptual:

```json
{
  "customer_id": 1,
  "items": [
    {
      "product_id": 10,
      "quantity": 2
    }
  ],
  "payment": {
    "method": "CASH",
    "amount": "50000"
  },
  "tipo_descuento": "FIXED",
  "valor_descuento": "5000"
}
```

El backend calcula:

```text
subtotal = suma(lineas)
impuesto = subtotal * porcentaje_impuesto
monto_descuento = regla(descuento)
total_final = subtotal + impuesto - monto_descuento
```

El backend valida:

- Producto existe.
- Producto activo.
- Stock suficiente.
- Descuento valido.
- Pago en efectivo suficiente.
- Cliente valido.

### Clientes

Endpoints:

- `GET /api/customers`
- `GET /api/customers/summary`
- `GET /api/customers/default`
- `GET /api/customers/{customer_id}/history`
- `POST /api/customers`
- `PUT /api/customers/{customer_id}`

Permiten:

- Tabla de clientes.
- Historial de compras.
- Selector de cliente en ventas.
- Reimpresion de factura desde historial.

### Usuarios

Endpoints:

- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/{user_id}`
- `PATCH /api/users/{user_id}/activate`
- `PATCH /api/users/{user_id}/deactivate`
- `PATCH /api/users/{user_id}/unlock`
- `PATCH /api/users/{user_id}/reset-attempts`
- `PATCH /api/users/{user_id}/password`

Operaciones disponibles para administrador:

- Crear usuario.
- Editar usuario.
- Cambiar rol.
- Activar/desactivar.
- Desbloquear.
- Restablecer contrasena.

### Reportes

Endpoints:

- `GET /api/reports/daily-sales`
- `GET /api/reports/sales`
- `GET /api/reports/inventory`
- `GET /api/reports/top-products`
- `GET /api/reports/payment-methods`
- `GET /api/reports/monthly-revenue`

### Configuracion

Endpoints:

- `GET /api/settings`
- `PUT /api/settings`
- `POST /api/settings/logo`

Incluye:

- Nombre del negocio.
- Moneda.
- Impuesto.
- Logo persistente.
- Datos de contacto.

### Ejemplo de comunicacion completa

```text
LoginPage.tsx
  -> authService.login()
  -> api.post("/auth/login")
  -> backend/app/api/routes/auth.py
  -> AuthService.login()
  -> UserRepository
  -> PostgreSQL users/roles
```

### Validaciones

Frontend:

- Campos obligatorios.
- Formato visual.
- Estados de carga/error.
- Validacion de pago antes de enviar.

Backend:

- Pydantic.
- Reglas de negocio en services.
- Restricciones de base de datos.
- Permisos por rol.
- Manejo de excepciones HTTP.

---

## 8. Arquitectura del Sistema

MeynaPOS usa arquitectura cliente-servidor con separacion por capas. No es microservicios; es un monolito modular.

### Diagrama general

```text
+-----------------------------+
|        React Frontend       |
|  Pages, Components, Hooks   |
|  Context, Services, Routes  |
+-------------+---------------+
              |
              | HTTPS/HTTP JSON + JWT
              v
+-----------------------------+
|          FastAPI API        |
|  Routers / Controllers      |
|  Dependencies / Middleware  |
+-------------+---------------+
              |
              v
+-----------------------------+
|       Services Layer        |
|   Business Rules / Use Cases|
+-------------+---------------+
              |
              v
+-----------------------------+
|      Repositories Layer     |
|  SQLAlchemy Queries         |
+-------------+---------------+
              |
              v
+-----------------------------+
|        PostgreSQL DB        |
| Tables, Relations, Indexes  |
+-----------------------------+
```

### Capas

**Presentacion**

- React pages.
- Layout.
- Componentes.
- Formularios.
- Tablas.
- Modales.

**Aplicacion/API**

- FastAPI routers.
- Dependencias.
- Validacion Pydantic.
- Control de permisos.

**Dominio/Servicios**

- Reglas de negocio.
- Calculos.
- Validacion de descuentos.
- Bloqueo de usuarios.
- Stock.
- Facturacion.

**Persistencia**

- Repositories.
- SQLAlchemy.
- PostgreSQL.

### Por que monolito modular y no microservicios

Para este proyecto academico y el tamano funcional de MeynaPOS, microservicios agregarian complejidad innecesaria:

- Mas despliegues.
- Mas comunicacion entre servicios.
- Mas monitoreo.
- Mas coordinacion transaccional.
- Mayor dificultad para pruebas locales.

Un monolito modular permite:

- Separacion clara por modulos.
- Desarrollo rapido.
- Transacciones simples.
- Menor costo operativo.
- Facilidad para Docker Compose.

Si el sistema creciera, los modulos ya estan separados lo suficiente para extraer servicios en el futuro, por ejemplo reportes o facturacion.

### Separacion de responsabilidades

Ejemplo con ventas:

```text
POSPage.tsx
  solo maneja UI, carrito y eventos del usuario

salesService.ts
  solo llama HTTP

sales.py router
  recibe request, valida usuario, llama servicio

SaleService
  calcula totales, valida stock, descuenta inventario

SaleRepository
  persiste venta, detalle y pago

PostgreSQL
  almacena datos relacionales
```

---

## 9. Patrones de Diseno Implementados

### Repository Pattern

Ubicacion:

- `backend/app/repositories/`

Ejemplos:

- `ProductRepository`
- `UserRepository`
- `SaleRepository`
- `ReportRepository`

Objetivo:

- Separar consultas SQLAlchemy de reglas de negocio.
- Evitar que los routers consulten directamente la base de datos.
- Facilitar pruebas y mantenimiento.

Ejemplo conceptual:

```text
ProductService
  -> ProductRepository.get_by_barcode()
  -> SQLAlchemy select(Product)
```

### Service Layer

Ubicacion:

- `backend/app/services/`

Ejemplos:

- `AuthService`
- `SaleService`
- `ProductService`
- `CustomerService`
- `SettingService`

Objetivo:

- Centralizar reglas de negocio.
- Mantener routers delgados.
- Evitar duplicacion.

Ejemplo:

`SaleService` valida stock, calcula impuesto, calcula descuento, actualiza inventario y crea la venta.

### Singleton Pattern

Archivo:

- `backend/app/database/session.py`

Clase:

- `DatabaseManager`

Proposito:

- Mantener una unica configuracion de engine/session factory para SQLAlchemy.
- Evitar multiples inicializaciones inconsistentes.

Implementacion real resumida:

```python
class DatabaseManager:
    _instance: Optional["DatabaseManager"] = None

    def __new__(cls) -> "DatabaseManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
```

### Factory Pattern

Archivo:

- `backend/app/utils/product_factory.py`

Clase:

- `ProductFactory`

Proposito:

- Crear productos con su inventario inicial de manera consistente.

Ejemplo conceptual:

```text
ProductFactory.create_product(payload)
  -> Product(...)
  -> Inventory(...)
```

Esto evita duplicar logica de inicializacion de productos e inventario.

### Dependency Injection

FastAPI implementa inyeccion de dependencias con `Depends`.

Archivos:

- `backend/app/dependencies/auth.py`
- `backend/app/database/session.py`

Usos:

- Inyectar sesion de base de datos.
- Obtener usuario autenticado.
- Exigir roles.

Ejemplo conceptual:

```python
current_user = Depends(require_roles(RoleName.ADMIN))
db = Depends(get_db)
```

### DTO Pattern

Los DTOs estan implementados con Pydantic.

Ubicacion:

- `backend/app/schemas/`

Ejemplos:

- `ProductCreate`
- `ProductRead`
- `SaleCreate`
- `SaleRead`
- `UserCreate`
- `LoginRequest`

Objetivo:

- Separar request/response de modelos SQLAlchemy.
- Validar entrada.
- Evitar exponer campos internos como `hashed_password`.

### Strategy Pattern

No existe una clase formal llamada `Strategy`, pero hay una estrategia funcional en el calculo de descuentos:

- `NONE`
- `FIXED`
- `PERCENTAGE`

El backend decide el algoritmo segun `discount_type`. En una evolucion futura podria extraerse a clases de estrategia separadas.

### Builder Pattern

No hay implementacion formal de Builder Pattern. La construccion compleja de recibos ocurre en `frontend/src/utils/receipt.ts`, pero no esta estructurada como Builder clasico.

---

## 10. Principios SOLID Aplicados

### S - Single Responsibility Principle

Cada clase o modulo tiene una responsabilidad clara.

Ejemplos reales:

- `AuthService`: autenticacion, intentos fallidos y token.
- `FileStorageService`: validacion y almacenamiento de archivos.
- `SettingService`: configuracion del negocio.
- `SaleService`: reglas de venta.
- `ProductRepository`: consultas de productos.

### O - Open/Closed Principle

El sistema se puede extender agregando nuevos servicios, rutas o schemas sin modificar toda la aplicacion.

Ejemplos:

- Agregar nuevos reportes no obliga a cambiar ventas.
- Agregar nuevos campos de configuracion se concentra en `BusinessSetting`, `SettingService` y schemas.
- Agregar nuevos metodos de pago puede extender enums y validacion.

### L - Liskov Substitution Principle

No hay jerarquias complejas de herencia en el dominio. El proyecto evita herencia innecesaria y prefiere composicion mediante servicios, repositorios y dependencias. Esto reduce riesgos de violar LSP.

### I - Interface Segregation Principle

Aunque Python no usa interfaces obligatorias como Java, la separacion por servicios y repositorios evita clases gigantes.

Ejemplos:

- `CustomerService` no maneja productos.
- `ProductService` no maneja login.
- `ReportService` no crea ventas.
- `FileStorageService` no conoce reglas de ventas.

### D - Dependency Inversion Principle

Las capas superiores no crean directamente conexiones globales ni mezclan consultas en controladores. FastAPI inyecta dependencias y los servicios trabajan con repositorios/sesiones.

Ejemplo:

```text
Router
  depende de Service

Service
  depende de Repository

Repository
  depende de SQLAlchemy Session inyectada
```

---

## 11. Flujo Completo de una Venta

Este es el flujo mas importante del sistema.

### 1. Inicio en frontend

Archivo:

- `frontend/src/pages/POSPage.tsx`

El cajero abre el modulo de ventas. La pantalla muestra:

- Buscador de productos.
- Entrada para codigo de barras.
- Grid/lista de productos.
- Carrito.
- Cantidades.
- Cliente seleccionado.
- Subtotal.
- Impuesto.
- Descuento.
- Total final.
- Dialogo de pago.

### 2. Busqueda de producto

El producto puede agregarse de tres formas:

- Busqueda manual por nombre.
- Clic sobre producto.
- Escaneo de codigo de barras o QR.

El lector USB se comporta como teclado. El hook `useBarcodeScanner` captura caracteres rapidos y procesa el codigo al recibir `Enter`.

Flujo:

```text
Scanner USB
  -> eventos keydown
  -> useBarcodeScanner
  -> POSPage
  -> productService.findByBarcode(code)
  -> GET /api/products/barcode/{code}
```

### 3. Validacion de producto

Backend:

- `backend/app/api/routes/products.py`
- `backend/app/services/product_service.py`
- `backend/app/repositories/product_repository.py`

Valida:

- Producto existe.
- Producto esta activo.
- Codigo corresponde a `barcode` o `qr_code`.

Si no existe, el frontend muestra modal:

- Codigo capturado.
- Buscar nuevamente.
- Cancelar.
- Crear producto si el usuario es Administrador.

### 4. Carrito

Si el producto existe:

- Si no esta en el carrito, se agrega.
- Si ya esta, se incrementa cantidad.
- Se valida stock antes de incrementar.

### 5. Cliente

El cajero puede:

- Mantener cliente predeterminado.
- Buscar cliente.
- Crear cliente desde venta.
- Consultar compras anteriores desde selector o dialogo.

El cliente predeterminado no se modifica globalmente por una venta individual.

### 6. Descuento

En el dialogo de pago se permite:

- Sin descuento.
- Descuento fijo.
- Descuento porcentual.

Campos:

- `tipo_descuento`
- `valor_descuento`
- `monto_descuento`

Reglas:

- Fijo mayor que 0 y no mayor a subtotal + impuestos.
- Porcentaje mayor que 0 y menor o igual a 100.
- Total final = subtotal + impuestos - descuento.

### 7. Envio al backend

Frontend llama:

```text
POST /api/sales
```

Archivo frontend:

- `frontend/src/services/salesService.ts`

Archivo backend:

- `backend/app/api/routes/sales.py`

### 8. Recalculo backend

Archivo:

- `backend/app/services/sale_service.py`

El backend recalcula todo:

- Precio actual del producto.
- Subtotal.
- Impuesto desde configuracion.
- Descuento.
- Total.
- Cambio.

No confia en los totales enviados por el frontend.

### 9. Persistencia

La venta se guarda en:

- `sales`
- `sale_details`
- `payments`

Tambien actualiza:

- `inventory.quantity`

### 10. Factura

El frontend genera recibo/factura visual con:

- Datos del negocio.
- Logo.
- Cliente.
- Productos.
- Subtotal.
- Impuesto.
- Descuento.
- Total.
- Metodo de pago.

Archivo:

- `frontend/src/utils/receipt.ts`

Se puede imprimir y descargar en PDF.

---

## 12. Seguridad

### JWT Authentication

Archivo:

- `backend/app/core/security.py`

El backend crea JWT con:

- `sub`: usuario.
- `role`: rol.
- `exp`: expiracion.

El frontend guarda token en `localStorage` mediante:

- `frontend/src/utils/authStorage.ts`

Axios lo envia automaticamente:

```text
Authorization: Bearer <token>
```

### Proteccion de rutas frontend

Archivos:

- `frontend/src/routes/PrivateRoute.tsx`
- `frontend/src/routes/RoleGuard.tsx`

Si el usuario no esta autenticado:

- se redirige a login.

Si el token expiro:

- se limpia sesion.
- se redirige a login.

### Roles y permisos

Roles:

- `ADMIN`
- `CASHIER`

Permisos de administrador:

- Gestionar usuarios.
- Gestionar productos.
- Gestionar categorias.
- Gestionar inventario.
- Gestionar reportes.
- Configurar negocio.
- Desbloquear usuarios.
- Cambiar roles.

Permisos de cajero:

- Registrar ventas.
- Consultar productos.
- Consultar inventario.
- Escanear codigos.
- Consultar clientes segun rutas disponibles.

El cajero no debe:

- Modificar usuarios.
- Acceder a configuracion administrativa.
- Cambiar roles.
- Desbloquear usuarios.

### Password hashing

Archivo:

- `backend/app/core/security.py`

Se usa `passlib` con bcrypt para:

- Hashear contrasenas.
- Verificar contrasenas.

La base de datos no almacena contrasenas planas.

### CAPTCHA

Archivo backend:

- `backend/app/services/auth_service.py`

Archivo frontend:

- `frontend/src/components/TurnstileWidget.tsx`

El sistema integra Cloudflare Turnstile como proteccion preferida. En configuracion existen variables para Turnstile y reCAPTCHA, pero la validacion activa implementada en el servicio corresponde a Turnstile.

### Bloqueo por intentos fallidos

Modelo:

- `backend/app/models/user.py`

Campos:

- `failed_login_attempts`
- `locked`
- `locked_at`

Regla:

- Despues de 5 intentos incorrectos consecutivos, el usuario queda bloqueado.
- Solo un administrador puede desbloquearlo.

Endpoints relacionados:

- `PATCH /api/users/{user_id}/unlock`
- `PATCH /api/users/{user_id}/reset-attempts`

### CORS

Archivo:

- `backend/app/core/config.py`
- `backend/main.py`

El backend lee `CORS_ORIGINS` desde variables de entorno. Esto controla que origenes frontend pueden consumir la API.

### Validacion de archivos

Archivo:

- `backend/app/services/file_storage_service.py`

Reglas:

- Solo imagenes permitidas.
- MIME y extension validados.
- Tamano maximo configurable.
- Nombre de archivo unico.
- Ruta estable relativa.
- Evita confiar en nombre original.

### Consideraciones reales

El proyecto no implementa actualmente:

- Refresh tokens.
- Revocacion completa de JWT por tabla de sesiones.
- Autenticacion multifactor.
- Escaneo por camara.

Estas serian mejoras futuras.

---

## 13. Docker y Despliegue Local

Archivo principal:

- `docker-compose.yml`

Servicios:

- `db`: PostgreSQL 16 Alpine.
- `backend`: FastAPI.
- `frontend`: React compilado y servido con Nginx.

### PostgreSQL

Servicio:

```text
db
```

Usa:

- Imagen `postgres:16-alpine`.
- Volumen persistente `postgres_data`.
- Healthcheck con `pg_isready`.

### Backend

Servicio:

```text
backend
```

Construido desde:

- `backend/Dockerfile`

Entry point:

- `backend/docker-entrypoint.sh`

El entrypoint ejecuta:

```text
python -m app.database.prepare_database
uvicorn main:app --host 0.0.0.0 --port 8000
```

Esto prepara la base de datos antes de iniciar la API.

### Frontend

Servicio:

```text
frontend
```

Construido desde:

- `frontend/Dockerfile`

Proceso:

1. Build con Node 20.
2. Copia `dist` a Nginx.
3. Sirve SPA en puerto 80 interno.
4. Expone `5173:80` en host.

### Volumen de media

El problema de imagenes que desaparecian se resolvio con almacenamiento persistente.

Configuracion real:

```text
media_data:/app/media
```

El backend sirve archivos desde:

```text
/media
```

Esto permite que:

- Imagenes de productos sobrevivan reinicios.
- Logo del negocio sobreviva reinicios.
- Rebuild de contenedores no elimine archivos cargados.

### Variables importantes

Ejemplos:

- `DATABASE_URL`
- `SECRET_KEY`
- `ENVIRONMENT`
- `CORS_ORIGINS`
- `TURNSTILE_SECRET_KEY`
- `RECAPTCHA_SECRET_KEY`
- `MEDIA_ROOT`
- `MEDIA_URL_PREFIX`
- `MAX_UPLOAD_SIZE_BYTES`
- `VITE_API_URL`
- `VITE_TURNSTILE_SITE_KEY`

### Healthchecks

El compose valida:

- PostgreSQL healthy.
- Backend healthy con `/health`.
- Frontend healthy con HTTP local.

### Comandos de despliegue local

```bash
docker compose build
docker compose up -d --force-recreate
docker compose ps
```

---

## 14. GitHub, Versionamiento y CI/CD

Repositorio:

```text
https://github.com/ARWAWINGUMU/MeynaPos
```

Rama principal:

```text
main
```

Tag estable:

```text
v1.0.0-beta
```

Commit estable de referencia:

```text
8bccf2c721366e8009158e16b854924b08476f90
```

### CI/CD

Archivo:

- `.github/workflows/ci.yml`

Se ejecuta en:

- Push a `main`.
- Push a `develop`.
- Pull request hacia `main`.
- Pull request hacia `develop`.

Jobs:

**backend**

1. Checkout.
2. Python 3.12.
3. `pip install -r requirements.txt`.
4. `pytest`.
5. `docker build -t meynapos-backend:ci ./backend`.

**frontend**

1. Checkout.
2. Node.js 20.
3. `npm install`.
4. `npm run build`.
5. `docker build -t meynapos-frontend:ci ./frontend`.

### Buenas practicas de versionamiento aplicadas

- `.gitignore` evita versionar `node_modules`, caches, `.env`, builds y temporales.
- Se usa un unico repositorio para frontend, backend, Docker y documentacion.
- El tag `v1.0.0-beta` marca una version funcional validada.

---

## 15. Conclusiones Tecnicas

MeynaPOS es un sistema POS web funcional con arquitectura escalable para un proyecto academico serio.

Aspectos fuertes:

- Separacion clara entre frontend y backend.
- API REST modular.
- Servicios con reglas de negocio.
- Repositorios para persistencia.
- Modelos relacionales consistentes.
- Autenticacion JWT.
- Roles y permisos.
- Bloqueo de usuarios por intentos fallidos.
- Descuentos validados en backend.
- Moneda configurable.
- Formato monetario reutilizable.
- Imagenes persistentes.
- Docker Compose completo.
- CI con pruebas y builds.
- Lectura de codigos de barras/QR mediante dispositivos USB HID.

Limitaciones actuales:

- No hay microservicios, intencionalmente.
- No hay refresh token.
- La tabla `sessions` existe, pero el flujo actual de JWT no depende de revocacion persistente por sesion.
- No existe escaneo por camara.
- No hay modulo completo visual de proveedores, aunque existe modelo `Supplier`.
- Las facturas historicas usan montos guardados de la venta, pero parte de la configuracion visual puede venir de la configuracion vigente.

Mejoras futuras:

- Auditoria de acciones administrativas.
- Refresh tokens con revocacion.
- Exportacion avanzada de reportes.
- Factura electronica segun regulacion local.
- Permisos mas granulares.
- Modulo completo de proveedores.
- Backup automatizado.
- Observabilidad con metricas y trazas.

---

## 16. Preguntas Probables del Profesor con Respuestas

### 1. Que es MeynaPOS?

MeynaPOS es un sistema web de punto de venta e inventario para pequenos y medianos negocios. Permite vender productos, manejar stock, clientes, usuarios, reportes, configuracion del negocio y facturacion basica.

### 2. Que arquitectura usa?

Usa arquitectura cliente-servidor con separacion por capas: frontend React, API FastAPI, servicios, repositorios y PostgreSQL.

### 3. Es microservicios?

No. Es un monolito modular. Para el alcance academico y funcional del proyecto es mas mantenible y evita complejidad innecesaria.

### 4. Por que FastAPI?

Porque permite crear APIs REST rapidas, tipadas, con validacion Pydantic, inyeccion de dependencias y documentacion OpenAPI automatica.

### 5. Por que React?

Porque permite construir una interfaz modular por componentes, adecuada para dashboard, tablas, formularios, modales y flujo POS.

### 6. Por que PostgreSQL?

Porque el sistema necesita relaciones, transacciones, integridad referencial y datos monetarios precisos.

### 7. Que ORM se usa?

SQLAlchemy. Permite mapear clases Python a tablas y trabajar con relaciones.

### 8. Que hace Alembic?

Controla migraciones de base de datos para evolucionar el esquema de forma versionada.

### 9. Como se autentica un usuario?

El frontend envia usuario, contrasena y token CAPTCHA a `/api/auth/login`. El backend valida credenciales y devuelve un JWT.

### 10. Donde se guarda el JWT?

En `localStorage`, mediante utilidades de frontend. Axios lo agrega automaticamente a las peticiones.

### 11. Como se protegen las rutas?

En frontend con `PrivateRoute` y `RoleGuard`. En backend con dependencias que validan usuario autenticado y rol.

### 12. Que roles existen?

ADMIN y CASHIER.

### 13. Que puede hacer un administrador?

Gestionar usuarios, productos, categorias, inventario, reportes, configuracion y desbloquear usuarios.

### 14. Que puede hacer un cajero?

Registrar ventas, consultar productos, consultar inventario, escanear codigos y operar el POS segun permisos.

### 15. Como se bloquea un usuario?

El backend incrementa `failed_login_attempts`; al llegar a 5 intentos fallidos bloquea el usuario con `locked = true` y fecha `locked_at`.

### 16. Quien puede desbloquear usuarios?

Solo un administrador mediante los endpoints del modulo usuarios.

### 17. Como se manejan contrasenas?

Se almacenan hasheadas con bcrypt usando `passlib`; nunca se guardan contrasenas planas.

### 18. Que CAPTCHA usa?

Cloudflare Turnstile. El backend tiene validacion en `AuthService` y el frontend usa `TurnstileWidget`.

### 19. Como se calcula una venta?

El backend calcula subtotal, impuesto, descuento y total final. No confia en calculos del frontend.

### 20. Por que no se usan floats para dinero?

Porque los floats pueden generar errores de precision. Se usan `Decimal` y `Numeric`.

### 21. Que tipos de descuento existen?

NONE, FIXED y PERCENTAGE.

### 22. Como se valida un descuento fijo?

Debe ser mayor que cero y no superar subtotal mas impuestos.

### 23. Como se valida un descuento porcentual?

Debe ser mayor que cero y menor o igual a 100.

### 24. Como se actualiza inventario?

Cuando se confirma una venta, `SaleService` descuenta stock. Cuando se crea una compra, `PurchaseService` incrementa stock.

### 25. Que pasa si no hay stock?

El backend rechaza la venta. El frontend tambien valida antes de agregar o incrementar en carrito.

### 26. Como funciona el lector de codigo de barras?

Como dispositivo HID tipo teclado. El hook captura caracteres rapidos y procesa el codigo cuando llega Enter.

### 27. El sistema usa camara para QR?

No. En esta fase solo soporta lectores USB que escriben como teclado.

### 28. Donde se guardan imagenes?

En `/app/media` dentro del contenedor backend, montado con volumen persistente `media_data`.

### 29. Por que antes desaparecian imagenes?

Porque guardar dentro de capas efimeras o rutas no persistentes se pierde al recrear contenedores. Se corrigio con volumen persistente y rutas estables.

### 30. Como se sirven imagenes?

FastAPI monta archivos estaticos bajo `/media`.

### 31. Como se evita subir archivos peligrosos?

`FileStorageService` valida MIME, extension, tamano maximo y genera nombres unicos.

### 32. Que patron usa la conexion a BD?

Singleton, mediante `DatabaseManager`.

### 33. Que patron usa la creacion de productos?

Factory, mediante `ProductFactory`.

### 34. Que patron usan los repositorios?

Repository Pattern, para aislar consultas SQLAlchemy.

### 35. Donde estan las reglas de negocio?

En los servicios de backend, como `SaleService`, `AuthService` y `ProductService`.

### 36. Que hace `docker-compose.yml`?

Levanta PostgreSQL, backend y frontend, define variables, volumenes, red interna y healthchecks.

### 37. Que verifica el CI?

Instala dependencias, ejecuta pruebas backend, compila frontend y construye imagenes Docker.

### 38. Como se evita N+1 en historial de clientes?

El servicio de clientes usa consultas eficientes y carga relacionada para historial, evitando consultar productos o detalles de uno en uno.

### 39. Que pasa si un producto ya tiene codigo de barras?

El backend valida unicidad y rechaza duplicados.

### 40. Como se configura la moneda?

Desde configuracion del negocio. El valor predeterminado es COP y tambien se soporta USD.

### 41. Como se formatea dinero?

Frontend usa una utilidad reutilizable en `frontend/src/utils/money.ts`; COP se muestra como `$ 10.000`.

### 42. Que pasa si el token expira?

El interceptor de Axios detecta `401`, limpia la sesion y redirige al login.

### 43. Que endpoint muestra salud del backend?

`GET /health`.

### 44. Que tablas participan en una venta?

`sales`, `sale_details`, `payments`, `products`, `inventory`, `users` y opcionalmente `customers`.

### 45. Que datos se muestran en dashboard?

Metricas generales del negocio, usuario autenticado, rol, fecha actual y navegacion a modulos.

### 46. Que no esta implementado aun?

Refresh tokens, revocacion persistente de JWT, modulo completo de proveedores, escaneo por camara y facturacion electronica oficial.

### 47. Como se maneja configuracion del negocio?

Con `BusinessSetting`, `SettingService`, `settings.py` y la pagina `SettingsPage`.

### 48. Como se manejan reportes?

El frontend consume endpoints de `reports.py`; el backend usa `ReportService` y `ReportRepository` para consultas agregadas.

### 49. Por que usar DTOs?

Para validar entradas y salidas sin exponer directamente los modelos internos de base de datos.

### 50. Cual es la principal fortaleza tecnica?

La separacion ordenada de responsabilidades: frontend modular, API REST, servicios de negocio, repositorios, modelos relacionales, pruebas y despliegue con Docker.

---

## 17. Guion Oral para Exposicion de 35 Minutos

### Minuto 0 a 2 - Presentacion

Buenos dias. Hoy voy a presentar MeynaPOS, un sistema web de punto de venta e inventario desarrollado como proyecto final de Ingenieria de Software II.

El nombre del sistema es MeynaPOS y su slogan es "Tecnologia para crecer juntos". El objetivo del proyecto es ofrecer una solucion para pequenos y medianos negocios que necesitan registrar ventas, controlar inventario, administrar productos, manejar clientes, generar reportes y operar con usuarios por roles.

No es solamente una maqueta visual. El sistema tiene frontend en React, backend en FastAPI, base de datos PostgreSQL, autenticacion JWT, Docker, migraciones, pruebas y pipeline de CI.

### Minuto 2 a 5 - Vision general

La arquitectura general se divide en tres grandes partes: frontend, backend y base de datos.

El frontend esta construido con React, TypeScript y Vite. Se encarga de la experiencia del usuario: login, dashboard, ventas, productos, inventario, clientes, usuarios, compras, reportes y configuracion.

El backend esta construido con FastAPI. Expone una API REST bajo `/api` y contiene la logica de negocio en servicios. El backend no es solo un intermediario; tambien valida permisos, calcula ventas, valida descuentos, controla stock, bloquea usuarios y gestiona archivos.

La base de datos es PostgreSQL. Alli se almacenan usuarios, roles, productos, categorias, inventario, ventas, detalles de venta, pagos, clientes, compras, configuracion del negocio e imagenes mediante rutas persistentes.

### Minuto 5 a 8 - Frontend

En el frontend se siguio una estructura modular. Las paginas viven en `frontend/src/pages`, los componentes reutilizables en `components`, los servicios HTTP en `services`, los hooks en `hooks`, las rutas en `routes`, el estado global en `context` y las utilidades en `utils`.

El layout principal esta en `AppLayout`. Ese layout mantiene el sidebar, header, logo, datos del usuario, rol y boton de cierre de sesion. Todas las pantallas internas se renderizan dentro de ese layout, por eso no se abren pestanas nuevas ni se rompe la navegacion.

La autenticacion se controla con `AuthContext`. Cuando el usuario inicia sesion, se guarda el JWT junto al nombre y rol. Si el token expira, el interceptor de Axios detecta una respuesta 401, limpia la sesion y devuelve al login.

Tambien existen rutas privadas con `PrivateRoute` y restricciones por rol con `RoleGuard`. Esto permite que un cajero no pueda entrar a modulos administrativos como usuarios o configuracion.

### Minuto 8 a 11 - Backend

El backend esta organizado siguiendo principios de arquitectura limpia por capas.

La carpeta `api/routes` contiene los controladores HTTP. Cada archivo representa un modulo, por ejemplo `auth.py`, `products.py`, `sales.py`, `users.py`, `customers.py` y `reports.py`.

La carpeta `services` contiene reglas de negocio. Por ejemplo, `SaleService` calcula ventas, valida stock, aplica impuestos y descuentos. `AuthService` valida login, CAPTCHA e intentos fallidos. `ProductService` valida codigos unicos y carga de imagenes.

La carpeta `repositories` encapsula consultas a base de datos. Asi los servicios no dependen de consultas mezcladas dentro de los routers.

Los modelos estan en `models` y representan tablas SQLAlchemy. Los schemas estan en `schemas` y son DTOs Pydantic para validar requests y responses.

### Minuto 11 a 14 - Base de datos

La base de datos es relacional. Las tablas principales son `users`, `roles`, `products`, `categories`, `inventory`, `sales`, `sale_details`, `payments`, `customers`, `purchases`, `purchase_details` y `business_settings`.

Un usuario pertenece a un rol. Un producto pertenece a una categoria y tiene un registro de inventario. Una venta tiene muchos detalles y un pago. Una venta tambien se relaciona con un cajero y opcionalmente con un cliente.

Los valores monetarios se manejan con `Numeric` en SQLAlchemy y `Decimal` en Python. Esto es importante porque para dinero no es correcto usar `float`, ya que puede producir errores de precision.

Las migraciones se controlan con Alembic. Hay migraciones para el esquema inicial, descuentos y moneda, codigo QR en productos y estado activo/inactivo de categorias.

### Minuto 14 a 17 - Autenticacion y seguridad

El login consume `POST /api/auth/login`. El usuario envia username, password y token CAPTCHA. El backend valida la informacion y devuelve un JWT.

Las contrasenas se guardan con hash bcrypt usando `passlib`, nunca en texto plano.

El sistema implementa bloqueo por intentos fallidos. Cada usuario tiene `failed_login_attempts`, `locked` y `locked_at`. Despues de 5 intentos incorrectos, la cuenta queda bloqueada. Solo un administrador puede desbloquearla.

Tambien hay roles. ADMIN puede administrar usuarios, productos, categorias, reportes e inventario. CASHIER puede operar ventas, consultar productos e inventario y escanear codigos, pero no puede administrar usuarios ni configuracion.

### Minuto 17 a 21 - Flujo de venta

El flujo de venta inicia en `POSPage`. El cajero puede buscar productos manualmente o usar un lector USB de codigo de barras o QR. Ese lector funciona como teclado. El hook `useBarcodeScanner` detecta caracteres enviados rapidamente y procesa el codigo cuando recibe Enter.

El frontend consulta `GET /api/products/barcode/{code}`. Si el producto existe y esta activo, se agrega al carrito. Si ya estaba en el carrito, aumenta la cantidad. Antes de agregar o incrementar se valida stock.

Si el producto no existe, se abre un modal. El modal muestra el codigo capturado y permite buscar de nuevo, cancelar o crear producto si el usuario es administrador.

Cuando se paga, se puede aplicar descuento. Hay tres opciones: sin descuento, descuento fijo o descuento porcentual. El frontend muestra subtotal, impuesto, descuento y total final, pero el backend recalcula todo en `SaleService`. Esta es una decision importante porque el backend nunca debe confiar en calculos del cliente.

Al confirmar la venta, el backend guarda la cabecera en `sales`, las lineas en `sale_details`, el pago en `payments` y descuenta inventario. Luego el frontend genera la factura para imprimir o descargar PDF.

### Minuto 21 a 24 - Productos, inventario y categorias

El modulo de productos permite crear, editar, desactivar, buscar por nombre, buscar por codigo de barras o QR, cargar imagen persistente y asignar categoria.

La categoria tiene nombre unico y estado activo/inactivo. Si una categoria esta asociada a productos, la regla es no eliminar fisicamente sino desactivar o impedir la operacion.

El inventario muestra stock actual, minimo, alertas de bajo stock y filtros por categoria. El administrador puede actualizar stock. El cajero puede consultar inventario.

El sistema tambien soporta imagenes persistentes. Las imagenes se guardan en `/app/media`, separadas por subcarpetas como `products` y `business`, y Docker monta ese directorio con el volumen `media_data`.

### Minuto 24 a 27 - Clientes, historial y reportes

El modulo de clientes muestra tabla con nombre, documento, telefono, correo, cantidad de compras, total comprado y fecha de ultima compra.

Al abrir un cliente se puede ver su historial: numero de venta, fecha, cajero, productos, subtotal, impuesto, descuento, total, metodo de pago y estado. Desde ese historial se puede reimprimir o descargar nuevamente la factura.

Los reportes permiten analizar ventas diarias, inventario, productos mas vendidos, metodos de pago e ingresos mensuales. Estos reportes se alimentan desde endpoints del backend y consultas agregadas.

### Minuto 27 a 30 - Docker y CI

El proyecto se despliega localmente con Docker Compose. Hay tres servicios: `db`, `backend` y `frontend`.

`db` usa PostgreSQL 16 Alpine y volumen `postgres_data`.

`backend` se construye desde `backend/Dockerfile`. Antes de iniciar Uvicorn, ejecuta `prepare_database`, que espera la base de datos, aplica migraciones, crea tablas si es necesario y siembra datos iniciales.

`frontend` se construye con Node 20 y luego se sirve con Nginx. El archivo `nginx.conf` permite que rutas internas funcionen correctamente al refrescar.

El compose tambien tiene healthchecks para verificar que PostgreSQL, backend y frontend esten saludables.

En GitHub Actions el pipeline instala dependencias, ejecuta pruebas de backend, compila frontend y construye imagenes Docker.

### Minuto 30 a 33 - Patrones y SOLID

El proyecto implementa Repository Pattern en la carpeta `repositories`, Service Layer en la carpeta `services`, Singleton en `DatabaseManager`, Factory en `ProductFactory`, Dependency Injection con FastAPI y DTOs con Pydantic.

Tambien aplica SOLID. Por ejemplo, `FileStorageService` solo se encarga de archivos; `SaleService` solo de reglas de venta; `AuthService` solo de autenticacion. Esto cumple responsabilidad unica.

La arquitectura permite extender modulos sin reescribir todo. Si se quiere agregar un nuevo reporte, se agrega en reportes sin tocar ventas. Si se quiere agregar nuevo campo de configuracion, se modifica el modelo, schema y servicio correspondiente.

### Minuto 33 a 35 - Cierre

En conclusion, MeynaPOS es una aplicacion POS completa para el alcance del curso. Tiene UI moderna, backend real, base de datos relacional, autenticacion, roles, descuentos, inventario, clientes, reportes, Docker y CI.

Las decisiones tecnicas principales fueron usar monolito modular, separar responsabilidades, validar reglas criticas en backend, usar Decimal para dinero, persistir archivos en volumen Docker y proteger rutas con JWT y roles.

Como mejoras futuras se podrian agregar refresh tokens, auditoria, modulo completo de proveedores, facturacion electronica, backups automaticos, permisos mas granulares y escaneo por camara.

Con esto queda demostrado no solo el funcionamiento del sistema, sino tambien la aplicacion de arquitectura, diseno, seguridad, persistencia, pruebas y despliegue.
