# Livestock Spatial & Epidemiological Analytics Suite (UI Inspiration Workbench)

A standalone, zero-build HTML5 / CSS3 / ES6 JavaScript data visualization and spatial epidemiology workbench designed for inspecting livestock farmer reports, Uber H3 hexagonal disease clusters, thermal mortality heatmaps, clinical symptom-to-pathogen correlations, and veterinary doctor / agro-vet pharmacy routing performance.

## Included Views & Modules

1. **`01 Spatial H3 & Heatmap` (CARTO Builder Style)**
   - Interactive Leaflet.js map with **305+ H3 hexagonal cells** colored on a perceptual `Teal -> Violet -> Magenta` ramp.
   - Instant toggle between **H3 Hex Grid**, **Thermal Heatmap** (`Leaflet.heat`), and **Hex + Vet Pins**.
   - **CARTO Right-Hand Analytical Dock**: Top 5 Hex Hotspots with emerald progress bars, Hero Telemetry Counter, Center-Labeled Disease Donut, and Species Headcount Breakdown.
2. **`02 Executive Analytics Suite` (Multi-Chart Console)**
   - 4-Column Top-Kicker KPI Strip.
   - **Row 1**: Primary Symptom Share Donut (`34% / 66%` center label), 12-Week Multi-Pathogen Outbreak Velocity Line Chart, and 4-Tier Case Resolution Horizontal Funnel.
   - **Row 2**: Regional LGA Grouped Bar Chart (Recorded Deaths vs. Active Reports vs. Vet Dispatches) + Flock/Herd Size Cohort Histogram.
   - **Row 3**: Species Vulnerability Stacked Bars, 7-Day Containment Rate Green Bars, and Pharmacy/Doctor SLA Ring Chart.
   - **Footer**: 4-Column Diagnostic Summary Checklists.
3. **`03 Symptom-Disease Matrix`**
   - 6x6 Clinical Symptom-to-Pathogen Co-Occurrence Probability Heatmap Table.
   - Transmission Velocity ($R_0$ Proxy) vs. Case Fatality Rate (%) Bubble Chart.
   - 12-Month Harmattan vs. Rainy Season Climatic Correlation Curve.
4. **`04 Vet & Store Dispatch`**
   - Farmer-to-Vet Distance vs. Turnaround Latency Chart.
   - Triage Channel Split across Species.
   - Live Veterinary Referral Clinic & Agro-Vet Supply Depot Directory + Filtered Farmer Dispatch Stream.
5. **`05 Layout Architecture Lab`**
   - 1-click layout topology switcher (Right-Dock vs. Bottom-Tray vs. Executive Multi-Chart Console) and 3-Theme Switcher (`CARTO Clean Light`, `Obsidian Dark Command`, `Warm Paper Technical`).

## Running Locally

Open `index.html` directly in any browser or serve locally:

```bash
npx serve . -l 4173
```
