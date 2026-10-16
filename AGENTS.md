# AGENTS.md — Technical Architecture & Domain Knowledge Base

> **AgroCebada FIRA 2026** — Geospatial monitoring, satellite-driven yield prediction, and credit risk simulation for malting and forage barley in central Mexico.

---

## 1. Project Mission & Hackathon Context

This project is developed for the **FIRA Reto AgroCebada 2026** ([Bases Oficiales FIRA](https://www.fira.gob.mx/Nd/Reto%20Agrocebada%20Bases.pdf)). FIRA (Fideicomisos Instituidos en Relación con la Agricultura / Banco de México) challenges teams to combine remote sensing, agro-climatic intelligence, and machine learning to estimate barley grain yield and assess agricultural credit risk under climate volatility.

### Geographic & Agronomic Scope
- **Total Parcels**: 197 commercial barley parcels georeferenced across 3 key producing states in Mexico's Central Altiplano:
  - **Hidalgo**: 76 parcels (predominantly Apan, Almoloya, Emiliano Zapata, Tepeapulco).
  - **Tlaxcala**: 65 parcels (Calpulalpan, Nanacamilpa, Huamantla, Tlaxco).
  - **Puebla**: 56 parcels (San Salvador el Seco, Ciudad Serdán, Esperanza).
- **The 70 / 30 Challenge Split**:
  - **70% Training (`train`, 138 parcels)**: Ground-truth harvested yield (`actualYieldTonHa`) is known and verified.
  - **30% Evaluation (`eval`, 59 parcels)**: Ground-truth yield is withheld by FIRA. The model predicts yield (`predictedYieldTonHa`) with 90% confidence intervals.
- **Sub-Lot Heterogeneity**:
  - Every parcel is divided into 3 distinct agronomic management units: `Lote A`, `Lote B`, and `Lote C`.
  - Sub-lots capture intra-parcel variability in soil texture (Franco-Arcilloso, Franco-Limoso, Franco-Arenoso), terrain slope, moisture status, and localized NDVI/NDWI profiles.
- **Temporal Satellite Evaluation (Sentinel-2 L2A)**:
  - 6 phenological monitoring checkpoints across the crop cycle:
    1. *Siembra y Emergencia* (Jun 15)
    2. *Macollamiento* (Jul 05)
    3. *Encañado* (Jul 25)
    4. *Espigado y Floración* (Ago 09) — *Critical biological window*
    5. *Llenado de Grano* (Ago 28)
    6. *Madurez y Cosecha* (Sep 18)
  - Evaluated multispectral indices & climate variables: NDVI, EVI, NDWI, SAVI, precipitation (mm), GDD (Growing Degree Days), and min/max temperatures.

---

## 2. Dual-View UX Architecture

AgroCebada implements a dual persona interface controlled via the mode switcher in the top navigation bar:

```
+-----------------------------------------------------------------------------------+
|  Top App Bar: Logo | Title & Region | Search | [Agricultor | Analista] | Backend   |
+-----------------------------------------------------------------------------------+
|  State Filter Chips (Todos 197 | Hidalgo 76 | Tlaxcala 65 | Puebla 56) | Nav / CSV|
+-----------------------------------------+-----------------------------------------+
|                                         |                                         |
|  LEFT COLUMN: Map & Timeline            |  RIGHT COLUMN: Side Sheet (Personas)    |
|                                         |                                         |
|  [ Interactive MapLibre GL 4 Map ]      |  [ Vista Agricultor ]                   |
|  - Yield / NDVI / NDWI / Split modes    |    - Expected yield vs mun avg          |
|  - Parcel polygon & sub-lot outlines   |    - Net income & total harvest         |
|  - Floating layers & sub-lot panels     |    - Sub-lot carousel cards             |
|                                         |    - Agronomic recommendations          |
|  [ EvaluationTimeline Stepper ]         |                                         |
|  - 6 Sentinel-2 passes                  |  OR: [ Vista Analista FIRA ]            |
|  - Active phenological stage card       |    - Tab 1: Simulador Financiero & SHAP |
|                                         |    - Tab 2: Modelo & Preguntas FIRA     |
|                                         |    - Tab 3: Inferencia en Vivo          |
|                                         |    - Tab 4: Tabla de 197 Parcelas       |
+-----------------------------------------+-----------------------------------------+
```

### Vista Agricultor (`src/components/FarmerView.tsx`)
Designed for barley growers with simple language, high-contrast indicators, and zero unnecessary technical jargon:
- **Header**: Producer name, parcel identity, municipality, area (ha), and variety (`Esperanza`, `Esmeralda`, `Adabella`, `Doña Josefa`).
- **Yield Gauge**: Expected harvest in `t/ha` benchmarked against the municipal historical average with color-coded tags (`Óptimo`, `Normal`, `Bajo`).
- **Financial Projections**: Total expected metric tons and estimated net profit after production expenses.
- **Sub-Lot Carousel**: Horizontal cards for `Lote A`, `Lote B`, and `Lote C` showing soil type, slope, moisture status, and targeted agronomic tasks.
- **Tooltips & Microcopy**: Contextual descriptions are accessible on hover/focus to prevent vertical page bloat.

### Vista Analista FIRA (`src/components/AnalystView.tsx`)
Designed for FIRA credit technical officers, underwriters, and hackathon judges across 4 specialized tabs:
1. **Simulador Financiero & SHAP**:
   - Dynamic parameter sliders: barley price per ton ($5,000–$11,000 MXN), production cost ($11,000–$25,000 MXN), simulated climate shock (-30% to +30%), FEGA guarantee coverage (50%–90%), and credit interest rate (8%–18%).
   - Metrics: Regional Net Margin, Portfolio ROI, Debt Service Coverage Ratio (DSCR), and FEGA guarantee capital protected.
   - **SHAP Attribution Breakdown**: Explains the exact contribution (+/- t/ha) of vegetation indices, climate variables, and terrain features.
2. **Modelo & Preguntas Guía**:
   - Cross-validation performance table: RMSE, MAE, R², and MAPE for LightGBM, XGBoost, Random Forest, and Ridge models.
   - Direct empirical answers to the 3 mandatory FIRA Guide Questions:
     - *Q1*: Which vegetation indices correlate highest with final yield? (NDVI & NDWI during Espigado/Floración).
     - *Q2*: What is the relative weight of remote sensing vs agroclimatic data? (~65% satellite indices, ~35% weather/soil).
     - *Q3*: How does the model mitigate spatial autocorrelation between contiguous parcels? (Spatial Block K-Fold CV by municipality).
3. **Predicción en Vivo**:
   - Interactive inference form allowing real-time parameter tweaking (state, altitude, water regime, satellite indices, rainfall, temperature, GDD).
   - Submits to `POST /api/predict` with immediate fallback to an internal regression estimator.
4. **Tabla de Parcelas**:
   - Complete 197-row interactive grid with state filter, split filter (`train` vs `eval`), sorting, and one-click CSV export of the 30% evaluation set.

---

## 3. Tech Stack & Design System

### Core Technologies
- **Runtime & UI**: React 18.3, TypeScript 5.6, Vite 6.0.
- **Styling**: Tailwind CSS 3.4 with custom Material Design 3 tokens.
- **Mapping**: MapLibre GL JS 4.7 with Carto raster basemaps (`https://cartodb-basemaps-a.global.ssl.fastly.net/rastertiles/voyager/{z}/{x}/{y}{r}.png`).
- **Icons**: Lucide React (`lucide-react`).

### Material Design 3 (Material You) Foundation
All styling follows Material 3 principles: tonal surfaces, clear elevation hierarchy, full pill buttons, and readable typography.

- **Color Tokens** (`tailwind.config.js` -> `colors.m3`):
  - Primary: `#2F6A3A` (`bg-m3-primary`, `text-m3-primary`)
  - Primary Container: `#B3F1B6` / On-Primary Container: `#00210A`
  - Secondary Container: `#D4E8D0` / On-Secondary Container: `#0F1F10`
  - Tertiary (Amber/Barley): `#7B5800` / Tertiary Container: `#FFDEA4`
  - Error: `#BA1A1A` / Error Container: `#FFDAD6`
  - Info: `#00639B` / Info Container: `#CDE5FF`
  - Surface Tones: `surface` (`#F7FBF2`), `surface-container-low` (`#F1F5EC`), `surface-container` (`#EBEFE6`), `surface-container-high` (`#E5E9E1`), `surface-container-highest` (`#E0E4DB`)
  - Inverse Surface: `#2D322C` (used for MapLibre popups)
- **Typography Scale**:
  - Loaded font: **Roboto Flex** (UI text) and **Roboto Mono** (parcel IDs and code).
  - Scale: `display-s`, `headline-m`, `headline-s`, `title-l`, `title-m`, `title-s`, `body-l`, `body-m`, `body-s`, `label-l`, `label-m`, `label-s`.
  - Tabular numbers: Always use the `tabular-nums` class on numeric data.
- **Shape & Elevation**:
  - Radii: `rounded-m3-xs` (4px), `rounded-m3-sm` (8px), `rounded-m3-md` (12px), `rounded-m3-lg` (16px), `rounded-m3-xl` (28px), `rounded-full`.
  - Shadows: `shadow-m3-1`, `shadow-m3-2`, `shadow-m3-3` (strictly reserved for floating elements like overlays, dialogs, and FABs).

### Shared Primitives (`src/components/ui/`)
All UI primitives are exported from `src/components/ui/index.ts`:
- **`Button`**: Pill button with variants (`filled`, `tonal`, `outlined`, `text`, `elevated`), sizes (`sm`, `md`), and `.state-layer`.
- **`IconButton`**: 40x40 circular button, requires `aria-label`, supports variants and `selected` toggle.
- **`FilterChip`**: Compact filter button with 8px radius, selection checkmark, and count badge.
- **`Tag`**: Non-interactive status pill with semantic tones (`primary`, `secondary`, `tertiary`, `error`, `info`, `neutral`).
- **`SegmentedButton<T>`**: Outlined container with pill boundaries and single-choice segments.
- **`Card`** & **`CardHeader`**: M3 tonal container with variants (`filled`, `outlined`, `elevated`, `tonal-*`).
- **`Tabs<T>`**: Primary M3 tab bar with keyboard navigation (ArrowLeft/ArrowRight) and content-width active indicator.
- **`Slider`**: Range input with live percentage fill (`--fill`), value badge, and non-overlapping mark labels.
- **`Metric`**: Uniform label/value/supporting display with `tabular-nums`.
- **`cn`**: Lightweight class concatenator (`(string | false | null | undefined)[] => string`).

---

## 4. Directory Structure & Key Files

```
├── .gitignore                      # Standard ignores (node_modules, dist, .env, etc.)
├── index.html                      # Entry HTML with Roboto Flex + Roboto Mono fonts
├── package.json                    # Scripts and dependencies
├── tailwind.config.js              # M3 color tokens, typography scale, radii, shadows
├── vite.config.ts                  # Vite configuration with React plugin
├── src/
│   ├── main.tsx                    # React DOM entry point
│   ├── App.tsx                     # Main layout shell, state coordinator, top app bar
│   ├── index.css                   # MapLibre CSS, M3 slider, scrollbar, and state-layers
│   ├── types/
│   │   └── agro.ts                 # Frozen TypeScript interfaces and domain models
│   ├── services/
│   │   └── api.ts                  # Backend communication, local mock fallback, CSV export
│   ├── data/
│   │   └── mockBarleyDataset.ts    # 197 georeferenced parcels with evaluations and metrics
│   └── components/
│       ├── ParcelMap.tsx           # MapLibre GL 4 map, polygon layers, popup card, legend
│       ├── EvaluationTimeline.tsx  # 6-step Sentinel-2 phenological date selector
│       ├── FarmerView.tsx          # Producer-focused view (yield, income, sub-lots)
│       ├── AnalystView.tsx         # FIRA analyst console (Simulator, Model, Predict, Table)
│       ├── BackendConnectModal.tsx # Dialog to connect external API or import custom JSON
│       └── ui/                     # Material 3 design system primitives
│           ├── Button.tsx
│           ├── IconButton.tsx
│           ├── Chip.tsx            # FilterChip and Tag
│           ├── SegmentedButton.tsx
│           ├── Card.tsx            # Card and CardHeader
│           ├── Tabs.tsx
│           ├── Slider.tsx
│           ├── Metric.tsx
│           ├── cn.ts
│           └── index.ts            # Re-exports all primitives
```

---

## 5. Backend Integration & API Contracts

AgroCebada works **100% autonomously out of the box** using the realistic 197-parcel synthetic dataset generated in `src/data/mockBarleyDataset.ts`. When a backend service (FastAPI, Flask, Express, Django) is running, the frontend seamlessly connects to it.

### Configuration
1. **Environment Variables**:
   ```bash
   VITE_API_URL=http://localhost:8000
   # or:
   VITE_BACKEND_URL=http://localhost:8000
   ```
2. **In-App Modal (`BackendConnectModal`)**:
   Clicking the server icon in the top app bar opens the connection manager, allowing users to:
   - Enter a custom backend URL (stored in `localStorage`).
   - Test connectivity with health ping.
   - Upload a custom GeoJSON/JSON dataset directly.

### Expected Backend Endpoints
- **`GET /api/parcels`**:
  - Response: Array of `BarleyParcel` objects or `{ parcels: BarleyParcel[] }`.
  - Fallback: `generate197BarleyParcels()` from `mockBarleyDataset.ts`.
- **`GET /api/model-insights`**:
  - Response: `ModelInsightsPayload` containing cross-validation metrics, guide question answers, and feature importance.
  - Fallback: `INITIAL_MODEL_INSIGHTS`.
- **`POST /api/predict`**:
  - Request Body (`LivePredictionInput`):
    ```json
    {
      "state": "Hidalgo",
      "altitudeM": 2480,
      "regime": "Temporal",
      "ndviEspigado": 0.76,
      "ndwiLlenado": 0.28,
      "eviEncanado": 0.52,
      "precipJulAgoMm": 240,
      "tempMinSepC": 6.8,
      "gddTotal": 1420
    }
    ```
  - Response (`LivePredictionResponse`):
    ```json
    {
      "predictedYieldTonHa": 4.18,
      "confidenceInterval": [3.82, 4.54],
      "firaCreditScore": 84,
      "riskLevel": "Bajo",
      "source": "backend"
    }
    ```

---

## 6. Development & Verification Workflow

### Getting Started
```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Compile and verify TypeScript types
npx tsc -b

# 4. Build for production
npm run build
```

### Environment Variables (`.env`)
Create a `.env` file in the project root:
```env
# Optional: MapLibre tile key (CartoCDN voyager works without key, but key can be passed)
VITE_MAP_API_KEY=

# Optional: Dedicated ML/Python backend URL
VITE_API_URL=http://localhost:8000
VITE_BACKEND_URL=http://localhost:8000
```

---

## 7. Autonomous Agent Guidelines & Invariants

When extending or refactoring this codebase, AI agents must preserve the following architectural contracts:

1. **Frozen Interfaces**:
   - Do NOT alter exported signatures in `src/types/agro.ts` without explicit migration steps.
   - Do NOT change the props interface of `ParcelMap`, `EvaluationTimeline`, `FarmerView`, `AnalystView`, or `BackendConnectModal`. `App.tsx` expects these exact signatures.
2. **Material 3 Token Integrity**:
   - Never introduce ad-hoc hex values or arbitrary color classes. Use the defined `m3-*` color tokens (`bg-m3-surface`, `text-m3-on-surface`, `border-m3-outline-variant`, etc.).
   - Rely on `src/components/ui/` primitives instead of re-inventing buttons, cards, tabs, or chips.
3. **TypeScript Strictness**:
   - Always run `npx tsc -b` before completing any task. The build must produce **0 errors**. Avoid `any` types where strict domain models exist.
4. **Responsive Layout Discipline**:
   - Test layouts from 360px (mobile) to 1920px (desktop monitors).
   - In desktop view (`lg:`), the left map pane must remain sticky and viewport-bounded (`h-[calc(100vh-64px-16px)]`); it must never stretch vertically alongside long sheets.
5. **No Monospace Overuse**:
   - Monospace font (`font-mono` / Roboto Mono) is reserved exclusively for parcel identifiers (e.g., `P-HGO-001`) and code snippets.
   - All standard numeric data must use standard text with the `tabular-nums` class.
6. **Sentence Case & Language**:
   - Keep all user-facing copy in **Spanish**, using sentence case (e.g., *"Evaluación 30%"*, not *"EVALUACION"*).
