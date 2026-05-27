const FEET_PER_SQUARE_METER = 10.76391041671;

const sections = [
  {
    id: "front",
    name: "Front yard",
    description: "Street-facing landscape and entry zone",
    color: "#d8a832",
    share: 19,
  },
  {
    id: "exterior-left",
    name: "Exterior side yard left",
    description: "Outer left access and setback",
    color: "#3479a8",
    share: 11,
  },
  {
    id: "interior-left",
    name: "Interior side yard left",
    description: "Left inner side near structure",
    color: "#3d9385",
    share: 13,
  },
  {
    id: "interior-right",
    name: "Interior side yard right",
    description: "Right inner side near structure",
    color: "#bf5f76",
    share: 13,
  },
  {
    id: "exterior-right",
    name: "Exterior side yard right",
    description: "Outer right access and setback",
    color: "#7767ad",
    share: 11,
  },
  {
    id: "back",
    name: "Backyard",
    description: "Rear outdoor living and lawn area",
    color: "#276b46",
    share: 33,
  },
];

const state = {
  map: null,
  geocoder: null,
  center: { lat: 39.7593, lng: -104.9857 },
  address: "2601 Blake St, Denver, CO",
  parcelWidth: 80,
  parcelDepth: 140,
  homeFootprint: 3360,
  measuredParcelArea: null,
  totalOutdoorArea: 7840,
  liveGoogle: false,
  parcelPolygon: null,
  sectionPolygons: [],
  labels: [],
};

const elements = {
  addressForm: document.querySelector("[data-address-form]"),
  addressInput: document.querySelector("#address"),
  apiState: document.querySelector("[data-api-state]"),
  activeAddress: document.querySelector("[data-active-address]"),
  mapNote: document.querySelector("[data-map-note]"),
  totalArea: document.querySelector("[data-total-area]"),
  confidence: document.querySelector("[data-confidence]"),
  sectionList: document.querySelector("[data-section-list]"),
  rowTemplate: document.querySelector("#section-row-template"),
  dimensionInputs: document.querySelectorAll("[data-dimension]"),
  normalizeButton: document.querySelector("[data-normalize]"),
  recenterButton: document.querySelector("[data-recenter]"),
  toolButtons: document.querySelectorAll("[data-tool]"),
  exportButton: document.querySelector("[data-export]"),
  demoMap: document.querySelector("[data-demo-map]"),
  mapCanvas: document.querySelector("#map"),
};

function formatNumber(value) {
  return Math.round(value).toLocaleString("en-US");
}

function getSectionArea(section) {
  return Math.max(0, state.totalOutdoorArea * (section.share / 100));
}

function normalizeShares(changedId) {
  const changed = sections.find((section) => section.id === changedId);
  const others = sections.filter((section) => section.id !== changedId);
  const remaining = Math.max(0, 100 - (changed ? changed.share : 0));
  const otherTotal = others.reduce((sum, section) => sum + section.share, 0) || 1;

  others.forEach((section) => {
    section.share = Math.max(4, Math.round((section.share / otherTotal) * remaining));
  });

  const drift = 100 - sections.reduce((sum, section) => sum + section.share, 0);
  if (others.length) {
    others[others.length - 1].share += drift;
  }
}

function calculateOutdoorArea() {
  const parcelArea = state.measuredParcelArea || state.parcelWidth * state.parcelDepth;
  state.totalOutdoorArea = Math.max(0, parcelArea - state.homeFootprint);
}

function renderSections() {
  elements.sectionList.replaceChildren();

  sections.forEach((section) => {
    const row = elements.rowTemplate.content.firstElementChild.cloneNode(true);
    const swatch = row.querySelector(".swatch");
    const title = row.querySelector("strong");
    const description = row.querySelector("small");
    const range = row.querySelector("input");
    const output = row.querySelector("output");

    swatch.style.background = section.color;
    title.textContent = section.name;
    description.textContent = `${section.share}% of outdoor area`;
    range.value = section.share;
    range.setAttribute("aria-label", `${section.name} coverage share`);
    output.textContent = `${formatNumber(getSectionArea(section))} sq ft`;

    range.addEventListener("input", () => {
      section.share = Number(range.value);
      normalizeShares(section.id);
      updateResults({ redraw: false });
    });

    elements.sectionList.append(row);
  });
}

