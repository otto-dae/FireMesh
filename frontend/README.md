# 🔥 Dashboard ESP32 - Sistema de Monitoreo de Detectores de Humo

Dashboard en tiempo real para monitorear dispositivos ESP32 con sensores de temperatura, humo y llama. Visualización interactiva con mapa OpenStreetMap, alertas automáticas, y seguimiento histórico de datos.

![Next.js](https://img.shields.io/badge/Next.js-16.0-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-336791?style=flat-square&logo=postgresql)
![Firebase](https://img.shields.io/badge/Firebase-Realtime-orange?style=flat-square&logo=firebase)

## 🎯 Características

- 📡 **Monitoreo en tiempo real** con Firebase Realtime Database
- 🗺️ **Mapa interactivo** con OpenStreetMap mostrando ubicación de dispositivos
- 🎨 **Marcadores con colores** según nivel de alerta (verde/amarillo/rojo)
- 📊 **Gráficas históricas** de temperatura, humo y llama
- ⚠️ **Sistema de alertas** automático por umbrales configurables
- 📱 **Interfaz responsiva** con shadcn/ui components
- 🔌 **MQTT protocol** para comunicación con ESP32
- 💾 **Almacenamiento PostgreSQL** para datos históricos

## 🏗️ Arquitectura

```
┌─────────────┐      MQTT      ┌──────────────────┐
│   ESP32     │ ───────────────>│  FastAPI Backend │
│  Sensores   │                 │   (Python)       │
└─────────────┘                 └────────┬─────────┘
                                         │
                     ┌───────────────────┼───────────────────┐
                     │                   │                   │
                     v                   v                   v
              ┌─────────────┐    ┌─────────────┐    ┌──────────────┐
              │ PostgreSQL  │    │  Firebase   │    │   Next.js    │
              │  (Prisma)   │    │  Realtime   │<───│   Frontend   │
              │  Histórico  │    │   Database  │    │  Dashboard   │
              └─────────────┘    └─────────────┘    └──────────────┘
```
#### Al final no usamos MQTT
## 📁 Estructura del Proyecto

```
dashboard-esp32/
├── app/                        # Next.js App Router
│   ├── api/                    # API Routes
│   │   ├── devices/           # Endpoints de dispositivos
│   │   └── readings/          # Endpoints de lecturas
│   ├── device/[id]/           # Página de detalle del dispositivo
│   ├── page.tsx               # Dashboard principal
│   └── layout.tsx             # Layout base
├── components/                 # Componentes React
│   ├── ui/                    # shadcn/ui components
│   ├── DeviceMap.tsx          # Mapa con Leaflet
│   └── DeviceList.tsx         # Lista de dispositivos
├── lib/                       # Utilidades
│   ├── prisma.ts              # Cliente Prisma
│   ├── firebase.ts            # Config Firebase
│   ├── realtime.ts            # Helpers Firebase Realtime
│   ├── types.ts               # Tipos TypeScript
│   └── alerts.ts              # Lógica de alertas
├── prisma/                    # Base de datos
│   └── schema.prisma          # Schema PostgreSQL
├── backend-fastapi/           # Backend Python (separado)
│   ├── app/                   # FastAPI app
│   │   ├── main.py           # Aplicación principal
│   │   ├── config.py         # Configuración
│   │   ├── mqtt/             # Cliente MQTT
│   │   ├── firebase/         # Firebase Admin SDK
│   │   └── api/              # Endpoints REST
│   ├── requirements.txt       # Dependencias Python
│   └── README.md             # Docs del backend
└── README.md                  # Esta documentación
```

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 20+ y pnpm
- PostgreSQL 14+
- Python 3.11+ (para el backend)
- Cuenta Firebase (gratis)
- Broker MQTT (público o local)

### 1. Clonar e instalar dependencias

```bash
# Instalar dependencias del frontend
pnpm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales
```

### 2. Configurar PostgreSQL

```bash
# Crear base de datos
createdb esp32_dashboard

# Ejecutar migraciones
pnpm exec prisma migrate dev --name init

# (Opcional) Seed con datos de ejemplo
pnpm exec prisma db seed
```

### 3. Configurar Firebase

1. Crear proyecto en [Firebase Console](https://console.firebase.google.com/)
2. Habilitar **Realtime Database**
3. Copiar configuración web al archivo `.env`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

### 4. Ejecutar el frontend

```bash
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000)

### 5. Configurar y ejecutar el backend FastAPI

Ver [backend-fastapi/README.md](./backend-fastapi/README.md) para instrucciones detalladas.

```bash
cd backend-fastapi
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## 🗺️ Configuración del Mapa

### Actualizar coordenadas reales

Editar coordenadas en `app/page.tsx` y `components/DeviceMap.tsx`:

```typescript
// Coordenadas de la Facultad de Informática (ejemplo)
center={[25.6866, -100.3161]}  // [latitud, longitud]
zoom={18}  // Nivel de zoom (18 = muy cerca)
```

Para obtener coordenadas exactas:
1. Ir a [OpenStreetMap](https://www.openstreetmap.org/)
2. Buscar tu ubicación
3. Click derecho > "Mostrar dirección" para ver lat/lon

### Registrar dispositivos con ubicaciones

```bash
# POST /api/devices
curl -X POST http://localhost:3000/api/devices \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "esp32_01",
    "name": "Detector Pasillo A",
    "location": "Primer piso, Pasillo A",
    "latitude": 25.6866,
    "longitude": -100.3161
  }'
```

## 📊 Base de Datos

### Schema Prisma

```prisma
model Device {
  id          String   @id @default(cuid())
  deviceId    String   @unique
  name        String
  location    String
  latitude    Float
  longitude   Float
  isActive    Boolean  @default(true)
  readings    SensorReading[]
  alerts      Alert[]
}

model SensorReading {
  id          String   @id @default(cuid())
  deviceId    String
  temperature Float
  smoke       Float
  flame       Float
  timestamp   DateTime @default(now())
  device      Device   @relation(fields: [deviceId], references: [id])
}

model Alert {
  id          String     @id @default(cuid())
  deviceId    String
  level       AlertLevel
  message     String
  isResolved  Boolean    @default(false)
  createdAt   DateTime   @default(now())
  device      Device     @relation(fields: [deviceId], references: [id])
}

enum AlertLevel {
  NORMAL
  WARNING
  CRITICAL
}
```

## ⚙️ Configuración de Alertas

Editar umbrales en `lib/alerts.ts`:

```typescript
export const DEFAULT_THRESHOLDS: AlertThresholds = {
  temperature: {
    warning: 35,   // °C
    critical: 50,  // °C
  },
  smoke: {
    warning: 300,   // ppm
    critical: 600,  // ppm
  },
  flame: {
    warning: 200,   // valor sensor (0-1023)
    critical: 500,  // valor sensor (0-1023)
  },
};
```

## 🔌 Integración ESP32

### Formato JSON desde ESP32

```json
{
  "deviceId": "esp32_01",
  "temperature": 25.5,
  "smoke": 120,
  "flame": 50,
  "timestamp": "2025-11-22T10:30:00Z"
}
```

### Publicar a MQTT

Topic: `esp32/sensors/{deviceId}`

Ver [backend-fastapi/README.md](./backend-fastapi/README.md) para código completo de ESP32.

## 📦 Scripts Disponibles

```bash
# Desarrollo
pnpm dev           # Iniciar Next.js en modo desarrollo

# Producción
pnpm build         # Build para producción
pnpm start         # Iniciar servidor de producción

# Base de datos
pnpm prisma:generate    # Generar cliente Prisma
pnpm prisma:migrate     # Ejecutar migraciones
pnpm prisma:studio      # Abrir Prisma Studio (GUI)

# Linting
pnpm lint          # Ejecutar ESLint
```

## 🎨 Tecnologías Utilizadas

### Frontend
- **Next.js 16** - Framework React con App Router
- **TypeScript** - Tipado estático
- **Tailwind CSS 4** - Estilos utility-first
- **shadcn/ui** - Componentes UI accesibles
- **Leaflet** - Mapas interactivos OpenStreetMap
- **Recharts** - Gráficas de datos
- **date-fns** - Manejo de fechas

### Backend
- **FastAPI** - Framework Python async
- **PostgreSQL** - Base de datos relacional
- **Prisma** - ORM TypeScript/Node.js
- **Firebase Realtime Database** - Sincronización en tiempo real
- **MQTT (paho-mqtt)** - Protocolo IoT

### DevOps
- **Vercel** - Deploy frontend (recomendado)
- **Railway/Render** - Deploy backend Python
- **Neon/Supabase** - PostgreSQL en la nube

## 🔐 Seguridad

⚠️ **IMPORTANTE**: Este proyecto NO incluye autenticación por diseño inicial.

Para producción, implementar:
- [ ] Autenticación (NextAuth.js, Clerk, etc.)
- [ ] Rate limiting en API
- [ ] Validación de origen MQTT
- [ ] HTTPS/TLS
- [ ] Reglas de seguridad Firebase
- [ ] Variables de entorno seguras

## 🐛 Troubleshooting

### Error: "Cannot find module '@prisma/client'"

```bash
pnpm exec prisma generate
```

### Error: Leaflet no renderiza en Next.js

El componente `DeviceMap` usa `dynamic import` con `ssr: false` para evitar problemas de SSR con Leaflet.

### Firebase Realtime Database no actualiza

1. Verificar que Firebase esté configurado correctamente en `.env`
2. Comprobar reglas de seguridad en Firebase Console
3. Verificar que el backend esté publicando datos

### Mapa no muestra marcadores

1. Verificar que hay dispositivos en la base de datos
2. Comprobar coordenadas (lat/lon deben ser números válidos)
3. Abrir DevTools y revisar errores en consola

## 📝 TODO

- [ ] Implementar backend FastAPI completo
- [ ] Agregar autenticación
- [ ] Panel de administración para gestionar dispositivos
- [ ] Notificaciones push para alertas críticas
- [ ] Exportar datos históricos (CSV/Excel)
- [ ] Dashboard de estadísticas globales
- [ ] Testing (Jest, Playwright)
- [ ] Docker Compose para desarrollo

## 🤝 Contribuir

Este proyecto fue creado para la Facultad de Informática. Para contribuir:

1. Fork el repositorio
2. Crear branch de feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## 📄 Licencia

Este proyecto es de código abierto para fines educativos.

## 👥 Autores

- **Adrián** - Dashboard y frontend
- **David Mata** - Requerimientos y especificaciones

---

**Hecho con ❤️ para la Facultad de Informática**
