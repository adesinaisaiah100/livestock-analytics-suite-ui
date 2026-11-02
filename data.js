// ============================================================================
// LIVESTOCK SPATIAL & EPIDEMIOLOGICAL ANALYTICS DATASET (STANDALONE MOCK ENGINE)
// ============================================================================

window.LIVESTOCK_CLUSTERS = [
  {
    id: "CLUSTER-JOS",
    name: "Jos Plateau Grazing & Poultry Belt",
    state: "Plateau",
    lga: "Jos South / Barkin Ladi",
    centerLat: 9.8965,
    centerLng: 8.8583,
    dominantSpecies: "cattle",
    dominantDisease: "FMD (Foot & Mouth)",
    dominantSymptom: "digestive",
    baseIntensity: 0.92
  },
  {
    id: "CLUSTER-OYO",
    name: "Ibadan-Oyo Commercial Corridor",
    state: "Oyo",
    lga: "Egbeda / Akinyele / Oyo East",
    centerLat: 7.4019,
    centerLng: 3.9173,
    dominantSpecies: "poultry",
    dominantDisease: "Newcastle Disease",
    dominantSymptom: "respiratory",
    baseIntensity: 0.88
  },
  {
    id: "CLUSTER-KANO",
    name: "Kano-Kaduna Pastoral Corridor",
    state: "Kano",
    lga: "Kura / Dawakin Kudu",
    centerLat: 11.8846,
    centerLng: 8.5364,
    dominantSpecies: "goats",
    dominantDisease: "PPR (Goat Plague)",
    dominantSymptom: "respiratory",
    baseIntensity: 0.84
  },
  {
    id: "CLUSTER-BENUE",
    name: "Makurdi-Gboko Valley Livestock Zone",
    state: "Benue",
    lga: "Makurdi / Gboko",
    centerLat: 7.7322,
    centerLng: 8.5391,
    dominantSpecies: "swine",
    dominantDisease: "African Swine Fever",
    dominantSymptom: "hemorrhagic",
    baseIntensity: 0.79
  },
  {
    id: "CLUSTER-KADUNA",
    name: "Zaria-Sabon Gari Mixed Basin",
    state: "Kaduna",
    lga: "Sabon Gari / Giwa",
    centerLat: 10.9854,
    centerLng: 7.6801,
    dominantSpecies: "sheep",
    dominantDisease: "Anthrax / Clostridial",
    dominantSymptom: "mortality",
    baseIntensity: 0.74
  }
];

window.VET_CENTERS = [
  {
    id: "VET-01",
    name: "NVRI Vom Regional Referral Clinic",
    type: "Veterinary Doctor Hospital",
    state: "Plateau",
    lga: "Jos South",
    lat: 9.7311,
    lng: 8.7914,
    routedCases: 412,
    fulfillmentRate: 94.2,
    avgResponseMins: 18,
    stockStatus: "Optimal"
  },
  {
    id: "VET-02",
    name: "Agodi Gate Veterinary Medical Center & Pharmacy",
    type: "Agro-Vet Store & Doctor Hub",
    state: "Oyo",
    lga: "Ibadan North",
    lat: 7.4068,
    lng: 3.9195,
    routedCases: 538,
    fulfillmentRate: 91.8,
    avgResponseMins: 14,
    stockStatus: "Optimal"
  },
  {
    id: "VET-03",
    name: "Dawanau Pastoral Vet Supply Depot",
    type: "Agro-Vet Store",
    state: "Kano",
    lga: "Dawakin Tofa",
    lat: 12.0841,
    lng: 8.4312,
    routedCases: 389,
    fulfillmentRate: 86.5,
    avgResponseMins: 24,
    stockStatus: "Restock Alert"
  },
  {
    id: "VET-04",
    name: "Benue River Basin Veterinary Dispatch",
    type: "Veterinary Doctor Clinic",
    state: "Benue",
    lga: "Makurdi",
    lat: 7.7198,
    lng: 8.5123,
    routedCases: 274,
    fulfillmentRate: 89.1,
    avgResponseMins: 21,
    stockStatus: "Optimal"
  },
  {
    id: "VET-05",
    name: "Samaru Livestock Pharmacy & Cold-Chain Store",
    type: "Agro-Vet Store",
    state: "Kaduna",
    lga: "Sabon Gari",
    lat: 11.1582,
    lng: 7.6544,
    routedCases: 318,
    fulfillmentRate: 88.4,
    avgResponseMins: 19,
    stockStatus: "Optimal"
  }
];

