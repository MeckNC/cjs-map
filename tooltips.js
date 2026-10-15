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