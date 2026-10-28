export const PROVINCES = [
  'BALOCHISTAN',
  'CAPITAL TERRITORY',
  'KHYBER PAKHTUNKHWA',
  'PUNJAB',
  'SINDH',
];

export const UOM_OPTIONS = [
  'Numbers, pieces, units',
  'Kilogram',
  'Gram',
  'Litre',
  'Meter',
  'Square metre',
  'Cubic metre',
  'Dozen',
  'Pair',
  'Set',
  'Pack',
  'Carton',
  'Hour',
  'Day',
  'Month',
  'Year',
  'Service',
];

export const RATE_OPTIONS = [
  '0%',
  '1%',
  '2%',
  '5%',
  '8%',
  '10%',
  '12%',
  '15%',
  '16%',
  '17%',
  '18%',
  '19%',
  '25%',
];

export const SALE_TYPE_OPTIONS = [
  'Goods at standard rate (default)',
  'Goods at Reduced Rate',
  'Goods at zero-rate',
  'Exempt goods',
  '3rd Schedule Goods',
  'Services',
  'Services (FED in ST Mode)',
  'Goods (FED in ST Mode)',
  'Cotton ginners',
  'Telecommunication services',
  'Petroleum Products',
  'Electricity Supply to Retailers',
  'Gas to CNG stations',
  'Mobile Phones',
  'Processing/Conversion of Goods',
  'Toll Manufacturing',
  'Steel melting and re-rolling',
  'Ship breaking',
  'Electric Vehicle',
  'Cement /Concrete Block',
  'Potassium Chlorate',
  'CNG Sales',
  'Goods as per SRO.297(|)/2023',
  'Non-Adjustable Supplies',
];

/** ITCS-approved sandbox scenarios only (code + display name for the team) */
export const SCENARIO_OPTIONS = [
  {
    id: 'SN001',
    name: 'Goods at Standard Rate to Registered Buyers',
  },
  {
    id: 'SN002',
    name: 'Goods at Standard Rate to Unregistered Buyers',
  },
  {
    id: 'SN005',
    name: 'Reduced Rate Sale',
  },
  {
    id: 'SN006',
    name: 'Exempt Goods Sale',
  },
  {
    id: 'SN007',
    name: 'Zero Rated Sale',
  },
  {
    id: 'SN008',
    name: 'Sale of 3rd Schedule Goods',
  },
  {
    id: 'SN016',
    name: 'Processing / Conversion of Goods',
  },
  {
    id: 'SN017',
    name: 'Sale of Goods where FED is Charged in ST Mode',
  },
  {
    id: 'SN018',
    name: 'Services Rendered or Provided Where FED is Charged in ST Mode',
  },
  {
    id: 'SN019',
    name: 'Services Rendered or Provided',
  },
  {
    id: 'SN024',
    name: 'Goods Sold that are Listed in SRO 297(1)/2023',
  },
  {
    id: 'SN026',
    name: 'Sale to End Consumer by Retailers',
  },
  {
    id: 'SN027',
    name: 'Sale to End Consumer by Retailers',
  },
  {
    id: 'SN028',
    name: 'Sale to End Consumer by Retailers',
  },
];

export function getScenarioLabel(scenarioId) {
  const found = SCENARIO_OPTIONS.find((s) => s.id === scenarioId);
  if (!found) return scenarioId || '—';
  return `${found.id} — ${found.name}`;
}

/** ITCS seller defaults (editable) */
export const ITCS_SELLER = {
  sellerNTNCNIC: '3670038',
  sellerBusinessName: 'ITCS (IT CONSULTING AND SERVICES)',
  sellerProvince: 'CAPITAL TERRITORY',
  sellerAddress: 'Islamabad, Pakistan',
};

export function createEmptyItem() {
  return {
    hsCode: '',
    productDescription: '',
    rate: '18%',
    uoM: 'Numbers, pieces, units',
    quantity: 1,
    totalValues: 0,
    valueSalesExcludingST: 0,
    fixedNotifiedValueOrRetailPrice: 0,
    salesTaxApplicable: 0,
    salesTaxWithheldAtSource: 0,
    // Official SN samples often use "" for extraTax; user can set numeric if needed
    extraTax: '',
    furtherTax: 0,
    sroScheduleNo: '',
    fedPayable: 0,
    discount: 0,
    saleType: 'Goods at standard rate (default)',
    sroItemSerialNo: '',
  };
}

export function createInitialForm() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    invoiceType: 'Sale Invoice',
    invoiceDate: today,
    scenarioId: 'SN005',
    invoiceRefNo: '',
    ...ITCS_SELLER,
    buyerNTNCNIC: '',
    buyerBusinessName: '',
    buyerProvince: 'CAPITAL TERRITORY',
    buyerAddress: '',
    buyerRegistrationType: 'Registered',
    items: [createEmptyItem()],
  };
}
