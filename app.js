// ============================================================================
// CORE CONTROLLER: SPATIAL H3 MAP, HEATMAPS, EXECUTIVE CHARTS & LIVE FILTERS
// ============================================================================

const state = {
  region: "ALL",
  species: "ALL",
  symptom: "ALL",
  disease: "ALL",
  metric: "recordedDeaths",
  mapLayerMode: "hex", // 'hex' | 'heat' | 'both'
  baseMapStyle: "satellite"
};

let mapInstance = null;
let tileLayerInstance = null;
let hexLayerGroup = null;
let heatLayerInstance = null;
let vetPinsLayerGroup = null;

// Chart.js Registry
const charts = {};

// CARTO Builder Color Ramp (Teal -> Cyan -> Lavender -> Pink -> Deep Magenta)
// Matches uploaded Image 1 ("Colorado Cell Towers" CARTO H3 hex grid)
function getCartoHexColor(normValue) {
  const v = Math.max(0, Math.min(1, normValue));
  if (v < 0.22) return "#5eead4"; // Light Seafoam Teal
  if (v < 0.42) return "#2dd4bf"; // Medium Teal
  if (v < 0.60) return "#818cf8"; // Indigo-Violet Transition
  if (v < 0.78) return "#e879f9"; // Vibrant Pink-Magenta
  if (v < 0.90) return "#c026d3"; // Deep Fuchsia
  return "#86198f";               // Critical Outbreak Core Purple-Magenta
}

function getMetricLabel(metricKey) {
  const labels = {
    recordedDeaths: "Recorded Animal Deaths",
    reportsCount: "Farmer Intake Reports",
    herdSize: "Total Animals Affected",
    routedToVet: "Cases Routed to Vet / Store"
  };
  return labels[metricKey] || "Recorded Animal Deaths";
}

function getFilteredHexCells() {
  return window.H3_HEX_CELLS.filter((cell) => {
    if (state.region !== "ALL" && cell.clusterId !== state.region) return false;
    if (state.species !== "ALL" && cell.species !== state.species) return false;
    if (state.symptom !== "ALL" && cell.symptom !== state.symptom) return false;
    if (state.disease !== "ALL" && cell.disease !== state.disease) return false;
    return true;
  });
}

// ============================================================================
// 1. INITIALIZE LEAFLET MAP & CARTO H3 HEXAGONAL LATTICE
// ============================================================================
function initSpatialMap() {
  mapInstance = L.map("h3Map", {
    center: [9.35, 7.65], // Centered across Nigeria's livestock corridors
    zoom: 7,
    zoomControl: false
  });

  L.control.zoom({ position: "bottomright" }).addTo(mapInstance);

  setBaseMapTiles(state.baseMapStyle);

  hexLayerGroup = L.layerGroup().addTo(mapInstance);
  vetPinsLayerGroup = L.layerGroup().addTo(mapInstance);

  renderSpatialLayers();
}

function setBaseMapTiles(styleKey) {
  if (tileLayerInstance) {
    mapInstance.removeLayer(tileLayerInstance);
  }

  const urls = {
    // Esri World Imagery + Labels hybrid look (matches terrain/satellite texture in Image 1)
    satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
  };

  tileLayerInstance = L.tileLayer(urls[styleKey] || urls.satellite, {
    maxZoom: 18,
    attribution: "&copy; CARTO / Esri Spatial Telemetry"
  }).addTo(mapInstance);
}