function updateResults({ redraw = true } = {}) {
  calculateOutdoorArea();
  elements.totalArea.textContent = formatNumber(state.totalOutdoorArea);
  elements.activeAddress.textContent = state.address;
  elements.confidence.textContent = state.liveGoogle
    ? "Live Google Maps estimate. Draw or edit the parcel for site-specific coverage."
    : "Six-section demo estimate based on an editable residential lot template.";
  renderSections();

  if (state.liveGoogle && redraw) {
    drawGoogleSections();
  }
}

function setApiState(kind, label) {
  elements.apiState.classList.toggle("is-live", kind === "live");
  elements.apiState.classList.toggle("is-error", kind === "error");
  elements.apiState.lastChild.textContent = ` ${label}`;
}

function getMapsKey() {
  const params = new URLSearchParams(window.location.search);
  return params.get("key") || params.get("mapsKey") || window.GOOGLE_MAPS_API_KEY || "";
}

function loadGoogleMaps() {
  const key = getMapsKey();
  if (!key) {
    state.liveGoogle = false;
    setApiState("demo", "Demo map");
    elements.mapNote.textContent = "Demo estimate. Add a Google Maps key for live satellite context.";
    updateResults();
    return;
  }

  window.initGoogleMaps = initGoogleMaps;

  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=geometry&callback=initGoogleMaps&v=weekly`;
  script.async = true;
  script.defer = true;
  script.onerror = () => {
    state.liveGoogle = false;
    setApiState("error", "Map key error");
    elements.mapNote.textContent = "Google Maps could not load. The demo estimate remains editable.";
    updateResults();
  };
  document.head.append(script);
}

function initGoogleMaps() {
  state.liveGoogle = true;
  setApiState("live", "Google Maps live");
  elements.demoMap.hidden = true;
  elements.mapNote.textContent = "Satellite estimate. Adjust the generated parcel and section shares.";

  state.map = new google.maps.Map(elements.mapCanvas, {
    center: state.center,
    zoom: 19,
    tilt: 0,
    mapTypeId: "satellite",
    disableDefaultUI: true,
    zoomControl: true,
    streetViewControl: true,
    fullscreenControl: true,
  });

  state.geocoder = new google.maps.Geocoder();
  drawGoogleSections();
}

function destinationPoint(center, eastFeet, northFeet) {
  const latRadians = (center.lat * Math.PI) / 180;
  const feetPerDegreeLat = 364000;
  const feetPerDegreeLng = Math.max(1, feetPerDegreeLat * Math.cos(latRadians));
  return {
    lat: center.lat + northFeet / feetPerDegreeLat,
    lng: center.lng + eastFeet / feetPerDegreeLng,
  };
}

function parcelBounds() {
  const halfWidth = state.parcelWidth / 2;
  const halfDepth = state.parcelDepth / 2;
  return {
    left: -halfWidth,
    right: halfWidth,
    front: -halfDepth,
    back: halfDepth,
  };
}

function polygonFromFeet(points) {
  return points.map(([x, y]) => destinationPoint(state.center, x, y));
}

function createGoogleLabel(position, text, color) {
  const marker = new google.maps.OverlayView();
  marker.onAdd = function onAdd() {
    const div = document.createElement("div");
    div.className = "section-label-marker";
    div.style.borderColor = color;
    div.textContent = text;
    this.div = div;
    this.getPanes().overlayMouseTarget.append(div);
  };
  marker.draw = function draw() {
    const point = this.getProjection().fromLatLngToDivPixel(new google.maps.LatLng(position.lat, position.lng));
    if (this.div && point) {
      this.div.style.left = `${point.x}px`;
      this.div.style.top = `${point.y}px`;
      this.div.style.transform = "translate(-50%, -50%)";
      this.div.style.position = "absolute";
    }
  };
  marker.onRemove = function onRemove() {
    if (this.div) {
      this.div.remove();
      this.div = null;
    }
  };
  marker.setMap(state.map);
  return marker;
}

function clearGoogleOverlays() {
  if (state.parcelPolygon) {
    state.parcelPolygon.setMap(null);
    state.parcelPolygon = null;
  }
  state.sectionPolygons.forEach((polygon) => polygon.setMap(null));
  state.labels.forEach((label) => label.setMap(null));
  state.sectionPolygons = [];
  state.labels = [];
}

function bindParcelEditing() {
  const path = state.parcelPolygon.getPath();
  const refreshArea = () => {
    if (!google.maps.geometry?.spherical) {
      return;
    }

    const squareMeters = google.maps.geometry.spherical.computeArea(path);
    state.measuredParcelArea = squareMeters * FEET_PER_SQUARE_METER;
    elements.mapNote.textContent = "Parcel boundary edited. Section shares now use the measured Google Maps polygon area.";
    updateResults({ redraw: false });
  };

  path.addListener("set_at", refreshArea);
  path.addListener("insert_at", refreshArea);
  path.addListener("remove_at", refreshArea);
  refreshArea();
}

function drawGoogleSections() {
  if (!state.map || !window.google?.maps) {
    return;
  }

  clearGoogleOverlays();

  const bounds = parcelBounds();
  const leftMid = bounds.left + state.parcelWidth * 0.28;
  const rightMid = bounds.right - state.parcelWidth * 0.28;
  const frontLine = bounds.front + state.parcelDepth * 0.32;
  const backLine = bounds.back - state.parcelDepth * 0.28;
  const houseLeft = -state.parcelWidth * 0.14;
  const houseRight = state.parcelWidth * 0.14;

  const parcel = polygonFromFeet([
    [bounds.left, bounds.front],
    [bounds.right, bounds.front],
    [bounds.right, bounds.back],
    [bounds.left, bounds.back],
  ]);

  state.parcelPolygon = new google.maps.Polygon({
    paths: parcel,
    map: state.map,
    strokeColor: "#ffffff",
    strokeOpacity: 0.95,
    strokeWeight: 3,
    fillOpacity: 0,
    editable: true,
  });
  bindParcelEditing();

  const sectionShapes = [
    {
      id: "front",
      points: [
        [bounds.left, bounds.front],
        [bounds.right, bounds.front],
        [bounds.right, frontLine],
        [bounds.left, frontLine],
      ],
      label: [0, bounds.front + (frontLine - bounds.front) / 2],
    },
    {
      id: "back",
      points: [
        [bounds.left, backLine],
        [bounds.right, backLine],
        [bounds.right, bounds.back],
        [bounds.left, bounds.back],
      ],
      label: [0, backLine + (bounds.back - backLine) / 2],
    },
    {
      id: "exterior-left",
      points: [
        [bounds.left, frontLine],
        [leftMid, frontLine],
        [leftMid, backLine],
        [bounds.left, backLine],
      ],
      label: [bounds.left + (leftMid - bounds.left) / 2, 0],
    },
    {
      id: "interior-left",
      points: [
        [leftMid, frontLine],
        [houseLeft, frontLine],
        [houseLeft, backLine],
        [leftMid, backLine],
      ],
      label: [leftMid + (houseLeft - leftMid) / 2, 0],
    },
    {
      id: "interior-right",
      points: [
        [houseRight, frontLine],
        [rightMid, frontLine],
        [rightMid, backLine],
        [houseRight, backLine],
      ],
      label: [houseRight + (rightMid - houseRight) / 2, 0],
    },
    {
      id: "exterior-right",
      points: [
        [rightMid, frontLine],
        [bounds.right, frontLine],
        [bounds.right, backLine],
        [rightMid, backLine],
      ],
      label: [rightMid + (bounds.right - rightMid) / 2, 0],
    },
  ];

  sectionShapes.forEach((shape) => {
    const section = sections.find((item) => item.id === shape.id);
    const polygon = new google.maps.Polygon({
      paths: polygonFromFeet(shape.points),
      map: state.map,
      strokeColor: "#ffffff",
      strokeOpacity: 0.88,
      strokeWeight: 2,
      fillColor: section.color,
      fillOpacity: 0.42,
      clickable: false,
    });

    state.sectionPolygons.push(polygon);
    state.labels.push(
      createGoogleLabel(
        destinationPoint(state.center, shape.label[0], shape.label[1]),
        section.name.replace(" yard", ""),
        section.color,
      ),
    );
  });

  const boundsObject = new google.maps.LatLngBounds();
  parcel.forEach((point) => boundsObject.extend(point));
  state.map.fitBounds(boundsObject, 60);
}

function geocodeAddress(address) {
  if (!state.liveGoogle || !state.geocoder) {
    state.address = address || state.address;
    elements.mapNote.textContent = "Demo estimate. Add a Google Maps key for live satellite context.";
    updateResults();
    return;
  }

  state.geocoder.geocode({ address }, (results, status) => {
    if (status !== "OK" || !results?.length) {
      setApiState("error", "Address not found");
      elements.mapNote.textContent = "Address was not found. Check spelling or adjust the estimate manually.";
      return;
    }

    const location = results[0].geometry.location;
    state.center = { lat: location.lat(), lng: location.lng() };
    state.address = results[0].formatted_address;
    state.measuredParcelArea = null;
    state.map.setCenter(state.center);
    setApiState("live", "Google Maps live");
    elements.mapNote.textContent = "Satellite estimate. Adjust the generated parcel and section shares.";
    updateResults();
  });
}

function exportResults() {
  const lines = [
    "Sierra Terrain outdoor coverage estimate",
    `Address: ${state.address}`,
    `Total outdoor area: ${formatNumber(state.totalOutdoorArea)} sq ft`,
    "",
    ...sections.map((section) => `${section.name}: ${formatNumber(getSectionArea(section))} sq ft (${section.share}%)`),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sierra-terrain-yard-coverage.txt";
  link.click();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  elements.addressForm.addEventListener("submit", (event) => {
    event.preventDefault();
    geocodeAddress(elements.addressInput.value.trim());
  });

  elements.dimensionInputs.forEach((input) => {
    input.addEventListener("input", () => {
      const value = Number(input.value);
      if (!Number.isFinite(value)) {
        return;
      }

      if (input.dataset.dimension === "width") state.parcelWidth = value;
      if (input.dataset.dimension === "depth") state.parcelDepth = value;
      if (input.dataset.dimension === "home") {
        state.homeFootprint = value;
      } else {
        state.measuredParcelArea = null;
      }
      updateResults();
    });
  });

  elements.normalizeButton.addEventListener("click", () => {
    const defaults = [19, 11, 13, 13, 11, 33];
    sections.forEach((section, index) => {
      section.share = defaults[index];
    });
    updateResults({ redraw: false });
  });

  elements.recenterButton.addEventListener("click", () => {
    if (state.liveGoogle && state.map) {
      state.map.setCenter(state.center);
      drawGoogleSections();
    }
  });

  elements.toolButtons.forEach((button) => {
    button.addEventListener("click", () => {
      elements.toolButtons.forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");

      if (button.dataset.tool === "clear") {
        state.measuredParcelArea = null;
        const defaults = [19, 11, 13, 13, 11, 33];
        sections.forEach((section, index) => {
          section.share = defaults[index];
        });
        updateResults();
      }
    });
  });

  elements.exportButton.addEventListener("click", exportResults);
}

bindEvents();
loadGoogleMaps();
