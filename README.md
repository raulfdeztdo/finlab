<p align="center">
  <img src="public/finlab-logo.svg" alt="Finlab" height="48" />
</p>

<p align="center">
  Panel de análisis técnico multi-temporal en tiempo real para scalping de <strong>XAUUSD</strong> (Oro/USD)
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss" />
  <img src="https://img.shields.io/badge/SQLite-better--sqlite3-003b57?logo=sqlite" />
  <img src="https://img.shields.io/badge/Docker-compose-2496ed?logo=docker" />
</p>

---

## Qué es Finlab

Finlab es una aplicación web de análisis financiero para traders de scalping. Conecta con la API de **TwelveData** para obtener datos OHLCV en 5 temporalidades simultáneas, calcula 10 indicadores técnicos por temporalidad y genera recomendaciones de entrada/salida con niveles de confianza.

Toda la interfaz está en **español** y está optimizada para operar en **horario europeo** (por defecto 08:00–01:00 hora de Madrid).

---

## Características principales

### Análisis técnico
- **5 temporalidades**: 5min, 15min, 30min, 1h, 4h
- **10 indicadores por temporalidad**: EMA (9/21/50/100/200), RSI, MACD, Bandas de Bollinger, Estocástico, ADX/DI, Ichimoku, VWAP, Pivotes, ATR
- **Señal global ponderada** (0–100): combinación multi-temporal con pesos configurables
- **Alineación multi-temporal (MTA)**: detecta cuando las 4 temporalidades apuntan en la misma dirección
- **Setup de trade automático**: zona de entrada, stop loss, TP1, TP2 y ratio riesgo/beneficio
- **Recomendaciones de scalping**: rebotes en soporte/resistencia, rupturas de tendencia, con nivel de confianza por operación

