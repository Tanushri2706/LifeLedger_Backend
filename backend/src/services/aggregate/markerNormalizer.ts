import { IExtractedLabValue, INormalizedObservation } from '../../types';

export interface ICanonicalMarkerDef {
  key: string;
  displayName: string;
  aliases: string[];
  standardUnit: string;
  compatibleUnits: string[];
}

export const CANONICAL_MARKERS: ICanonicalMarkerDef[] = [
  {
    key: 'hba1c',
    displayName: 'HbA1c (Glycated Hemoglobin)',
    aliases: ['hba1c', 'glycated hemoglobin', 'glycosylated hemoglobin', 'hemoglobin a1c', 'a1c'],
    standardUnit: '%',
    compatibleUnits: ['%', 'mmol/mol']
  },
  {
    key: 'fasting_glucose',
    displayName: 'Fasting Blood Sugar (FBS)',
    aliases: [
      'fasting blood sugar',
      'fbs',
      'fasting glucose',
      'fasting blood glucose',
      'fasting plasma glucose',
      'blood sugar fasting',
      'blood glucose fasting'
    ],
    standardUnit: 'mg/dL',
    compatibleUnits: ['mg/dl', 'mg/dL', 'mmol/l', 'mmol/L']
  },
  {
    key: 'postprandial_glucose',
    displayName: 'Postprandial Blood Sugar (PPBS)',
    aliases: [
      'postprandial blood sugar',
      'ppbs',
      'postprandial glucose',
      'pp blood sugar',
      'random blood sugar',
      'rbs',
      'blood glucose random'
    ],
    standardUnit: 'mg/dL',
    compatibleUnits: ['mg/dl', 'mg/dL', 'mmol/l', 'mmol/L']
  },
  {
    key: 'total_cholesterol',
    displayName: 'Total Cholesterol',
    aliases: ['total cholesterol', 'serum cholesterol', 'cholesterol, total', 'cholesterol total', 'cholesterol'],
    standardUnit: 'mg/dL',
    compatibleUnits: ['mg/dl', 'mg/dL', 'mmol/l', 'mmol/L']
  },
  {
    key: 'ldl_cholesterol',
    displayName: 'LDL Cholesterol',
    aliases: [
      'ldl cholesterol',
      'ldl',
      'low density lipoprotein',
      'ldl - cholesterol',
      'direct ldl',
      'ldl-c',
      'ldl cholesterol direct'
    ],
    standardUnit: 'mg/dL',
    compatibleUnits: ['mg/dl', 'mg/dL', 'mmol/l', 'mmol/L']
  },
  {
    key: 'hdl_cholesterol',
    displayName: 'HDL Cholesterol',
    aliases: [
      'hdl cholesterol',
      'hdl',
      'high density lipoprotein',
      'hdl - cholesterol',
      'direct hdl',
      'hdl-c',
      'hdl cholesterol direct'
    ],
    standardUnit: 'mg/dL',
    compatibleUnits: ['mg/dl', 'mg/dL', 'mmol/l', 'mmol/L']
  },
  {
    key: 'triglycerides',
    displayName: 'Triglycerides',
    aliases: ['triglycerides', 'triglyceride', 'tg', 'serum triglycerides'],
    standardUnit: 'mg/dL',
    compatibleUnits: ['mg/dl', 'mg/dL', 'mmol/l', 'mmol/L']
  },
  {
    key: 'serum_creatinine',
    displayName: 'Serum Creatinine',
    aliases: ['serum creatinine', 'creatinine', 's. creatinine', 'blood creatinine', 'creatinine serum'],
    standardUnit: 'mg/dL',
    compatibleUnits: ['mg/dl', 'mg/dL', 'umol/l', 'µmol/l']
  },
  {
    key: 'blood_urea_nitrogen',
    displayName: 'Blood Urea Nitrogen (BUN)',
    aliases: ['blood urea nitrogen', 'bun', 'blood urea', 'serum urea', 'urea'],
    standardUnit: 'mg/dL',
    compatibleUnits: ['mg/dl', 'mg/dL', 'mmol/l', 'mmol/L']
  },
  {
    key: 'tsh',
    displayName: 'Thyroid Stimulating Hormone (TSH)',
    aliases: [
      'tsh',
      'thyroid stimulating hormone',
      'tsh - ultrasensitive',
      'tsh ultrasensitive',
      's. tsh',
      'thyroid stimulating hormone (tsh)'
    ],
    standardUnit: 'uIU/mL',
    compatibleUnits: ['uiu/ml', 'µiu/ml', 'miu/l', 'mcunit/ml', 'uiu/l', 'uIU/mL']
  },
  {
    key: 'hemoglobin',
    displayName: 'Hemoglobin',
    aliases: ['hemoglobin', 'hb', 'haemoglobin', 'hgb'],
    standardUnit: 'g/dL',
    compatibleUnits: ['g/dl', 'g/dL', 'g/l', 'mmol/l']
  },
  {
    key: 'wbc_count',
    displayName: 'White Blood Cell Count (WBC)',
    aliases: ['wbc count', 'wbc', 'white blood cells', 'total leukocyte count', 'tlc', 'white blood cell count'],
    standardUnit: 'cells/mcL',
    compatibleUnits: ['cells/mcl', '/mcl', '/cumm', '10^3/ul', 'k/ul', 'thou/mcl']
  },
  {
    key: 'rbc_count',
    displayName: 'Red Blood Cell Count (RBC)',
    aliases: ['rbc count', 'rbc', 'red blood cells', 'total erythrocyte count', 'tec', 'red blood cell count'],
    standardUnit: 'million/mcL',
    compatibleUnits: ['million/mcl', 'mil/mcl', '10^6/ul', 'm/mcl']
  },
  {
    key: 'platelet_count',
    displayName: 'Platelet Count',
    aliases: ['platelet count', 'platelets', 'plt', 'thrombocyte count'],
    standardUnit: '/mcL',
    compatibleUnits: ['/mcl', 'cells/mcl', '/cumm', '10^3/ul', 'k/ul', 'thou/mcl', 'lakhs/cumm']
  },
  {
    key: 'bilirubin_total',
    displayName: 'Total Bilirubin',
    aliases: ['total bilirubin', 'serum bilirubin total', 'bilirubin total', 'bilirubin, total'],
    standardUnit: 'mg/dL',
    compatibleUnits: ['mg/dl', 'mg/dL', 'umol/l', 'µmol/l']
  },
  {
    key: 'sgpt_alt',
    displayName: 'ALT / SGPT (Alanine Aminotransferase)',
    aliases: ['sgpt', 'alt', 'alanine aminotransferase', 'alanine transaminase', 'sgpt (alt)', 's.g.p.t'],
    standardUnit: 'U/L',
    compatibleUnits: ['u/l', 'iu/l', 'U/L', 'IU/L']
  },
  {
    key: 'sgot_ast',
    displayName: 'AST / SGOT (Aspartate Aminotransferase)',
    aliases: ['sgot', 'ast', 'aspartate aminotransferase', 'aspartate transaminase', 'sgot (ast)', 's.g.o.t'],
    standardUnit: 'U/L',
    compatibleUnits: ['u/l', 'iu/l', 'U/L', 'IU/L']
  },
  {
    key: 'uric_acid',
    displayName: 'Serum Uric Acid',
    aliases: ['uric acid', 'serum uric acid'],
    standardUnit: 'mg/dL',
    compatibleUnits: ['mg/dl', 'mg/dL', 'umol/l', 'µmol/l']
  },
  {
    key: 'vitamin_d',
    displayName: 'Vitamin D (25-OH)',
    aliases: ['vitamin d', '25-hydroxy vitamin d', 'vitamin d total', 'vitamin d3', '25-oh vitamin d', 'vitamin d (25-oh)'],
    standardUnit: 'ng/mL',
    compatibleUnits: ['ng/ml', 'ng/mL', 'nmol/l', 'nmol/L']
  },
  {
    key: 'vitamin_b12',
    displayName: 'Vitamin B12',
    aliases: ['vitamin b12', 'cyanocobalamin', 'b12', 'serum vitamin b12'],
    standardUnit: 'pg/mL',
    compatibleUnits: ['pg/ml', 'pg/mL', 'pmol/l', 'pmol/L']
  },
  {
    key: 'hematocrit',
    displayName: 'Hematocrit (PCV)',
    aliases: ['hematocrit', 'hct', 'pcv', 'packed cell volume'],
    standardUnit: '%',
    compatibleUnits: ['%']
  },
  {
    key: 'dengue_ns1',
    displayName: 'Dengue NS1 Antigen',
    aliases: ['dengue ns1', 'ns1 antigen', 'dengue ns1 antigen', 'dengue virus ns1 antigen', 'dengue ns1 ag'],
    standardUnit: '',
    compatibleUnits: ['', 'ratio', 's/co']
  },
  {
    key: 'dengue_igm',
    displayName: 'Dengue IgM Antibody',
    aliases: ['dengue igm', 'dengue antibody igm', 'dengue virus igm'],
    standardUnit: '',
    compatibleUnits: ['', 'ratio', 'index', 'iv']
  },
  {
    key: 'dengue_igg',
    displayName: 'Dengue IgG Antibody',
    aliases: ['dengue igg', 'dengue antibody igg', 'dengue virus igg'],
    standardUnit: '',
    compatibleUnits: ['', 'ratio', 'index', 'iv']
  },
  {
    key: 'crp',
    displayName: 'C-Reactive Protein (CRP)',
    aliases: ['crp', 'c-reactive protein', 'c reactive protein', 'hs-crp', 'high sensitivity crp'],
    standardUnit: 'mg/L',
    compatibleUnits: ['mg/l', 'mg/L', 'mg/dl', 'mg/dL']
  },
  {
    key: 'esr',
    displayName: 'Erythrocyte Sedimentation Rate (ESR)',
    aliases: ['esr', 'erythrocyte sedimentation rate', 'sed rate'],
    standardUnit: 'mm/hr',
    compatibleUnits: ['mm/hr', 'mm/1st hr', 'mm/h']
  },
  {
    key: 'neutrophils',
    displayName: 'Neutrophils',
    aliases: ['neutrophils', 'neutrophil percentage', 'polymorphs', 'anc', 'absolute neutrophil count'],
    standardUnit: '%',
    compatibleUnits: ['%', 'cells/mcl', '/cumm', 'k/ul']
  },
  {
    key: 'lymphocytes',
    displayName: 'Lymphocytes',
    aliases: ['lymphocytes', 'lymphocyte percentage', 'alc', 'absolute lymphocyte count'],
    standardUnit: '%',
    compatibleUnits: ['%', 'cells/mcl', '/cumm', 'k/ul']
  }
];