function renderSpatialLayers() {
  if (!mapInstance) return;

  hexLayerGroup.clearLayers();
  vetPinsLayerGroup.clearLayers();
  if (heatLayerInstance) {
    mapInstance.removeLayer(heatLayerInstance);
    heatLayerInstance = null;
  }

  const cells = getFilteredHexCells();
  const metricKey = state.metric;

  const maxVal = Math.max(1, ...cells.map((c) => c[metricKey]));

  // 1. Render H3 Hexagonal Grid Polygons
  if (state.mapLayerMode === "hex" || state.mapLayerMode === "both") {
    cells.forEach((cell) => {
      const norm = cell[metricKey] / maxVal;
      const fillColor = getCartoHexColor(norm);

      const poly = L.polygon(cell.vertices, {
        color: "rgba(255, 255, 255, 0.55)",
        weight: 1,
        fillColor: fillColor,
        fillOpacity: 0.68
      });

      poly.on("mouseover", function () {
        this.setStyle({
          weight: 2.5,
          color: "#ffffff",
          fillOpacity: 0.88
        });
        updateHexInspector(cell);
      });

      poly.on("mouseout", function () {
        this.setStyle({
          weight: 1,
          color: "rgba(255, 255, 255, 0.55)",
          fillOpacity: 0.68
        });
      });

      poly.on("click", function () {
        updateHexInspector(cell);
        mapInstance.panTo([cell.lat, cell.lng]);
      });

      poly.bindTooltip(
        `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;">
          <strong>${cell.h3Index}</strong><br/>
          Zone: ${cell.lga} (${cell.state})<br/>
          Species: ${cell.species.toUpperCase()} | ${cell.disease}<br/>
          Deaths: <b>${cell.recordedDeaths}</b> | Reports: <b>${cell.reportsCount}</b>
        </div>`,
        { sticky: true }
      );

      hexLayerGroup.addLayer(poly);
    });
  }

  // 2. Render Thermal Heatmap Layer
  if (state.mapLayerMode === "heat" && typeof L.heatLayer === "function") {
    const heatPoints = cells.map((c) => [
      c.lat,
      c.lng,
      Math.min(1, c[metricKey] / maxVal)
    ]);
    heatLayerInstance = L.heatLayer(heatPoints, {
      radius: 28,
      blur: 20,
      maxZoom: 10,
      gradient: {
        0.2: "#2dd4bf",
        0.5: "#818cf8",
        0.75: "#e879f9",
        1.0: "#dc2626"
      }
    }).addTo(mapInstance);
  }

  // 3. Render Veterinary Doctor & Agro-Vet Store Pins
  if (state.mapLayerMode === "both") {
    window.VET_CENTERS.forEach((vet) => {
      const marker = L.circleMarker([vet.lat, vet.lng], {
        radius: 7,
        fillColor: "#0284c7",
        color: "#ffffff",
        weight: 2,
        fillOpacity: 1
      });

      marker.bindPopup(
        `<div style="font-family:'Inter',sans-serif;font-size:12px;">
          <div style="font-weight:700;color:#0284c7;margin-bottom:3px;">${vet.name}</div>
          <div>Type: <b>${vet.type}</b></div>
          <div>Location: ${vet.lga}, ${vet.state}</div>
          <div>Cases Routed: <b>${vet.routedCases}</b> (${vet.fulfillmentRate}% fulfilled)</div>
        </div>`
      );
      vetPinsLayerGroup.addLayer(marker);
    });
  }

  if (cells.length > 0) {
    updateHexInspector(cells[0]);
  }

  updateCartoRightDock(cells);
}

function updateHexInspector(cell) {
  document.getElementById("inspIndex").textContent = `H3 INDEX: ${cell.h3Index.toUpperCase()}`;
  document.getElementById("inspZone").textContent = `${cell.lga} (${cell.state} State)`;
  document.getElementById("inspDeaths").textContent = cell.recordedDeaths.toLocaleString();
  document.getElementById("inspReports").textContent = cell.reportsCount.toLocaleString();
  document.getElementById("inspSpecies").textContent = cell.species.toUpperCase();
  document.getElementById("inspDisease").textContent = cell.disease;
}