// Generate a dense, realistic CARTO-style H3 hexagonal lattice around each regional cluster
// Produces ~380 contiguous hex cells with realistic radial intensity falloff (like Image 1)
function generateHexLattice() {
  const cells = [];
  const hexRadiusDeg = 0.068; // ~7.5km hex radius for clear regional visibility
  const dx = hexRadiusDeg * 1.5;
  const dy = hexRadiusDeg * Math.sqrt(3);

  const speciesPool = ["cattle", "poultry", "goats", "sheep", "swine"];
  const symptomPool = ["respiratory", "hemorrhagic", "digestive", "neurological", "mortality"];
  const diseaseBySpecies = {
    cattle: ["FMD (Foot & Mouth)", "CBPP", "Anthrax", "Trypanosomiasis"],
    poultry: ["Newcastle Disease", "Infectious Bursal (Gumboro)", "Coccidiosis", "Avian Influenza"],
    goats: ["PPR (Goat Plague)", "Contagious Caprine Pleuropneumonia", "Haemonchosis"],
    sheep: ["Sheep Pox", "PPR (Ovine)", "Footrot", "Enterotoxemia"],
    swine: ["African Swine Fever", "Erysipelas", "Porcine Parvovirus"]
  };

  let hexCounter = 1000;

  window.LIVESTOCK_CLUSTERS.forEach((cluster, cIdx) => {
    const rings = 5; // 5 hexagonal rings around each cluster center
    for (let q = -rings; q <= rings; q++) {
      for (let r = -rings; r <= rings; r++) {
        if (Math.abs(q + r) > rings) continue;

        const dist = Math.sqrt(q * q + r * r + q * r);
        const normDist = dist / (rings + 0.5);

        const latOffset = (r + q * 0.5) * dy;
        const lngOffset = q * dx;

        const cellLat = cluster.centerLat + latOffset;
        const cellLng = cluster.centerLng + lngOffset;

        // Deterministic pseudo-random seed
        const seed = Math.abs(Math.sin((cIdx + 1) * 97 + q * 31 + r * 17));
        const intensity = Math.max(0.08, Math.min(0.99, (1 - normDist * 0.78) * cluster.baseIntensity * (0.75 + seed * 0.35)));

        const species = seed > 0.35 ? cluster.dominantSpecies : speciesPool[Math.floor(seed * 100) % speciesPool.length];
        const symptom = seed > 0.4 ? cluster.dominantSymptom : symptomPool[Math.floor(seed * 70) % symptomPool.length];
        const diseases = diseaseBySpecies[species];
        const disease = diseases[Math.floor(seed * 50) % diseases.length];

        const reportsCount = Math.max(2, Math.round(intensity * 95 + seed * 18));
        const herdSize = Math.round(reportsCount * (species === "poultry" ? 185 : 28) * (0.8 + seed * 0.4));
        const recordedDeaths = Math.round(reportsCount * (intensity * 14.5) * (species === "poultry" ? 2.8 : 0.75));
        const routedToVet = Math.round(reportsCount * (0.62 + seed * 0.32));

        // Construct 6 vertices of flat-topped hexagon
        const vertices = [];
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i;
          const vLat = cellLat + hexRadiusDeg * 0.96 * Math.sin(angle);
          const vLng = cellLng + hexRadiusDeg * 0.96 * Math.cos(angle);
          vertices.push([vLat, vLng]);
        }

        hexCounter++;
        const h3FakeIndex = `8758${cIdx + 1}${Math.abs(q)}${Math.abs(r)}${hexCounter.toString(16)}fffffff`;

        cells.push({
          h3Index: h3FakeIndex,
          clusterId: cluster.id,
          clusterName: cluster.name,
          state: cluster.state,
          lga: cluster.lga,
          lat: cellLat,
          lng: cellLng,
          vertices,
          species,
          symptom,
          disease,
          intensity,
          reportsCount,
          herdSize,
          recordedDeaths,
          routedToVet,
          mortalityRatePct: +((recordedDeaths / Math.max(1, herdSize)) * 100).toFixed(1)
        });
      }
    }
  });

  return cells;
}

window.H3_HEX_CELLS = generateHexLattice();

// Symptom-to-Disease Correlation Matrix Data (View 3)
window.SYMPTOM_DISEASE_MATRIX = [
  {
    symptom: "Twisted Neck / Torticollis & Paralysis",
    category: "neurological",
    scores: {
      "Newcastle Disease": 94,
      "PPR (Goat Plague)": 12,
      "FMD (Foot & Mouth)": 4,
      "African Swine Fever": 18,
      "Coccidiosis": 8,
      "Anthrax": 15
    }
  },
  {
    symptom: "Nasal Discharge, Coughing & Rales",
    category: "respiratory",
    scores: {
      "Newcastle Disease": 82,
      "PPR (Goat Plague)": 91,
      "FMD (Foot & Mouth)": 22,
      "African Swine Fever": 34,
      "Coccidiosis": 6,
      "Anthrax": 19
    }
  },
  {
    symptom: "Bloody Diarrhea & Mucosal Lesions",
    category: "hemorrhagic",
    scores: {
      "Newcastle Disease": 48,
      "PPR (Goat Plague)": 79,
      "FMD (Foot & Mouth)": 14,
      "African Swine Fever": 88,
      "Coccidiosis": 96,
      "Anthrax": 64
    }
  },
  {
    symptom: "Oral Blisters, Drooling & Hoof Lameness",
    category: "digestive",
    scores: {
      "Newcastle Disease": 5,
      "PPR (Goat Plague)": 62,
      "FMD (Foot & Mouth)": 97,
      "African Swine Fever": 21,
      "Coccidiosis": 3,
      "Anthrax": 9
    }
  },
  {
    symptom: "Peracute Sudden Death (<24h Onset)",
    category: "mortality",
    scores: {
      "Newcastle Disease": 76,
      "PPR (Goat Plague)": 54,
      "FMD (Foot & Mouth)": 19,
      "African Swine Fever": 92,
      "Coccidiosis": 29,
      "Anthrax": 98
    }
  },
  {
    symptom: "High Fever, Cyanotic Ears & Huddling",
    category: "hemorrhagic",
    scores: {
      "Newcastle Disease": 41,
      "PPR (Goat Plague)": 58,
      "FMD (Foot & Mouth)": 37,
      "African Swine Fever": 95,
      "Coccidiosis": 18,
      "Anthrax": 72
    }
  }
];