export function parseNumericValue(valueStr: string): number | null {
  if (!valueStr) return null;
  const cleaned = valueStr.trim().replace(/,/g, '');
  const match = cleaned.match(/^[-+]?\d+(?:\.\d+)?/);
  if (match && match[0] && !isNaN(Number(match[0]))) {
    return Number(match[0]);
  }
  return null;
}

export function normalizeUnit(unitStr?: string): string {
  if (!unitStr) return '';
  const u = unitStr.trim();
  const lower = u.toLowerCase();
  if (lower === 'mg/dl' || lower === 'mg/100ml' || lower === 'mg/100 ml') return 'mg/dL';
  if (lower === 'g/dl' || lower === 'gm/dl' || lower === 'g/100ml') return 'g/dL';
  if (lower === 'mmol/l' || lower === 'mmol/liter') return 'mmol/L';
  if (lower === 'umol/l' || lower === 'µmol/l') return 'µmol/L';
  if (lower === 'u/l' || lower === 'iu/l' || lower === 'units/l') return 'U/L';
  if (lower === 'uiu/ml' || lower === 'µiu/ml' || lower === 'miu/l' || lower === 'mcunit/ml') return 'uIU/mL';
  if (lower === 'ng/ml') return 'ng/mL';
  if (lower === 'pg/ml') return 'pg/mL';
  if (lower === '%') return '%';
  if (lower === 'cells/mcl' || lower === '/mcl' || lower === '/cumm' || lower === '10^3/ul') return 'cells/mcL';
  if (lower === 'million/mcl' || lower === 'mil/mcl' || lower === '10^6/ul') return 'million/mcL';
  return u;
}

