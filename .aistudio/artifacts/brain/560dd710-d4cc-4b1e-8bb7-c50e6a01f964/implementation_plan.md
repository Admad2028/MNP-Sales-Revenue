# India Client Origin Heat Map & Geographic Analytics

Interactive geographic heat map visualization of client origin cities across India derived from Column K data in September and October Google Sheet records, featuring multi-month filtering, frequency-based heat halo styling, and granular order metrics.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and UX decisions were confirmed during the interactive clarification phase:

- **Visualization Style**: Interactive city bubbles with radial heat density halos layered over an accurate India regional map. Areas with no orders remain clean white/neutral; areas with 1 order are highlighted in light red, and repeat origin cities (>1 order) render in deep dark red with concentrated heat halos.
- **Section Placement**: Integrated as an expandable analytics section within the primary dashboard (located directly alongside efficiency and distribution analytics, above the raw records log).
- **Multi-City Attribution**: Multi-city entries (such as `"Pune, Lucknow"`, `"Mumbai, Bangalore"`, and `"Banglore,Chennai"`) are split into distinct individual city records so each participating city receives appropriate order credit and heat intensity.
- **Data Hygiene**: Exclude placeholders (`"0"`, `"-"`, empty values) and normalize common naming variants (e.g. `Banglore` / `Bangalore` / `bengluru` $\rightarrow$ `Bengaluru`, `Lacknow` $\rightarrow$ `Lucknow`, `pitumpur` $\rightarrow$ `Pithampur`, `Greater noida` $\rightarrow$ `Greater Noida`).

---

## 1. Overview & Core Concept

- **What It Does**: Parses the `originCity` (Column K) data across September and October records, computes city-level order frequencies and revenues, and renders an interactive SVG map of India. Users can toggle between **September 2026**, **October 2026**, or **Both (September & October)** to observe client demand geographic shifts and repeat-order hotspots.
- **Target Audience / Persona**: Sales directors and operations executives seeking to identify geographical clusters of high-converting clients, regional marketing traction, and multi-city order distributions.
- **Key Value**: Replaces raw text sheet inspections with instant visual clarity on geographic market penetration and client concentration across India.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. *Expand/Collapse Section*: Users can toggle the "Client Origin Heat Map (India)" analytics section open or closed from the main dashboard.
  2. *Month Filter Toggle*: Quick segmented buttons: **September**, **October**, and **Sep + Oct (Consensus)**.
  3. *Map Hover & Inspection*: Hovering over any city bubble reveals an interactive tooltip with city name, state, total order count, total deal revenue generated, and individual order dates/reps.
  4. *City Breakdown Ledger*: A side-by-side or stacked ranked list of top client cities with tabular numbers, percentage shares, and repeat-buyer tags.
- **Visual Identity & Theme**:
  - *Color Progression*: 
    - Zero orders / Non-client areas: `#FFFFFF` / clean `#F8FAFC` base surface with subtle border stroke `#E2E8F0`.
    - Single order city: `#FCA5A5` (light coral/rose) with soft 12px blur halo.
    - Multiple orders (>1): `#DC2626` to `#7F1D1D` (dark intense crimson) with pulsing radial gradient heat halo (`rgba(185, 28, 28, 0.45)`).
  - *Typography*: Display headings in `Plus Jakarta Sans` with `tabular-nums` for all order counts and currency values (`₹`).
  - *Zero-Pill Restraint*: Unboxed metadata with quiet typographic bullet separators (`·`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: SVG Map Projection vs. Heavy External Tile Map**
  - *Chosen Approach*: Self-contained, responsive India SVG map with mathematically projected coordinate pins (equirectangular/Mercator bounds $68^\circ\text{E} - 97.5^\circ\text{E}$, $8^\circ\text{N} - 37^\circ\text{N}$).
  - *Why*: Zero third-party tile loading latency, hermetic offline reliability, smooth vector scaling, and seamless Tailwind CSS dark/light theme integration.
  - *Alternatives Considered*: Leaflet or Google Maps tiles (rejected due to excessive network bundle size, external tile authentication requirements, and slower initial render).
- **Decision 2: Dedicated Month Filtering vs Global Date Overwrite**
  - *Chosen Approach*: Provide dedicated in-section month filters (September, October, Both) that allow instant geographic comparison without disturbing the user's broader active date range in the KPI cards above.
  - *Why*: Enables rapid switching between September and October client origins as explicitly requested in the prompt, while also synchronizing cleanly with the overall dataset.

---

## 4. Technical Architecture & Data Strategy

```
┌───────────────────────────────────────────────────────────────┐
│                     Google Sheet Records                      │
│   (September & October Rows with Column K "originCity")       │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│               originCityParser & Normalizer                   │
│   - Split delimited entries ("Pune, Lucknow" -> 2 cities)     │
│   - Filter out invalid tokens ("0", "-", "")                  │
│   - Canonicalize spelling variants (Banglore -> Bengaluru)    │
│   - Map each city to Lat/Long coordinates                     │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                   IndiaOriginHeatMap Component                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Controls: [September] [October] [Both (Consensus)]      │  │
│  ├────────────────────────────┬────────────────────────────┤  │
│  │ Interactive India SVG Map  │ Ranked City Performance    │  │
│  │ - White base / neutral     │ - Order Counts (tabular)   │  │
│  │ - Light red (1 order)      │ - Total Sales Revenue (₹)  │  │
│  │ - Dark crimson (>1 order)  │ - Repeat Hotspot Badges    │  │
│  │ - Radial heat halo filters │ - Rep breakdown            │  │
│  │ - Hover tooltip card       │                            │  │
│  └────────────────────────────┴────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

- **City Coordinates Registry**: Geocoded dictionary of all Indian origin cities appearing in the company's dataset (Delhi, Mumbai, Bengaluru/Bangalore, Pune, Lucknow, Hyderabad, Chennai, Kolkata, Indore, Gwalior, Burhanpur, Bikaner, Pithampur, Baran/Rajasthan, Greater Noida, etc.).
- **Heat Computation**:
  $$\text{Intensity}(c) = \begin{cases} 0 & \text{count} = 0 \\ 1 & \text{count} = 1 \\ 2 + \log_2(\text{count}) & \text{count} > 1 \end{cases}$$
- **State Integration**: Managed inside `src/components/IndiaOriginHeatMap.tsx`, mounted into `src/App.tsx` between the efficiency cards and the detailed sheet record table.
