const ZIP_LAYER_BASE =
      "https://meckags.mecklenburgcountync.gov/server/rest/services/CriminalJusticeServices/CJSCaseCountsByZIP/MapServer";

require([
  "esri/Map",
  "esri/views/MapView",
  "esri/Graphic",
  "esri/layers/GraphicsLayer",
  "esri/layers/FeatureLayer",
  "esri/symbols/SimpleFillSymbol",
  "esri/symbols/SimpleMarkerSymbol",
  "esri/geometry/Polygon",
  "esri/geometry/Point",
  "esri/geometry/Extent",
  "esri/Basemap",
  "esri/layers/VectorTileLayer",
], function (
  EsriMap,
  MapView,
  Graphic,
  GraphicsLayer,
  FeatureLayer,
  SimpleFillSymbol,
  SimpleMarkerSymbol,
  Polygon,
  Point,
  Extent,
  Basemap,
  VectorTileLayer,
) {
  "use strict";

  (async function main() {
    // Easy configuration for Dashboard Title and Year Range
    const DASHBOARD_CONFIG = {
      title: "Community Well-Being and Criminal Court Cases",
    };

    
    const tooltips = TOOLTIPS;
    const start_year = YEAR_START;
    const end_year = YEAR_END;
    const BUCKET_COLORS = ["#6B8E7F", "#4A8A8A", "#2C5F7C"];
    const EARTH_TO_SKY = [
      "#6B8E7F",
      "#4A8A8A",
      "#2C5F7C",
      "#6B4E63",
      "#B5694A",
      "#6B4423",
    ];
    const DEMO_COLORS = {
      white_nh_pct: "#2C5F7C",
      black_nh_pct: "#B5694A",
      hispanic_pct: "#4A8A8A",
      asian_nh_pct: "#6B4423",
      two_or_more_races_nh_pct: "#6B8E7F",
      other_race_nh_pct: "#6B4E63",
    };

    function num(v) {
      if (v === null || v === undefined || v === "" || v === "-666666666")
        return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }

    function normalizeZip(v) {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      const m = s.match(/\b\d{5}\b/);
      return m ? m[0] : s ? s.padStart(5, "0") : null;
    }

    function getZip(props) {
      if (!props) return null;
      return normalizeZip(props.zip_polygon);
    }

    /* ---- Formatting helpers ---- */
    function fmt(v, format) {
      if (v === null || v === undefined || !Number.isFinite(Number(v)))
        return "\u2014";
      const n = Number(v);
      if (format === "percent") return n.toFixed(1) + "%";
      if (format === "currency") return "$" + Math.round(n).toLocaleString();
      if (format === "number") return Math.round(n).toLocaleString();
      if (format === "rate") return n.toFixed(1);
      return n.toFixed(1);
    }

    /* fmtC removed — was a redundant wrapper around fmt() */

    function getInfoIcon(text, title, source) {
      const tooltipAttr = text
        ? ` data-tooltip="${text.replace(/"/g, "&quot;")}"`
        : "";
      const titleAttr = title
        ? ` data-title="${title.replace(/"/g, "&quot;")}"`
        : "";
      const sourceAttr = source
        ? ` data-source="${source.replace(/"/g, "&quot;")}"`
        : "";
      return `<svg class="info-icon" viewBox="0 0 16 16" width="12" height="12" fill="currentColor"${tooltipAttr}${titleAttr}${sourceAttr}><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M8.93 6.588l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>`;
    }


    const metricCatalog = [
      {
        id: "case_rate",
        category: "Case Counts",
        direction: "down",
        label: tooltips.getLabel("courtCaseRate", "Court Case Rate"),
        format: "rate",
        tooltip: tooltips.getTooltip(
          "courtCaseRate",
          "Rate of resident court cases per 1,000 residents.",
        ),
        source: tooltips.getSource("case_rate"),
        getValue: (p) => num(p.case_rate),
        getCountyAvg: (p) => num(p.count_avg_case_rate),
      },
      {
        id: "total_case_count",
        category: "Case Counts",
        direction: "down",
        label: tooltips.getLabel("courtCaseCount", "Court Case Count"),
        format: "number",
        tooltip: tooltips.getTooltip(
          "courtCaseCount",
          "Total number of court cases filed for residents in this ZIP.",
        ),
        source: tooltips.getSource("courtCaseCount"),
        getValue: (p) => num(p.total_case_count),
        getCountyAvg: (p) => num(p.count_avg_case_counts),
      },
      {
        id: "non_poverty_rate",
        category: "Economy",
        direction: "up",
        label: tooltips.getLabel("nonPovertyRate", "Non-Poverty Rate"),
        format: "percent",
        tooltip: tooltips.getTooltip(
          "nonPovertyRate",
          "Share of residents whose family income was below federal poverty threshold.",
        ),
        source: tooltips.getSource("nonPovertyRate"),
        getValue: (p) =>
          num(p.non_poverty_rate) !== null ? num(p.non_poverty_rate) : null,
        getCountyAvg: (p) => num(p.county_avg_non_poverty_rate),
      },
      {
        id: "median_income",
        category: "Economy",
        direction: "up",
        label: tooltips.getLabel("median_income", "Median Household Income"),
        format: "currency",
        tooltip: tooltips.getTooltip(
          "median_income",
          "Median household income in the past 12 months (inflation-adjusted).",
        ),
        source: tooltips.getSource("median_income"),
        getValue: (p) => num(p.median_income),
        getCountyAvg: (p) => num(p.county_avg_median_income),
      },
      {
        id: "housing_expense_under30",
        category: "Housing",
        direction: "up",
        label: tooltips.getLabel("housingExpenseUnder30", "Housing"),
        format: "percent",
        tooltip: tooltips.getTooltip(
          "housingExpenseUnder30",
          "Share of households spending over 30% of household income on housing costs.",
        ),
        source: tooltips.getSource("housingExpenseUnder30"),
        getValue: (p) =>
          num(p.housing_expense_under30) !== null
            ? Math.abs(num(p.housing_expense_under30))
            : null,
        getCountyAvg: (p) =>
          num(p.county_avg_housing_expense_under30) !== null
            ? num(p.county_avg_housing_expense_under30)
            : null,
      },
      {
        id: "insured_pct",
        category: "Health",
        direction: "up",
        label: tooltips.getLabel("insured_pct", "Health Insurance"),
        format: "percent",
        tooltip: tooltips.getTooltip(
          "insured_pct",
          "Percentage of population with health insurance coverage.",
        ),
        source: tooltips.getSource("insured_pct"),
        getValue: (p) => num(p.insured_rate),
        getCountyAvg: (p) =>
          num(p.county_avg_insured_rate) !== null
            ? num(p.county_avg_insured_rate)
            : null,
      },
      {
        id: "education_attainment_rate",
        category: "Education",
        direction: "up",
        label: tooltips.getLabel(
          "educationAttainmentRate",
          "Educational Attainment",
        ),
        format: "percent",
        tooltip: tooltips.getTooltip(
          "educationAttainmentRate",
          "Share of residents aged 25+ who have attained a high school diploma or higher.",
        ),
        source: tooltips.getSource("educationAttainmentRate"),
        getValue: (p) => num(p.education_attainment_rate),
        getCountyAvg: (p) => num(p.county_avg_education_attainment_rate),
      },
      {
        id: "total_population",
        category: "Demographics",
        direction: "neutral",
        label: tooltips.getLabel("total_population", "Total Population"),
        format: "number",
        tooltip: tooltips.getTooltip(
          "total_population",
          "Total estimated resident population from the ZIP feature layer.",
        ),
        source: tooltips.getSource("total_population"),
        getValue: (p) => num(p.total_pop),
        getCountyAvg: () => null,
      },
      {
        id: "white_nh_pct",
        category: "Demographics",
        direction: "neutral",
        label: "White",
        format: "percent",
        tooltip: tooltips.getTooltip(
          "non_hispanic_white_pct",
          "Percentage of residents identifying as Non-Hispanic or Lation White.",
        ),
        source: tooltips.getSource("non_hispanic_white_pct"),
        getValue: (p) => num(p.white_nh_pct),
        getCountyAvg: (p) => num(p.county_avg_white_nh_pct),
      },
      {
        id: "black_nh_pct",
        category: "Demographics",
        direction: "neutral",
        label: "Black",
        format: "percent",
        tooltip: tooltips.getTooltip(
          "non_hispanic_black_pct",
          "Percentage of residents identifying as Non-Hispanic or Latino Black.",
        ),
        source: tooltips.getSource("non_hispanic_black_pct"),
        getValue: (p) => num(p.black_nh_pct),
        getCountyAvg: (p) => num(p.county_avg_black_nh_pct),
      },
      {
        id: "hispanic_pct",
        category: "Demographics",
        direction: "neutral",
        label: "Hispanic or Latino",
        format: "percent",
        tooltip: tooltips.getTooltip(
          "hispanic_latino_pct",
          "Percentage of residents identifying as Hispanic or Latino.",
        ),
        source: tooltips.getSource("hispanic_latino_pct"),
        getValue: (p) => num(p.hispanic_pct),
        getCountyAvg: (p) => num(p.county_avg_hispanic_pct),
      },
      {
        id: "asian_nh_pct",
        category: "Demographics",
        direction: "neutral",
        label: "Asian",
        format: "percent",
        tooltip: tooltips.getTooltip(
          "non_hispanic_asian_pct",
          "Percentage of residents identifying as Non-Hispanic or Latino  Asian.",
        ),
        source: tooltips.getSource("non_hispanic_asian_pct"),
        getValue: (p) => num(p.asian_nh_pct),
        getCountyAvg: (p) => num(p.county_avg_asian_nh_pct),
      },
      {
        id: "two_or_more_races_nh_pct",
        category: "Demographics",
        direction: "neutral",
        label: "Two or More Races",
        format: "percent",
        tooltip: tooltips.getTooltip("two_or_more_races"),
        source: tooltips.defaultSource,
        getValue: (p) => num(p.two_or_more_races_nh_pct),
        getCountyAvg: (p) => num(p.county_avg_two_or_more_races_nh_pct),
      },
      {
        id: "other_race_nh_pct",
        category: "Demographics",
        direction: "neutral",
        label: "Another Race",
        format: "percent",
        tooltip: tooltips.getTooltip("other_race"),
        source: tooltips.defaultSource,
        getValue: (p) => num(p.other_race_nh_pct),
        getCountyAvg: (p) => num(p.county_avg_other_race_nh_pct),
      },
    ];

    const METRIC_CARDS = [
      { metricId: "case_rate" },
      { metricId: "median_income" },
      { metricId: "non_poverty_rate" },
      { metricId: "insured_pct" },
      { metricId: "housing_expense_under30" },
      { metricId: "education_attainment_rate" },
    ];

    function setDashboardYearText() {
      const dashboardYear = document.getElementById("brandYear");
      dashboardYear.textContent = `${start_year}-${end_year}`;
    }
    setDashboardYearText();

    function initializeTooltips() {
      document.querySelectorAll(".metric-card").forEach((card) => {
        const metricCardId = card.dataset.metricId;
        const cardData = metricCatalog.find((a) => a.id === metricCardId);
        const tooltipText =
          (cardData && cardData.tooltip) || tooltips.getTooltip(metricCardId);
        const label =
          (cardData && cardData.label) || tooltips.getLabel(metricCardId);
        const source =
          (cardData && cardData.source) || tooltips.getSource(metricCardId);

        const icon = card.querySelector(".info-icon");
        if (icon) {
          if (tooltipText) icon.setAttribute("data-tooltip", tooltipText);
          if (label) icon.setAttribute("data-title", label);
          if (source) icon.setAttribute("data-source", source);
        }
        if (label) {
          const title = card.querySelector(".metric-title span");
          if (title) title.textContent = label;
        }
      });
    }
    initializeTooltips();
    let customStyle_;
    if (typeof CUSTOM_MAP_STYLE !== "undefined") {
      customStyle_ = CUSTOM_MAP_STYLE;
    } else {
      try {
        const styleResp = await fetch(CUSTOM_STYLE_PATH);
        if (!styleResp.ok)
          throw new Error(
            `Could not load custom style at ${CUSTOM_STYLE_PATH}`,
          );
        customStyle_ = await styleResp.json();
      } catch (e) {
        console.error(e);
      }
    }

    function splitStyleByLabels(style) {
      if (!style) return { base: null, labelsOnly: null };
      const base = JSON.parse(JSON.stringify(style));
      const labelsOnly = JSON.parse(JSON.stringify(style));
      base.layers = (style.layers || []).filter((l) => l.type !== "symbol");
      labelsOnly.layers = (style.layers || []).filter(
        (l) => l.type === "symbol",
      );
      return { base, labelsOnly };
    }
    const { base: baseStyle_, labelsOnly: labelStyle_ } =
      splitStyleByLabels(customStyle_);

    const baseVectorTileLayer = new VectorTileLayer({
      url: "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer",
      style: baseStyle_,
    });
    const labelVectorTileLayer = new VectorTileLayer({
      url: "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer",
      style: labelStyle_,
    });

    const customBasemap = new Basemap({
      baseLayers: [baseVectorTileLayer],
      referenceLayers: [labelVectorTileLayer],
    });

    const map = new EsriMap({ basemap: customBasemap });
    const center = [-80.84, 35.23];
    const buffer = 0.2;
    const extent = new Extent({
      xmin: center[0] - buffer,
      ymin: center[1] - buffer,
      xmax: center[0] + buffer,
      ymax: center[1] + buffer + 0.05,
      spatialReference: { wkid: 4326 },
    });

    const view = new MapView({
      container: "map",
      map: map,
      center: center,
      zoom: 8,
      popupEnabled: false,
      constraints: {
        minZoom: 8,
        maxZoom: 11,
        snapToZoom: false,
        geometry: extent,
      },
      highlightOptions: {
        color: [17, 24, 39, 1],
        haloOpacity: 1,
        fillOpacity: 0.12,
      },
    });

	  
	const mapEl = document.getElementById("map");
	if (mapEl) {
	  mapEl.setAttribute("tabindex", "0");
	  mapEl.setAttribute("role", "application");
	  mapEl.setAttribute(
		"aria-label",
		"Interactive map of Mecklenburg County ZIP codes. Use arrow keys to move between ZIP areas. Press Enter or Space to pin the focused ZIP. Press Escape to clear."
	  );
	}
	  
	  
	  
    const fixedGL = new GraphicsLayer();
    const searchGL = new GraphicsLayer();
    const selectionGL = new GraphicsLayer();
    map.addMany([fixedGL, selectionGL, searchGL]);

    let zipFL = null,
      zipLV = null,
      pinHandle = null,
      pinHandleB = null,
      initialViewExtent = null;

    let zipGeojson = null,
      currentBreaks = [],
      pinnedZip = null,
      pinnedZipB = null,
      hoverZip = null;
	  
	let focusedZipIndex = -1;
	let interactiveZips = [];
	  
    const EXCLUDED_ZIPS = new Set([
      "28104",
      "28107",
      "28115",
      "28120",
      "28075",
      "28223",
    ]);
    const featureByZip = new Map(),
      geomByZip = new Map(),
      oidByZip = new Map(),
      bboxByZip = new Map();

    const statusEl = document.getElementById("status"),
      infoTitle = document.getElementById("infoTitle"),
      infoCaseCount = document.getElementById("infoCaseCount"),
      infoCaseRate = document.getElementById("infoCaseRate"),
      infoIncome = document.getElementById("infoIncome"),
      infoPoverty = document.getElementById("infoPoverty"),
      infoBurdened = document.getElementById("infoBurdened"),
      infoUninsured = document.getElementById("infoUninsured"),
      infoHighSchool = document.getElementById("infoHighSchool"),
      clearPin = document.getElementById("clearPin"),
      legendTitle = document.getElementById("legendTitle"),
      legendBuckets = document.getElementById("legendBuckets"),
      zipAcsBody = document.getElementById("zipAcsBody"),
      brandIcon = document.getElementById("brandIcon"),
      searchForm = document.getElementById("searchForm"),
      searchInput = document.getElementById("searchInput"),
      searchSuggestions = document.getElementById("searchSuggestions");

    /* ---- Caches (populated after data load) ---- */
    const zipDataCache = new Map(); // zip → { metricId: { value, formatted, countyAvg, fmtAvg } }
    const countyAvgCache = new Map(); // metricId → number
    const compareHtmlCache = new Map(); // "zipA:zipB" → html string
    const demoHtmlCache = new Map(); // zip → html string

    /* ---- Value helpers for ZIPs ---- */
    function getVal(zip, metric = null) {
      const m = metric || metricCatalog.find((x) => x.id === "case_rate");
      if (!m) return null;
      const f = featureByZip.get(zip);
      if (!f || !f.properties) return null;
      return m.getValue(f.properties);
    }

    function getZipColor(z) {
      if (!z) return "#6B8E7F";
      if (EXCLUDED_ZIPS.has(z)) return "#c4b5a5";
      const v = getVal(z);
      if (v === null || !currentBreaks || currentBreaks.length < 2)
        return "#DCCFC0";
      for (let i = 0; i < currentBreaks.length - 1; i++) {
        if (v <= currentBreaks[i + 1]) return BUCKET_COLORS[i];
      }
      return BUCKET_COLORS[BUCKET_COLORS.length - 1] || "#6B8E7F";
    }

    function getCountyAvg(metric) {
      if (!metric) return null;
      if (countyAvgCache.has(metric.id)) return countyAvgCache.get(metric.id);

      let sum = 0,
        count = 0;
      for (const [z, f] of featureByZip.entries()) {
        if (!EXCLUDED_ZIPS.has(z) && f.properties) {
          const avg = metric.getCountyAvg(f.properties);
          if (avg !== null && Number.isFinite(avg)) return avg;
          const val = metric.getValue(f.properties);
          if (val !== null && Number.isFinite(val)) {
            sum += val;
            count++;
          }
        }
      }
      return count > 0 ? sum / count : null;
    }

    function getCityForZip(zip) {
      const f = featureByZip.get(zip);
      const name = f?.properties?.po_name
        ? String(f.properties.po_name).trim()
        : "";
      if (!name) return "Mecklenburg";
      return name
        .replace(/,\s*NC$/i, "")
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    function buildCaches() {
      countyAvgCache.clear();
      zipDataCache.clear();
      compareHtmlCache.clear();
      demoHtmlCache.clear();

      for (const metric of metricCatalog) {
        let cachedAvg = null;
        let sum = 0;
        let count = 0;
        for (const [z, f] of featureByZip.entries()) {
          if (!EXCLUDED_ZIPS.has(z) && f.properties) {
            const avg = metric.getCountyAvg(f.properties);
            if (avg !== null && Number.isFinite(avg)) {
              cachedAvg = avg;
              break;
            }
            const val = metric.getValue(f.properties);
            if (val !== null && Number.isFinite(val)) {
              sum += val;
              count++;
            }
          }
        }
        if (cachedAvg === null && count > 0) {
          cachedAvg = sum / count;
        }
        if (cachedAvg !== null) {
          countyAvgCache.set(metric.id, cachedAvg);
        }
      }

      for (const [zip, feat] of featureByZip.entries()) {
        const entry = {};
        for (const metric of metricCatalog) {
          const value = metric.getValue(feat.properties);
          const avg = countyAvgCache.get(metric.id) ?? null;
          entry[metric.id] = {
            value,
            formatted: fmt(value, metric.format),
            countyAvg: avg,
            fmtAvg: fmt(avg, metric.format),
          };
        }
        zipDataCache.set(zip, entry);
      }
    }

    function geojsonToPolygon(geom) {
      if (!geom) return null;
      let rings = [];
      if (geom.type === "Polygon") rings = geom.coordinates;
      else if (geom.type === "MultiPolygon")
        geom.coordinates.forEach((poly) => poly.forEach((r) => rings.push(r)));
      else return null;
      if (!rings.length) return null;
      return new Polygon({ rings: rings, spatialReference: { wkid: 4326 } });
    }

    const bboxCache = new Map(); // zip → [minLng, minLat, maxLng, maxLat]

    function computeBBox(feat) {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      const g = feat.geometry;
      if (!g || !g.coordinates) return null;
      const rings =
        g.type === "Polygon"
          ? [g.coordinates[0]]
          : g.type === "MultiPolygon"
            ? g.coordinates.map((p) => p[0])
            : [];
      for (const ring of rings) {
        for (const [x, y] of ring) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
      return [minX, minY, maxX, maxY];
    }

    function buildBBoxCache() {
      bboxCache.clear();
      for (const f of (zipGeojson && zipGeojson.features) || []) {
        const z = getZip(f.properties || {});
        if (z) bboxCache.set(z, computeBBox(f));
      }
    }

    function pointInRing(pt, ring) {
      const x = pt[0],
        y = pt[1];
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0],
          yi = ring[i][1];
        const xj = ring[j][0],
          yj = ring[j][1];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
          inside = !inside;
      }
      return inside;
    }

    function pointInGeom(pt, geom) {
      if (!geom) return false;
      if (geom.type === "Polygon") {
        if (!geom.coordinates || !geom.coordinates.length) return false;
        if (!pointInRing(pt, geom.coordinates[0])) return false;
        for (let i = 1; i < geom.coordinates.length; i++) {
          if (pointInRing(pt, geom.coordinates[i])) return false;
        }
        return true;
      }
      if (geom.type === "MultiPolygon") {
        if (!geom.coordinates) return false;
        for (const poly of geom.coordinates) {
          if (!poly || !poly.length) continue;
          if (pointInRing(pt, poly[0])) {
            let inHole = false;
            for (let i = 1; i < poly.length; i++) {
              if (pointInRing(pt, poly[i])) {
                inHole = true;
                break;
              }
            }
            if (!inHole) return true;
          }
        }
      }
      return false;
    }

    function pointInFeat(pt, feat) {
      return feat ? pointInGeom(pt, feat.geometry) : false;
    }

    function hexToRgb(hex) {
      hex = String(hex).replace("#", "");
      if (hex.length === 3)
        hex = hex
          .split("")
          .map((c) => c + c)
          .join("");
      const n = parseInt(hex, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function fillColor(hex, alpha) {
      const c = hexToRgb(hex);
      return [c[0], c[1], c[2], alpha];
    }

    function quantile(values, n = 3) {
      if (!values.length) return [];
      const s = [...values].sort((a, b) => a - b),
        b = [];
      for (let i = 0; i <= n; i++) {
        const p = ((s.length - 1) * i) / n,
          l = Math.floor(p),
          u = Math.ceil(p),
          f = p - l;
        b.push(s[l] + (s[u] - s[l]) * f);
      }
      return b;
    }

    function allRows() {
      const rows = [];
      for (const [z, f] of featureByZip.entries()) {
        if (EXCLUDED_ZIPS.has(z)) continue;
        const v = getVal(z);
        if (v !== null) rows.push({ zip: z, value: v, feature: f });
      }
      return rows.sort((a, b) => b.value - a.value);
    }

    function makeRenderer() {
      const infos = [];
      for (let i = 0; i < currentBreaks.length - 1; i++) {
        infos.push({
          minValue: i === 0 ? -1e308 : currentBreaks[i],
          maxValue:
            i === currentBreaks.length - 2 ? 1e308 : currentBreaks[i + 1],
          symbol: {
            type: "simple-fill",
            color: fillColor(BUCKET_COLORS[i], 0.8),
            outline: { color: [255, 255, 255, 1], width: 1.1 },
          },
        });
      }
      return {
        type: "class-breaks",
        field: "val",
        defaultSymbol: {
          type: "simple-fill",
          color: fillColor("#d1d5db", 0.8),
          outline: { color: [156, 163, 175, 1], width: 1.4 },
        },
        classBreakInfos: infos,
      };
    }

    function fixedSymbol() {
      return new SimpleFillSymbol({
        color: fillColor("#c4b5a5", 0.95),
        outline: { color: "#faf9f8", width: 1.6 },
      });
    }

    function buildLayers() {
      const values = allRows().map((d) => d.value);
      currentBreaks = quantile(values, 3);
      geomByZip.clear();
      oidByZip.clear();
      bboxByZip.clear();

      const flSource = [],
        fixedGraphics = [];
      let oid = 1,
        fullExtent = null;

      for (const f of zipGeojson.features || []) {
        const z = getZip(f.properties || {});
        if (!z) continue;
        const poly = geojsonToPolygon(f.geometry);
        if (!poly) continue;
        geomByZip.set(z, poly);
        const ext = poly.extent;
        if (ext) {
          bboxByZip.set(z, [ext.xmin, ext.ymin, ext.xmax, ext.ymax]);
          fullExtent = fullExtent ? fullExtent.union(ext) : ext.clone();
        }
        if (EXCLUDED_ZIPS.has(z)) {
          fixedGraphics.push(
            new Graphic({
              geometry: poly,
              attributes: { zip: z },
              symbol: fixedSymbol(),
            }),
          );
        } else {
          const id = oid++;
          oidByZip.set(z, id);
          flSource.push(
            new Graphic({
              geometry: poly,
              attributes: { objectid: id, zip: z, val: getVal(z) },
            }),
          );
        }
      }

      const mapContainer = document.getElementById("map");
      if (mapContainer) {
        mapContainer.style.opacity = "0";
        mapContainer.style.transition = "opacity 0.8s ease-in-out";
      }

      fixedGL.removeAll();
      fixedGL.addMany(fixedGraphics);

      if (zipFL) map.remove(zipFL);

      zipFL = new FeatureLayer({
        source: flSource,
        objectIdField: "objectid",
        fields: [
          { name: "objectid", type: "oid" },
          { name: "zip", type: "string" },
          { name: "val", type: "double" },
        ],
        geometryType: "polygon",
        spatialReference: { wkid: 4326 },
        renderer: makeRenderer(),
        popupEnabled: false,
      });

      map.add(zipFL, 0);

      view.whenLayerView(zipFL).then((lv) => {
        zipLV = lv;
        setTimeout(() => {
          if (mapContainer) mapContainer.style.opacity = "1";
        }, 50);
      });

      if (fullExtent) {
        const zoomLevel = getZoomLevel();
        view
          .goTo({
            center: [-80.84, 35.26],
            zoom: zoomLevel,
            duration: 1200,
          })
          .then(() => {
            initialViewExtent = view.extent.clone();
          })
          .catch(() => {});
      }
    }
    function getZoomLevel() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (width < 900) {
        return 8.75; // Mobile
      } else if (width < 1080) {
        return 8.76; // Tablet
      } else if (width < 1800) {
        return 9.45; // Desktop
      } else {
        return 9.85;
      }
    }
    function renderAcsTooltip(){
      const acsTooltip = document.getElementById('acs-tooltip');
      acsTooltip.setAttribute('data-tooltip', `U.S. Census Bureau, American Community Survey (ACS),<br> ${ACS_PERIOD} 5-year estimates.`);

    }
    
    renderAcsTooltip();

    function highlightPins() {
      selectionGL.removeAll();
      if (pinHandle) {
        pinHandle.remove();
        pinHandle = null;
      }
      if (pinHandleB) {
        pinHandleB.remove();
        pinHandleB = null;
      }

      if (pinnedZip) {
        const g = geomByZip.get(pinnedZip);
        if (g) {
          selectionGL.add(
            new Graphic({
              geometry: g,
              symbol: new SimpleFillSymbol({
                color: [59, 130, 246, 0.25],
                outline: { color: [255, 255, 255, 1], width: 4.5 },
              }),
            }),
          );
          selectionGL.add(
            new Graphic({
              geometry: g,
              symbol: new SimpleFillSymbol({
                color: [0, 0, 0, 0],
                outline: { color: [59, 130, 246, 1], width: 2 },
              }),
            }),
          );
        }
      }

      if (pinnedZipB) {
        const gB = geomByZip.get(pinnedZipB);
        if (gB) {
          selectionGL.add(
            new Graphic({
              geometry: gB,
              symbol: new SimpleFillSymbol({
                color: [255, 190, 0, 0.22],
                outline: { color: [255, 255, 255, 1], width: 4.5 },
              }),
            }),
          );
          selectionGL.add(
            new Graphic({
              geometry: gB,
              symbol: new SimpleFillSymbol({
                color: [0, 0, 0, 0],
                outline: { color: [217, 119, 6, 1], width: 2 },
              }),
            }),
          );
        }
      }
    }

    function updateLegend() {
      const LEGEND_LABELS = ["High", "Medium", "Low"];
      const tipText = tooltips.getTooltip(
        "None",
        `Number of court cases between ${YEAR_START} and ${YEAR_END} per 1,000 residents age 16 and over. Higher means more frequent contact with the court system per resident.`,
      );
      const sourceText = tooltips.getSource("case_rate");

      if (legendTitle) {
        legendTitle.innerHTML = `<span class="legend-title-name">Court Case Rate</span>${getInfoIcon(tipText, "Court Case Rate", sourceText)}`;
      }
      if (!legendBuckets) return;

      if (!currentBreaks || currentBreaks.length < 2) {
        legendBuckets.innerHTML = `<div class="legend-row"><span class="swatch nodata"></span><span>No mapped values</span></div>`;
        return;
      }

      const legendInfoIcon = legendTitle
        ? legendTitle.querySelector(".info-icon")
        : null;
      if (legendInfoIcon) {
        const rangeData = [];
        for (let i = currentBreaks.length - 2; i >= 0; i--) {
          rangeData.push({
            lo: fmt(currentBreaks[i], "rate"),
            hi: fmt(currentBreaks[i + 1], "rate"),
            color: BUCKET_COLORS[i],
          });
        }
        rangeData.push({
          text: "Excluded Area",
          color: "#c4b5a5",
        });
        legendInfoIcon.setAttribute(
          "data-legend-ranges",
          JSON.stringify(rangeData),
        );
      }

      let html = "";
      for (let i = currentBreaks.length - 2; i >= 0; i--) {
        const label =
          LEGEND_LABELS[currentBreaks.length - 2 - i] || `Tier ${i + 1}`;
        html += `<div class="legend-row">
          <span class="swatch" style="background:${BUCKET_COLORS[i]};"></span>
          <span class="legend-label-text">${label}</span>
        </div>`;
      }

      html += `<div class="legend-row mt-1" style="border-top: 1px solid rgba(0,0,0,0.08); padding-top: 5px;">
        <span class="swatch" style="background:#c4b5a5; border: 1px solid #a89887;"></span>
        <span style="color:#64748b; font-size:11.5px;">Excluded Area</span>
      </div>`;

      legendBuckets.innerHTML = html;
    }

    function addFooter() {
      const footer = document.querySelector(".footer");
      if (!footer) return;
      footer.innerHTML = ``;
      footer.classList.add("fade-in");
    }

    function updateCardDOM(metricId, value, countyAvg, metric) {
      const cardEl = document.querySelector(
        `.metric-card[data-metric-id="${metricId}"]`,
      );
      if (!cardEl) return;

      const valueEl = cardEl.querySelector('[data-role="value"]');
      const deltaEl = cardEl.querySelector('[data-role="delta"]');
      const avgEl = cardEl.querySelector('[data-role="avg"]');

      if (valueEl) {
        valueEl.classList.remove("skeleton");
        valueEl.textContent = value !== null ? fmt(value, metric.format) : "—";
      }

      if (deltaEl) {
        deltaEl.classList.remove("skeleton");
        if (value === null || countyAvg === null) {
          deltaEl.className = "delta";
          deltaEl.innerHTML = `<span style="color:#9ca3af; font-size:11px;">—</span>`;
        } else {
          const diff = value - countyAvg;
          if (Math.abs(diff) < 0.05) {
            deltaEl.className = "delta";
            deltaEl.innerHTML = `<span style="color:#6b7280; font-size:11px;">${fmt(0, metric.format)}</span>`;
          } else {
            const isUp = diff > 0;
            const isGood =
              metric.direction === "up"
                ? diff >= 0
                : metric.direction === "down"
                  ? diff <= 0
                  : true;
            deltaEl.className = "delta" + (isGood ? "" : " negative");
            const iconClass = isUp ? "bi-caret-up-fill" : "bi-caret-down-fill";
            deltaEl.innerHTML = `<i class="bi ${iconClass}"></i>`;
          }
        }
      }

      if (avgEl) {
        avgEl.textContent =
          countyAvg !== null ? fmt(countyAvg, metric.format) : "—";
      }
    }

    function renderMetricCards(targetZip) {
      const cardsHeading = document.getElementById("cardsHeading");
      const cached = targetZip ? zipDataCache.get(targetZip) : null;

      if (targetZip) {
        if (EXCLUDED_ZIPS.has(targetZip)) {
          if (cardsHeading)
            cardsHeading.innerHTML = `ZIP ${targetZip} <span class="badge" style="background:#c4b5a5;color:#ffffff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;vertical-align:1px;">EXCLUDED</span>`;
          for (const cfg of METRIC_CARDS) {
            const metric = metricCatalog.find((m) => m.id === cfg.metricId);
            if (!metric) continue;
            const avg = countyAvgCache.get(metric.id) ?? null;
            updateCardDOM(cfg.metricId, null, avg, metric);
          }
          return;
        }

        const isPinned = targetZip === pinnedZip;
        if (cardsHeading) {
          cardsHeading.innerHTML = isPinned
            ? `ZIP ${targetZip} <span class="badge bg-secondary ms-1" style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;vertical-align:1px;">PINNED</span>`
            : `ZIP ${targetZip}`;
        }

        for (const cfg of METRIC_CARDS) {
          const metric = metricCatalog.find((m) => m.id === cfg.metricId);
          if (!metric) continue;
          const d = cached ? cached[metric.id] : null;
          const value = d ? d.value : getVal(targetZip, metric);
          const avg = d ? d.countyAvg : getCountyAvg(metric);
          updateCardDOM(cfg.metricId, value, avg, metric);
        }
      } else {
        if (cardsHeading)
          cardsHeading.textContent = "Hover Over or Click a ZIP Area";
        for (const cfg of METRIC_CARDS) {
          const metric = metricCatalog.find((m) => m.id === cfg.metricId);
          if (!metric) continue;
          const avg = countyAvgCache.get(metric.id) ?? null;
          updateCardDOM(cfg.metricId, null, avg, metric);
        }
      }
    }

    const DEMO_PCT_METRICS = [
      "white_nh_pct",
      "black_nh_pct",
      "hispanic_pct",
      "asian_nh_pct",
      "two_or_more_races_nh_pct",
      "other_race_nh_pct",
    ]
      .map((id) => metricCatalog.find((m) => m.id === id))
      .filter(Boolean);

    function buildDemoHtml(targetZip) {
      const cached = zipDataCache.get(targetZip);
      const popM = metricCatalog.find((m) => m.id === "total_population");
      const popVal = cached
        ? cached.total_population?.value
        : popM
          ? getVal(targetZip, popM)
          : null;
      let html = "";
      if (popM && popVal !== null) {
        html += `<div class="acs-row"><span class="acs-name">${popM.label}</span><span class="acs-val">${fmt(popVal, popM.format)}</span></div>`;
      }

      if (DEMO_PCT_METRICS.length > 0) {
        let totalPct = 0;
        let barHtml = `<div class="demo-bar mt-2">`;
        let legendHtml = `<div class="demo-legend">`;
        for (const m of DEMO_PCT_METRICS) {
          const val = cached
            ? cached[m.id]?.value || 0
            : getVal(targetZip, m) || 0;
          totalPct += val;
          const color = DEMO_COLORS[m.id] || "#cbd5e1";
          if (val > 0) {
            barHtml += `<div class="demo-segment" style="width:${val}%; background:${color};" title="${m.label}: ${fmt(val, "percent")}"></div>`;
          }
          legendHtml += `<div class="demo-legend-item" title="${m.label}: ${fmt(val, "percent")}">
            <span class="demo-swatch" style="background:${color}"></span>
            <span class="demo-label">${m.label}${getInfoIcon(m.tooltip, m.label, m.source || tooltips.getSource(m.id))}</span>
            <span class="demo-val">${fmt(val, "percent")}</span>
          </div>`;
        }
        if (totalPct < 99.5) {
          const other = Math.max(0, 100 - totalPct);
          barHtml += `<div class="demo-segment" style="width:${other}%; background:#e5e7eb;" title="Other: ${fmt(other, "percent")}"></div>`;
        }
        barHtml += `</div>`;
        legendHtml += `</div>`;
        html += `<div class="demo-container">${barHtml}${legendHtml}</div>`;
      }
      return html;
    }

    function renderDemographics(targetZip) {
      const demographicsTitle = document.getElementById("demographicsTitle");
      const demographicsBody = document.getElementById("demographicsBody");
      if (!demographicsBody) return;

      if (targetZip) {
        if (EXCLUDED_ZIPS.has(targetZip)) {
          if (demographicsTitle)
            demographicsTitle.textContent = `Demographics · ZIP ${targetZip}`;
          demographicsBody.innerHTML = `<div class="acs-empty text-muted small">Demographic data is unavailable for this excluded ZIP code area.</div>`;
          return;
        }

        if (demographicsTitle)
          demographicsTitle.textContent = `Demographics · ZIP ${targetZip}`;

        if (demoHtmlCache.has(targetZip)) {
          demographicsBody.innerHTML = demoHtmlCache.get(targetZip);
        } else {
          const html = buildDemoHtml(targetZip);
          demoHtmlCache.set(targetZip, html);
          demographicsBody.innerHTML = html;
        }
      } else {
        if (demographicsTitle) demographicsTitle.textContent = "Demographics";
        demographicsBody.innerHTML = `<div class="acs-empty text-muted small">Hover over or click a ZIP code on the map to see its demographic breakdown.</div>`;
      }
    }

    function renderZipAcsCompare(zipA, zipB) {
      const isZipAValid = Boolean(zipA && zipA !== "—" && zipA !== "-");
      const isZipBValid = Boolean(zipB && zipB !== "—" && zipB !== "-");

      const indicators = [
        {
          id: "courtCaseRate",
          metric: metricCatalog.find((m) => m.id === "case_rate"),
          label: "Court Case Rate",
          star: false,
          subtext: "lower is better",
          format: "rate",
        },
        {
          id: "courtCaseCount",
          metric: metricCatalog.find((m) => m.id === "total_case_count"),
          label: "Court Case Count",
          star: false,
          subtext: "total resident cases",
          format: "number",
        },
        {
          id: "medianIncome",
          metric: metricCatalog.find((m) => m.id === "median_income"),
          label: "Median Household Income",
          star: false,
          subtext: "higher is better",
          format: "currency",
        },
        {
          id: "nonPovertyRate",
          metric: metricCatalog.find((m) => m.id === "non_poverty_rate"),
          label: "Non-Poverty Rate",
          star: false,
          subtext: "higher is better",
          format: "percent",
        },
        {
          id: "healthInsurance",
          metric: metricCatalog.find((m) => m.id === "insured_pct"),
          label: "Health Insurance",
          star: false,
          subtext: "higher is better",
          format: "percent",
        },
        {
          id: "housingCost",
          metric: metricCatalog.find((m) => m.id === "housing_expense_under30"),
          label: "Housing",
          star: false,
          subtext: "higher is better",
          format: "percent",
        },
        {
          id: "educationAttainment",
          metric: metricCatalog.find(
            (m) => m.id === "education_attainment_rate",
          ),
          label: "Educational Attainment",
          star: false,
          subtext: "higher is better",
          format: "percent",
        },
      ];

      const pinSvg = (cls) =>
        `<svg class="cmp-slot-pin ${cls}" viewBox="0 0 16 16" width="15" height="15" fill="currentColor"><path d="M8 0a5 5 0 0 0-5 5c0 3.75 5 11 5 11s5-7.25 5-11a5 5 0 0 0-5-5zm0 7.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>`;

      let html = `
        <div class="cmp-container">
          <div class="cmp-top-bar">
            <span class="cmp-top-title">COMPARE TWO ZIP CODES</span>
            <button id="exitCompareBtn" class="cmp-exit-btn" type="button" title="Exit Compare Mode">
              <span class="cmp-exit-x">✕</span> Exit
            </button>
          </div>

          <div class="cmp-slots-grid">
            <div class="cmp-slot-card slot-1 ${isZipAValid ? "selected" : "active-slot"}" id="cmpSlot1">
              ${
                isZipAValid
                  ? `
                <div class="cmp-slot-header">
                  ${pinSvg("blue")}
                  <span class="cmp-slot-badge blue">ZIP #1</span>
                  <button class="cmp-slot-clear" id="clearSlot1" title="Clear ZIP #1">✕</button>
                </div>
                <div class="cmp-slot-val blue">ZIP ${zipA}</div>
              `
                  : `
                ${pinSvg("blue")}
                <span class="cmp-slot-prompt">Click a map ZIP or search to pick ZIP #1</span>
              `
              }
            </div>

            <div class="cmp-slot-card slot-2 ${isZipBValid ? "selected" : isZipAValid ? "active-slot" : ""}" id="cmpSlot2">
              ${
                isZipBValid
                  ? `
                <div class="cmp-slot-header">
                  ${pinSvg("orange")}
                  <span class="cmp-slot-badge orange">ZIP #2</span>
                  <button class="cmp-slot-clear" id="clearSlot2" title="Clear ZIP #2">✕</button>
                </div>
                <div class="cmp-slot-val orange">ZIP ${zipB}</div>
              `
                  : `
                ${pinSvg("orange")}
                <span class="cmp-slot-prompt">Click a map ZIP or search to pick ZIP #2</span>
              `
              }
            </div>
          </div>

          <div class="cmp-table">
            <div class="cmp-table-header">
              <div class="cmp-th-metric">Indicator</div>
              <div class="cmp-th-col cmp-th-avg">County Avg</div>
              <div class="cmp-th-col">
                <div class="cmp-th-slot-wrap">
                  <span class="cmp-slot-num slot-1">1</span>
                  <span class="cmp-th-zip slot-1">${isZipAValid ? zipA : "—"}</span>
                </div>
              </div>
              <div class="cmp-th-col">
                <div class="cmp-th-slot-wrap">
                  <span class="cmp-slot-num slot-2">2</span>
                  <span class="cmp-th-zip slot-2">${isZipBValid ? zipB : "—"}</span>
                </div>
              </div>
            </div>
            <div class="cmp-table-body">
      `;

      for (const item of indicators) {
        const m = item.metric;
        if (!m) continue;
        const cAvg = getCountyAvg(m);
        const valA = isZipAValid ? getVal(zipA, m) : null;
        const valB = isZipBValid ? getVal(zipB, m) : null;

        const tooltipText = m.tooltip || tooltips.getTooltip(item.id || m.id);
        const label = item.label || m.label;

        html += `
          <div class="cmp-table-row">
            <div class="cmp-metric-cell">
              <div class="cmp-metric-title-wrap">
                <span class="cmp-metric-name">${label}${item.star ? "*" : ""}</span>
                ${getInfoIcon(tooltipText, label, tooltips.getSource(item.id || m.id))}
              </div>
              <div class="cmp-metric-sub">${item.subtext}</div>
            </div>
            <div class="cmp-val-cell cmp-val-avg">${fmt(cAvg, item.format)}</div>
            <div class="cmp-val-cell cmp-val-1">${isZipAValid ? fmt(valA, item.format) : "—"}</div>
            <div class="cmp-val-cell cmp-val-2">${isZipBValid ? fmt(valB, item.format) : "—"}</div>
          </div>
        `;
      }
      let windowWidth = window.innerWidth;
      if (windowWidth < 1500) {
        html += `
            </div>
            <div class="cmp-footnote">
           For community well-being indicators, higher values are better; for court case indicators, lower values are better.
            </div>
          </div>
        </div>
      `;
      }

      if (zipAcsBody) {
        zipAcsBody.innerHTML = html;

        const exitBtn = zipAcsBody.querySelector("#exitCompareBtn");
        if (exitBtn) exitBtn.addEventListener("click", toggleCompareMode);

        const clear1 = zipAcsBody.querySelector("#clearSlot1");
        if (clear1) {
          clear1.addEventListener("click", (e) => {
            e.stopPropagation();
            setPins(pinnedZipB || null, null);
          });
        }

        const clear2 = zipAcsBody.querySelector("#clearSlot2");
        if (clear2) {
          clear2.addEventListener("click", (e) => {
            e.stopPropagation();
            setPins(pinnedZip, null);
          });
        }
      }
    }

    let isCompareMode = false;
    let currentAcsKey = "";

    const _compareCard = document.getElementById("compareCard");
    const _cardsHeading = document.getElementById("cardsHeading");
    const _metricCardsContainer = document.getElementById(
      "metricCardsContainer",
    );
    const _demographicsCard = document.getElementById("demographicsCard");

    function refreshAcs() {
      if (isCompareMode) {
        if (_cardsHeading) _cardsHeading.classList.add("d-none");
        if (_metricCardsContainer)
          _metricCardsContainer.classList.add("d-none");
        if (_demographicsCard) _demographicsCard.classList.add("d-none");
        if (_compareCard) _compareCard.classList.remove("d-none");

        const key = `cmp:${pinnedZip || "none"}:${pinnedZipB || "none"}`;
        if (currentAcsKey !== key) {
          currentAcsKey = key;
          renderZipAcsCompare(pinnedZip, pinnedZipB);
        }
      } else {
        if (_compareCard) _compareCard.classList.add("d-none");
        if (_cardsHeading) _cardsHeading.classList.remove("d-none");
        if (_metricCardsContainer)
          _metricCardsContainer.classList.remove("d-none");
        if (_demographicsCard) _demographicsCard.classList.remove("d-none");

        const target = pinnedZip || hoverZip || null;
        const key = `single:${target}:${pinnedZip ? "pin" : "hover"}`;
        if (currentAcsKey !== key) {
          currentAcsKey = key;
          renderMetricCards(target);
          renderDemographics(target);
        }
      }
    }
    const infoPanel = document.getElementById("infoPanel");

    function clearPanel() {
      if (infoTitle) infoTitle.textContent = "—";
      if (infoCaseCount) infoCaseCount.textContent = "—";
      if (infoCaseRate) infoCaseRate.textContent = "—";
      if (infoIncome) infoIncome.textContent = "—";
      if (infoPoverty) infoPoverty.textContent = "—";
      if (infoBurdened) infoBurdened.textContent = "—";
      if (infoUninsured) infoUninsured.textContent = "—";
      if (infoHighSchool) infoHighSchool.textContent = "—";

      const infoGridContainer = document.getElementById("infoGridContainer");
      const excludedLabel = document.getElementById("excludedLabel");
      if (infoGridContainer) infoGridContainer.classList.remove("d-none");
      if (excludedLabel) excludedLabel.classList.add("d-none");

      if (infoPanel) infoPanel.classList.add("d-none");
    }

    function positionPanelAtCursor(x, y) {
      if (!infoPanel) return;
      const mapWrap = document.querySelector(".map-wrap");
      const mapWidth = mapWrap ? mapWrap.clientWidth : view ? view.width : 1000;
      const mapHeight = mapWrap
        ? mapWrap.clientHeight
        : view
          ? view.height
          : 700;
      const panelWidth = infoPanel.offsetWidth || 220;
      const panelHeight = infoPanel.offsetHeight || 130;

      let posX = x + 18;
      let posY = y + 18;

      if (posX + panelWidth > mapWidth - 12) {
        posX = x - panelWidth - 18;
      }
      if (posY + panelHeight > mapHeight - 12) {
        posY = y - panelHeight - 18;
      }

      posX = Math.max(12, posX);
      posY = Math.max(12, posY);

      infoPanel.style.left = `${posX}px`;
      infoPanel.style.top = `${posY}px`;
      infoPanel.style.right = "auto";
      infoPanel.style.transform = "none";
    }

    function showPanel(f) {
      if (!f) return;
      const z = getZip(f.properties || {});
      const city = getCityForZip(z);

      if (infoTitle)
        infoTitle.textContent = `${z || "—"}${city ? ` (${city})` : ""}`;

      const infoHeader = document.querySelector(".info-header");
      if (infoHeader) {
        infoHeader.style.background = getZipColor(z);
      }

      const infoGridContainer = document.getElementById("infoGridContainer");
      const excludedLabel = document.getElementById("excludedLabel");

      if (EXCLUDED_ZIPS.has(z)) {
        if (infoGridContainer) infoGridContainer.classList.add("d-none");
        if (excludedLabel) {
          excludedLabel.classList.remove("d-none");
          if (z === "28223") {
            excludedLabel.innerHTML = `<span class="badge" style="color: #0f0e0eb3; font-size: 11px; font-weight: 550; padding: 4px 8px; border-radius: 6px; white-space: normal; display: inline-block; text-align: left;">This ZIP code represents UNC Charlotte’s campus. Data is not available for all community well-being indicators and is not displayed here.</span>`;
          } else {
            excludedLabel.innerHTML = `<span class="badge" style="color: #0f0e0eb3; font-size: 11px; font-weight: 550; padding: 4px 8px; border-radius: 6px; white-space: normal; display: inline-block; text-align: left;">This ZIP code is partially in an adjacent county. Data is excluded.</span>`;
          }
        }
      } else {
        if (infoGridContainer) infoGridContainer.classList.remove("d-none");
        if (excludedLabel) excludedLabel.classList.add("d-none");

        const p = f.properties || {};

        const ccVal = num(p.total_case_count);
        const ccRat = num(p.case_rate);
        const incVal = num(p.median_income);
        const povVal =
          num(p.non_poverty_rate) !== null ? num(p.non_poverty_rate) : null;
        const rentVal =
          num(p.housing_expense_under30) !== null
            ? Math.abs(num(p.housing_expense_under30))
            : null;
        const uninsVal =
          num(p.insured_rate) !== null ? num(p.insured_rate) : null;
        const highSchool = num(p.education_attainment_rate);

        if (infoCaseCount) infoCaseCount.textContent = fmt(ccVal, "number");
        if (infoCaseRate) infoCaseRate.textContent = fmt(ccRat, "rate");
        if (infoIncome) infoIncome.textContent = fmt(incVal, "currency");
        if (infoPoverty) infoPoverty.textContent = fmt(povVal, "percent");
        if (infoBurdened) infoBurdened.textContent = fmt(rentVal, "percent");
        if (infoUninsured) infoUninsured.textContent = fmt(uninsVal, "percent");
        if (infoHighSchool)
          infoHighSchool.textContent = fmt(highSchool, "percent");
      }

      if (infoPanel) infoPanel.classList.remove("d-none");
    }

    function setPins(a, b) {
      pinnedZip = a;
      pinnedZipB = b;
      highlightPins();
      refreshAcs();
    }

    function updateCompareBtnUI() {
      const compareBtn = document.getElementById("compareBtn");
      if (!compareBtn) return;
      if (isCompareMode) {
        compareBtn.classList.add("active");
        compareBtn.innerHTML = `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg> Compare`;
        compareBtn.setAttribute("title", "Exit Compare mode");
      } else {
        compareBtn.classList.remove("active");
        compareBtn.innerHTML = `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="5" height="10" rx="1" /><rect x="9" y="3" width="5" height="10" rx="1" /></svg> Compare`;
        compareBtn.setAttribute("title", "Toggle 2-ZIP Compare mode");
      }
    }

    function toggleCompareMode() {
      isCompareMode = !isCompareMode;
      currentAcsKey = "";
      updateCompareBtnUI();
      setPins(null, null);
    }

    function togglePin(z) {
      if (!z) return;
      if (!isCompareMode) {
        if (z === pinnedZip) setPins(null, null);
        else setPins(z, null);
      } else {
        if (!pinnedZip) {
          setPins(z, null);
        } else if (!pinnedZipB) {
          if (z === pinnedZip) setPins(null, null);
          else setPins(pinnedZip, z);
        } else {
          if (z === pinnedZipB) setPins(pinnedZip, null);
          else if (z === pinnedZip) setPins(pinnedZipB, null);
          else setPins(pinnedZipB, z);
        }
      }
    }

    function pinZip(z) {
      if (!isCompareMode) {
        setPins(z, null);
      } else {
        if (!pinnedZip) {
          setPins(z, null);
        } else if (z !== pinnedZip) {
          setPins(pinnedZip, z);
        }
      }
    }

    function clearPinned() {
      pinnedZip = null;
      pinnedZipB = null;
      currentAcsKey = "";
      if (pinHandle) {
        pinHandle.remove();
        pinHandle = null;
      }
      if (pinHandleB) {
        pinHandleB.remove();
        pinHandleB = null;
      }
      highlightPins();
      clearPanel();
      refreshAcs();
    }

    function showSearchMarker(lat, lng) {
      searchGL.removeAll();
      searchGL.add(
        new Graphic({
          geometry: new Point({ longitude: lng, latitude: lat }),
          symbol: new SimpleMarkerSymbol({
            style: "circle",
            color: [168, 85, 247, 1],
            size: 13,
            outline: { color: "#ffffff", width: 3 },
          }),
        }),
      );
    }
    function clearSearchMarker() {
      searchGL.removeAll();
    }

    let activeSuggestionIdx = -1;

    function hideSuggestions() {
      if (searchSuggestions) {
        searchSuggestions.classList.add("d-none");
        searchSuggestions.innerHTML = "";
      }
      activeSuggestionIdx = -1;
    }

    function updateSuggestions(val) {
      if (!searchSuggestions) return;
      const rawQuery = (val || "").trim().toLowerCase();
      if (!rawQuery) {
        hideSuggestions();
        return;
      }

      const allZips = Array.from(geomByZip.keys()).sort();
      const matches = allZips.filter((z) => {
        const city = getCityForZip(z).toLowerCase();
        return z.includes(rawQuery) || city.includes(rawQuery);
      });

      if (matches.length === 0) {
        hideSuggestions();
        return;
      }

      activeSuggestionIdx = -1;
      searchSuggestions.innerHTML = matches
        .slice(0, 8)
        .map((z, i) => {
          const city = getCityForZip(z);
          return `<div class="suggestion-item" data-zip="${z}" data-idx="${i}">
            <span><b>${z}</b></span>
            <span class="suggestion-badge">${city}</span>
          </div>`;
        })
        .join("");

      searchSuggestions.classList.remove("d-none");

      searchSuggestions
        .querySelectorAll(".suggestion-item[data-zip]")
        .forEach((el) => {
          el.addEventListener("mousedown", (e) => {
            e.preventDefault();
            const selectedZip = el.getAttribute("data-zip");
            if (selectedZip) {
              searchInput.value = selectedZip;
              handleSearch(selectedZip);
            }
          });
        });
    }

    async function handleSearch(q) {
      q = (q || "").trim();
      hideSuggestions();
      if (!q) return;

      const zipMatch = q.replace(/\D/g, "");
      if (zipMatch.length === 5 && geomByZip.has(zipMatch)) {
        clearSearchMarker();
        pinZip(zipMatch);
        const city = getCityForZip(zipMatch);
        statusEl.innerHTML = `Located <b>${zipMatch}</b> (${city}).`;
        return;
      }

      const qLower = q.toLowerCase();
      for (const [z] of geomByZip.entries()) {
        const city = getCityForZip(z).toLowerCase();
        if (city === qLower || city.includes(qLower)) {
          clearSearchMarker();
          pinZip(z);
          statusEl.innerHTML = `Located <b>${z}</b> (${getCityForZip(z)}).`;
          return;
        }
      }

      statusEl.innerHTML = `Location <b>${q}</b> not found in Mecklenburg County.`;
    }

    function buildSilhouette() {
      if (!zipGeojson) return null;
      let minLng = Infinity,
        maxLng = -Infinity,
        minLat = Infinity,
        maxLat = -Infinity;
      const allRings = [];
      for (const f of zipGeojson.features || []) {
        if (EXCLUDED_ZIPS.has(getZip(f.properties || {}))) continue;
        const g = f.geometry;
        if (!g) continue;
        const polys =
          g.type === "Polygon"
            ? [g.coordinates]
            : g.type === "MultiPolygon"
              ? g.coordinates
              : [];
        for (const poly of polys) {
          const outer = poly[0];
          allRings.push(outer);
          for (const c of outer) {
            const lng = c[0],
              lat = c[1];
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          }
        }
      }
      if (allRings.length === 0) return null;
      const w = 32,
        h = 32,
        pad = 2,
        rangeLng = maxLng - minLng,
        rangeLat = maxLat - minLat,
        scale = Math.min((w - 2 * pad) / rangeLng, (h - 2 * pad) / rangeLat),
        offsetX = (w - rangeLng * scale) / 2,
        offsetY = (h - rangeLat * scale) / 2;
      let pathD = "";
      for (const ring of allRings) {
        ring.forEach((coord, i) => {
          const x = offsetX + (coord[0] - minLng) * scale,
            y = h - (offsetY + (coord[1] - minLat) * scale);
          pathD += (i === 0 ? "M" : "L") + x.toFixed(2) + "," + y.toFixed(2);
        });
        pathD += "Z";
      }
      return pathD;
    }

    function setBrandSilhouette() {
      const path = buildSilhouette();
      if (!path || !brandIcon) return;
      brandIcon.innerHTML = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="${path}" fill="#285206" fill-rule="evenodd" opacity="0.92"/></svg>`;
      const fav = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#fff"/><path d="${path}" fill="#285206" fill-rule="evenodd"/></svg>`;
      let link = document.querySelector("link[rel='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.type = "image/svg+xml";
      link.href = "data:image/svg+xml;utf8," + encodeURIComponent(fav);
    }

    function zipAtEvent(evt) {
      const mp = view.toMap({ x: evt.x, y: evt.y });
      if (!mp) return null;
      const lng = mp.longitude,
        lat = mp.latitude;
      if (lng == null || lat == null) return null;
      const pt = [lng, lat];
      for (const f of (zipGeojson && zipGeojson.features) || []) {
        const z = getZip(f.properties || {});
        const bb = bboxCache.get(z);
        if (bb && (lng < bb[0] || lat < bb[1] || lng > bb[2] || lat > bb[3]))
          continue;
        if (pointInFeat(pt, f)) return z;
      }
      return null;
    }

    let pendingEvt = null,
      rafQueued = false;

    function processHover() {
      rafQueued = false;
      const evt = pendingEvt;
      if (!evt) return;
      const z = zipAtEvent(evt);
      if (z !== hoverZip) {
        hoverZip = z;
        if (!z) {
          clearPanel();
        } else {
          showPanel(featureByZip.get(z));
        }
        refreshAcs();
      }
      if (z) {
        positionPanelAtCursor(evt.x, evt.y);
      }
    }

		  
function buildInteractiveZipList() {
  interactiveZips = Array.from(geomByZip.keys())
    .filter((z) => !EXCLUDED_ZIPS.has(z))
    .sort();
  focusedZipIndex = -1;
}

function focusZipByIndex(idx) {
  if (!interactiveZips.length) return;
  focusedZipIndex =
    ((idx % interactiveZips.length) + interactiveZips.length) %
    interactiveZips.length;
  const z = interactiveZips[focusedZipIndex];
  hoverZip = z;
  const feat = featureByZip.get(z);
  if (feat) {
    showPanel(feat);
  } else {
    clearPanel();
  }
  refreshAcs();
}

function setupKeyboardNavigation() {
  if (!mapEl) return;

  mapEl.addEventListener("keydown", (e) => {
    if (!interactiveZips.length) return;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      focusZipByIndex(focusedZipIndex + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      focusZipByIndex(focusedZipIndex - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (hoverZip) togglePin(hoverZip);
    } else if (e.key === "Escape") {
      e.preventDefault();
      hoverZip = null;
      clearPanel();
      refreshAcs();
      focusedZipIndex = -1;
    }
  });
}
D. Call the setup after data is ready
Inside the init() function, after buildLayers(); (around line 1906), add:

js
buildInteractiveZipList();
setupKeyboardNavigation();
E. Make info icons focusable + support keyboard tooltips
At the end of the file (just before init();), replace/extend the existing mouseover/mouseout tooltip code with this improved version:

js
function makeInfoIconsAccessible() {
  document.querySelectorAll(".info-icon").forEach((icon) => {
    icon.setAttribute("tabindex", "0");
    icon.setAttribute("role", "button");
    const title = icon.getAttribute("data-title") || "More information";
    icon.setAttribute("aria-label", title);
  });
}

function showInfoTooltip(icon) {
  const text = icon.getAttribute("data-tooltip");
  const legendRanges = icon.getAttribute("data-legend-ranges");
  if (!text) return;

  let tooltipHtml = `<div class="tooltip-desc">${text}</div>`;

  if (legendRanges) {
    try {
      const ranges = JSON.parse(legendRanges);
      tooltipHtml += `<div class="tooltip-divider" style="height:1px; background:rgba(0,0,0,0.1); margin: 6px 0;"></div>`;
      tooltipHtml += `<div class="tooltip-ranges">`;
      for (const r of ranges) {
        const labelText = r.text ? r.text : `${r.lo} – ${r.hi}`;
        tooltipHtml += `<div class="tooltip-range-row" style="display:flex; align-items:center; gap:6px; margin-top:4px;">
          <span class="swatch" style="background:${r.color}; border: 1px solid rgba(0,0,0,0.1); flex-shrink:0;"></span>
          <span class="tooltip-range-val">${labelText}</span>
        </div>`;
      }
      tooltipHtml += `</div>`;
    } catch (_) {}
  }

  infoCard.innerHTML = tooltipHtml;
  infoCard.style.display = "block";
  infoCard.style.height = "auto";
  infoCard.style.minHeight = "auto";
  infoCard.style.width = "auto";
  infoCard.style.maxWidth = legendRanges ? "300px" : "240px";

  // Positioning logic (same as original mouseover)
  const sidebar = document.querySelector(".sidebar");
  const isInsideSidebar = icon.closest(".sidebar");
  const iconRect = icon.getBoundingClientRect();

  if (isInsideSidebar && sidebar) {
    const sidebarRect = sidebar.getBoundingClientRect();
    if (sidebarRect.left > 280) {
      const left = sidebarRect.left - infoCard.offsetWidth - 10;
      let top = iconRect.top + iconRect.height / 2 - infoCard.offsetHeight / 2;
      if (top < 10) top = 10;
      if (top + infoCard.offsetHeight > window.innerHeight - 10) {
        top = window.innerHeight - infoCard.offsetHeight - 10;
      }
      infoCard.style.left = left + "px";
      infoCard.style.top = top + "px";
    } else {
      infoCard.style.maxWidth = "min(240px, calc(100vw - 24px))";
      let left = Math.max(
        10,
        Math.min(
          iconRect.left + iconRect.width / 2 - infoCard.offsetWidth / 2,
          window.innerWidth - infoCard.offsetWidth - 10
        )
      );
      let top = iconRect.top - infoCard.offsetHeight - 8;
      if (top < 10) top = iconRect.bottom + 8;
      infoCard.style.left = left + "px";
      infoCard.style.top = top + "px";
    }
  } else {
    let top = iconRect.top - infoCard.offsetHeight - 10;
    let left = iconRect.left - 12;
    if (top < 10) top = iconRect.bottom + 8;
    if (left < 10) left = 10;
    if (left + infoCard.offsetWidth > window.innerWidth - 10) {
      left = window.innerWidth - infoCard.offsetWidth;
    }
    infoCard.style.top = top - 5 + "px";
    infoCard.style.left = "1rem";
  }
}

// Call this after DOM is ready (e.g. at the end of init or after initializeTooltips)
makeInfoIconsAccessible();

document.addEventListener("mouseover", (e) => {
  const icon = e.target.closest(".info-icon");
  if (icon) showInfoTooltip(icon);
});

document.addEventListener("focusin", (e) => {
  const icon = e.target.closest(".info-icon");
  if (icon) showInfoTooltip(icon);
});

document.addEventListener("mouseout", (e) => {
  const icon = e.target.closest(".info-icon");
  if (icon && (!e.relatedTarget || !icon.contains(e.relatedTarget))) {
    infoCard.style.display = "none";
  }
});

document.addEventListener("focusout", (e) => {
  const icon = e.target.closest(".info-icon");
  if (icon) {
    infoCard.style.display = "none";
  }
});
Summary of what the changes do
File	Change	WCAG benefit
index.html	Updated help text + map tabindex/role/aria-label	2.1.1, 4.1.2
styles.css	Visible :focus-visible outlines	2.4.7
scripts.js	Arrow-key ZIP navigation + Enter/Space to pin + Escape to clear	2.1.1, 2.4.3
scripts.js	Info icons become focusable and show tooltips on focus	2.1.1, 1.3.1
Mouse hover and click behavior are preserved. Keyboard users can now tab to the map, use arrow keys to move between ZIP areas, and activate them exactly like a click.

Would you like me to also generate a single complete patched scripts.js file (as a downloadable gist or via a fork), or add a fully accessible ZIP dropdown list as a stronger alternative to arrow-key cycling?



3 sources

		  
		  
		  
    view.on("pointer-move", (evt) => {
      pendingEvt = { x: evt.x, y: evt.y };
      if (!rafQueued) {
        rafQueued = true;
        requestAnimationFrame(processHover);
      }
    });

    view.on("pointer-leave", () => {
      pendingEvt = null;
      rafQueued = false;
      hoverZip = null;
      clearPanel();
      refreshAcs();
    });

    view.on("immediate-click", (evt) => {
      evt.stopPropagation();
      const z = zipAtEvent(evt);
      if (z) {
        togglePin(z);
      } else if (!isCompareMode) {
        clearPinned();
      }
    });

    async function loadDataset() {
      let rawFc = null;
      if (
        typeof MECKLENBURG_GEOJSON !== "undefined" &&
        MECKLENBURG_GEOJSON &&
        MECKLENBURG_GEOJSON.features
      ) {
        rawFc = MECKLENBURG_GEOJSON;
      } else {
        const fetchUrl = ZIP_LAYER_BASE + '/0/query?where=1%3D1&outFields=*&outSR=4326&returnGeometry=true&f=geojson'
        const r = await fetch(fetchUrl);
        if (!r.ok)
          throw new Error(`Could not fetch feature layer (HTTP ${r.status})`);
        rawFc = await r.json();
      }

      const partsByZip = new Map();
      const propsByZip = new Map();
      const order = [];

      for (const f of rawFc.features || []) {
        const p = f.properties || {};
        const z = getZip(p);
        if (!z) continue;

        if (!partsByZip.has(z)) {
          partsByZip.set(z, []);
          propsByZip.set(z, p);
          order.push(z);
        }

        const g = f.geometry;
        if (g && g.coordinates) {
          const polys =
            g.type === "Polygon"
              ? [g.coordinates]
              : g.type === "MultiPolygon"
                ? g.coordinates
                : [];
          const parts = partsByZip.get(z);
          for (const poly of polys) {
            parts.push(poly);
          }
        }
      }

      const consolidatedFeatures = [];
      featureByZip.clear();

      for (const z of order) {
        const props = propsByZip.get(z);
        const parts = partsByZip.get(z) || [];
        let geometry = null;
        if (parts.length === 1) {
          geometry = { type: "Polygon", coordinates: parts[0] };
        } else if (parts.length > 1) {
          geometry = { type: "MultiPolygon", coordinates: parts };
        }

        const feat = { type: "Feature", geometry, properties: props };
        consolidatedFeatures.push(feat);
        featureByZip.set(z, feat);

        if (props.to_exclude === 1 || props.to_exclude === "1") {
          EXCLUDED_ZIPS.add(z);
        }
      }

      zipGeojson = {
        type: "FeatureCollection",
        features: consolidatedFeatures,
      };
      buildBBoxCache();
    }

    async function init() {
      try {
        const brandTitleText = document.getElementById("brandTitleText");
        const brandYear = document.getElementById("brandYear");
        if (brandTitleText && DASHBOARD_CONFIG.title) {
          brandTitleText.textContent = DASHBOARD_CONFIG.title;
           brandYear.textContent = '';
        }

        if (statusEl)
          statusEl.innerHTML = `Loading Mecklenburg ZIP boundaries and court case dataset...`;
        await loadDataset();
        if (!zipGeojson.features.length) {
          throw new Error("No usable features found in dataset.");
        }

        await view.when();
        view.ui.move("zoom", "top-left");

        buildCaches();
        buildLayers();
		  buildInteractiveZipList();
		  setupKeyboardNavigation();
        setBrandSilhouette();
        updateLegend();
        clearPanel();
        refreshAcs();
        addFooter();

        if (statusEl) statusEl.innerHTML = "";
      } catch (e) {
        if (statusEl) {
          statusEl.innerHTML = `<span class="error">${e.message}</span><br>Check network connection and feature service availability.`;
        }
        console.error(e);
      }
    }

    if (clearPin) clearPin.addEventListener("click", clearPinned);

    if (searchForm) {
      searchForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        await handleSearch(searchInput.value);
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        updateSuggestions(searchInput.value);
      });
      searchInput.addEventListener("focus", () => {
        if (searchInput.value.trim()) {
          updateSuggestions(searchInput.value);
        }
      });
      searchInput.addEventListener("blur", () => {
        setTimeout(hideSuggestions, 200);
      });
      searchInput.addEventListener("keydown", (e) => {
        const items = searchSuggestions
          ? searchSuggestions.querySelectorAll(".suggestion-item[data-zip]")
          : [];
        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (items.length > 0) {
            activeSuggestionIdx = (activeSuggestionIdx + 1) % items.length;
            items.forEach((item, idx) => {
              item.classList.toggle("active", idx === activeSuggestionIdx);
            });
          }
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          if (items.length > 0) {
            activeSuggestionIdx =
              (activeSuggestionIdx - 1 + items.length) % items.length;
            items.forEach((item, idx) => {
              item.classList.toggle("active", idx === activeSuggestionIdx);
            });
          }
        } else if (e.key === "Enter") {
          if (activeSuggestionIdx >= 0 && items[activeSuggestionIdx]) {
            e.preventDefault();
            const selectedZip =
              items[activeSuggestionIdx].getAttribute("data-zip");
            searchInput.value = selectedZip;
            handleSearch(selectedZip);
          }
        } else if (e.key === "Escape") {
          searchInput.value = "";
          searchInput.blur();
          hideSuggestions();
          clearSearchMarker();
        }
      });
    }

    function resetView() {
      isCompareMode = false;
      currentAcsKey = "";
      updateCompareBtnUI();
      if (view) {
        if (initialViewExtent) {
          view.goTo(initialViewExtent).catch(() => {});
        } else {
          view.goTo({ center: [-80.84, 35.26], zoom: 8.78 }).catch(() => {});
        }
      }
      clearPinned();
      if (searchInput) searchInput.value = "";
      hideSuggestions();
      clearSearchMarker();
      if (statusEl) statusEl.innerHTML = "";
    }
    const compareBtn = document.getElementById("compareBtn");
    if (compareBtn) {
      compareBtn.addEventListener("click", toggleCompareMode);
    }
    const resetBtn = document.getElementById("resetBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", resetView);
    }
    const infoCard = document.createElement("div");
    infoCard.className = "info-tooltip-card shadow-sm";
    document.body.appendChild(infoCard);

    document.addEventListener("mouseover", (e) => {
      const icon = e.target.closest(".info-icon");
      if (icon) {
        const text = icon.getAttribute("data-tooltip");
        const legendRanges = icon.getAttribute("data-legend-ranges");

        if (text) {
          let tooltipHtml = `<div class="tooltip-desc">${text}</div>`;

          if (legendRanges) {
            try {
              const ranges = JSON.parse(legendRanges);

              tooltipHtml += `<div class="tooltip-divider" style="height:1px; background:rgba(0,0,0,0.1); margin: 6px 0;"></div>`;
              tooltipHtml += `<div class="tooltip-ranges">`;

              for (const r of ranges) {
                const labelText = r.text ? r.text : `${r.lo} &ndash; ${r.hi}`;
                tooltipHtml += `<div class="tooltip-range-row" style="display:flex; align-items:center; gap:6px; margin-top:4px;">
                  <span class="swatch" style="background:${r.color}; border: 1px solid rgba(0,0,0,0.1); flex-shrink:0;"></span>
                  <span class="tooltip-range-val">${labelText}</span>
                </div>`;
              }
              tooltipHtml += `</div>`;
            } catch (_) {
              /* ignore parse errors */
            }
          }
          infoCard.innerHTML = tooltipHtml;
          infoCard.style.display = "block";
          infoCard.style.height = "auto";
          infoCard.style.minHeight = "auto";
          infoCard.style.width = "auto";
          infoCard.style.maxWidth = legendRanges ? "300px" : "240px";

          const sidebar = document.querySelector(".sidebar");
          const isInsideSidebar = icon.closest(".sidebar");
          const iconRect = icon.getBoundingClientRect();

          if (isInsideSidebar && sidebar) {
            const sidebarRect = sidebar.getBoundingClientRect();

            if (sidebarRect.left > 280) {
              const left = sidebarRect.left - infoCard.offsetWidth - 10;
              let top =
                iconRect.top + iconRect.height / 2 - infoCard.offsetHeight / 2;
              if (top < 10) top = 10;
              if (top + infoCard.offsetHeight > window.innerHeight - 10) {
                top = window.innerHeight - infoCard.offsetHeight - 10;
              }

              infoCard.style.left = left + "px";
              infoCard.style.top = top + "px";
            } else {
              infoCard.style.maxWidth = "min(240px, calc(100vw - 24px))";

              let left = Math.max(
                10,
                Math.min(
                  iconRect.left + iconRect.width / 2 - infoCard.offsetWidth / 2,
                  window.innerWidth - infoCard.offsetWidth - 10,
                ),
              );
              let top = iconRect.top - infoCard.offsetHeight - 8;
              if (top < 10) top = iconRect.bottom + 8;

              infoCard.style.left = left + "px";
              infoCard.style.top = top + "px";
            }
          } else {
            let top = iconRect.top - infoCard.offsetHeight - 10;
            let left = iconRect.left - 12;

            if (top < 10) top = iconRect.bottom + 8;
            if (left < 10) left = 10;
            if (left + infoCard.offsetWidth > window.innerWidth - 10) {
              left = window.innerWidth - infoCard.offsetWidth;
            }

            infoCard.style.top = top - 5 + "px";
            infoCard.style.left = "1rem";
          }
        }
      }
    });
// Call this after DOM is ready (e.g. at the end of init or after initializeTooltips)
makeInfoIconsAccessible();

document.addEventListener("mouseover", (e) => {
  const icon = e.target.closest(".info-icon");
  if (icon) showInfoTooltip(icon);
});

document.addEventListener("focusin", (e) => {
  const icon = e.target.closest(".info-icon");
  if (icon) showInfoTooltip(icon);
});

document.addEventListener("mouseout", (e) => {
  const icon = e.target.closest(".info-icon");
  if (icon && (!e.relatedTarget || !icon.contains(e.relatedTarget))) {
    infoCard.style.display = "none";
  }
});

document.addEventListener("focusout", (e) => {
  const icon = e.target.closest(".info-icon");
  if (icon) {
    infoCard.style.display = "none";
  }
});	  
	  
	  
	  
	  
    init();
  })();
});