export function areUnitsCompatible(unitA?: string, unitB?: string): boolean {
  const normA = normalizeUnit(unitA);
  const normB = normalizeUnit(unitB);
  if (!normA && !normB) return true;
  if (!normA || !normB) return false;
  return normA.toLowerCase() === normB.toLowerCase();
}

export function matchCanonicalMarker(rawTestName: string): ICanonicalMarkerDef | null {
  if (!rawTestName) return null;
  const cleanName = rawTestName
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const marker of CANONICAL_MARKERS) {
    for (const alias of marker.aliases) {
      if (cleanName === alias || cleanName.startsWith(alias + ' ') || cleanName.endsWith(' ' + alias)) {
        return marker;
      }
    }
  }

  // Substring match for robust detection
  for (const marker of CANONICAL_MARKERS) {
    for (const alias of marker.aliases) {
      if (alias.length >= 4 && cleanName.includes(alias)) {
        return marker;
      }
    }
  }

  return null;
}

export function normalizeExtractedValue(
  extracted: IExtractedLabValue,
  reportId: string,
  reportDate: Date
): { canonicalKey: string; displayName: string; observation: INormalizedObservation } {
  const matched = matchCanonicalMarker(extracted.testName);
  const canonicalKey = matched ? matched.key : extracted.testName.toLowerCase().replace(/[^\w]/g, '_');
  const displayName = matched ? matched.displayName : extracted.testName;
  const normUnit = normalizeUnit(extracted.unit);
  const numVal = parseNumericValue(extracted.value);

  const observation: INormalizedObservation = {
    reportId,
    reportDate,
    testName: extracted.testName,
    rawValue: extracted.value,
    numericValue: numVal,
    unit: normUnit || extracted.unit,
    referenceRange: extracted.referenceRange,
    isAbnormal: Boolean(extracted.isAbnormal),
    flag: extracted.flag,
    sourceContext: extracted.sourceContext
  };

  return {
    canonicalKey,
    displayName,
    observation
  };
}