// ============================================================================
// 2. UPDATE CARTO RIGHT-HAND WIDGET DOCK (IMAGE 1 WIDGETS)
// ============================================================================
function updateCartoRightDock(cells) {
  const metricKey = state.metric;
  const metricTitle = getMetricLabel(metricKey);

  document.getElementById("activeHexCounter").textContent = `${cells.length} H3 CELLS`;
  document.getElementById("legendMetricLabel").textContent = `${metricTitle} per Hex Cell`;

  // Big Hero Counter
  const totalMetricVal = cells.reduce((acc, c) => acc + c[metricKey], 0);
  const totalReports = cells.reduce((acc, c) => acc + c.reportsCount, 0);
  const totalRouted = cells.reduce((acc, c) => acc + c.routedToVet, 0);
  const routedPct = totalReports > 0 ? ((totalRouted / totalReports) * 100).toFixed(1) : "0.0";

  document.getElementById("widgetBigCounterTitle").textContent = `Total ${metricTitle}`;
  document.getElementById("widgetBigCounterVal").textContent = totalMetricVal.toLocaleString();
  document.getElementById("widgetBigCounterSub").textContent =
    `Across ${totalReports.toLocaleString()} farmer reports | ${routedPct}% routed to nearby vets`;

  // Top 5 Hex Cells Horizontal Progress Bars (Exact Image 1 Top Widget Style)
  const sortedHexes = [...cells].sort((a, b) => b[metricKey] - a[metricKey]).slice(0, 5);
  const topMax = sortedHexes.length > 0 ? sortedHexes[0][metricKey] : 1;

  const topHexContainer = document.getElementById("widgetTopHexList");
  topHexContainer.innerHTML = sortedHexes
    .map((cell) => {
      const widthPct = Math.max(8, Math.round((cell[metricKey] / topMax) * 100));
      return `
        <div class="carto-rank-item" onclick="focusHexCell('${cell.h3Index}')">
          <div class="carto-rank-row">
            <span class="carto-rank-label">${cell.h3Index.slice(0, 10)} / ${cell.state}</span>
            <span class="carto-rank-val">${cell[metricKey].toLocaleString()}</span>
          </div>
          <div class="carto-bar-track">
            <div class="carto-bar-fill" style="width: ${widthPct}%;"></div>
          </div>
        </div>
      `;
    })
    .join("");

  // Species Breakdown Progress Bars
  const speciesTotals = {};
  cells.forEach((c) => {
    speciesTotals[c.species] = (speciesTotals[c.species] || 0) + c.herdSize;
  });
  const speciesEntries = Object.entries(speciesTotals).sort((a, b) => b[1] - a[1]);
  const maxSpeciesHerd = speciesEntries.length > 0 ? speciesEntries[0][1] : 1;
  const speciesColors = {
    poultry: "#0284c7",
    cattle: "#10b981",
    goats: "#8b5cf6",
    sheep: "#f59e0b",
    swine: "#ec4899"
  };

  document.getElementById("widgetSpeciesBreakdown").innerHTML = speciesEntries
    .map(([sp, count]) => {
      const pct = Math.max(6, Math.round((count / maxSpeciesHerd) * 100));
      return `
        <div class="carto-rank-item">
          <div class="carto-rank-row">
            <span class="carto-rank-label">${sp.toUpperCase()}</span>
            <span class="carto-rank-val">${count.toLocaleString()} head</span>
          </div>
          <div class="carto-bar-track">
            <div class="carto-bar-fill" style="width:${pct}%;background:${speciesColors[sp] || '#10b981'};"></div>
          </div>
        </div>
      `;
    })
    .join("");

  // Update CARTO Dock Donut Chart
  const diseaseTotals = {};
  cells.forEach((c) => {
    diseaseTotals[c.disease] = (diseaseTotals[c.disease] || 0) + c.reportsCount;
  });
  const disEntries = Object.entries(diseaseTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const disSum = disEntries.reduce((s, e) => s + e[1], 0) || 1;

  if (disEntries.length > 0) {
    const topDisPct = ((disEntries[0][1] / disSum) * 100).toFixed(1);
    document.getElementById("dockDonutPct").textContent = `${topDisPct}%`;
    document.getElementById("dockDonutLabel").textContent = disEntries[0][0].split(" ")[0].toUpperCase();
  }

  if (charts.cartoDockDonut) {
    charts.cartoDockDonut.data.labels = disEntries.map((e) => e[0]);
    charts.cartoDockDonut.data.datasets[0].data = disEntries.map((e) => e[1]);
    charts.cartoDockDonut.update();
  }
}

window.focusHexCell = function (h3Index) {
  const found = window.H3_HEX_CELLS.find((c) => c.h3Index === h3Index);
  if (found && mapInstance) {
    updateHexInspector(found);
    mapInstance.setView([found.lat, found.lng], 9);
  }
};

// ============================================================================
// 3. INITIALIZE & SYNC ALL CHART.JS ANALYTICS PANELS (VIEWS 1, 2, 3, 4)
// ============================================================================
function initAllCharts() {
  const fontFamily = "'Inter', sans-serif";
  Chart.defaults.font.family = fontFamily;
  Chart.defaults.font.size = 11;
  Chart.defaults.color = "#64748b";

  // 1. CARTO Right-Dock Donut (Image 1 Bottom-Right Ring)
  charts.cartoDockDonut = new Chart(document.getElementById("cartoDockDonut"), {
    type: "doughnut",
    data: {
      labels: ["Newcastle", "FMD", "PPR", "ASF", "Coccidiosis"],
      datasets: [
        {
          data: [38, 24, 18, 12, 8],
          backgroundColor: ["#10b981", "#7c3aed", "#0284c7", "#f59e0b", "#ec4899"],
          borderWidth: 2,
          borderColor: "#ffffff"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "74%",
      plugins: {
        legend: { display: false }
      }
    }
  });

  // 2. Executive View Top-Left Donut (Matches Image 2 "29% 200%" Red/Blue Ring)
  charts.execSymptomDonut = new Chart(document.getElementById("execSymptomDonut"), {
    type: "doughnut",
    data: {
      labels: [
        "Respiratory Signs",
        "Hemorrhagic / Acute",
        "Digestive / Blisters",
        "Neurological",
        "Sudden Mortality"
      ],
      datasets: [
        {
          data: [34, 26, 18, 12, 10],
          backgroundColor: ["#0284c7", "#dc2626", "#2563eb", "#f59e0b", "#0d9488"],
          borderWidth: 2,
          borderColor: "#ffffff"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 10, padding: 8, font: { size: 10 } }
        }
      }
    }
  });

  // 3. Executive View Top-Center Multi-Line Chart (Matches Images 2 & 3 Multi-Line Curves)
  charts.execMultiLineChart = new Chart(document.getElementById("execMultiLineChart"), {
    type: "line",
    data: {
      labels: ["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Wk 5", "Wk 6", "Wk 7", "Wk 8", "Wk 9", "Wk 10", "Wk 11", "Wk 12"],
      datasets: [
        {
          label: "Recorded Animal Deaths",
          data: [420, 580, 740, 690, 950, 1120, 1340, 1290, 1580, 1420, 1790, 1940],
          borderColor: "#dc2626",
          backgroundColor: "rgba(220, 38, 38, 0.08)",
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.25
        },
        {
          label: "Farmer Symptom Reports",
          data: [310, 440, 520, 610, 680, 790, 880, 940, 1050, 1180, 1310, 1490],
          borderColor: "#0284c7",
          backgroundColor: "rgba(2, 132, 199, 0.08)",
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.25
        },
        {
          label: "Routed to Vet / Store",
          data: [240, 360, 410, 490, 560, 670, 750, 820, 910, 1020, 1150, 1320],
          borderColor: "#d97706",
          backgroundColor: "rgba(217, 119, 6, 0.08)",
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.25
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          align: "end",
          labels: { boxWidth: 10, usePointStyle: false }
        }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: "rgba(148, 163, 184, 0.2)" } },
        x: { grid: { display: false } }
      }
    }
  });

  // 4. Executive View Top-Right Horizontal Triage Funnel
  charts.execRoutingFunnelChart = new Chart(document.getElementById("execRoutingFunnelChart"), {
    type: "bar",
    data: {
      labels: ["Agro-Vet Pharmacy", "Licensed Vet Doctor", "Biosecurity Self-Care", "State Epi Alert"],
      datasets: [
        {
          label: "Dispatched Cases",
          data: [4420, 2610, 2190, 1309],
          backgroundColor: ["#0284c7", "#0d9488", "#6366f1", "#dc2626"],
          borderRadius: 2
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "rgba(148, 163, 184, 0.2)" } },
        y: { grid: { display: false } }
      }
    }
  });

  // 5. Executive View Mid-Left Dense Grouped Bar Chart (Matches Image 2 Red/Blue Grouped Bars)
  charts.execGroupedBarChart = new Chart(document.getElementById("execGroupedBarChart"), {
    type: "bar",
    data: {
      labels: [
        "Jos South",
        "Barkin Ladi",
        "Egbeda (Oyo)",
        "Akinyele",
        "Kura (Kano)",
        "Dawakin Kudu",
        "Makurdi",
        "Gboko",
        "Sabon Gari",
        "Giwa"
      ],
      datasets: [
        {
          label: "Recorded Deaths",
          data: [1820, 1540, 1980, 1410, 1620, 1190, 1340, 980, 1490, 1120],
          backgroundColor: "#dc2626",
          borderRadius: 2
        },
        {
          label: "Active Farmer Reports",
          data: [1240, 1080, 1520, 1190, 1110, 890, 940, 760, 1020, 780],
          backgroundColor: "#0284c7",
          borderRadius: 2
        },
        {
          label: "Vet Store Dispatches",
          data: [980, 870, 1310, 950, 890, 710, 780, 620, 840, 640],
          backgroundColor: "#f59e0b",
          borderRadius: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", align: "end", labels: { boxWidth: 10 } }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: "rgba(148, 163, 184, 0.2)" } },
        x: { grid: { display: false } }
      }
    }
  });

  // 6. Executive View Mid-Right Herd Size Cohort Histogram
  charts.execHerdCohortChart = new Chart(document.getElementById("execHerdCohortChart"), {
    type: "bar",
    data: {
      labels: ["1-50 Head", "51-200 Head", "201-500 Head", "501-1,000 Head", "1,001-2,500", "2,500+ Commercial"],
      datasets: [
        {
          label: "Mean Flock Mortality Rate (%)",
          data: [8.4, 6.9, 5.2, 4.1, 3.3, 2.1],
          backgroundColor: "#0284c7",
          borderRadius: 2
        },
        {
          label: "Unvaccinated Share (%)",
          data: [42.0, 31.5, 22.0, 14.8, 9.2, 4.5],
          backgroundColor: "#94a3b8",
          borderRadius: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", align: "end", labels: { boxWidth: 10 } }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: "rgba(148, 163, 184, 0.2)" } },
        x: { grid: { display: false } }
      }
    }
  });

  // 7. Executive View Bottom-Left Species Stacked Chart (Matches Image 3 Bottom-Left Gold/Red/Blue Bars)
  charts.execSpeciesStackedChart = new Chart(document.getElementById("execSpeciesStackedChart"), {
    type: "bar",
    data: {
      labels: ["Poultry", "Cattle", "Goats", "Sheep", "Swine"],
      datasets: [
        {
          label: "Recorded Mortality",
          data: [6840, 2410, 2890, 1420, 1332],
          backgroundColor: "#dc2626"
        },
        {
          label: "Treated & Stabilized",
          data: [14200, 8900, 7400, 5100, 3800],
          backgroundColor: "#f59e0b"
        },
        {
          label: "Healthy / Protected",
          data: [42000, 29000, 21000, 16500, 11200],
          backgroundColor: "#0284c7"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { boxWidth: 10, font: { size: 10 } } }
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, grid: { color: "rgba(148, 163, 184, 0.2)" } }
      }
    }
  });

  // 8. Executive View Bottom-Center Green Containment Bars (Matches Image 3 Green Bars)
  charts.execRecoveryBarChart = new Chart(document.getElementById("execRecoveryBarChart"), {
    type: "bar",
    data: {
      labels: ["Jos", "Ibadan", "Kano", "Makurdi", "Zaria", "Oyo East", "Gboko", "Kura"],
      datasets: [
        {
          label: "7-Day Flock Containment (%)",
          data: [92, 95, 86, 89, 91, 93, 87, 85],
          backgroundColor: "#15803d",
          borderRadius: 2
        },
        {
          label: "Baseline Target (%)",
          data: [80, 80, 80, 80, 80, 80, 80, 80],
          backgroundColor: "#cbd5e1",
          borderRadius: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { boxWidth: 10, font: { size: 10 } } }
      },
      scales: {
        y: { beginAtZero: true, max: 100, grid: { color: "rgba(148, 163, 184, 0.2)" } },
        x: { grid: { display: false } }
      }
    }
  });

  // 9. Executive View Bottom-Right SLA Gold/Red Ring (Matches Image 3 Bottom-Right Ring)
  charts.execSlaDonutChart = new Chart(document.getElementById("execSlaDonutChart"), {
    type: "doughnut",
    data: {
      labels: ["Fulfilled <2 Hours", "Same-Day Vet Visit", "Pending Stock Transfer"],
      datasets: [
        {
          data: [68, 23.4, 8.6],
          backgroundColor: ["#f59e0b", "#dc2626", "#cbd5e1"],
          borderWidth: 2,
          borderColor: "#ffffff"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "72%",
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } }
      }
    }
  });

  // 10. View 3: Disease Contagion vs Lethality Bubble Chart
  charts.matrixBubbleChart = new Chart(document.getElementById("matrixBubbleChart"), {
    type: "bubble",
    data: {
      datasets: [
        {
          label: "Newcastle Disease (Poultry)",
          data: [{ x: 8.4, y: 72, r: 22 }],
          backgroundColor: "rgba(220, 38, 38, 0.7)"
        },
        {
          label: "FMD — Foot & Mouth (Cattle)",
          data: [{ x: 9.2, y: 14, r: 20 }],
          backgroundColor: "rgba(2, 132, 199, 0.7)"
        },
        {
          label: "PPR — Goat Plague (Goats)",
          data: [{ x: 7.6, y: 64, r: 18 }],
          backgroundColor: "rgba(124, 58, 237, 0.7)"
        },
        {
          label: "African Swine Fever (Swine)",
          data: [{ x: 6.8, y: 91, r: 16 }],
          backgroundColor: "rgba(217, 119, 6, 0.7)"
        },
        {
          label: "Coccidiosis (Poultry)",
          data: [{ x: 5.5, y: 28, r: 17 }],
          backgroundColor: "rgba(13, 148, 136, 0.7)"
        },
        {
          label: "Anthrax (Ruminants)",
          data: [{ x: 3.4, y: 95, r: 12 }],
          backgroundColor: "rgba(192, 38, 211, 0.7)"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: "Transmission Velocity Index (R0 Proxy)" },
          min: 2,
          max: 11
        },
        y: {
          title: { display: true, text: "Untreated Case Fatality Rate (%)" },
          min: 0,
          max: 105
        }
      }
    }
  });

  // 11. View 3: Climatic / Seasonal Symptom Correlation Chart
  charts.matrixRadarChart = new Chart(document.getElementById("matrixRadarChart"), {
    type: "line",
    data: {
      labels: ["Jan (Harmattan)", "Feb", "Mar", "Apr", "May", "Jun (Rains)", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      datasets: [
        {
          label: "Respiratory & Newcastle Surge",
          data: [92, 88, 64, 42, 35, 38, 44, 49, 52, 68, 84, 95],
          borderColor: "#dc2626",
          tension: 0.3
        },
        {
          label: "Parasitic, Coccidiosis & Footrot Surge",
          data: [24, 28, 39, 58, 79, 91, 96, 89, 82, 61, 34, 26],
          borderColor: "#0d9488",
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });

  // 12. View 4: Vet Routing Latency Chart
  charts.routingLatencyChart = new Chart(document.getElementById("routingLatencyChart"), {
    type: "bar",
    data: {
      labels: ["Plateau (Vom)", "Oyo (Ibadan)", "Kano (Dawanau)", "Benue (Makurdi)", "Kaduna (Zaria)"],
      datasets: [
        {
          label: "Mean Farmer-to-Vet Distance (km)",
          data: [11.4, 8.2, 16.8, 14.1, 12.5],
          backgroundColor: "#0284c7"
        },
        {
          label: "Median Triage-to-Dispatch Time (Mins)",
          data: [18, 14, 24, 21, 19],
          backgroundColor: "#10b981"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });

  // 13. View 4: Triage Door Split Chart
  charts.routingDoorSplitChart = new Chart(document.getElementById("routingDoorSplitChart"), {
    type: "bar",
    data: {
      labels: ["Poultry", "Cattle", "Goats", "Sheep", "Swine"],
      datasets: [
        {
          label: "Agro-Vet Store Supply Referral",
          data: [52, 44, 48, 46, 35],
          backgroundColor: "#0284c7"
        },
        {
          label: "Emergency Vet Doctor Escalation",
          data: [28, 38, 32, 30, 49],
          backgroundColor: "#dc2626"
        },
        {
          label: "Supportive Biosecurity Management",
          data: [20, 18, 20, 24, 16],
          backgroundColor: "#10b981"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true },
        y: { stacked: true, max: 100 }
      }
    }
  });
}

// ============================================================================
// 4. POPULATE TABLES & UPDATE EXECUTIVE METRICS ON FILTER CHANGE
// ============================================================================
function renderTablesAndMetrics() {
  const cells = getFilteredHexCells();

  const totalReports = cells.reduce((s, c) => s + c.reportsCount, 0);
  const totalDeaths = cells.reduce((s, c) => s + c.recordedDeaths, 0);
  const totalHerd = cells.reduce((s, c) => s + c.herdSize, 0);
  const totalRouted = cells.reduce((s, c) => s + c.routedToVet, 0);

  document.getElementById("kpiTotalReports").textContent = totalReports.toLocaleString();
  document.getElementById("kpiTotalDeaths").textContent = totalDeaths.toLocaleString();
  document.getElementById("kpiTotalHerd").textContent = totalHerd.toLocaleString();
  document.getElementById("kpiRoutedCases").textContent = totalRouted.toLocaleString();

  // Render View 3 Symptom-to-Disease Probability Matrix Table
  const diseases = [
    "Newcastle Disease",
    "PPR (Goat Plague)",
    "FMD (Foot & Mouth)",
    "African Swine Fever",
    "Coccidiosis",
    "Anthrax"
  ];

  const matrixTable = document.getElementById("symptomMatrixTable");
  let matrixHtml = `<thead><tr><th>Observed Farmer-Reported Symptom</th>`;
  diseases.forEach((d) => {
    matrixHtml += `<th>${d}</th>`;
  });
  matrixHtml += `</tr></thead><tbody>`;

  window.SYMPTOM_DISEASE_MATRIX.forEach((row) => {
    matrixHtml += `<tr><td class="symptom-row-label">${row.symptom}</td>`;
    diseases.forEach((d) => {
      const score = row.scores[d] || 0;
      const alpha = (score / 100) * 0.82;
      const bg = score > 70
        ? `rgba(220, 38, 38, ${alpha})`
        : score > 40
        ? `rgba(2, 132, 199, ${alpha})`
        : `rgba(148, 163, 184, 0.12)`;
      const textCol = score > 55 ? "#ffffff" : "var(--text-primary)";
      matrixHtml += `<td><div class="heat-cell" style="background:${bg};color:${textCol};padding:6px 4px;">${score}%</div></td>`;
    });
    matrixHtml += `</tr>`;
  });
  matrixHtml += `</tbody>`;
  matrixTable.innerHTML = matrixHtml;

  // Render View 4 Vet Network Table
  const vetTbody = document.querySelector("#vetNetworkTable tbody");
  vetTbody.innerHTML = window.VET_CENTERS.map((v) => {
    const badgeClass = v.stockStatus === "Optimal" ? "status-resolved" : "status-critical";
    return `
      <tr>
        <td style="font-family:'JetBrains Mono',monospace;font-weight:600;">${v.id}</td>
        <td style="font-weight:600;">${v.name}</td>
        <td>${v.type}</td>
        <td>${v.lga}, ${v.state}</td>
        <td style="font-family:'JetBrains Mono',monospace;">${v.routedCases}</td>
        <td style="font-family:'JetBrains Mono',monospace;font-weight:700;">${v.fulfillmentRate}%</td>
        <td style="font-family:'JetBrains Mono',monospace;">${v.avgResponseMins} mins</td>
        <td><span class="status-box ${badgeClass}">${v.stockStatus}</span></td>
      </tr>
    `;
  }).join("");

  // Render View 4 Live Farmer Report Table (Top 12 filtered cells)
  const reportTbody = document.querySelector("#liveFarmerReportTable tbody");
  reportTbody.innerHTML = cells
    .slice(0, 12)
    .map((c) => {
      const isCrit = c.recordedDeaths > 50 || c.symptom === "mortality" || c.symptom === "hemorrhagic";
      const actionBadge = isCrit
        ? `<span class="status-box status-critical">EMERGENCY VET DOCTOR</span>`
        : `<span class="status-box status-routed">AGRO-VET STORE SUPPLY</span>`;
      return `
        <tr>
          <td style="font-family:'JetBrains Mono',monospace;font-weight:600;">${c.h3Index.slice(0, 12)}</td>
          <td>${c.lga} (${c.state})</td>
          <td style="text-transform:uppercase;font-weight:600;">${c.species}</td>
          <td style="font-family:'JetBrains Mono',monospace;">${c.herdSize.toLocaleString()}</td>
          <td style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--accent-crimson);">${c.recordedDeaths}</td>
          <td style="text-transform:capitalize;">${c.symptom}</td>
          <td style="font-weight:600;">${c.disease}</td>
          <td>${actionBadge}</td>
        </tr>
      `;
    })
    .join("");
}

// ============================================================================
// 5. NAVIGATION, THEME SWITCHING & LAYOUT PRESETS
// ============================================================================
window.switchView = function (viewId) {
  document.querySelectorAll(".view-section").forEach((sec) => {
    sec.classList.toggle("active", sec.id === viewId);
  });
  document.querySelectorAll(".nav-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-view") === viewId);
  });

  if (viewId === "view-spatial" && mapInstance) {
    setTimeout(() => mapInstance.invalidateSize(), 120);
  }
};

window.applySpatialLayout = function (layoutClass) {
  const container = document.getElementById("spatialWorkbenchContainer");
  container.classList.remove("layout-bottom-dock", "layout-dual-sidebar");
  if (layoutClass && layoutClass !== "default") {
    container.classList.add(layoutClass);
  }
  window.switchView("view-spatial");
};

function bindEvents() {
  // Top Navigation Tabs
  document.querySelectorAll(".nav-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.switchView(btn.getAttribute("data-view"));
    });
  });

  // Theme Switcher
  document.getElementById("themeSwitcher").addEventListener("change", (e) => {
    document.documentElement.setAttribute("data-theme", e.target.value);
  });

  // Global Filters
  const filterMap = {
    filterRegion: "region",
    filterSpecies: "species",
    filterSymptom: "symptom",
    filterDisease: "disease",
    filterMetric: "metric"
  };

  Object.entries(filterMap).forEach(([domId, stateKey]) => {
    document.getElementById(domId).addEventListener("change", (e) => {
      state[stateKey] = e.target.value;
      renderSpatialLayers();
      renderTablesAndMetrics();

      // Pan map if specific regional cluster chosen
      if (stateKey === "region" && e.target.value !== "ALL") {
        const cl = window.LIVESTOCK_CLUSTERS.find((c) => c.id === e.target.value);
        if (cl && mapInstance) {
          mapInstance.setView([cl.centerLat, cl.centerLng], 9);
        }
      } else if (stateKey === "region" && e.target.value === "ALL" && mapInstance) {
        mapInstance.setView([9.35, 7.65], 7);
      }
    });
  });

  // Reset Filters
  document.getElementById("btnResetFilters").addEventListener("click", () => {
    state.region = "ALL";
    state.species = "ALL";
    state.symptom = "ALL";
    state.disease = "ALL";
    state.metric = "recordedDeaths";

    document.getElementById("filterRegion").value = "ALL";
    document.getElementById("filterSpecies").value = "ALL";
    document.getElementById("filterSymptom").value = "ALL";
    document.getElementById("filterDisease").value = "ALL";
    document.getElementById("filterMetric").value = "recordedDeaths";

    if (mapInstance) mapInstance.setView([9.35, 7.65], 7);
    renderSpatialLayers();
    renderTablesAndMetrics();
  });

  // Map Layer Mode Buttons (H3 Hex / Heatmap / Both)
  document.querySelectorAll("[data-maplayer]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-maplayer]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.mapLayerMode = btn.getAttribute("data-maplayer");
      renderSpatialLayers();
    });
  });

  // Base Map Tile Style Buttons
  document.querySelectorAll("[data-basemap]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-basemap]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.baseMapStyle = btn.getAttribute("data-basemap");
      setBaseMapTiles(state.baseMapStyle);
    });
  });

  // Map Quick Search Input
  document.getElementById("mapQuickSearch").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) return;
    const match = window.H3_HEX_CELLS.find(
      (c) =>
        c.state.toLowerCase().includes(q) ||
        c.lga.toLowerCase().includes(q) ||
        c.disease.toLowerCase().includes(q) ||
        c.species.toLowerCase().includes(q)
    );
    if (match && mapInstance) {
      updateHexInspector(match);
      mapInstance.setView([match.lat, match.lng], 9);
    }
  });

  // Export CSV / GeoJSON Snapshot
  document.getElementById("btnExportSnapshot").addEventListener("click", () => {
    const cells = getFilteredHexCells();
    const csvRows = [
      ["H3_Index", "State", "LGA", "Species", "Symptom", "Suspected_Disease", "Farmer_Reports", "Herd_Size", "Recorded_Deaths", "Routed_To_Vet"].join(",")
    ];
    cells.forEach((c) => {
      csvRows.push(
        [
          c.h3Index,
          `"${c.state}"`,
          `"${c.lga}"`,
          c.species,
          c.symptom,
          `"${c.disease}"`,
          c.reportsCount,
          c.herdSize,
          c.recordedDeaths,
          c.routedToVet
        ].join(",")
      );
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `livestock_h3_telemetry_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ============================================================================
// BOOTSTRAP SUITE
// ============================================================================
window.addEventListener("DOMContentLoaded", () => {
  initAllCharts();
  initSpatialMap();
  renderTablesAndMetrics();
  bindEvents();
});