### Datos de mercado
- Fuente: [TwelveData API](https://twelvedata.com) (compatible con plan gratuito)
- Símbolo por defecto: XAUUSD (Oro/USD)
- Caché en memoria: 25 minutos por temporalidad
- Rate limiting interno: máximo 5 peticiones/minuto (respeta el límite del plan gratuito)
- Filtrado de candles de fin de semana (ruido de broker)

### Auto-refresh y notificaciones
- **Actualización automática cada 15 minutos** dentro del horario configurado
- **Horario configurable** (por defecto 08:00–01:00 hora Madrid), guardado en `localStorage`
- **Notificaciones de escritorio** para señales con confianza ≥ 50%
- Último análisis persistido en `localStorage` — sin llamada a la API en cada recarga
- Countdown en tiempo real hasta la próxima actualización

### Autenticación y usuarios
- Sistema de login con sesiones por cookie
- Base de datos **SQLite** (`better-sqlite3`) con usuarios, sesiones, historial de peticiones API y acciones sugeridas
- Gestión de usuarios exclusiva para el rol `admin` (crear, editar, eliminar)
- Usuario admin por defecto: `admin` / `password` / `email@mail.com`

### Responsive
- Header con menú hamburguesa en móvil
- SymbolSelector integrado en el menú desplegable en móvil
- Diseño adaptado a pantallas desde 375px

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript 5 |
| Estilos | Tailwind CSS 4 |
| Base de datos | SQLite via `better-sqlite3` |
| Indicadores | `technicalindicators` |
| Iconos | `lucide-react` |
| Auth | Cookies de sesión + bcryptjs |
| Despliegue | Docker + docker compose |

---

## Estructura del proyecto

```
finlab/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/route.ts          # Login / logout / check sesión
│   │   │   ├── market-data/route.ts   # Endpoint principal de análisis + escritura CSV
│   │   │   ├── backtesting/route.ts   # Endpoint de backtesting semanal
│   │   │   ├── users/route.ts         # CRUD usuarios (admin)
│   │   │   └── history/route.ts       # Historial de señales
│   │   ├── login/page.tsx             # Página de login
│   │   ├── layout.tsx
│   │   ├── page.tsx                   # Server component con redirect auth
│   │   └── globals.css
│   ├── components/
│   │   ├── Dashboard.tsx              # Componente principal / orquestador
│   │   ├── PriceHeader.tsx            # Precio actual y variación
│   │   ├── SignalGauge.tsx            # Gauge de señal global (0–100)
│   │   ├── TradeSetupPanel.tsx        # Zona entrada, SL, TP, R:R
│   │   ├── MTAPanel.tsx               # Alineación multi-temporal
│   │   ├── TimeframeTable.tsx         # Tabla de indicadores por temporalidad
│   │   ├── ScalpingRecommendations.tsx# Tarjetas de recomendaciones
│   │   ├── BacktestingPanel.tsx       # Panel de backtesting semanal
│   │   ├── SessionClock.tsx           # Sesión activa y próxima actualización
│   │   ├── ScheduleConfig.tsx         # Modal configuración de horario
│   │   ├── HistoryPanel.tsx           # Historial de acciones sugeridas
│   │   ├── UserManagement.tsx         # Modal gestión de usuarios (admin)
│   │   └── SymbolSelector.tsx         # Selector de símbolo
│   └── lib/
│       ├── api/twelvedata.ts          # Cliente TwelveData + caché + rate limit
│       ├── config/
│       │   ├── indicators.ts          # Parámetros de indicadores y schedule
│       │   └── symbols.ts             # Definición de símbolos
│       ├── csv/index.ts               # Registro semanal CSV + motor de backtesting
│       ├── db/index.ts                # SQLite singleton y operaciones de DB
│       ├── indicators/calculator.ts   # Cálculo de todos los indicadores
│       ├── signals/scoring.ts         # Pipeline completo de análisis
│       └── types/index.ts             # Tipos TypeScript
├── public/
│   ├── finlab-logo.svg                # Logo horizontal (README / og)
│   └── favicon.svg                    # Favicon SVG
├── data/                              # Datos persistentes (excluido de git)
│   ├── db/finlab.db                   # Base de datos SQLite
│   ├── csv/                           # CSVs semanales de trades y velas
│   └── cache/                         # Caché de respuestas TwelveData
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## Instalación y despliegue

### Requisitos
- Docker y docker compose instalados
- API key de [TwelveData](https://twelvedata.com) (plan gratuito suficiente)

### 1. Clonar y configurar variables de entorno

```bash
git clone <repo-url> finlab
cd finlab
cp .env.example .env.local
```

Edita `.env.local`:

```env
TWELVEDATA_API_KEY=tu_api_key_aqui
TZ=Europe/Madrid
```

### 2. Construir y levantar

```bash
docker compose build --no-cache && docker compose up -d
```

### 3. Acceder

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

Credenciales por defecto:

| Campo | Valor |
|---|---|
| Usuario | `admin` |
| Contraseña | `exIqex34` |

> Cambia la contraseña desde el panel de gestión de usuarios una vez dentro.

---

## Persistencia de datos en Docker

La aplicación usa **tres volúmenes Docker** para que los datos sobrevivan entre rebuilds:

| Volumen | Ruta en contenedor | Contenido |
|---|---|---|
| `finlab-db` | `/app/data/db` | Base de datos SQLite (`finlab.db`) |
| `finlab-csv` | `/app/data/csv` | CSVs semanales de trades y velas 5min |
| `finlab-cache` | `/app/data/cache` | Caché de respuestas de TwelveData |

Los volúmenes se crean vacíos la **primera vez** y se remontan con sus datos en todos los rebuilds posteriores. Un `docker compose build --no-cache && docker compose up -d` **nunca borra los datos**.

### Rebuild normal (mantiene todos los datos)

```bash
docker compose build --no-cache && docker compose up -d
```

### Borrar solo la caché de TwelveData

```bash
docker volume rm finlab_finlab-cache
docker compose up -d
```

### Borrar solo los CSVs de backtesting

```bash
docker volume rm finlab_finlab-csv
docker compose up -d
```

### Borrar la base de datos (usuarios, sesiones, historial)

> Necesario si cambias el schema de la DB entre versiones.

```bash
docker compose down
docker volume rm finlab_finlab-db
docker compose up -d
```

La app recreará la DB con el schema nuevo y el usuario admin por defecto.

### Borrar todos los datos persistentes

```bash
docker compose down -v
docker compose up -d
```

> El flag `-v` en `docker compose down` elimina **todos** los volúmenes asociados al proyecto.

---

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # añade tu API key
npm run dev
```

La app corre en [http://localhost:3000](http://localhost:3000).

> En desarrollo, `better-sqlite3` requiere que tengas instalado Python 3, `make` y `g++` para compilar el addon nativo.

---

## Indicadores técnicos

| Indicador | Temporalidades | Parámetros 5min |
|---|---|---|
| EMA | Todas | 9, 21, 50, 100, 200 |
| RSI | Todas | Período 7, sobrecompra 80, sobreventa 20 |
| MACD | Todas | Fast 5, Slow 13, Signal 1 |
| Bollinger Bands | Todas | Período 14, 1.5σ |
| Estocástico | Todas | K=5, D=3, Smooth=1 |
| ADX / DI | Todas | Período 14 |
| Ichimoku | Todas | Conversión 7, Base 22, Span 44 |
| VWAP | Todas | Acumulado de sesión |
| Pivotes | Todas | Clásico (PP, R1, R2, S1, S2) |
| ATR | Todas | Período 14 (informativo) |

Los parámetros de temporalidades más lentas (30min, 1h, 4h) usan configuraciones estándar (RSI 14, MACD 12/26/9, Bollinger 20/2σ).

---

## Configuración del horario

Por defecto la app actualiza datos entre las **08:00 y las 01:00** hora de Madrid. Puedes cambiar este horario desde el botón de configuración en el header. El horario se guarda en `localStorage` y persiste entre sesiones.

El intervalo de auto-refresh es de **15 minutos**, sincronizado con el reloj (actualiza a :00, :15, :30, :45 de cada hora).

---

## Base de datos

La base de datos SQLite se crea automáticamente en `data/db/finlab.db` al iniciar la aplicación. Contiene cuatro tablas:

| Tabla | Contenido |
|---|---|
| `users` | Usuarios con rol (`admin` / `user`), hash de contraseña y email |
| `sessions` | Tokens de sesión activos |
| `api_requests` | Historial de todas las peticiones realizadas a TwelveData |
| `suggested_actions` | Recomendaciones de scalping generadas en cada análisis |

## Backtesting semanal

Cada análisis exitoso escribe automáticamente dos CSVs en `data/csv/`:

| Fichero | Contenido |
|---|---|
| `trades_YYYY-Www.csv` | Operaciones detectadas (entrada, SL, TP, confianza, dirección...) |
| `candles_5min_YYYY-Www.csv` | Velas 5min acumuladas de la semana (deduplicadas) |

El panel de **Backtesting Semanal** en el dashboard evalúa automáticamente cada trade contra las velas 5min posteriores a la señal, calculando win rate, PnL, desglose por dirección y por tipo de operación. Los resultados también están disponibles vía API en `/api/backtesting?week=YYYY-Www`.

---

## Variables de entorno

| Variable | Descripción | Requerida |
|---|---|---|
| `TWELVEDATA_API_KEY` | API key de TwelveData | Sí |
| `TZ` | Zona horaria del servidor | No (por defecto `Europe/Madrid`) |

---

## Notas sobre el plan gratuito de TwelveData

- Límite: 8 peticiones/minuto, ~800 peticiones/día
- Cada análisis completo consume **5 peticiones** (una por temporalidad)
- Con auto-refresh cada 15 minutos: máximo 96 análisis/día = 480 peticiones/día
- Finlab espera 10 segundos entre peticiones para respetar el rate limit
- El tiempo total de un análisis completo es ~50 segundos
