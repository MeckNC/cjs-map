/* Mecklenburg County CJS map - scoped build. All code lives in this closure.
   One global namespace is used: window.MeckNCcjsMap (loader promise + instances). */
(function (window, realDocument) {
  "use strict";
  var NS = window.MeckNCcjsMap = window.MeckNCcjsMap || { instances: [] };
  var ARCGIS_JS = "https://js.arcgis.com/4.31/";
  var ARCGIS_CSS = "https://js.arcgis.com/4.31/esri/themes/light/main.css";
  var IDP = "mcjs-";

  function addCssOnce(href) {
    if (realDocument.querySelector('link[href="' + href + '"]')) return;
    var l = realDocument.createElement("link"); l.rel = "stylesheet"; l.href = href;
    realDocument.head.appendChild(l);
  }
  function isArcgisRequire(r) { return typeof r === "function" && typeof r.on === "function" && typeof r.toUrl === "function"; }
  function loadArcgis() {
    if (NS.loader) return NS.loader;
    NS.loader = new Promise(function (resolve, reject) {
      if (isArcgisRequire(window.require) && window.esriConfig) { resolve(window.require); return; }
      var existing = realDocument.querySelector('script[src^="https://js.arcgis.com/4."]');
      if (!existing && (window.define || window.require)) {
        // Another loader owns require/define: replacing it could break Drupal libraries. Refuse instead.
        reject(new Error("another script loader (require/define) is already on this page. Use the iframe version of the map."));
        return;
      }
      var s = existing || realDocument.createElement("script");
      var done = function () {
        if (!isArcgisRequire(window.require)) { reject(new Error("ArcGIS loader did not initialize")); return; }
        // Hide the AMD flag so Drupal/jQuery/UMD libraries loaded later (e.g. by Layout Builder AJAX)
        // keep registering as normal globals instead of calling the ArcGIS define(). ArcGIS's own
        // modules call define() directly and do not need the flag.
        try { NS.amdFlag = window.define.amd; delete window.define.amd; if (window.define.amd) window.define.amd = undefined; } catch (e) {}
        resolve(window.require);
      };
      if (existing && isArcgisRequire(window.require)) { resolve(window.require); return; }
      s.addEventListener("load", done); s.addEventListener("error", function () { NS.loader = null; reject(new Error("Could not load " + ARCGIS_JS)); });
      if (!existing) { s.src = ARCGIS_JS; s.async = true; realDocument.head.appendChild(s); }
    });
    return NS.loader;
  }

  // A document-like object limited to one map wrapper.
  function scopedDocument(root) {
    var fakeHead = realDocument.createElement("div"); // swallows the original favicon rewrite
    return {
      getElementById: function (id) {
        var el = root.querySelector("#" + CSS.escape(IDP + id));
        if (el) return el;
        // CKEditor 5 can strip empty elements; recreate missing ones (hidden) so the map never crashes.
        if (!fakeHead._stubs) fakeHead._stubs = {};
        if (!fakeHead._stubs[id]) { var st = realDocument.createElement("span"); st.id = IDP + id; st.hidden = true; root.appendChild(st); fakeHead._stubs[id] = st; }
        return fakeHead._stubs[id];
      },
      querySelector: function (s) { return root.querySelector(s); },
      querySelectorAll: function (s) { return root.querySelectorAll(s); },
      createElement: function (t) { return realDocument.createElement(t); },
      createElementNS: function (n, t) { return realDocument.createElementNS(n, t); },
      createTextNode: function (t) { return realDocument.createTextNode(t); },
      addEventListener: function (t, f, o) { root.addEventListener(t, f, o); },
      removeEventListener: function (t, f, o) { root.removeEventListener(t, f, o); },
      get body() { return root; },
      get head() { return fakeHead; },
      get activeElement() { return realDocument.activeElement; },
      get documentElement() { return realDocument.documentElement; }
    };
  }

  function start(root, __require) {
    var __root = root, __ctx = { root: root, view: null };
    var document = scopedDocument(root);
    // Repair markup CKEditor 5 mangles: it empties <button>s, leaving the icon/label as loose siblings
    // (often wrapped in <p>). Remove the strays and rebuild the button contents.
    // Search is switched off (markup is commented out in the block; this also covers CKEditor
    // dropping the comment). Removing the form makes every search lookup fall back to hidden stubs.
    var SEARCH_ENABLED = false;
    if (!SEARCH_ENABLED) {
      var __sf = root.querySelector('#' + IDP + 'searchForm');
      if (__sf) __sf.remove();
      root.classList.add('mcjs-no-search');
    }
    (function repairButtons() {
      var defs = {
        resetBtn: '<svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 2.5v4h4"/><path d="M2.7 6.2a6 6 0 1 1 1.2 5.8"/></svg> Reset',
        compareBtn: '<svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="5" height="10" rx="1"/><rect x="9" y="3" width="5" height="10" rx="1"/></svg> Compare'
      };
      Object.keys(defs).forEach(function (k) {
        var b = root.querySelector('#' + IDP + k);
        if (!b) return;
        var label = k === 'resetBtn' ? 'Reset' : 'Compare';
        var host = (b.parentElement && b.parentElement.tagName === 'P') ? b.parentElement : b;
        if (host !== b) { host.parentElement.insertBefore(b, host); host.remove(); }
        var n = b.nextSibling;
        while (n) {
          var nx = n.nextSibling, t = (n.textContent || '').replace(/\s+/g, ' ').trim();
          if (n.nodeType === 3 && !t) { n.remove(); }
          else if (n.nodeName.toLowerCase() === 'svg' && !n.id) { n.remove(); }
          else if ((n.nodeName === 'P' || n.nodeType === 3) && (t === label || t === '')) { n.remove(); }
          else break;
          n = nx;
        }
        if (!b.querySelector('svg')) b.innerHTML = defs[k];
      });
      // CKEditor also drops &nbsp; into empty divs/spans; strip stray empty <p>s.
      Array.prototype.forEach.call(root.querySelectorAll('p'), function (pp) {
        if (!pp.textContent.replace(/\u00a0|\s/g, '') && !pp.querySelector('*:not(br)')) pp.remove();
      });
    })();
    NS.instances.push(__ctx);
    // ---------------- config (was 01M52SKFBS8ACSYMGZ6NGRYSCZ.js) ----------------
const YEAR_START = '2023';
const YEAR_END   = '2025';
const MEDIAN_INCOME_PERIOD = '2024';
const ACS_PERIOD = '2020-2024';
const TOOLTIPS = {

  defaultSource: `U.S. Census Bureau, American
Community Survey (ACS), ${ACS_PERIOD} 5-year estimates.`,
  communityWellBeingSource: "U.S. Census Bureau ACS 5-year estimates",
  zipCodeMapping: "Some small or non-residential ZIP Codes are combined with a neighboring ZIP Code area. Case counts are included in the combined area, and ACS demographic data are shown only for the larger ZIP Code area because reliable estimates are unavailable for the smaller ZIP Codes.",
  indicators: {
    courtCaseCount: {
      id: "courtCaseCount",
      metricId: "case_count_2025",
      label: "Court Case Count",
      description: `Number of court cases between ${YEAR_START} and ${YEAR_END} for residents in this ZIP Code.`,
    },
    courtCaseRate: {
      id: "courtCaseRate",
      metricId: "case_count_2025_per_1k",
      label: "Court Case Rate",
      description: `Number of court cases per 1,000 residents
age 16 and over in this ZIP Code between
${YEAR_START} and ${YEAR_END}. Higher values indicate more
court cases relative to the ZIP Code
population age 16 and over.`,
    },
   

    // ── Economic & Poverty ──
    povertyRate: {
      id: "nonPovertyRate",
      metricId: "non_poverty_rate",
      label: "Non-Poverty Rate",
      description: `Percent of residents who are not below the
federal poverty threshold. Poverty thresholds
vary by family size and composition. Higher
values indicate fewer residents living below
the poverty threshold.`,
    },
    unemploymentRate: {
      id: "unemploymentRate",
      metricId: "unemployment_pct",
      label: "Unemployment Rate",
      description: "Percentage of civilian labor force aged 16+ that is unemployed. Higher means more residents seeking work are without employment.",
    },
    medianIncome: {
      id: "medianIncome",
      metricId: "median_income",
      label: "Median Household Income",
      description: `Median household income in the past 12 months (in ${MEDIAN_INCOME_PERIOD} inflation-adjusted dollars).`,
    },
    publicAssistanceSnap: {
      id: "publicAssistanceSnap",
      metricId: "public_assistance_snap_pct",
      label: "Public Assistance or SNAP",
      description: "Percentage of households receiving Food Stamps / SNAP or cash public assistance in the past 12 months.",
    },

    // ── Housing ──
    housingExpenseUnder30: {
      id: "housingExpenseUnder30",
      metricId: "housing_expense_under30",
      label: "Housing",
      description: `Percent of renter- and owner-occupied
households spending 30% or less of
household income on housing costs in the
past 12 months. Higher values indicate that
more households are not housing cost-burdened.`,
    },

    // ── Health ──
    healthInsuranceCoverage: {
      id: "healthInsuranceCoverage",
      metricId: "insured_pct",
      label: "Health Insurance",
      description: `Percent of the civilian noninstitutionalized
population with health insurance coverage.
Higher values indicate that more residents
are insured.`,
    },
    civilianNoninstitutionalized: {
      id: "civilianNoninstitutionalized",
      metricId: "civilian_noninstitutionalized",
      label: "Civilian Noninstitutionalized Population",
      description: "Civilian noninstitutionalized population used as baseline for health metrics.",
    },

    // ── Demographics & Education ──
    totalPopulation: {
      id: "totalPopulation",
      metricId: "total_population",
      label: "Total Population",
      description: "Total estimated resident population from the ZIP feature layer.",
    },
    nonHispanicWhite: {
      id: "nonHispanicWhite",
      metricId: "non_hispanic_white_pct",
      label: "White",
      description: "Percent of residents identifying as White, not Hispanic or Latino.",
    },
    nonHispanicBlack: {
      id: "nonHispanicBlack",
      metricId: "non_hispanic_black_pct",
      label: "Black",
      description: "Percent of residents identifying as Black, not Hispanic or Latino.",
    },
    hispanicLatino: {
      id: "hispanicLatino",
      metricId: "hispanic_latino_pct",
      label: "Hispanic",
      description: "Percent of residents identifying as Hispanic or Latino  (any race).",
    },
    nonHispanicAsian: {
      id: "nonHispanicAsian",
      metricId: "non_hispanic_asian_pct",
      label: "Asian",
      description: "Percent of residents identifying as Asian, not Hispanic or Latino.",
    },
    twoOrMoreRaces: {
      id: "twoOrMoreRaces",
      metricId: "two_or_more_races",
      label: "Two or More Races",
      description: "Percent of residents identifying as two or more races, not Hispanic or Latino.",
    },
    otherRace: {
      id: "otherRace",
      metricId: "other_race",
      label: "Another Race",
      description: "Percent of residents identifying as any other race, not Hispanic or Latino.",
    },
    educationAttainmentRate: {
      id: "educationAttainmentRate",
      label: "Educational Attainment",
      description: `Percent of residents age 25 and older who
have a high school diploma or equivalent
(e.g., GED), or a higher level of education.
Higher values indicate that more residents
have completed at least high school.`,
    },
    courtcaseDataSource: 'Criminal court case data comes from Mecklenburg County'
  },

  get(key) {
    if (!key) return null;
    if (this.indicators[key]) return this.indicators[key];
    for (const k of Object.keys(this.indicators)) {
      const ind = this.indicators[k];
      if (ind.metricId === key || ind.id === key || ind.label === key) {
        return ind;
      }
    }
    if (typeof key === "string" && key.startsWith("case_count")) {
      return key.includes("per_1k") ? this.indicators.courtCaseRate : this.indicators.courtCaseCount;
    }
    return null;
  },


  getTooltip(key, fallback = "") {
    const ind = this.get(key);
    return ind && ind.description ? ind.description : fallback;
  },


  getLabel(key, fallback = "") {
    const ind = this.get(key);
    return ind && ind.label ? ind.label : fallback;
  },


  getSource(key) {
    const ind = this.get(key);
    return ind && ind.source ? ind.source : this.defaultSource;
  }
};
    // ---------------- basemap style (was 01M52SKFCNR18H1Q6W3NE6G5PY.js) ----------------
var CUSTOM_MAP_STYLE = 
{
  "version": 8,
  "sprite": "https://www.arcgis.com/sharing/rest/content/items/3bab6a6c630045cc8a7bc5f4d8ff3bc0/resources/sprites/sprite-1786986968956",
  "glyphs": "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/resources/fonts/{fontstack}/{range}.pbf",
  "sources": {
    "esri": {
      "type": "vector",
      "url": "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer",
      "tiles": [
        "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/tile/{z}/{y}/{x}.pbf"
      ]
    }
  },
  "layers": [
    {
      "id": "background",
      "type": "background",
      "paint": {
        "background-color": "#dce6e6"
      },
      "layout": {}
    },
    {
      "id": "Land",
      "type": "fill",
      "source": "esri",
      "source-layer": "Land",
      "filter": [
        "in",
        "_symbol",
        0,
        1
      ],
      "layout": {
        "visibility": "visible"
      },
      "paint": {
        "fill-opacity": 1,
        "fill-color": "#e4e4dd",
        "fill-antialias": true,
        "fill-translate": [
          0,
          0
        ],
        "fill-translate-anchor": "map"
      }
    },
    {
      "id": "Urban area",
      "type": "fill",
      "source": "esri",
      "source-layer": "Urban area",
      "minzoom": 5,
      "maxzoom": 15,
      "layout": {},
      "paint": {
        "fill-color": "#dadacc"
      }
    },
    {
      "id": "Openspace or forest",
      "type": "fill",
      "source": "esri",
      "source-layer": "Openspace or forest",
      "minzoom": 12,
      "layout": {},
      "paint": {
        "fill-color": "#cad8c5",
        "fill-outline-color": "#bdcfb7"
      }
    },
    {
      "id": "Admin0 forest or park",
      "type": "fill",
      "source": "esri",
      "source-layer": "Admin0 forest or park",
      "minzoom": 7,
      "layout": {},
      "paint": {
        "fill-color": "#d8e1d4",
        "fill-outline-color": "#cad8c5"
      }
    },
    {
      "id": "Admin1 forest or park",
      "type": "fill",
      "source": "esri",
      "source-layer": "Admin1 forest or park",
      "minzoom": 8,
      "layout": {},
      "paint": {
        "fill-color": "#d8e1d4",
        "fill-outline-color": "#cad8c5"
      }
    },
    {
      "id": "Zoo",
      "type": "fill",
      "source": "esri",
      "source-layer": "Zoo",
      "minzoom": 12,
      "layout": {
        "visibility": "visible"
      },
      "paint": {
        "fill-color": "#cad8c5"
      }
    },
    {
      "id": "Airport/Airport property",
      "type": "fill",
      "source": "esri",
      "source-layer": "Airport",
      "filter": [
        "==",
        "_symbol",
        1
      ],
      "minzoom": 9,
      "layout": {
        "visibility": "visible"
      },
      "paint": {
        "fill-color": "#c6c7b2"
      }
    },
    {
      "id": "Airport/Airport runway",
      "type": "fill",
      "source": "esri",
      "source-layer": "Airport",
      "filter": [
        "==",
        "_symbol",
        0
      ],
      "minzoom": 11,
      "layout": {},
      "paint": {
        "fill-color": "#c6c7b2"
      }
    },
    {
      "id": "Pedestrian",
      "type": "fill",
      "source": "esri",
      "source-layer": "Pedestrian",
      "minzoom": 14,
      "layout": {
        "visibility": "visible"
      },
      "paint": {
        "fill-color": "#e7ded0"
      }
    },
    {
      "id": "Park or farming",
      "type": "fill",
      "source": "esri",
      "source-layer": "Park or farming",
      "minzoom": 12,
      "layout": {
        "visibility": "none"
      },
      "paint": {
        "fill-color": "#cad8c5"
      }
    },
    {
      "id": "Beach",
      "type": "fill",
      "source": "esri",
      "source-layer": "Beach",
      "minzoom": 13,
      "layout": {},
      "paint": {
        "fill-pattern": "Special area of interest/Sand"
      }
    },
    {
      "id": "Special area of interest/Garden path",
      "type": "fill",
      "source": "esri",
      "source-layer": "Special area of interest",
      "filter": [
        "==",
        "_symbol",
        12
      ],
      "minzoom": 14,
      "layout": {
        "visibility": "none"
      },
      "paint": {
        "fill-color": "#c6c7b2",
        "fill-outline-color": "#bdbda2"
      }
    },
    {
      "id": "Special area of interest/Parking",
      "type": "fill",
      "source": "esri",
      "source-layer": "Special area of interest",
      "filter": [
        "==",
        "_symbol",
        15
      ],
      "minzoom": 14,
      "layout": {},
      "paint": {
        "fill-color": "#c6c7b2"
      }
    },
    {
      "id": "Special area of interest/Green openspace",
      "type": "fill",
      "source": "esri",
      "source-layer": "Special area of interest",
      "filter": [
        "==",
        "_symbol",
        11
      ],
      "minzoom": 14,
      "layout": {},
      "paint": {
        "fill-color": "#cad8c5"
      }
    },
    {
      "id": "Special area of interest/Grass",
      "type": "fill",
      "source": "esri",
      "source-layer": "Special area of interest",
      "filter": [
        "==",
        "_symbol",
        8
      ],
      "minzoom": 14,
      "layout": {},
      "paint": {
        "fill-color": "#cad8c5"
      }
    },
    {
      "id": "Special area of interest/Baseball field or other grounds",
      "type": "fill",
      "source": "esri",
      "source-layer": "Special area of interest",
      "filter": [
        "==",
        "_symbol",
        1
      ],
      "minzoom": 14,
      "layout": {},
      "paint": {
        "fill-color": "#c6c7b2"
      }
    },
    {
      "id": "Special area of interest/Groundcover",
      "type": "fill",
      "source": "esri",
      "source-layer": "Special area of interest",
      "filter": [
        "==",
        "_symbol",
        13
      ],
      "minzoom": 14,
      "layout": {},
      "paint": {
        "fill-pattern": "Special area of interest/Groundcover",
        "fill-opacity": 0.5
      }
    },
    {
      "id": "Special area of interest/Field or court exterior",
      "type": "fill",
      "source": "esri",
      "source-layer": "Special area of interest",
      "filter": [
        "==",
        "_symbol",
        5
      ],
      "minzoom": 14,
      "layout": {},
      "paint": {
        "fill-color": "#c6c7b2"
      }
    },
    {
      "id": "Special area of interest/Football field or court",
      "type": "fill",
      "source": "esri",
      "source-layer": "Special area of interest",
      "filter": [
        "==",
        "_symbol",
        4
      ],
      "minzoom": 14,
      "layout": {},
      "paint": {
        "fill-color": "#c6c7b2",
        "fill-outline-color": "#bdbda2"
      }
    },
    {
      "id": "Special area of interest/Hardcourt",
      "type": "fill",
      "source": "esri",
      "source-layer": "Special area of interest",
      "filter": [
        "==",
        "_symbol",
        10
      ],
      "minzoom": 14,
      "layout": {},
      "paint": {
        "fill-color": "#c6c7b2",
        "fill-outline-color": "#bdbda2"
      }
    },
    {
      "id": "Special area of interest/Mulch or dirt",
      "type": "fill",
      "source": "esri",
      "source-layer": "Special area of interest",
      "filter": [
        "==",
        "_symbol",
        14
      ],
      "minzoom": 14,
      "layout": {},
      "paint": {
        "fill-color": "#c6c7b2"
      }
    },
    {
      "id": "Special area of interest/Athletic track",
      "type": "fill",
      "source": "esri",
      "source-layer": "Special area of interest",
      "filter": [
        "==",
        "_symbol",
        0
      ],
      "minzoom": 14,
      "layout": {},
      "paint": {
        "fill-color": "#c6c7b2",
        "fill-outline-color": "#bdbda2"
      }
    },
    {
      "id": "Special area of interest/Sand",
      "type": "fill",
      "source": "esri",
      "source-layer": "Special area of interest",
      "filter": [
        "==",
        "_symbol",
        6
      ],
      "minzoom": 14,
      "layout": {},
      "paint": {
        "fill-pattern": "Special area of interest/Sand"
      }
    },
    {
      "id": "Special area of interest/Rock or gravel",
      "type": "fill",
      "source": "esri",
      "source-layer": "Special area of interest",
      "filter": [
        "==",
        "_symbol",
        16
      ],
      "minzoom": 14,
      "layout": {},
      "paint": {
        "fill-pattern": "Special area of interest/Rock or gravel"
      }
    },
    {
      "id": "Special area of interest/Water",
      "type": "fill",
      "source": "esri",
      "source-layer": "Special area of interest",
      "filter": [
        "==",
        "_symbol",
        7
      ],
      "minzoom": 15,
      "layout": {},
      "paint": {
        "fill-color": "#dce6e6"
      }
    },
    {
      "id": "Water line small scale",
      "type": "line",
      "source": "esri",
      "source-layer": "Water line small scale",
      "minzoom": 1,
      "maxzoom": 5,
      "layout": {
        "line-join": "round",
        "visibility": "none"
      },
      "paint": {
        "line-color": "#dce6e6",
        "line-width": 0.5
      }
    },
    {
      "id": "Water line medium scale",
      "type": "line",
      "source": "esri",
      "source-layer": "Water line medium scale",
      "minzoom": 6,
      "maxzoom": 7,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#dce6e6",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              5,
              0.5
            ],
            [
              7,
              0.7
            ]
          ]
        }
      }
    },
    {
      "id": "Water line large scale",
      "type": "line",
      "source": "esri",
      "source-layer": "Water line large scale",
      "minzoom": 7,
      "maxzoom": 11,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#dce6e6",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              7,
              0.7
            ],
            [
              11,
              0.8
            ]
          ]
        }
      }
    },
    {
      "id": "Water line/Waterfall",
      "type": "line",
      "source": "esri",
      "source-layer": "Water line",
      "filter": [
        "==",
        "_symbol",
        5
      ],
      "minzoom": 11,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#dce6e6",
        "line-width": 0.8,
        "line-dasharray": [
          5,
          5
        ]
      }
    },
    {
      "id": "Water line/Dam or weir",
      "type": "line",
      "source": "esri",
      "source-layer": "Water line",
      "filter": [
        "==",
        "_symbol",
        2
      ],
      "minzoom": 11,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#dce6e6",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              11,
              0.7
            ],
            [
              14,
              0.7
            ],
            [
              17,
              2
            ]
          ]
        }
      }
    },
    {
      "id": "Water line/Levee/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Water line",
      "filter": [
        "==",
        "_symbol",
        3
      ],
      "minzoom": 11,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#aab4b4",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              11,
              0.7
            ],
            [
              14,
              0.7
            ],
            [
              17,
              2
            ]
          ]
        }
      }
    },
    {
      "id": "Water line/Levee/0",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water line",
      "filter": [
        "==",
        "_symbol",
        3
      ],
      "minzoom": 13,
      "layout": {
        "symbol-placement": "line",
        "symbol-avoid-edges": true,
        "icon-image": "Water line/Levee/0",
        "symbol-spacing": 15,
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-padding": 1,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ]
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water line/Canal or ditch",
      "type": "line",
      "source": "esri",
      "source-layer": "Water line",
      "filter": [
        "==",
        "_symbol",
        1
      ],
      "minzoom": 11,
      "layout": {
        "line-cap": "round"
      },
      "paint": {
        "line-color": "#dce6e6",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              11,
              0.8
            ],
            [
              14,
              0.8
            ],
            [
              17,
              2
            ]
          ]
        }
      }
    },
    {
      "id": "Water line/Stream or river intermittent",
      "type": "line",
      "source": "esri",
      "source-layer": "Water line",
      "filter": [
        "==",
        "_symbol",
        4
      ],
      "minzoom": 11,
      "layout": {},
      "paint": {
        "line-color": "#dce6e6",
        "line-dasharray": [
          7,
          3
        ],
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              11,
              0.8
            ],
            [
              14,
              0.8
            ],
            [
              17,
              2
            ]
          ]
        }
      }
    },
    {
      "id": "Water line/Stream or river",
      "type": "line",
      "source": "esri",
      "source-layer": "Water line",
      "filter": [
        "==",
        "_symbol",
        0
      ],
      "minzoom": 11,
      "layout": {
        "line-cap": "round"
      },
      "paint": {
        "line-color": "#dce6e6",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              11,
              0.8
            ],
            [
              14,
              0.8
            ],
            [
              17,
              2
            ]
          ]
        }
      }
    },
    {
      "id": "Marine area/bathymetry depth 1",
      "type": "fill",
      "source": "esri",
      "source-layer": "Marine area",
      "minzoom": 4,
      "layout": {},
      "paint": {
        "fill-color": "#dce6e6"
      }
    },
    {
      "id": "Water area small scale",
      "type": "fill",
      "source": "esri",
      "source-layer": "Water area small scale",
      "minzoom": 1,
      "maxzoom": 5,
      "layout": {},
      "paint": {
        "fill-color": "#dce6e6"
      }
    },
    {
      "id": "Water area medium scale/Lake intermittent",
      "type": "fill",
      "source": "esri",
      "source-layer": "Water area medium scale",
      "filter": [
        "==",
        "_symbol",
        1
      ],
      "minzoom": 5,
      "maxzoom": 7,
      "layout": {},
      "paint": {
        "fill-pattern": "Water area/Lake or river intermittent"
      }
    },
    {
      "id": "Water area medium scale/Lake or river",
      "type": "fill",
      "source": "esri",
      "source-layer": "Water area medium scale",
      "filter": [
        "==",
        "_symbol",
        0
      ],
      "minzoom": 5,
      "maxzoom": 7,
      "layout": {},
      "paint": {
        "fill-color": "#dce6e6"
      }
    },
    {
      "id": "Water area large scale/Lake intermittent",
      "type": "fill",
      "source": "esri",
      "source-layer": "Water area large scale",
      "filter": [
        "==",
        "_symbol",
        1
      ],
      "minzoom": 7,
      "maxzoom": 11,
      "layout": {},
      "paint": {
        "fill-pattern": "Water area/Lake or river intermittent"
      }
    },
    {
      "id": "Water area large scale/Lake or river",
      "type": "fill",
      "source": "esri",
      "source-layer": "Water area large scale",
      "filter": [
        "==",
        "_symbol",
        0
      ],
      "minzoom": 7,
      "maxzoom": 11,
      "layout": {},
      "paint": {
        "fill-color": "#dce6e6"
      }
    },
    {
      "id": "Water area/Lake, river or bay",
      "type": "fill",
      "source": "esri",
      "source-layer": "Water area",
      "filter": [
        "==",
        "_symbol",
        7
      ],
      "minzoom": 11,
      "layout": {},
      "paint": {
        "fill-color": "#dce6e6"
      }
    },
    {
      "id": "Water area/Lake or river intermittent",
      "type": "fill",
      "source": "esri",
      "source-layer": "Water area",
      "filter": [
        "==",
        "_symbol",
        6
      ],
      "minzoom": 11,
      "layout": {},
      "paint": {
        "fill-pattern": "Water area/Lake or river intermittent"
      }
    },
    {
      "id": "Water area/Inundated area",
      "type": "fill",
      "source": "esri",
      "source-layer": "Water area",
      "filter": [
        "==",
        "_symbol",
        4
      ],
      "minzoom": 11,
      "layout": {},
      "paint": {
        "fill-pattern": "Water area/Inundated area"
      }
    },
    {
      "id": "Water area/Swamp or marsh",
      "type": "fill",
      "source": "esri",
      "source-layer": "Water area",
      "filter": [
        "==",
        "_symbol",
        3
      ],
      "minzoom": 11,
      "layout": {},
      "paint": {
        "fill-pattern": "Water area/Swamp or marsh"
      }
    },
    {
      "id": "Water area/Playa",
      "type": "fill",
      "source": "esri",
      "source-layer": "Water area",
      "filter": [
        "==",
        "_symbol",
        1
      ],
      "minzoom": 11,
      "layout": {},
      "paint": {
        "fill-pattern": "Water area/Playa"
      }
    },
    {
      "id": "Water area/Dam or weir",
      "type": "fill",
      "source": "esri",
      "source-layer": "Water area",
      "filter": [
        "==",
        "_symbol",
        5
      ],
      "minzoom": 11,
      "layout": {},
      "paint": {
        "fill-color": "#dce6e6",
        "fill-outline-color": "#dce6e6"
      }
    },
    {
      "id": "Special area of interest/Bike, walk or pedestrian",
      "type": "fill",
      "source": "esri",
      "source-layer": "Special area of interest",
      "filter": [
        "==",
        "_symbol",
        2
      ],
      "minzoom": 14,
      "layout": {},
      "paint": {
        "fill-color": "#c6c7b2"
      }
    },
    {
      "id": "Railroad/2",
      "type": "line",
      "source": "esri",
      "source-layer": "Railroad",
      "minzoom": 12,
      "layout": {
        "line-join": "round",
        "visibility": "none"
      },
      "paint": {
        "line-color": "#7c7468",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              12,
              1.5
            ],
            [
              14,
              2.5
            ],
            [
              17,
              3
            ]
          ]
        }
      }
    },
    {
      "id": "Railroad/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Railroad",
      "minzoom": 12,
      "layout": {
        "line-join": "round",
        "visibility": "none"
      },
      "paint": {
        "line-color": "#aba395",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              12,
              0.5
            ],
            [
              14,
              1
            ],
            [
              17,
              1.5
            ]
          ]
        }
      }
    },
    {
      "id": "Ferry/Rail ferry/2",
      "type": "line",
      "source": "esri",
      "source-layer": "Ferry",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          1
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 12,
      "layout": {
        "line-join": "round",
        "visibility": "none"
      },
      "paint": {
        "line-color": "#8d9797",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              12,
              1.5
            ],
            [
              14,
              2.5
            ],
            [
              17,
              3
            ]
          ]
        }
      }
    },
    {
      "id": "Ferry/Rail ferry/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Ferry",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          1
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 12,
      "layout": {
        "line-join": "round",
        "visibility": "none"
      },
      "paint": {
        "line-color": "#bdc8c8",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              12,
              0.5
            ],
            [
              14,
              1
            ],
            [
              17,
              1.5
            ]
          ]
        }
      }
    },
    {
      "id": "Special area of interest line/Dock or pier",
      "type": "line",
      "source": "esri",
      "source-layer": "Special area of interest line",
      "filter": [
        "==",
        "_symbol",
        0
      ],
      "minzoom": 15,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#ffffef",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              15,
              0.7
            ],
            [
              17,
              1.2
            ]
          ]
        }
      }
    },
    {
      "id": "Special area of interest line/Sports field",
      "type": "line",
      "source": "esri",
      "source-layer": "Special area of interest line",
      "filter": [
        "==",
        "_symbol",
        6
      ],
      "minzoom": 15,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#ffffef",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              15,
              0.7
            ],
            [
              17,
              1.2
            ]
          ]
        }
      }
    },
    {
      "id": "Building/Shadow",
      "type": "fill",
      "source": "esri",
      "source-layer": "Building",
      "minzoom": 16,
      "layout": {},
      "paint": {
        "fill-color": "#b6afa2",
        "fill-translate": {
          "stops": [
            [
              15,
              [
                0,
                0
              ]
            ],
            [
              18,
              [
                2,
                2
              ]
            ]
          ]
        },
        "fill-translate-anchor": "viewport"
      }
    },
    {
      "id": "Building",
      "type": "fill",
      "source": "esri",
      "source-layer": "Building",
      "minzoom": 15,
      "layout": {},
      "paint": {
        "fill-color": "#e8e1d3",
        "fill-outline-color": "#e8e1d3"
      }
    },
    {
      "id": "Special area of interest line/Parking lot",
      "type": "line",
      "source": "esri",
      "source-layer": "Special area of interest line",
      "filter": [
        "==",
        "_symbol",
        5
      ],
      "minzoom": 15,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#ffffef",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              15,
              0.7
            ],
            [
              17,
              1.2
            ]
          ]
        }
      }
    },
    {
      "id": "Trail or path/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Trail or path",
      "minzoom": 15,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#b5ac9f",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              14,
              1.5
            ],
            [
              16,
              3.3
            ],
            [
              18,
              4
            ]
          ]
        }
      }
    },
    {
      "id": "Road/4WD/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Road",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          10
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 13,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#989083",
        "line-dasharray": [
          2,
          1
        ],
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              11,
              0.55
            ],
            [
              14,
              1.11
            ],
            [
              18,
              2.71
            ]
          ]
        }
      }
    },
    {
      "id": "Road/Service/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Road",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          8
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 13,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#989083",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              11,
              0.55
            ],
            [
              14,
              1.11
            ],
            [
              18,
              2.71
            ]
          ]
        }
      }
    },
    {
      "id": "Road/Local/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Road",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          7
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 12,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#989083",
        "line-width": {
          "base": 1.4,
          "stops": [
            [
              11,
              0.55
            ],
            [
              14,
              1.38
            ],
            [
              16,
              2
            ],
            [
              18,
              5.71
            ]
          ]
        }
      }
    },
    {
      "id": "Road/Pedestrian/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Road",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          9
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 15,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#989083",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              14,
              0.55
            ],
            [
              16,
              1.11
            ],
            [
              18,
              1.38
            ]
          ]
        }
      }
    },
    {
      "id": "Road/Minor, ramp or traffic circle/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Road",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          6
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 11,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#989083",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              11,
              0.39
            ],
            [
              14,
              1.38
            ],
            [
              16,
              3.17
            ],
            [
              18,
              5.71
            ]
          ]
        }
      }
    },
    {
      "id": "Road/Minor/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Road",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          5
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 11,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#989083",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              11,
              0.88
            ],
            [
              14,
              1.91
            ],
            [
              16,
              3.17
            ],
            [
              18,
              5.71
            ]
          ]
        }
      }
    },
    {
      "id": "Road/Major, ramp or traffic circle/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Road",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          4
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 9,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#989083",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              9,
              0.55
            ],
            [
              14,
              2.42
            ],
            [
              16,
              3.34
            ],
            [
              18,
              5.77
            ]
          ]
        }
      }
    },
    {
      "id": "Road/Major/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Road",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          3
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 9,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#989083",
        "line-width": {
          "base": 1,
          "stops": [
            [
              9,
              0.55
            ],
            [
              14,
              2.42
            ],
            [
              16,
              3.34
            ],
            [
              18,
              5.77
            ]
          ]
        }
      }
    },
    {
      "id": "Road/Freeway Motorway, ramp or traffic circle/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Road",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          2
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 7,
      "layout": {
        "line-join": "round",
        "line-cap": "round"
      },
      "paint": {
        "line-color": "#989083",
        "line-width": {
          "base": 1,
          "stops": [
            [
              9,
              0.31
            ],
            [
              14,
              2.71
            ],
            [
              16,
              4.01
            ],
            [
              18,
              8.4
            ]
          ]
        }
      }
    },
    {
      "id": "Road/Highway/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Road",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          1
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 8,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#989083",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              8,
              0.31
            ],
            [
              14,
              2.71
            ],
            [
              16,
              4.01
            ],
            [
              18,
              8.4
            ]
          ]
        }
      }
    },
    {
      "id": "Road/Freeway Motorway/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Road",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          0
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 7,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#989083",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              5,
              0.31
            ],
            [
              14,
              2.71
            ],
            [
              16,
              4.01
            ],
            [
              18,
              8.4
            ]
          ]
        }
      }
    },
    {
      "id": "Trail or path/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Trail or path",
      "minzoom": 15,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#e7ded0",
        "line-dasharray": [
          3,
          1.5
        ],
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              14,
              1.3
            ],
            [
              16,
              2
            ],
            [
              18,
              2.3
            ]
          ]
        }
      }
    },
    {
      "id": "Road/Pedestrian/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Road",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          9
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 15,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9c0b2",
        "line-dasharray": [
          3,
          1.5
        ],
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              14,
              0.49
            ],
            [
              16,
              0.69
            ],
            [
              18,
              0.78
            ]
          ]
        }
      }
    },
    {
      "id": "Road/4WD/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Road",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          10
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 13,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9c0b2",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              11,
              0.31
            ],
            [
              14,
              0.49
            ],
            [
              18,
              2.08
            ]
          ]
        }
      }
    },
    {
      "id": "Road/Service/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Road",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          8
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 13,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9c0b2",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              11,
              0.31
            ],
            [
              14,
              0.49
            ],
            [
              18,
              2.08
            ]
          ]
        }
      }
    },
    {
      "id": "Road/Local/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Road",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          7
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 12,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9c0b2",
        "line-width": {
          "base": 1.4,
          "stops": [
            [
              11,
              0.43
            ],
            [
              14,
              0.69
            ],
            [
              16,
              1.38
            ],
            [
              18,
              4.91
            ]
          ]
        }
      }
    },
    {
      "id": "Road/Minor, ramp or traffic circle/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Road",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          6
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 11,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9c0b2",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              11,
              0.31
            ],
            [
              14,
              0.69
            ],
            [
              16,
              2.42
            ],
            [
              18,
              4.91
            ]
          ]
        }
      }
    },
    {
      "id": "Road/Minor/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Road",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          5
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 11,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9c0b2",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              11,
              0.49
            ],
            [
              14,
              1.16
            ],
            [
              16,
              2.42
            ],
            [
              18,
              4.91
            ]
          ]
        }
      }
    },
    {
      "id": "Road/Major, ramp or traffic circle/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Road",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          4
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 9,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9c0b2",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              9,
              0.31
            ],
            [
              14,
              1.76
            ],
            [
              16,
              2.71
            ],
            [
              18,
              5.13
            ]
          ]
        }
      }
    },
    {
      "id": "Road/Major/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Road",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          3
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 9,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9c0b2",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              9,
              0.31
            ],
            [
              14,
              1.76
            ],
            [
              16,
              2.71
            ],
            [
              18,
              5.13
            ]
          ]
        }
      }
    },
    {
      "id": "Road/Freeway Motorway, ramp or traffic circle/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Road",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          2
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 7,
      "layout": {
        "line-join": "round",
        "line-cap": "round"
      },
      "paint": {
        "line-color": "#c9c0b2",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              9,
              0.31
            ],
            [
              14,
              2.08
            ],
            [
              16,
              3.34
            ],
            [
              18,
              7.82
            ]
          ]
        }
      }
    },
    {
      "id": "Road/Highway/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Road",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          1
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 8,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9c0b2",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              8,
              0.31
            ],
            [
              14,
              2.08
            ],
            [
              16,
              3.34
            ],
            [
              18,
              7.82
            ]
          ]
        }
      }
    },
    {
      "id": "Road/Freeway Motorway/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Road",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          0
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 6,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9c0b2",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              5,
              0.31
            ],
            [
              14,
              2.08
            ],
            [
              16,
              3.34
            ],
            [
              18,
              7.82
            ]
          ]
        }
      }
    },
    {
      "id": "Road tunnel/4WD/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Road tunnel",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          10
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 13,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#989083",
        "line-opacity": 0.5,
        "line-dasharray": [
          2,
          1
        ],
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              11,
              1.5
            ],
            [
              14,
              3.3
            ],
            [
              18,
              8.3
            ]
          ]
        }
      }
    },
    {
      "id": "Road tunnel/Service/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Road tunnel",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          8
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 13,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#989083",
        "line-opacity": 0.5,
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              11,
              1.5
            ],
            [
              14,
              3.3
            ],
            [
              18,
              8.3
            ]
          ]
        }
      }
    },
    {
      "id": "Road tunnel/Local/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Road tunnel",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          7
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 12,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#989083",
        "line-opacity": 0.5,
        "line-width": {
          "base": 1.4,
          "stops": [
            [
              11,
              1.5
            ],
            [
              14,
              4
            ],
            [
              16,
              6
            ],
            [
              18,
              17.3
            ]
          ]
        }
      }
    },
    {
      "id": "Road tunnel/Pedestrian/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Road tunnel",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          9
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 15,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#989083",
        "line-opacity": 0.5,
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              14,
              1.5
            ],
            [
              16,
              3.3
            ],
            [
              18,
              4
            ]
          ]
        }
      }
    },
    {
      "id": "Road tunnel/Minor, ramp or traffic circle/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Road tunnel",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          6
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 11,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#989083",
        "line-opacity": 0.5,
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              11,
              1
            ],
            [
              14,
              4
            ],
            [
              16,
              9.65
            ],
            [
              18,
              17.3
            ]
          ]
        }
      }
    },
    {
      "id": "Road tunnel/Minor/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Road tunnel",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          5
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 11,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#989083",
        "line-opacity": 0.5,
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              11,
              2.6
            ],
            [
              14,
              5.65
            ],
            [
              16,
              9.65
            ],
            [
              18,
              17.3
            ]
          ]
        }
      }
    },
    {
      "id": "Road tunnel/Major, ramp or traffic circle/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Road tunnel",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          4
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 9,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#989083",
        "line-opacity": 0.5,
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              9,
              1.5
            ],
            [
              14,
              7.3
            ],
            [
              16,
              10.3
            ],
            [
              18,
              18
            ]
          ]
        }
      }
    },
    {
      "id": "Road tunnel/Major/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Road tunnel",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          3
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 9,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#989083",
        "line-opacity": 0.5,
        "line-width": {
          "base": 1,
          "stops": [
            [
              9,
              1.5
            ],
            [
              14,
              7.3
            ],
            [
              16,
              10.3
            ],
            [
              18,
              18
            ]
          ]
        }
      }
    },
    {
      "id": "Road tunnel/Freeway Motorway, ramp or traffic circle/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Road tunnel",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          2
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 7,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#989083",
        "line-opacity": 0.5,
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              9,
              0.3
            ],
            [
              14,
              8.3
            ],
            [
              16,
              14.3
            ],
            [
              18,
              28
            ]
          ]
        }
      }
    },
    {
      "id": "Road tunnel/Highway/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Road tunnel",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          1
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 8,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#989083",
        "line-opacity": 0.5,
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              8,
              0.3
            ],
            [
              14,
              8.3
            ],
            [
              16,
              14.3
            ],
            [
              18,
              28
            ]
          ]
        }
      }
    },
    {
      "id": "Road tunnel/Freeway Motorway/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Road tunnel",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          0
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 7,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#989083",
        "line-opacity": 0.5,
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              5,
              0.3
            ],
            [
              14,
              8.3
            ],
            [
              16,
              14.3
            ],
            [
              18,
              28
            ]
          ]
        }
      }
    },
    {
      "id": "Road tunnel/Pedestrian/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Road tunnel",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          9
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 15,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9c0b2",
        "line-opacity": 0.5,
        "line-dasharray": [
          3,
          1.5
        ],
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              14,
              1.3
            ],
            [
              16,
              2
            ],
            [
              18,
              2.3
            ]
          ]
        }
      }
    },
    {
      "id": "Road tunnel/4WD/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Road tunnel",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          10
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 13,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9c0b2",
        "line-opacity": 0.5,
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              11,
              0.75
            ],
            [
              14,
              1.3
            ],
            [
              18,
              6.3
            ]
          ]
        }
      }
    },
    {
      "id": "Road tunnel/Service/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Road tunnel",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          8
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 13,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9c0b2",
        "line-opacity": 0.5,
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              11,
              0.75
            ],
            [
              14,
              1.3
            ],
            [
              18,
              6.3
            ]
          ]
        }
      }
    },
    {
      "id": "Road tunnel/Local/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Road tunnel",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          7
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 12,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9c0b2",
        "line-opacity": 0.5,
        "line-width": {
          "base": 1.4,
          "stops": [
            [
              11,
              1.1
            ],
            [
              14,
              2
            ],
            [
              16,
              4
            ],
            [
              18,
              15.3
            ]
          ]
        }
      }
    },
    {
      "id": "Road tunnel/Minor, ramp or traffic circle/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Road tunnel",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          6
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 11,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9c0b2",
        "line-opacity": 0.5,
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              11,
              0.75
            ],
            [
              14,
              2
            ],
            [
              16,
              7.65
            ],
            [
              18,
              15.3
            ]
          ]
        }
      }
    },
    {
      "id": "Road tunnel/Minor/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Road tunnel",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          5
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 11,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9c0b2",
        "line-opacity": 0.5,
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              11,
              1.3
            ],
            [
              14,
              3.65
            ],
            [
              16,
              7.65
            ],
            [
              18,
              15.3
            ]
          ]
        }
      }
    },
    {
      "id": "Road tunnel/Major, ramp or traffic circle/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Road tunnel",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          4
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 9,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9c0b2",
        "line-opacity": 0.5,
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              9,
              0.75
            ],
            [
              14,
              5.3
            ],
            [
              16,
              8.3
            ],
            [
              18,
              16
            ]
          ]
        }
      }
    },
    {
      "id": "Road tunnel/Major/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Road tunnel",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          3
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 9,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9c0b2",
        "line-opacity": 0.5,
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              9,
              0.75
            ],
            [
              14,
              5.3
            ],
            [
              16,
              8.3
            ],
            [
              18,
              16
            ]
          ]
        }
      }
    },
    {
      "id": "Road tunnel/Freeway Motorway, ramp or traffic circle/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Road tunnel",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          2
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 7,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9c0b2",
        "line-opacity": 0.5,
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              9,
              0.3
            ],
            [
              14,
              6.3
            ],
            [
              16,
              12.3
            ],
            [
              18,
              26
            ]
          ]
        }
      }
    },
    {
      "id": "Road tunnel/Highway/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Road tunnel",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          1
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 8,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9c0b2",
        "line-opacity": 0.5,
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              8,
              0.3
            ],
            [
              14,
              6.3
            ],
            [
              16,
              12.3
            ],
            [
              18,
              26
            ]
          ]
        }
      }
    },
    {
      "id": "Road tunnel/Freeway Motorway/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Road tunnel",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          0
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 6,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#c9c0b2",
        "line-opacity": 0.5,
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              5,
              0.3
            ],
            [
              14,
              6.3
            ],
            [
              16,
              12.3
            ],
            [
              18,
              26
            ]
          ]
        }
      }
    },
    {
      "id": "Special area of interest/Gutter",
      "type": "fill",
      "source": "esri",
      "source-layer": "Special area of interest",
      "filter": [
        "==",
        "_symbol",
        9
      ],
      "minzoom": 14,
      "layout": {},
      "paint": {
        "fill-color": "#c6c7b2",
        "fill-outline-color": "#bdbda2"
      }
    },
    {
      "id": "Special area of interest/Curb",
      "type": "fill",
      "source": "esri",
      "source-layer": "Special area of interest",
      "filter": [
        "==",
        "_symbol",
        3
      ],
      "minzoom": 14,
      "layout": {},
      "paint": {
        "fill-color": "#c6c7b2",
        "fill-outline-color": "#bdbda2"
      }
    },
    {
      "id": "Boundary line/Disputed admin2/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Boundary line",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          8
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 9,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#888072",
        "line-opacity": 0.95,
        "line-width": {
          "base": 1,
          "stops": [
            [
              4,
              0.65
            ],
            [
              14,
              7
            ],
            [
              17,
              7
            ]
          ]
        }
      }
    },
    {
      "id": "Boundary line/Disputed admin2/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Boundary line",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          8
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 9,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#b8afa0",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              1,
              0.65
            ],
            [
              14,
              1.3
            ],
            [
              17,
              2.65
            ]
          ]
        },
        "line-dasharray": [
          7,
          5
        ]
      }
    },
    {
      "id": "Boundary line/Disputed admin1/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Boundary line",
      "minzoom": 4,
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          7
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#888072",
        "line-opacity": 0.95,
        "line-width": {
          "base": 1,
          "stops": [
            [
              4,
              0.65
            ],
            [
              14,
              7
            ]
          ]
        }
      }
    },
    {
      "id": "Boundary line/Disputed admin0/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Boundary line",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          6
        ],
        [
          "!in",
          "Viz",
          3
        ],
        [
          "!in",
          "DisputeID",
          8,
          16,
          90,
          96,
          0
        ]
      ],
      "minzoom": 1,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#888072",
        "line-opacity": 0.95,
        "line-width": {
          "base": 1,
          "stops": [
            [
              1,
              0.65
            ],
            [
              14,
              9.3
            ]
          ]
        }
      }
    },
    {
      "id": "Boundary line/Disputed admin1/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Boundary line",
      "minzoom": 4,
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          7
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#b8afa0",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              1,
              0.65
            ],
            [
              14,
              1.3
            ],
            [
              17,
              2.65
            ]
          ]
        },
        "line-dasharray": [
          7,
          5
        ]
      }
    },
    {
      "id": "Boundary line/Disputed admin0/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Boundary line",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          6
        ],
        [
          "!in",
          "Viz",
          3
        ],
        [
          "!in",
          "DisputeID",
          8,
          16,
          90,
          96,
          0
        ]
      ],
      "minzoom": 1,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#b8afa0",
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              1,
              0.65
            ],
            [
              14,
              1.3
            ],
            [
              17,
              2.65
            ]
          ]
        },
        "line-dasharray": [
          7,
          5
        ]
      }
    },
    {
      "id": "Boundary line/Admin2/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Boundary line",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          2
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 10,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#888072",
        "line-opacity": 0.6,
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              8,
              1.3
            ],
            [
              14,
              2.65
            ]
          ]
        }
      }
    },
    {
      "id": "Boundary line/Admin1/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Boundary line",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          1
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 4,
      "layout": {
        "line-cap": "round",
        "line-join": "round",
        "visibility": "none"
      },
      "paint": {
        "line-color": "#888072",
        "line-width": {
          "base": 1,
          "stops": [
            [
              4,
              0.65
            ],
            [
              14,
              7
            ]
          ]
        }
      }
    },
    {
      "id": "Boundary line/Admin0/1",
      "type": "line",
      "source": "esri",
      "source-layer": "Boundary line",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          0
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 1,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#888072",
        "line-width": {
          "base": 1,
          "stops": [
            [
              1,
              0.65
            ],
            [
              14,
              9.3
            ]
          ]
        }
      }
    },
    {
      "id": "Boundary line/Admin5",
      "type": "line",
      "source": "esri",
      "source-layer": "Boundary line",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          5
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 16,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#b8afa0",
        "line-dasharray": [
          5,
          3
        ]
      }
    },
    {
      "id": "Boundary line/Admin4",
      "type": "line",
      "source": "esri",
      "source-layer": "Boundary line",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          4
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 16,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#b8afa0",
        "line-dasharray": [
          5,
          3
        ]
      }
    },
    {
      "id": "Boundary line/Admin3",
      "type": "line",
      "source": "esri",
      "source-layer": "Boundary line",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          3
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 16,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#b8afa0",
        "line-dasharray": [
          5,
          3
        ]
      }
    },
    {
      "id": "Boundary line/Admin2/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Boundary line",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          2
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 9,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#b8afa0",
        "line-dasharray": [
          6,
          4
        ],
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              8,
              0.5
            ],
            [
              14,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "Boundary line/Admin1/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Boundary line",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          1
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 7,
      "layout": {
        "line-join": "round",
        "visibility": "none"
      },
      "paint": {
        "line-color": "#b8afa0",
        "line-dasharray": [
          7,
          5.3
        ],
        "line-width": {
          "base": 1,
          "stops": [
            [
              7,
              0.3
            ],
            [
              14,
              1.3
            ]
          ]
        }
      }
    },
    {
      "id": "Boundary line/Admin0/0",
      "type": "line",
      "source": "esri",
      "source-layer": "Boundary line",
      "filter": [
        "all",
        [
          "==",
          "_symbol",
          0
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 5,
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "#b8afa0",
        "line-dasharray": [
          7,
          5.3
        ],
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              5,
              0.7
            ],
            [
              14,
              1.3
            ]
          ]
        }
      }
    },
    {
      "id": "Water point/Sea or ocean",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water point",
      "filter": [
        "==",
        "_label_class",
        0
      ],
      "minzoom": 9,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "stops": [
            [
              9,
              8.08
            ],
            [
              15,
              14.87
            ]
          ]
        },
        "text-letter-spacing": 0.3,
        "text-line-height": 1.6,
        "text-max-width": 4,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water point/Island",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water point",
      "filter": [
        "==",
        "_label_class",
        7
      ],
      "minzoom": 9,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "stops": [
            [
              9,
              8.08
            ],
            [
              15,
              9.54
            ]
          ]
        },
        "text-letter-spacing": 0.1,
        "text-max-width": 4,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water point/Dam or weir",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water point",
      "filter": [
        "==",
        "_label_class",
        5
      ],
      "minzoom": 9,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "stops": [
            [
              9,
              8.08
            ],
            [
              15,
              9.54
            ]
          ]
        },
        "text-letter-spacing": 0.1,
        "text-max-width": 4,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 0.7,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water point/Playa",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water point",
      "filter": [
        "==",
        "_label_class",
        6
      ],
      "minzoom": 9,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "stops": [
            [
              9,
              8.08
            ],
            [
              15,
              9.54
            ]
          ]
        },
        "text-letter-spacing": 0.1,
        "text-max-width": 4,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 0.7,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water point/Canal or ditch",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water point",
      "filter": [
        "==",
        "_label_class",
        4
      ],
      "minzoom": 9,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "stops": [
            [
              9,
              8.08
            ],
            [
              15,
              9.54
            ]
          ]
        },
        "text-letter-spacing": 0.13,
        "text-max-width": 4,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water point/Stream or river",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water point",
      "filter": [
        "==",
        "_label_class",
        3
      ],
      "minzoom": 9,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "stops": [
            [
              9,
              8.08
            ],
            [
              15,
              9.54
            ]
          ]
        },
        "text-letter-spacing": 0.1,
        "text-max-width": 4,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 0.5,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water point/Lake or reservoir",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water point",
      "filter": [
        "==",
        "_label_class",
        2
      ],
      "minzoom": 9,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "stops": [
            [
              9,
              8.08
            ],
            [
              15,
              9.54
            ]
          ]
        },
        "text-letter-spacing": 0.1,
        "text-max-width": 4,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 0.5,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water point/Bay or inlet",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water point",
      "filter": [
        "==",
        "_label_class",
        1
      ],
      "minzoom": 9,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "stops": [
            [
              9,
              8.08
            ],
            [
              15,
              9.54
            ]
          ]
        },
        "text-letter-spacing": 0.1,
        "text-max-width": 4,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water line/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water line/label",
      "minzoom": 11,
      "layout": {
        "symbol-placement": "line",
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 8.56,
        "text-letter-spacing": 0.07,
        "text-max-width": 6,
        "text-max-angle": 18,
        "text-field": "{_name_global}",
        "text-padding": 1,
        "text-offset": [
          0,
          -0.5
        ],
        "symbol-spacing": 800,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 0.5,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Marine park/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Marine park/label",
      "minzoom": 16,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water area/label/Dam or weir",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water area/label",
      "filter": [
        "==",
        "_label_class",
        8
      ],
      "minzoom": 11,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.08,
        "text-max-width": 4,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water area/label/Playa",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water area/label",
      "filter": [
        "==",
        "_label_class",
        9
      ],
      "minzoom": 11,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.08,
        "text-max-width": 4,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water area/label/Canal or ditch",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water area/label",
      "filter": [
        "==",
        "_label_class",
        2
      ],
      "minzoom": 11,
      "layout": {
        "symbol-placement": "line",
        "symbol-spacing": 1000,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.13,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "text-max-width": 5,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 0.5,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water area/label/Small river",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water area/label",
      "filter": [
        "==",
        "_label_class",
        7
      ],
      "minzoom": 11,
      "layout": {
        "symbol-placement": "line",
        "symbol-spacing": 1000,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.13,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "text-max-width": 8,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 0.5,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water area/label/Large river",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water area/label",
      "filter": [
        "==",
        "_label_class",
        4
      ],
      "minzoom": 11,
      "layout": {
        "symbol-placement": "line",
        "symbol-spacing": 1000,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.54,
        "text-letter-spacing": 0.13,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "text-max-width": 8,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 0.5,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water area/label/Small lake or reservoir",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water area/label",
      "filter": [
        "==",
        "_label_class",
        6
      ],
      "minzoom": 11,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.13,
        "text-max-width": 4,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 0.5,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water area/label/Large lake or reservoir",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water area/label",
      "filter": [
        "==",
        "_label_class",
        3
      ],
      "minzoom": 11,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.54,
        "text-letter-spacing": 0.13,
        "text-line-height": 1.15,
        "text-max-width": 4,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 0.5,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water area/label/Bay or inlet",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water area/label",
      "filter": [
        "==",
        "_label_class",
        1
      ],
      "minzoom": 11,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 10.49,
        "text-letter-spacing": 0.13,
        "text-line-height": 1.15,
        "text-max-width": 4,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 0.5,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water area/label/Small island",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water area/label",
      "filter": [
        "==",
        "_label_class",
        0
      ],
      "minzoom": 11,
      "layout": {
        "text-size": 9.04,
        "text-letter-spacing": 0.1,
        "text-max-width": 4,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water area/label/Large island",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water area/label",
      "filter": [
        "==",
        "_label_class",
        5
      ],
      "minzoom": 11,
      "layout": {
        "text-size": 9.54,
        "text-letter-spacing": 0.13,
        "text-max-width": 4,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water area large scale/label/River",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water area large scale/label",
      "filter": [
        "==",
        "_label_class",
        1
      ],
      "minzoom": 7,
      "maxzoom": 11,
      "layout": {
        "symbol-placement": "line",
        "symbol-spacing": 1000,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 8.56,
        "text-letter-spacing": 0.1,
        "text-field": "{_name}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "text-max-width": 4,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 0.5,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water area large scale/label/Lake or lake intermittent",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water area large scale/label",
      "filter": [
        "==",
        "_label_class",
        0
      ],
      "minzoom": 7,
      "maxzoom": 11,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.1,
        "text-max-width": 4,
        "text-field": "{_name}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 0.5,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water area medium scale/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water area medium scale/label",
      "minzoom": 5,
      "maxzoom": 7,
      "layout": {
        "text-max-width": 4,
        "text-field": "{_name}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "text-letter-spacing": 0.08,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 8.56,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 0.5,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water area small scale/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water area small scale/label",
      "minzoom": 1,
      "maxzoom": 5,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 8.56,
        "text-letter-spacing": 0.08,
        "text-max-width": 4,
        "text-field": "{_name}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 0.5,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Marine area/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Marine area/label",
      "minzoom": 11,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.54,
        "text-letter-spacing": 0.13,
        "text-max-width": 4,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 0.5,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Marine waterbody/label/small",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Marine waterbody/label",
      "filter": [
        "==",
        "_label_class",
        4
      ],
      "minzoom": 4,
      "maxzoom": 10,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-letter-spacing": 0.12,
        "text-max-width": 4,
        "text-field": "{_name}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "text-size": {
          "stops": [
            [
              1,
              8.56
            ],
            [
              6,
              10.49
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 0.5,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Marine waterbody/label/medium",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Marine waterbody/label",
      "filter": [
        "==",
        "_label_class",
        3
      ],
      "minzoom": 4,
      "maxzoom": 10,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-letter-spacing": 0.15,
        "text-max-width": 4,
        "text-field": "{_name}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "text-size": {
          "stops": [
            [
              1,
              8.56
            ],
            [
              6,
              10.49
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 0.5,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Marine waterbody/label/large",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Marine waterbody/label",
      "filter": [
        "==",
        "_label_class",
        2
      ],
      "minzoom": 4,
      "maxzoom": 10,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-letter-spacing": 0.18,
        "text-line-height": 1.5,
        "text-max-width": 4,
        "text-field": "{_name}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "text-size": {
          "stops": [
            [
              1,
              8.56
            ],
            [
              6,
              11.47
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 0.5,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Marine waterbody/label/x large",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Marine waterbody/label",
      "filter": [
        "==",
        "_label_class",
        1
      ],
      "minzoom": 3,
      "maxzoom": 10,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-letter-spacing": 0.2,
        "text-line-height": 1.5,
        "text-max-width": 4,
        "text-field": "{_name}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "text-size": {
          "stops": [
            [
              1,
              9.54
            ],
            [
              6,
              12.44
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 0.5,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Marine waterbody/label/2x large",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Marine waterbody/label",
      "filter": [
        "==",
        "_label_class",
        0
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-letter-spacing": 0.3,
        "text-line-height": 1.6,
        "text-max-width": 4,
        "text-field": "{_name}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "text-size": {
          "stops": [
            [
              1,
              10.49
            ],
            [
              4,
              13.41
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 0.5,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Ferry/label/Rail ferry",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Ferry/label",
      "filter": [
        "all",
        [
          "==",
          "_label_class",
          1
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 16,
      "layout": {
        "symbol-placement": "line",
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 8.08,
        "text-letter-spacing": 0.1,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 5,
        "text-offset": [
          0,
          -0.6
        ],
        "symbol-spacing": 1000,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Railroad/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Railroad/label",
      "minzoom": 16,
      "layout": {
        "symbol-placement": "line",
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 8.08,
        "text-letter-spacing": 0.1,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 5,
        "text-offset": [
          0,
          -0.6
        ],
        "symbol-spacing": 1000,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Road tunnel/label/Pedestrian",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Road tunnel/label",
      "filter": [
        "all",
        [
          "==",
          "_label_class",
          6
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 15,
      "layout": {
        "symbol-placement": "line",
        "symbol-avoid-edges": true,
        "symbol-spacing": 400,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 8.85,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 5,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Road tunnel/label/Local, service, 4WD",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Road tunnel/label",
      "filter": [
        "all",
        [
          "==",
          "_label_class",
          5
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 15,
      "layout": {
        "symbol-placement": "line",
        "symbol-avoid-edges": true,
        "symbol-spacing": 400,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.09,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 5,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Road tunnel/label/Minor",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Road tunnel/label",
      "filter": [
        "all",
        [
          "==",
          "_label_class",
          4
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 14,
      "layout": {
        "symbol-placement": "line",
        "symbol-avoid-edges": true,
        "symbol-spacing": 400,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.09,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 5,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Road tunnel/label/Major, alt name",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Road tunnel/label",
      "filter": [
        "all",
        [
          "==",
          "_label_class",
          3
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 14,
      "layout": {
        "symbol-placement": "line",
        "symbol-avoid-edges": true,
        "symbol-spacing": 400,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 10.02,
        "text-letter-spacing": 0.09,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 5,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Road tunnel/label/Major",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Road tunnel/label",
      "filter": [
        "all",
        [
          "==",
          "_label_class",
          2
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 14,
      "layout": {
        "symbol-placement": "line",
        "symbol-avoid-edges": true,
        "symbol-spacing": 400,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 10.02,
        "text-letter-spacing": 0.09,
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-padding": 5,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Road tunnel/label/Highway",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Road tunnel/label",
      "filter": [
        "all",
        [
          "==",
          "_label_class",
          7
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 13,
      "layout": {
        "symbol-placement": "line",
        "symbol-avoid-edges": true,
        "symbol-spacing": 400,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 10.02,
        "text-letter-spacing": 0.09,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 5,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Road tunnel/label/Freeway Motorway, alt name",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Road tunnel/label",
      "filter": [
        "all",
        [
          "==",
          "_label_class",
          1
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 13,
      "layout": {
        "symbol-placement": "line",
        "symbol-avoid-edges": true,
        "symbol-spacing": 400,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 10.02,
        "text-letter-spacing": 0.09,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 5,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Road tunnel/label/Freeway Motorway",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Road tunnel/label",
      "filter": [
        "all",
        [
          "==",
          "_label_class",
          0
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 13,
      "layout": {
        "symbol-placement": "line",
        "symbol-avoid-edges": true,
        "symbol-spacing": 400,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 10.02,
        "text-letter-spacing": 0.09,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 5,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Building/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Building/label",
      "minzoom": 17,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.08,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 0.7,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Trail or path/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Trail or path/label",
      "minzoom": 15,
      "layout": {
        "symbol-placement": "line",
        "symbol-avoid-edges": true,
        "symbol-spacing": 400,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 8.85,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 5,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Road/label/Pedestrian",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Road/label",
      "filter": [
        "all",
        [
          "==",
          "_label_class",
          6
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 15,
      "layout": {
        "symbol-placement": "line",
        "symbol-avoid-edges": true,
        "symbol-spacing": 400,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 8.85,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 5,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Road/label/Local",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Road/label",
      "filter": [
        "all",
        [
          "==",
          "_label_class",
          5
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 15,
      "layout": {
        "symbol-placement": "line",
        "symbol-avoid-edges": true,
        "symbol-spacing": 400,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.09,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 5,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Road/label/Minor",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Road/label",
      "filter": [
        "all",
        [
          "==",
          "_label_class",
          4
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 14,
      "layout": {
        "symbol-placement": "line",
        "symbol-avoid-edges": true,
        "symbol-spacing": 400,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.54,
        "text-letter-spacing": 0.09,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Road/label/Major, alt name",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Road/label",
      "filter": [
        "all",
        [
          "==",
          "_label_class",
          3
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 14,
      "layout": {
        "symbol-placement": "line",
        "symbol-avoid-edges": true,
        "symbol-spacing": 400,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 10.02,
        "text-letter-spacing": 0.09,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Road/label/Major",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Road/label",
      "filter": [
        "all",
        [
          "==",
          "_label_class",
          2
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 14,
      "layout": {
        "symbol-placement": "line",
        "symbol-avoid-edges": true,
        "symbol-spacing": 400,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 10.02,
        "text-letter-spacing": 0.09,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Road/label/Highway",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Road/label",
      "filter": [
        "all",
        [
          "==",
          "_label_class",
          75
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 13,
      "layout": {
        "symbol-placement": "line",
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 10.02,
        "text-letter-spacing": 0.09,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Road/label/Freeway Motorway, alt name",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Road/label",
      "filter": [
        "all",
        [
          "==",
          "_label_class",
          1
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 13,
      "layout": {
        "symbol-placement": "line",
        "symbol-avoid-edges": true,
        "symbol-spacing": 400,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 10.02,
        "text-letter-spacing": 0.09,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Road/label/Freeway Motorway",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Road/label",
      "filter": [
        "all",
        [
          "==",
          "_label_class",
          0
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 13,
      "layout": {
        "symbol-placement": "line",
        "symbol-avoid-edges": true,
        "symbol-spacing": 400,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 10.02,
        "text-letter-spacing": 0.09,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Road/label/Rectangle white black (Alt)",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Road/label",
      "filter": [
        "all",
        [
          "in",
          "_label_class",
          8,
          10,
          12,
          14,
          16,
          18,
          20,
          22,
          24,
          26,
          28,
          30,
          32,
          34,
          36,
          38,
          40,
          42,
          44,
          46,
          48,
          50,
          52,
          54,
          56,
          58,
          60,
          62,
          64,
          66,
          68,
          70,
          72,
          74
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 14,
      "layout": {
        "symbol-placement": "line",
        "symbol-spacing": 800,
        "text-max-angle": 25,
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 8.08,
        "text-max-width": 6,
        "text-field": "{_name}",
        "icon-image": "Road/Rectangle white black (Alt)/{_len}",
        "icon-rotation-alignment": "viewport",
        "text-rotation-alignment": "viewport",
        "text-offset": [
          0,
          0.2
        ],
        "text-padding": 30,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Road/label/Rectangle white black",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Road/label",
      "filter": [
        "all",
        [
          "in",
          "_label_class",
          7,
          9,
          11,
          13,
          15,
          17,
          19,
          21,
          23,
          25,
          27,
          29,
          31,
          33,
          35,
          37,
          39,
          41,
          43,
          45,
          47,
          49,
          51,
          53,
          55,
          57,
          59,
          61,
          63,
          65,
          67,
          69,
          71,
          73
        ],
        [
          "!in",
          "Viz",
          3
        ]
      ],
      "minzoom": 14,
      "layout": {
        "symbol-placement": "line",
        "symbol-spacing": 800,
        "text-max-angle": 25,
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 8.08,
        "text-max-width": 6,
        "text-field": "{_name}",
        "icon-image": "Road/Rectangle white black/{_len}",
        "icon-rotation-alignment": "viewport",
        "text-rotation-alignment": "viewport",
        "text-offset": [
          0,
          0.2
        ],
        "text-padding": 30,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Cemetery/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Cemetery/label",
      "minzoom": 16,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Freight/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Freight/label",
      "minzoom": 17,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Water and wastewater/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Water and wastewater/label",
      "minzoom": 17,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Port/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Port/label",
      "minzoom": 17,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Industry/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Industry/label",
      "minzoom": 17,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Government/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Government/label",
      "minzoom": 17,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Finance/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Finance/label",
      "minzoom": 17,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Emergency/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Emergency/label",
      "minzoom": 17,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Indigenous/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Indigenous/label",
      "minzoom": 17,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Military/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Military/label",
      "minzoom": 17,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 25,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Transportation/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Transportation/label",
      "minzoom": 17,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Pedestrian/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Pedestrian/label",
      "minzoom": 17,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Beach/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Beach/label",
      "minzoom": 17,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.08,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Golf course/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Golf course/label",
      "minzoom": 17,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Zoo/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Zoo/label",
      "minzoom": 15,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Retail/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Retail/label",
      "minzoom": 17,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Landmark/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Landmark/label",
      "minzoom": 17,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Openspace or forest/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Openspace or forest/label",
      "minzoom": 14,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 25,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Park or farming/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Park or farming/label",
      "minzoom": 14,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 25,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Point of interest/Park",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Point of interest",
      "filter": [
        "==",
        "_label_class",
        1
      ],
      "minzoom": 14,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.08,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-width": 1,
        "text-halo-color": "#000000",
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Education/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Education/label",
      "minzoom": 17,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Medical/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Medical/label",
      "minzoom": 17,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.04,
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Admin1 forest or park/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Admin1 forest or park/label",
      "minzoom": 9,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "stops": [
            [
              9,
              8.08
            ],
            [
              12,
              9.04
            ]
          ]
        },
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 25,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Admin0 forest or park/label/Default",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Admin0 forest or park/label",
      "minzoom": 9,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "stops": [
            [
              9,
              8.08
            ],
            [
              12,
              9.04
            ]
          ]
        },
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 25,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Airport/label/Airport property",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Airport/label",
      "minzoom": 9,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "stops": [
            [
              9,
              8.08
            ],
            [
              12,
              9.04
            ]
          ]
        },
        "text-letter-spacing": 0.05,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "symbol-avoid-edges": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Admin2 area/label/small",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Admin2 area/label",
      "filter": [
        "==",
        "_label_class",
        1
      ],
      "minzoom": 4,
      "layout": {
        "visibility": "visible",
        "text-size": 12.56,
        "icon-size": 1,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-line-height": 1.45,
        "text-padding": 3,
        "text-letter-spacing": 0.25,
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "text-justify": "center",
        "text-rotation-alignment": "auto",
        "text-optional": false,
        "icon-allow-overlap": false,
        "icon-optional": false,
        "icon-ignore-placement": false,
        "icon-rotation-alignment": "auto",
        "symbol-placement": "point",
        "symbol-avoid-edges": true,
        "symbol-spacing": 250,
        "text-anchor": "center",
        "icon-anchor": "center",
        "icon-offset": [
          0,
          0
        ],
        "text-offset": [
          0,
          0
        ],
        "icon-rotate": 0,
        "text-rotate": 0,
        "text-max-angle": 45,
        "text-field": "{_name}",
        "text-transform": "uppercase"
      },
      "paint": {
        "icon-opacity": 1,
        "text-opacity": 1,
        "text-color": "#ffffff",
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-translate-anchor": "map",
        "icon-translate-anchor": "map",
        "icon-translate": [
          0,
          0
        ],
        "text-translate": [
          0,
          0
        ]
      }
    },
    {
      "id": "Admin2 area/label/large",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Admin2 area/label",
      "filter": [
        "==",
        "_label_class",
        0
      ],
      "minzoom": 9,
      "layout": {
        "visibility": "visible",
        "text-size": 27.22,
        "icon-size": 1,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-line-height": 1.2,
        "text-padding": 1,
        "text-letter-spacing": 0.2,
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "text-justify": "center",
        "text-rotation-alignment": "auto",
        "text-optional": false,
        "icon-allow-overlap": false,
        "icon-optional": false,
        "icon-ignore-placement": false,
        "icon-rotation-alignment": "auto",
        "symbol-placement": "point",
        "symbol-avoid-edges": true,
        "symbol-spacing": 250,
        "text-anchor": "center",
        "icon-anchor": "center",
        "icon-offset": [
          0,
          0
        ],
        "text-offset": [
          0,
          0
        ],
        "icon-rotate": 0,
        "text-rotate": 0,
        "text-max-angle": 45,
        "text-field": "{_name}",
        "text-transform": "uppercase"
      },
      "paint": {
        "icon-opacity": 1,
        "text-opacity": 1,
        "text-color": "#ffffff",
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-translate-anchor": "map",
        "icon-translate-anchor": "map",
        "icon-translate": [
          0,
          0
        ],
        "text-translate": [
          0,
          0
        ]
      }
    },
    {
      "id": "Admin1 area/label/x small",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Admin1 area/label",
      "filter": [
        "==",
        "_label_class",
        5
      ],
      "minzoom": 5,
      "maxzoom": 10,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-padding": 1,
        "symbol-avoid-edges": true,
        "text-transform": "uppercase",
        "text-size": {
          "stops": [
            [
              4,
              8.56
            ],
            [
              5,
              8.56
            ],
            [
              6,
              9.04
            ],
            [
              9,
              9.54
            ]
          ]
        },
        "text-letter-spacing": {
          "stops": [
            [
              4,
              0.1
            ],
            [
              8,
              0.18
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Admin1 area/label/small",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Admin1 area/label",
      "filter": [
        "==",
        "_label_class",
        4
      ],
      "minzoom": 5,
      "maxzoom": 10,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-padding": 1,
        "symbol-avoid-edges": true,
        "text-transform": "uppercase",
        "text-size": {
          "stops": [
            [
              4,
              8.56
            ],
            [
              5,
              8.56
            ],
            [
              6,
              9.04
            ],
            [
              9,
              10.97
            ]
          ]
        },
        "text-letter-spacing": {
          "stops": [
            [
              4,
              0.1
            ],
            [
              8,
              0.18
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Admin1 area/label/medium",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Admin1 area/label",
      "filter": [
        "==",
        "_label_class",
        3
      ],
      "minzoom": 5,
      "maxzoom": 10,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-padding": 1,
        "symbol-avoid-edges": true,
        "text-transform": "uppercase",
        "text-size": {
          "stops": [
            [
              4,
              9.54
            ],
            [
              5,
              9.54
            ],
            [
              6,
              10.02
            ],
            [
              9,
              11.47
            ]
          ]
        },
        "text-letter-spacing": {
          "stops": [
            [
              4,
              0.1
            ],
            [
              8,
              0.18
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Admin1 area/label/large",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Admin1 area/label",
      "filter": [
        "==",
        "_label_class",
        2
      ],
      "minzoom": 5,
      "maxzoom": 10,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-padding": 1,
        "symbol-avoid-edges": true,
        "text-transform": "uppercase",
        "text-size": {
          "stops": [
            [
              4,
              9.54
            ],
            [
              5,
              10.02
            ],
            [
              6,
              10.49
            ],
            [
              9,
              14.37
            ]
          ]
        },
        "text-letter-spacing": {
          "stops": [
            [
              4,
              0.1
            ],
            [
              8,
              0.2
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Admin1 area/label/x large",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Admin1 area/label",
      "filter": [
        "==",
        "_label_class",
        1
      ],
      "minzoom": 5,
      "maxzoom": 10,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-padding": 1,
        "symbol-avoid-edges": true,
        "text-transform": "uppercase",
        "text-size": {
          "stops": [
            [
              4,
              10.02
            ],
            [
              5,
              10.49
            ],
            [
              6,
              10.97
            ],
            [
              9,
              16.34
            ]
          ]
        },
        "text-letter-spacing": {
          "stops": [
            [
              4,
              0.13
            ],
            [
              8,
              0.3
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Admin1 area/label/2x large",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Admin1 area/label",
      "filter": [
        "==",
        "_label_class",
        0
      ],
      "minzoom": 5,
      "maxzoom": 10,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-padding": 1,
        "symbol-avoid-edges": true,
        "text-transform": "uppercase",
        "text-size": {
          "stops": [
            [
              4,
              10.49
            ],
            [
              5,
              10.97
            ],
            [
              6,
              11.47
            ],
            [
              9,
              16.82
            ]
          ]
        },
        "text-letter-spacing": {
          "stops": [
            [
              4,
              0.13
            ],
            [
              8,
              0.4
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Point of interest/General",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Point of interest",
      "filter": [
        "==",
        "_label_class",
        0
      ],
      "minzoom": 17,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 8.56,
        "text-letter-spacing": 0.08,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-width": 1,
        "text-halo-color": "#000000",
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Point of interest/Bus station",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Point of interest",
      "filter": [
        "==",
        "_symbol",
        2
      ],
      "minzoom": 17,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 8.56,
        "text-letter-spacing": 0.04,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 5,
        "text-offset": [
          0,
          -0.9
        ],
        "visibility": "visible"
      },
      "paint": {
        "text-halo-width": 1,
        "text-halo-color": "#000000",
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Point of interest/Rail station",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Point of interest",
      "filter": [
        "==",
        "_symbol",
        3
      ],
      "minzoom": 17,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 8.56,
        "text-letter-spacing": 0.04,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 5,
        "text-offset": [
          0,
          -0.9
        ],
        "visibility": "visible"
      },
      "paint": {
        "text-halo-width": 1,
        "text-halo-color": "#000000",
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Neighborhood",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Neighborhood",
      "minzoom": 14,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "stops": [
            [
              10,
              9.54
            ],
            [
              16,
              13.41
            ]
          ]
        },
        "text-letter-spacing": 0.08,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": {
          "stops": [
            [
              13,
              20
            ],
            [
              18,
              2
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City large scale/town small",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City large scale",
      "filter": [
        "==",
        "_label_class",
        5
      ],
      "minzoom": 10,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "stops": [
            [
              10,
              9.54
            ],
            [
              16,
              12.44
            ]
          ]
        },
        "text-letter-spacing": 0.08,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 15,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City large scale/town large",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City large scale",
      "filter": [
        "==",
        "_label_class",
        4
      ],
      "minzoom": 10,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "stops": [
            [
              10,
              9.54
            ],
            [
              16,
              14.37
            ]
          ]
        },
        "text-letter-spacing": 0.09,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 1,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City large scale/small",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City large scale",
      "filter": [
        "==",
        "_label_class",
        3
      ],
      "minzoom": 10,
      "maxzoom": 18,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-letter-spacing": 0.1,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 1,
        "text-size": {
          "stops": [
            [
              10,
              10.49
            ],
            [
              16,
              15.36
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City large scale/medium",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City large scale",
      "filter": [
        "==",
        "_label_class",
        2
      ],
      "minzoom": 10,
      "maxzoom": 17,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-letter-spacing": 0.1,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 1,
        "text-size": {
          "stops": [
            [
              10,
              10.49
            ],
            [
              16,
              17.81
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City large scale/large",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City large scale",
      "filter": [
        "==",
        "_label_class",
        1
      ],
      "minzoom": 10,
      "maxzoom": 17,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-letter-spacing": 0.1,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 1,
        "text-size": {
          "stops": [
            [
              10,
              13.41
            ],
            [
              16,
              21.25
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City large scale/x large",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City large scale",
      "filter": [
        "==",
        "_label_class",
        0
      ],
      "minzoom": 10,
      "maxzoom": 17,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-letter-spacing": 0.1,
        "text-max-width": 6,
        "text-field": "{_name_global}",
        "text-padding": 1,
        "text-size": {
          "stops": [
            [
              10,
              14.37
            ],
            [
              16,
              24.23
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City small scale/town small non capital",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City small scale",
      "filter": [
        "==",
        "_symbol",
        17
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.54,
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-letter-spacing": 0.05,
        "text-padding": 1,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City small scale/town large non capital",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City small scale",
      "filter": [
        "==",
        "_symbol",
        15
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.54,
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-letter-spacing": 0.05,
        "text-padding": 1,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City small scale/small non capital",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City small scale",
      "filter": [
        "==",
        "_symbol",
        12
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.54,
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-letter-spacing": 0.05,
        "text-padding": 1,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City small scale/medium non capital",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City small scale",
      "filter": [
        "==",
        "_symbol",
        9
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-padding": 1,
        "text-letter-spacing": 0.05,
        "text-size": 9.54,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City small scale/other capital",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City small scale",
      "filter": [
        "==",
        "_symbol",
        18
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.54,
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-letter-spacing": 0.05,
        "text-padding": 1,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City small scale/town large other capital",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City small scale",
      "filter": [
        "==",
        "_symbol",
        14
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.54,
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-letter-spacing": 0.05,
        "text-padding": 1,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City small scale/small other capital",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City small scale",
      "filter": [
        "==",
        "_symbol",
        11
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": 9.54,
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-letter-spacing": 0.05,
        "text-padding": 1,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City small scale/medium other capital",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City small scale",
      "filter": [
        "==",
        "_symbol",
        8
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-letter-spacing": 0.05,
        "text-padding": 1,
        "text-size": 9.54,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Admin0 point/x small",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Admin0 point",
      "filter": [
        "==",
        "_label_class",
        5
      ],
      "minzoom": 5,
      "maxzoom": 10,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-padding": 1,
        "symbol-avoid-edges": true,
        "text-letter-spacing": {
          "stops": [
            [
              5,
              0.13
            ],
            [
              8,
              0.5
            ]
          ]
        },
        "text-size": {
          "stops": [
            [
              5,
              9.54
            ],
            [
              10,
              11.94
            ]
          ]
        },
        "text-transform": "uppercase",
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Admin0 point/small",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Admin0 point",
      "filter": [
        "==",
        "_label_class",
        4
      ],
      "minzoom": 4,
      "maxzoom": 10,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-padding": 1,
        "symbol-avoid-edges": true,
        "text-letter-spacing": {
          "stops": [
            [
              4,
              0.13
            ],
            [
              8,
              0.5
            ]
          ]
        },
        "text-size": {
          "stops": [
            [
              4,
              9.54
            ],
            [
              10,
              11.94
            ]
          ]
        },
        "text-transform": "uppercase",
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Admin0 point/medium",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Admin0 point",
      "filter": [
        "==",
        "_label_class",
        3
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-padding": 1,
        "symbol-avoid-edges": true,
        "text-letter-spacing": {
          "stops": [
            [
              2,
              0.13
            ],
            [
              8,
              0.5
            ]
          ]
        },
        "text-size": {
          "stops": [
            [
              2,
              7.6
            ],
            [
              4,
              9.54
            ],
            [
              10,
              15.36
            ]
          ]
        },
        "text-transform": "uppercase",
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Admin0 point/large",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Admin0 point",
      "filter": [
        "==",
        "_label_class",
        2
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-padding": 1,
        "symbol-avoid-edges": true,
        "text-letter-spacing": {
          "stops": [
            [
              2,
              0.13
            ],
            [
              8,
              0.5
            ]
          ]
        },
        "text-size": {
          "stops": [
            [
              2,
              8.56
            ],
            [
              4,
              9.54
            ],
            [
              6,
              15.36
            ]
          ]
        },
        "text-transform": "uppercase",
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Admin0 point/x large",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Admin0 point",
      "filter": [
        "==",
        "_label_class",
        1
      ],
      "minzoom": 2,
      "maxzoom": 8,
      "layout": {
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-padding": 1,
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-line-height": 1.5,
        "text-letter-spacing": {
          "stops": [
            [
              2,
              0.15
            ],
            [
              6,
              0.5
            ]
          ]
        },
        "text-size": {
          "stops": [
            [
              2,
              8.56
            ],
            [
              4,
              9.54
            ],
            [
              6,
              15.36
            ]
          ]
        },
        "text-transform": "uppercase",
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City small scale/town small admin0 capital",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City small scale",
      "filter": [
        "==",
        "_symbol",
        16
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-letter-spacing": 0.05,
        "text-padding": 1,
        "text-size": {
          "stops": [
            [
              3,
              9.54
            ],
            [
              6,
              10.02
            ],
            [
              8,
              12.44
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City small scale/town large admin0 capital",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City small scale",
      "filter": [
        "==",
        "_symbol",
        13
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-letter-spacing": 0.05,
        "text-padding": 1,
        "text-size": {
          "stops": [
            [
              3,
              9.54
            ],
            [
              6,
              10.02
            ],
            [
              8,
              12.44
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City small scale/small admin0 capital",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City small scale",
      "filter": [
        "==",
        "_symbol",
        10
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-letter-spacing": 0.05,
        "text-padding": 1,
        "text-size": {
          "stops": [
            [
              3,
              9.54
            ],
            [
              6,
              10.02
            ],
            [
              8,
              12.44
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City small scale/medium admin0 capital",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City small scale",
      "filter": [
        "==",
        "_symbol",
        7
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-letter-spacing": 0.05,
        "text-padding": 1,
        "text-size": {
          "stops": [
            [
              3,
              9.54
            ],
            [
              6,
              10.02
            ],
            [
              8,
              12.44
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City small scale/large other capital",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City small scale",
      "filter": [
        "==",
        "_symbol",
        5
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-letter-spacing": 0.05,
        "text-padding": 1,
        "text-size": {
          "stops": [
            [
              3,
              9.54
            ],
            [
              6,
              10.49
            ],
            [
              8,
              13.41
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City small scale/x large admin2 capital",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City small scale",
      "filter": [
        "==",
        "_symbol",
        2
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-letter-spacing": 0.05,
        "text-padding": 1,
        "text-size": {
          "stops": [
            [
              3,
              10.49
            ],
            [
              6,
              11.47
            ],
            [
              8,
              14.37
            ]
          ]
        },
        "visibility": "none"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City small scale/large non capital",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City small scale",
      "filter": [
        "==",
        "_symbol",
        6
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-letter-spacing": 0.05,
        "text-padding": 1,
        "text-size": {
          "stops": [
            [
              3,
              9.54
            ],
            [
              6,
              10.49
            ],
            [
              8,
              13.41
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City small scale/large admin0 capital",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City small scale",
      "filter": [
        "==",
        "_symbol",
        4
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-letter-spacing": 0.05,
        "text-padding": 1,
        "text-size": {
          "stops": [
            [
              3,
              9.54
            ],
            [
              6,
              10.49
            ],
            [
              8,
              13.41
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City small scale/x large non capital",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City small scale",
      "filter": [
        "==",
        "_symbol",
        3
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-letter-spacing": 0.05,
        "text-padding": 1,
        "text-size": {
          "stops": [
            [
              3,
              10.49
            ],
            [
              6,
              11.47
            ],
            [
              8,
              14.37
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City small scale/x large admin1 capital",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City small scale",
      "filter": [
        "==",
        "_symbol",
        1
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-letter-spacing": 0.05,
        "text-padding": 1,
        "text-size": {
          "stops": [
            [
              3,
              10.49
            ],
            [
              6,
              11.47
            ],
            [
              8,
              14.37
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "City small scale/x large admin0 capital",
      "type": "symbol",
      "source": "esri",
      "source-layer": "City small scale",
      "filter": [
        "==",
        "_symbol",
        0
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-letter-spacing": 0.05,
        "text-padding": 1,
        "text-size": {
          "stops": [
            [
              3,
              10.49
            ],
            [
              6,
              11.47
            ],
            [
              8,
              14.37
            ]
          ]
        },
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Admin0 point/2x large",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Admin0 point",
      "filter": [
        "==",
        "_label_class",
        0
      ],
      "minzoom": 2,
      "maxzoom": 6,
      "layout": {
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-padding": 1,
        "symbol-avoid-edges": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-line-height": 1.7,
        "text-letter-spacing": {
          "stops": [
            [
              2,
              0.3
            ],
            [
              5,
              0.5
            ]
          ]
        },
        "text-size": {
          "stops": [
            [
              2,
              11.47
            ],
            [
              4,
              14.87
            ],
            [
              5,
              17.31
            ]
          ]
        },
        "text-transform": "uppercase",
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Disputed label point/Island",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Disputed label point",
      "filter": [
        "all",
        [
          "==",
          "_label_class",
          1
        ],
        [
          "in",
          "DisputeID",
          0
        ]
      ],
      "minzoom": 6,
      "layout": {
        "icon-image": "Disputed label point",
        "icon-allow-overlap": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "stops": [
            [
              6,
              6.64
            ],
            [
              15,
              9.54
            ]
          ]
        },
        "text-letter-spacing": 0.13,
        "text-max-width": 4,
        "text-field": "{_name}",
        "text-optional": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Disputed label point/Waterbody",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Disputed label point",
      "filter": [
        "all",
        [
          "==",
          "_label_class",
          0
        ],
        [
          "in",
          "DisputeID",
          1006
        ]
      ],
      "minzoom": 2,
      "maxzoom": 10,
      "layout": {
        "icon-image": "Disputed label point",
        "icon-allow-overlap": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "stops": [
            [
              2,
              7.6
            ],
            [
              6,
              8.85
            ]
          ]
        },
        "text-letter-spacing": 0.1,
        "text-max-width": 4,
        "text-field": "{_name}",
        "text-optional": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-blur": 1,
        "text-halo-color": "#000000",
        "text-halo-width": 0.5,
        "text-color": "#ffffff"
      }
    },
    {
      "id": "Disputed label point/Admin0",
      "type": "symbol",
      "source": "esri",
      "source-layer": "Disputed label point",
      "filter": [
        "all",
        [
          "==",
          "_label_class",
          2
        ],
        [
          "in",
          "DisputeID",
          1021
        ]
      ],
      "minzoom": 2,
      "layout": {
        "icon-image": "Disputed label point",
        "icon-allow-overlap": true,
        "text-font": [
          "Arial Bold",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "stops": [
            [
              2,
              7.6
            ],
            [
              4,
              9.54
            ],
            [
              10,
              15.36
            ]
          ]
        },
        "text-transform": "uppercase",
        "text-letter-spacing": {
          "stops": [
            [
              2,
              0.13
            ],
            [
              8,
              0.5
            ]
          ]
        },
        "text-max-width": 6,
        "text-field": "{_name}",
        "text-optional": true,
        "visibility": "visible"
      },
      "paint": {
        "text-halo-color": "#000000",
        "text-halo-width": 1,
        "text-halo-blur": 1,
        "text-color": "#ffffff"
      }
    }
  ]
}
    // ---------------- app (was 01M52SKFD2N2EER1GPYWGZQTA0.js) ----------------
const ZIP_LAYER_BASE =
      "https://meckags.mecklenburgcountync.gov/server/rest/services/CriminalJusticeServices/CJSCaseCountsByZIP/MapServer";

__require([
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
    const BUCKET_COLORS = ["#53b7d9", "#00768a", "#001e62"]; // brand ramp: teal-light, teal, logo blue
    const EARTH_TO_SKY = [
      "#5aa3d2",
      "#00768a",
      "#001e62",
      "#211746",
      "#d93838",
      "#c1962e",
    ];
    const DEMO_COLORS = {
      white_nh_pct: "#001e62",
      black_nh_pct: "#d93838",
      hispanic_pct: "#00768a",
      asian_nh_pct: "#c1962e",
      two_or_more_races_nh_pct: "#5aa3d2",
      other_race_nh_pct: "#211746",
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
  if (dashboardYear) {
    dashboardYear.textContent = `${start_year}-${end_year}`;
  }
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

    const view = __ctx.view = new MapView({
      container: document.getElementById("map"),
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

    /* ---- WCAG semantics added by county (headings, combobox, live region, decorative icons) ---- */
    (function mcjsA11y() {
      try {
        if (searchInput && searchSuggestions) {
          searchSuggestions.setAttribute("role", "listbox");
          searchSuggestions.setAttribute("aria-label", "ZIP suggestions");
          searchInput.setAttribute("role", "combobox");
          searchInput.setAttribute("aria-autocomplete", "list");
          searchInput.setAttribute("aria-controls", searchSuggestions.id || "mcjs-searchSuggestions");
          searchInput.setAttribute("aria-expanded", "false");
        }
        const root = (brandIcon && brandIcon.closest && brandIcon.closest("#mecknc-cjs-map")) || window.document.getElementById("mecknc-cjs-map");
        if (root) {
          const bt = root.querySelector(".brand-title");
          if (bt) { bt.setAttribute("role", "heading"); bt.setAttribute("aria-level", "2"); }
          root.querySelectorAll(".section-title").forEach((el) => { el.setAttribute("role", "heading"); el.setAttribute("aria-level", "3"); });
          const lt = root.querySelector(".legend-title");
          if (lt) { lt.setAttribute("role", "heading"); lt.setAttribute("aria-level", "3"); }
          if (!root.querySelector("#mcjs-announcer")) {
            const a = window.document.createElement("div");
            a.id = "mcjs-announcer"; a.className = "usa-sr-only";
            a.setAttribute("role", "status"); a.setAttribute("aria-live", "polite"); a.setAttribute("aria-atomic", "true");
            root.appendChild(a);
          }
        }
      } catch (e) {}
    })();
    function mcjsAnnounce(msg) {
      try {
        const a = window.document.getElementById("mcjs-announcer");
        if (!a) return;
        a.textContent = "";
        setTimeout(() => { a.textContent = msg; }, 50);
      } catch (e) {}
    }

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
      if (!z) return "#53b7d9";
      if (EXCLUDED_ZIPS.has(z)) return "#a1a1a4";
      const v = getVal(z);
      if (v === null || !currentBreaks || currentBreaks.length < 2)
        return "#c9c9c9";
      for (let i = 0; i < currentBreaks.length - 1; i++) {
        if (v <= currentBreaks[i + 1]) return BUCKET_COLORS[i];
      }
      return BUCKET_COLORS[BUCKET_COLORS.length - 1] || "#53b7d9";
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
          color: fillColor("#c9c9c9", 0.8),
          outline: { color: [161, 161, 164, 1], width: 1.4 },
        },
        classBreakInfos: infos,
      };
    }

    function fixedSymbol() {
      return new SimpleFillSymbol({
        color: fillColor("#a1a1a4", 0.95),
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
      const width = __root.clientWidth || window.innerWidth;
      const height = __root.clientHeight || window.innerHeight;
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

    function syncZipListActive() {
      const list = document.getElementById("zipList");
      if (!list || !list.querySelectorAll) return;
      let first = null;
      list.querySelectorAll(".zip-list-item").forEach((el) => {
        const z = el.getAttribute("data-zip");
        const on = !!z && (z === pinnedZip || z === pinnedZipB);
        el.classList.toggle("is-active", on);
        el.classList.toggle("is-active-b", on && z === pinnedZipB && z !== pinnedZip);
        el.setAttribute("aria-selected", on ? "true" : "false");
        if (on && z === pinnedZip) first = el;
      });
      // roving tabindex: one tab stop for the whole list
      const items = list.querySelectorAll(".zip-list-item");
      let stop = first || list.querySelector(".zip-list-item.mcjs-roving") || items[0];
      items.forEach((el) => el.setAttribute("tabindex", el === stop ? "0" : "-1"));
      list.setAttribute("tabindex", "-1");
      const key = (pinnedZip || "") + "|" + (pinnedZipB || "");
      if (syncZipListActive.__last !== undefined && syncZipListActive.__last !== key) {
        mcjsAnnounce(pinnedZip ? (pinnedZipB ? `Comparing ZIP ${pinnedZip} and ZIP ${pinnedZipB}.` : `ZIP ${pinnedZip} selected. Details shown below the map.`) : "Selection cleared.");
      }
      syncZipListActive.__last = key;
      if (first) {
        // scroll inside the list only, never the page
        const lr = list.getBoundingClientRect(), er = first.getBoundingClientRect();
        const top = er.top - lr.top + list.scrollTop, h = er.height;
        if (top < list.scrollTop) list.scrollTop = top - 4;
        else if (top + h > list.scrollTop + list.clientHeight) list.scrollTop = top + h - list.clientHeight + 4;
      }
    }
    try { window.__mcjsSyncZipList = syncZipListActive; } catch (e) {}

    function highlightPins() {
      try { syncZipListActive(); } catch (e) {}
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
                color: [33, 23, 70, 0.22],
                outline: { color: [255, 255, 255, 1], width: 4.5 },
              }),
            }),
          );
          selectionGL.add(
            new Graphic({
              geometry: g,
              symbol: new SimpleFillSymbol({
                color: [0, 0, 0, 0],
                outline: { color: [33, 23, 70, 1], width: 2.5 },
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
                color: [217, 56, 56, 0.2],
                outline: { color: [255, 255, 255, 1], width: 4.5 },
              }),
            }),
          );
          selectionGL.add(
            new Graphic({
              geometry: gB,
              symbol: new SimpleFillSymbol({
                color: [0, 0, 0, 0],
                outline: { color: [217, 56, 56, 1], width: 2.5 },
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
          color: "#a1a1a4",
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

      html += `<div class="legend-row margin-top-05" style="border-top: 1px solid rgba(0,0,0,0.08); padding-top: 5px;">
        <span class="swatch" style="background:#a1a1a4; border: 1px solid #5d594d;"></span>
        <span style="color:#5d594d; font-size:11.5px;">Excluded Area</span>
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
          deltaEl.innerHTML = `<span style="color:#5d594d; font-size:11px;">—</span>`;
        } else {
          const diff = value - countyAvg;
          if (Math.abs(diff) < 0.05) {
            deltaEl.className = "delta";
            deltaEl.innerHTML = `<span style="color:#5d594d; font-size:11px;">${fmt(0, metric.format)}</span>`;
          } else {
            const isUp = diff > 0;
            const isGood =
              metric.direction === "up"
                ? diff >= 0
                : metric.direction === "down"
                  ? diff <= 0
                  : true;
            deltaEl.className = "delta" + (isGood ? "" : " negative");
            deltaEl.innerHTML = `<svg class="mcjs-caret" aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="10" height="10" fill="currentColor"><path d="${isUp ? "M8 3l6 9H2z" : "M8 13L2 4h12z"}"/></svg>`;
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
            cardsHeading.innerHTML = `ZIP ${targetZip} <span class="badge" style="background:#5d594d;color:#ffffff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;vertical-align:1px;">EXCLUDED</span>`;
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
            ? `ZIP ${targetZip} <span class="badge bg-base-dark margin-left-05" style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;vertical-align:1px;">PINNED</span>`
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
        let barHtml = `<div class="demo-bar margin-top-1">`;
        let legendHtml = `<div class="demo-legend">`;
        for (const m of DEMO_PCT_METRICS) {
          const val = cached
            ? cached[m.id]?.value || 0
            : getVal(targetZip, m) || 0;
          totalPct += val;
          const color = DEMO_COLORS[m.id] || "#a1a1a4";
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
          barHtml += `<div class="demo-segment" style="width:${other}%; background:#c9c9c9;" title="Other: ${fmt(other, "percent")}"></div>`;
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
          demographicsBody.innerHTML = `<div class="acs-empty text-base font-body-2xs">Demographic data is unavailable for this excluded ZIP code area.</div>`;
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
        demographicsBody.innerHTML = `<div class="acs-empty text-base font-body-2xs">Hover over or click a ZIP code on the map to see its demographic breakdown.</div>`;
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
            <button id="mcjs-exitCompareBtn" class="cmp-exit-btn" type="button" title="Close comparison" aria-label="Close comparison">
              <span class="cmp-exit-x" aria-hidden="true">✕</span> Exit
            </button>
          </div>

          <div class="cmp-slots-grid">
            <div class="cmp-slot-card slot-1 ${isZipAValid ? "selected" : "active-slot"}" id="mcjs-cmpSlot1">
              ${
                isZipAValid
                  ? `
                <div class="cmp-slot-header">
                  ${pinSvg("blue")}
                  <span class="cmp-slot-badge blue">ZIP #1</span>
                  <button type="button" class="cmp-slot-clear" id="mcjs-clearSlot1" title="Clear ZIP #1" aria-label="Clear ZIP #1 (${zipA})"><span aria-hidden="true">✕</span></button>
                </div>
                <div class="cmp-slot-val blue">ZIP ${zipA}</div>
              `
                  : `
                ${pinSvg("blue")}
                <span class="cmp-slot-prompt">Click a ZIP on the map or in the ZIP list to pick ZIP #1</span>
              `
              }
            </div>

            <div class="cmp-slot-card slot-2 ${isZipBValid ? "selected" : isZipAValid ? "active-slot" : ""}" id="mcjs-cmpSlot2">
              ${
                isZipBValid
                  ? `
                <div class="cmp-slot-header">
                  ${pinSvg("orange")}
                  <span class="cmp-slot-badge orange">ZIP #2</span>
                  <button type="button" class="cmp-slot-clear" id="mcjs-clearSlot2" title="Clear ZIP #2" aria-label="Clear ZIP #2 (${zipB})"><span aria-hidden="true">✕</span></button>
                </div>
                <div class="cmp-slot-val orange">ZIP ${zipB}</div>
              `
                  : `
                ${pinSvg("orange")}
                <span class="cmp-slot-prompt">Click a ZIP on the map or in the ZIP list to pick ZIP #2</span>
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
      let windowWidth = __root.clientWidth || window.innerWidth;
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
        // don't rebuild identical markup: replacing the panel between mousedown and mouseup
        // (e.g. a focusout refresh when focus moves from the ZIP list to ✕ Exit) swallowed the click
        if (zipAcsBody.__mcjsHtml !== html) { zipAcsBody.innerHTML = html; zipAcsBody.__mcjsHtml = html; }
        if (!zipAcsBody.__mcjsDelegated) {
          zipAcsBody.__mcjsDelegated = true;
          zipAcsBody.addEventListener("click", (e) => {
            const t = e.target && e.target.closest ? e.target.closest("#mcjs-exitCompareBtn, #mcjs-clearSlot1, #mcjs-clearSlot2") : null;
            if (!t) return;
            e.preventDefault(); e.stopPropagation();
            if (t.id === "mcjs-exitCompareBtn") exitCompare();
            else if (t.id === "mcjs-clearSlot1") setPins(pinnedZipB || null, null);
            else setPins(pinnedZip, null);
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
        if (_cardsHeading) _cardsHeading.classList.add("display-none");
        if (_metricCardsContainer)
          _metricCardsContainer.classList.add("display-none");
        if (_demographicsCard) _demographicsCard.classList.add("display-none");
        if (_compareCard) _compareCard.classList.remove("display-none");

        const key = `cmp:${pinnedZip || "none"}:${pinnedZipB || "none"}`;
        if (currentAcsKey !== key) {
          currentAcsKey = key;
          renderZipAcsCompare(pinnedZip, pinnedZipB);
        }
      } else {
        if (_compareCard) _compareCard.classList.add("display-none");
        if (_cardsHeading) _cardsHeading.classList.remove("display-none");
        if (_metricCardsContainer)
          _metricCardsContainer.classList.remove("display-none");
        if (_demographicsCard) _demographicsCard.classList.remove("display-none");

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
      if (infoGridContainer) infoGridContainer.classList.remove("display-none");
      if (excludedLabel) excludedLabel.classList.add("display-none");

      if (infoPanel) { infoPanel.classList.add("display-none"); infoPanel.__anchored = false; }
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
      if (infoPanel) {
        if (infoPanel.__suppress && infoPanel.__suppress === z) return; // closed with X: wait for a new hover/click
        infoPanel.__suppress = null;
        infoPanel.__zip = z;
      }
      const city = getCityForZip(z);

      if (infoTitle)
        infoTitle.textContent = `${z || "—"}${city ? ` (${city})` : ""}`;

      const infoHeader = document.querySelector(".info-header");
      if (infoHeader) {
        const bg = getZipColor(z);
        infoHeader.style.background = bg;
        // keep header text >= 4.5:1 on light ZIP colors
        let light = false;
        const m = /^#?([0-9a-f]{6})$/i.exec(String(bg || "").trim());
        if (m) {
          const c = [0, 2, 4].map((i) => parseInt(m[1].substr(i, 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
          light = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.18;
        }
        infoHeader.classList.toggle("mcjs-header-light", light);
      }

      const infoGridContainer = document.getElementById("infoGridContainer");
      const excludedLabel = document.getElementById("excludedLabel");

      if (EXCLUDED_ZIPS.has(z)) {
        if (infoGridContainer) infoGridContainer.classList.add("display-none");
        if (excludedLabel) {
          excludedLabel.classList.remove("display-none");
          if (z === "28223") {
            excludedLabel.innerHTML = `<span class="badge" style="color: #0f0e0eb3; font-size: 11px; font-weight: 550; padding: 4px 8px; border-radius: 6px; white-space: normal; display: inline-block; text-align: left;">This ZIP code represents UNC Charlotte’s campus. Data is not available for all community well-being indicators and is not displayed here.</span>`;
          } else {
            excludedLabel.innerHTML = `<span class="badge" style="color: #0f0e0eb3; font-size: 11px; font-weight: 550; padding: 4px 8px; border-radius: 6px; white-space: normal; display: inline-block; text-align: left;">This ZIP code is partially in an adjacent county. Data is excluded.</span>`;
          }
        }
      } else {
        if (infoGridContainer) infoGridContainer.classList.remove("display-none");
        if (excludedLabel) excludedLabel.classList.add("display-none");

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

      if (infoPanel) infoPanel.classList.remove("display-none");
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
        compareBtn.innerHTML = `<svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg> Exit compare`;
        compareBtn.setAttribute("title", "Exit Compare mode");
        compareBtn.setAttribute("aria-label", "Exit compare");
      } else {
        compareBtn.classList.remove("active");
        compareBtn.innerHTML = `<svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="5" height="10" rx="1" /><rect x="9" y="3" width="5" height="10" rx="1" /></svg> Compare`;
        compareBtn.setAttribute("title", "Toggle 2-ZIP Compare mode");
        compareBtn.setAttribute("aria-label", "Compare two ZIP areas");
      }
    }

    function exitCompare() { if (isCompareMode) toggleCompareMode(); try { const c = document.getElementById("compareBtn"); if (c && c.focus) c.focus({ preventScroll: true }); } catch (e) {} }
    function toggleCompareMode() {
      isCompareMode = !isCompareMode;
      currentAcsKey = "";
      updateCompareBtnUI();
      // keep the current ZIP as ZIP #1 when entering; keep ZIP #1 (drop #2) when leaving
      setPins(pinnedZip || null, null);
      try { mcjsAnnounce(isCompareMode ? (pinnedZip ? `Compare mode on. ZIP ${pinnedZip} is ZIP 1; pick a second ZIP.` : "Compare mode on. Pick two ZIP areas.") : "Compare mode off."); } catch (e) {}
      try { const ip = document.getElementById("infoPanel"); if (ip) { ip.classList.add("display-none"); ip.__anchored = false; } } catch (e) {}
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
          else setPins(pinnedZip, z); // replace ZIP #2, keep ZIP #1
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
            color: [0, 118, 138, 1],
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
      if (searchInput) searchInput.setAttribute("aria-expanded", "false");
      if (searchSuggestions) {
        searchSuggestions.classList.add("display-none");
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

      searchSuggestions.classList.remove("display-none");
      if (searchInput) searchInput.setAttribute("aria-expanded", "true");
      searchSuggestions.querySelectorAll(".suggestion-item").forEach((it, i) => { it.setAttribute("role", "option"); if (!it.id) it.id = "mcjs-sugg-" + i; });

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

      statusEl.textContent = "";
      const qb = document.createElement("b"); qb.textContent = q;
      statusEl.append("Location ", qb, " not found in Mecklenburg County.");
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
      brandIcon.innerHTML = `<svg aria-hidden="true" focusable="false" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="${path}" fill="#211746" fill-rule="evenodd" opacity="0.92"/></svg>`;
      const fav = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#fff"/><path d="${path}" fill="#211746" fill-rule="evenodd"/></svg>`;
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
      if (infoPanel && infoPanel.__anchored && pinnedZip) {
        // pinned ZIP details stay put (so the X can be reached); hover only updates state
        if (z !== hoverZip) { hoverZip = z; refreshAcs(); }
        return;
      }
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
		  
		  
		  
		  
function buildZipList() {
  const container = document.getElementById("zipList");
  if (!container) return;

  container.innerHTML = "";
  interactiveZips.forEach((zip, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "zip-list-item";
    btn.setAttribute("role", "option");
    btn.setAttribute("data-zip", zip);
    btn.setAttribute("aria-label", `ZIP ${zip}`);
    btn.textContent = `ZIP ${zip}`;

    btn.addEventListener("click", () => {
      focusZipByIndex(idx);
      togglePin(zip);
      // same rule as map clicks: if this ZIP was unpinned, close its details box
      try {
        const ip = document.getElementById("infoPanel");
        if (ip && zip !== pinnedZip && zip !== pinnedZipB && ip.__zip !== pinnedZip && ip.__zip !== pinnedZipB) { ip.classList.add("display-none"); ip.__anchored = false; }
        if (ip) ip.__closedByUser = false;
      } catch (e) {}
    });

    btn.addEventListener("focus", () => {
      focusZipByIndex(idx);
      container.querySelectorAll(".zip-list-item").forEach((el) => { el.setAttribute("tabindex", el === btn ? "0" : "-1"); el.classList.toggle("mcjs-roving", el === btn); });
    });

    btn.addEventListener("keydown", (e) => {
      const all = Array.from(container.querySelectorAll(".zip-list-item"));
      const i = all.indexOf(btn);
      let n = -1;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") n = Math.min(all.length - 1, i + 1);
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") n = Math.max(0, i - 1);
      else if (e.key === "Home") n = 0;
      else if (e.key === "End") n = all.length - 1;
      if (n >= 0) { e.preventDefault(); all[n].focus({ preventScroll: true }); all[n].scrollIntoView({ block: "nearest", inline: "nearest" }); }
    });

    container.appendChild(btn);
  });
  if (!container.__mcjsBlur) {
    container.__mcjsBlur = true;
    container.addEventListener("focusout", (e) => {
      if (e.relatedTarget && container.contains(e.relatedTarget)) return;
      hoverZip = null;
      try { highlightFocusedZip(null); } catch (err) {}
      clearPanel();
      currentAcsKey = "";
      refreshAcs();
    });
  }
  try { syncZipListActive(); } catch (e) {}
}		  
		  
		  

function highlightFocusedZip(zip) {
  // Remove previous keyboard-only highlights
  const toRemove = [];
  selectionGL.graphics.forEach((g) => {
    if (g.attributes && g.attributes.keyboardHighlight) toRemove.push(g);
  });
  toRemove.forEach((g) => selectionGL.remove(g));

  if (!zip) return;
  const geom = geomByZip.get(zip);
  if (!geom) return;

  // two-ring focus (white halo + brand purple) so it meets 3:1 on every ramp color
  [[[255, 255, 255, 1], 6], [[33, 23, 70, 1], 3]].forEach(([c, w]) => {
    selectionGL.add(
      new Graphic({
        geometry: geom,
        attributes: { keyboardHighlight: true },
        symbol: new SimpleFillSymbol({ color: [0, 0, 0, 0], outline: { color: c, width: w } }),
      })
    );
  });
}

function focusZipByIndex(idx) {
  if (!interactiveZips.length) return;
  focusedZipIndex =
    ((idx % interactiveZips.length) + interactiveZips.length) %
    interactiveZips.length;
  const z = interactiveZips[focusedZipIndex];
  hoverZip = z;
  { const ip = document.getElementById("infoPanel"); if (ip) ip.__suppress = null; }

  const feat = featureByZip.get(z);
  if (feat) {
    showPanel(feat);
  } else {
    clearPanel();
  }
  highlightFocusedZip(z);
  refreshAcs();
}




		  
function setupKeyboardNavigation() {
  // Disabled to prevent keyboard trap. Use the sidebar ZIP list instead.
  console.log("Keyboard navigation on map disabled to avoid focus trap");
}

		  
		  
		  
		  
		  
		  
		  
		  
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
  if (infoCard.__ensureX) infoCard.__ensureX();
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

		  

		  

		  
		  
    view.on("pointer-move", (evt) => {
      pendingEvt = { x: evt.x, y: evt.y };
      if (!rafQueued) {
        rafQueued = true;
        requestAnimationFrame(processHover);
      }
    });

    view.on("pointer-leave", () => {
      try { pendingEvt = null; } catch (e) {}
      rafQueued = false;
      hoverZip = null;
      if (!(infoPanel && infoPanel.__anchored && pinnedZip)) clearPanel();
      refreshAcs();
    });

    view.on("immediate-click", (evt) => {
      evt.stopPropagation();
      const z = zipAtEvent(evt);
      if (infoPanel) infoPanel.__suppress = null;
      if (z && infoPanel && infoPanel.__closedByUser && (z === pinnedZip || z === pinnedZipB)) {
        infoPanel.__closedByUser = false;
        // box was closed with X: a click/tap on the selected ZIP reopens it instead of unpinning
        showPanel(featureByZip.get(z));
        positionPanelAtCursor(evt.x, evt.y);
        infoPanel.__anchored = true;
        return;
      }
      if (z) {
        togglePin(z);
        if (infoPanel) { infoPanel.__anchored = false; infoPanel.__closedByUser = false; }
        const stillPinned = z === pinnedZip || z === pinnedZipB;
        if (stillPinned && featureByZip.get(z)) {
          // show the ZIP that was clicked (not whichever slot changed) and keep it in place
          showPanel(featureByZip.get(z));
          positionPanelAtCursor(evt.x, evt.y);
          if (infoPanel) infoPanel.__anchored = true;
        } else if (infoPanel) {
          // clicked ZIP was unpinned: close its details box
          infoPanel.classList.add("display-none");
        }
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
		  buildZipList();          // ASIDE NAV
		  setupKeyboardNavigation();
        setBrandSilhouette();
        updateLegend();
        clearPanel();
        refreshAcs();
        addFooter();
		  
		  
// Force map and all its internal elements out of the tab order
setTimeout(() => {
  const mapEl = document.getElementById("map");
  if (mapEl) {
    mapEl.removeAttribute("tabindex");
    mapEl.removeAttribute("role");
    mapEl.setAttribute("tabindex", "-1");
    mapEl.querySelectorAll("[tabindex]").forEach(el => {
      el.setAttribute("tabindex", "-1");
    });
  }
}, 800);
setTimeout(() => {
  const mapEl = document.getElementById("map");
  if (mapEl) {
    mapEl.setAttribute("tabindex", "-1");
    mapEl.querySelectorAll("*").forEach(el => {
      if (el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    });
  }
}, 2500);		  
		  
		  

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
      // drop transient hover/keyboard-focus state so panels return to the first-load view
      hoverZip = null;
      try { pendingEvt = null; } catch (e) {}
      try { focusedZipIndex = -1; } catch (e) {}
      try { highlightFocusedZip(null); } catch (e) {}
      try { infoCard.style.display = "none"; } catch (e) {}
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
      if (infoPanel) infoPanel.classList.add("display-none");
      currentAcsKey = "";
      refreshAcs();
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
    infoCard.className = "info-tooltip-card shadow-1";
    document.body.appendChild(infoCard);

    /* ---- Visible close (X) buttons for the ZIP details panel and the info pop-ups ---- */
    const MCJS_X = '<svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>';
    function mcjsCloseBtn(label, onClose) {
      const b = window.document.createElement("button");
      b.type = "button"; b.className = "mcjs-close";
      b.setAttribute("aria-label", label); b.setAttribute("title", label);
      b.innerHTML = MCJS_X + '<span class="usa-sr-only">' + label + "</span>"; // name survives even if aria-label is stripped
      b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); onClose(); });
      return b;
    }
    // Leaving the whole map area (not just onto our own panel) re-arms a closed panel.
    { const mw = document.querySelector(".map-wrap"); if (mw && infoPanel) mw.addEventListener("mouseleave", () => { infoPanel.__suppress = null; }); }
    // Map ZIP details panel: X hides the box but keeps any pinned selection.
    if (infoPanel) {
      const hdr = infoPanel.querySelector(".info-header");
      if (hdr && !hdr.querySelector(".mcjs-close")) {
        hdr.appendChild(mcjsCloseBtn("Close ZIP details", () => {
          infoPanel.__suppress = infoPanel.__zip || hoverZip || null;
          infoPanel.__anchored = false;
          infoPanel.__closedByUser = true;
          infoPanel.classList.add("display-none");
          // keyboard users: park focus on the map region (focusing a list item would reopen the box)
          const mapEl = document.getElementById("map");
          if (mapEl && mapEl.focus) { if (!mapEl.hasAttribute("tabindex")) mapEl.setAttribute("tabindex", "-1"); mapEl.focus({ preventScroll: true }); }
        }));
      }
    }
    // Info "i" pop-ups: add an X whenever the card is (re)filled.
    function mcjsCloseTip() {
      const icon = infoCard.__icon || null;
      infoCard.__suppressIcon = icon;
      infoCard.style.display = "none";
      if (icon && icon.focus) icon.focus({ preventScroll: true });
    }
    function mcjsEnsureTipX() {
      if (!infoCard.querySelector(":scope > .mcjs-close")) infoCard.insertBefore(mcjsCloseBtn("Close information", mcjsCloseTip), infoCard.firstChild);
    }
    infoCard.__ensureX = mcjsEnsureTipX;
    infoCard.setAttribute("role", "group");
    infoCard.setAttribute("aria-label", "Information");
    new MutationObserver(mcjsEnsureTipX).observe(infoCard, { childList: true });
    // Capture phase runs before the tooltip handlers: remember the icon, and keep a closed
    // pop-up from reopening until the pointer/focus leaves that icon.
    const mcjsTipGate = (e) => {
      const icon = e.target && e.target.closest ? e.target.closest(".info-icon") : null;
      if (!icon) return;
      if (infoCard.__suppressIcon === icon) { e.stopImmediatePropagation(); return; }
      infoCard.__icon = icon;
    };
    window.document.addEventListener("mouseover", mcjsTipGate, true);
    window.document.addEventListener("focusin", mcjsTipGate, true);
    window.document.addEventListener("mouseout", (e) => {
      const icon = e.target && e.target.closest ? e.target.closest(".info-icon") : null;
      if (icon && infoCard.__suppressIcon === icon && !(e.relatedTarget && icon.contains(e.relatedTarget))) infoCard.__suppressIcon = null;
    }, true);
    window.document.addEventListener("focusout", (e) => {
      const icon = e.target && e.target.closest ? e.target.closest(".info-icon") : null;
      if (!icon) return;
      if (infoCard.__suppressIcon === icon) { infoCard.__suppressIcon = null; e.stopImmediatePropagation(); return; }
      // keyboard: let focus move from the icon into the pop-up's X without hiding it
      if (e.relatedTarget && infoCard.contains(e.relatedTarget)) e.stopImmediatePropagation();
    }, true);
    infoCard.addEventListener("focusout", (e) => {
      if (!(e.relatedTarget && (infoCard.contains(e.relatedTarget) || e.relatedTarget === infoCard.__icon))) infoCard.style.display = "none";
    });
    infoCard.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.stopPropagation(); mcjsCloseTip(); return; }
      if (e.key === "Tab" && infoCard.__icon) {
        // the pop-up sits at the end of the DOM; keep keyboard order icon -> X -> next control
        e.preventDefault();
        const icon = infoCard.__icon;
        if (e.shiftKey) { infoCard.__suppressIcon = null; icon.focus({ preventScroll: true }); return; }
        const all = Array.from(root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
          .filter((el) => !infoCard.contains(el) && el.offsetParent !== null && !el.disabled);
        const i = all.indexOf(icon);
        infoCard.style.display = "none";
        const next = all[i + 1];
        if (next) next.focus(); else icon.focus();
      }
    });
    window.document.addEventListener("keydown", (e) => {
      if (e.key !== "Tab" || e.shiftKey) return;
      const icon = e.target && e.target.closest ? e.target.closest(".info-icon") : null;
      const x = infoCard.querySelector(".mcjs-close");
      if (icon && icon === infoCard.__icon && x && infoCard.style.display !== "none") { e.preventDefault(); x.focus({ preventScroll: true }); }
    }, true);

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
          if (infoCard.__ensureX) infoCard.__ensureX();
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

let __mcjsTipTimer = null;
let __mcjsTouch = false;
window.document.addEventListener("pointerdown", (e) => {
  __mcjsTouch = e.pointerType === "touch" || e.pointerType === "pen";
  if (__mcjsTouch && infoCard.style.display !== "none" && !infoCard.contains(e.target) && !(e.target.closest && e.target.closest(".info-icon"))) infoCard.style.display = "none";
}, true);
function __mcjsHideTipSoon() { if (__mcjsTouch) return; /* touch: no hover, close with X or Escape */ clearTimeout(__mcjsTipTimer); __mcjsTipTimer = setTimeout(() => { infoCard.style.display = "none"; }, 300); }
infoCard.addEventListener("mouseenter", () => clearTimeout(__mcjsTipTimer));
infoCard.addEventListener("mouseleave", __mcjsHideTipSoon);
document.addEventListener("mouseover", (e) => { if (e.target.closest && e.target.closest(".info-icon")) clearTimeout(__mcjsTipTimer); });
document.addEventListener("mouseout", (e) => {
  const icon = e.target.closest(".info-icon");
  if (icon && (!e.relatedTarget || (!icon.contains(e.relatedTarget) && !infoCard.contains(e.relatedTarget)))) {
    __mcjsHideTipSoon();
  }
});
// WCAG 1.4.13 / 2.1.2: Escape dismisses tooltip, hover panel and suggestions
window.document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!(root.contains(e.target) || e.target === window.document.body || e.target === window.document.documentElement)) return;
  clearTimeout(__mcjsTipTimer);
  infoCard.style.display = "none";
  const ip = document.getElementById("infoPanel");
  if (ip) { if (!ip.classList.contains("display-none")) { ip.__suppress = ip.__zip || null; ip.__closedByUser = true; } ip.classList.add("display-none"); ip.__anchored = false; }
  try { hideSuggestions(); } catch (err) {}
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

    return __ctx;
  }

  function destroy(ctx) {
    try { if (ctx.view) ctx.view.destroy(); } catch (e) {}
    ctx.view = null;
    NS.instances = NS.instances.filter(function (c) { return c !== ctx; });
  }
  // Layout Builder re-renders blocks with AJAX; drop maps whose wrapper left the page.
  function sweep() { NS.instances.slice().forEach(function (c) { if (!c.root.isConnected) destroy(c); }); }

  function inLayoutEditor() {
    return !!realDocument.querySelector("#layout-builder, .layout-builder, #drupal-off-canvas, .ck-editor__editable") ||
      (window.location.pathname.indexOf("/layout") !== -1);
  }
  function init(root) {
    if (root.getAttribute("data-mcjs-init")) return;
    root.setAttribute("data-mcjs-init", "1");
    if (inLayoutEditor() && root.getAttribute("data-mcjs-preview") !== "1") {
      // Do not run the live map inside Layout Builder / the editor; it only adds weight and risk there.
      var ph = realDocument.createElement("div");
      ph.className = "mcjs-placeholder";
      ph.textContent = "CJS map placeholder: the interactive map shows on the saved page, not in the layout editor.";
      root.textContent = ""; root.appendChild(ph); root.style.height = "auto"; root.style.minHeight = "0";
      return;
    }
    if (realDocument.querySelectorAll(".mecknc-cjs-map[data-mcjs-init]").length > 1) {
      console.warn("[MeckNC CJS map] Only one copy of this map is supported per page; extra copy skipped.");
      return;
    }
    addCssOnce(ARCGIS_CSS);
    loadArcgis().then(function (req) {
      if (!root.isConnected) return;
      try { start(root, req); } catch (e) { console.error("[MeckNC CJS map]", e); }
    }).catch(function (e) {
      var st = root.querySelector("#" + IDP + "status");
      if (st) st.textContent = "The map could not load: " + e.message;
      console.error("[MeckNC CJS map]", e);
    });
  }
  function attachAll(context) {
    sweep();
    var ctx = context && context.querySelectorAll ? context : realDocument;
    var list = [];
    if (ctx.matches && ctx.matches(".mecknc-cjs-map")) list.push(ctx);
    Array.prototype.push.apply(list, ctx.querySelectorAll(".mecknc-cjs-map"));
    if (window.once) list = window.once("mecknc-cjs-map", list);
    list.forEach(init);
  }
  NS.destroyAll = function () { NS.instances.slice().forEach(destroy); };

  if (window.Drupal && window.Drupal.behaviors) {
    window.Drupal.behaviors.mecknCjsMap = {
      attach: function (context) { try { attachAll(context); } catch (e) { console.error("[MeckNC CJS map]", e); } },
      detach: function (context, settings, trigger) {
        if (trigger !== "unload") return;
        NS.instances.slice().forEach(function (c) { if (context === realDocument || (context.contains && context.contains(c.root))) destroy(c); });
      }
    };
  }
  var safeAttach = function () { try { attachAll(realDocument); } catch (e) { console.error("[MeckNC CJS map]", e); } };
  if (realDocument.readyState === "loading") realDocument.addEventListener("DOMContentLoaded", safeAttach);
  else safeAttach();
  if (window.MutationObserver && !NS.observer) {
    var t; NS.observer = new MutationObserver(function () { clearTimeout(t); t = setTimeout(sweep, 500); });
    NS.observer.observe(realDocument.documentElement, { childList: true, subtree: true });
  }
})(window, document);
