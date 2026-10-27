export function validateForm(form) {
  const errors = {};

  if (!form.invoiceDate) errors.invoiceDate = 'Invoice date is required';
  if (!form.scenarioId) errors.scenarioId = 'Scenario ID is required';
  if (!form.sellerNTNCNIC?.trim()) errors.sellerNTNCNIC = 'Seller NTN/CNIC is required';
  if (!form.sellerBusinessName?.trim())
    errors.sellerBusinessName = 'Seller business name is required';
  if (!form.sellerProvince) errors.sellerProvince = 'Seller province is required';
  if (!form.sellerAddress?.trim()) errors.sellerAddress = 'Seller address is required';
  if (!form.buyerBusinessName?.trim())
    errors.buyerBusinessName = 'Buyer business name is required';
  if (!form.buyerProvince) errors.buyerProvince = 'Buyer province is required';
  if (!form.buyerAddress?.trim()) errors.buyerAddress = 'Buyer address is required';
  if (!form.buyerRegistrationType)
    errors.buyerRegistrationType = 'Buyer registration type is required';

  if (form.buyerRegistrationType === 'Registered' && !form.buyerNTNCNIC?.trim()) {
    errors.buyerNTNCNIC = 'Buyer NTN/CNIC is required for registered buyers';
  }

  if (!form.items?.length) {
    errors.items = 'At least one invoice item is required';
  }

  const itemErrors = (form.items || []).map((item, index) => {
    const e = {};
    if (!item.hsCode?.trim()) e.hsCode = 'Required';
    if (!item.productDescription?.trim()) e.productDescription = 'Required';
    if (!item.rate?.trim()) e.rate = 'Required';
    if (!item.uoM?.trim()) e.uoM = 'Required';
    if (item.quantity === '' || item.quantity == null || Number(item.quantity) < 0) {
      e.quantity = 'Invalid';
    }
    if (
      item.valueSalesExcludingST === '' ||
      item.valueSalesExcludingST == null ||
      Number.isNaN(Number(item.valueSalesExcludingST))
    ) {
      e.valueSalesExcludingST = 'Invalid';
    }
    if (!item.saleType?.trim()) e.saleType = 'Required';
    return Object.keys(e).length ? { index, ...e } : null;
  }).filter(Boolean);

  if (itemErrors.length) {
    errors.itemErrors = itemErrors;
  }

  return errors;
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}

export function parseRatePercent(rate) {
  if (!rate) return 0;
  const n = parseFloat(String(rate).replace('%', '').trim());
  return Number.isFinite(n) ? n : 0;
}

/** Recalculate sales tax from excluding-ST value and rate when user edits those fields */
export function calcSalesTax(valueExcludingST, rate) {
  const base = Number(valueExcludingST) || 0;
  const pct = parseRatePercent(rate);
  return Math.round(base * (pct / 100) * 100) / 100;
}

export function calcItemTotal(item) {
  const base = Number(item.valueSalesExcludingST) || 0;
  const st = Number(item.salesTaxApplicable) || 0;
  const further = Number(item.furtherTax) || 0;
  const extra =
    item.extraTax === '' || item.extraTax == null ? 0 : Number(item.extraTax) || 0;
  const fed = Number(item.fedPayable) || 0;
  const discount = Number(item.discount) || 0;
  return Math.round((base + st + further + extra + fed - discount) * 100) / 100;
}

export function calcInvoiceTotals(items = []) {
  return items.reduce(
    (acc, item) => {
      acc.valueSalesExcludingST += Number(item.valueSalesExcludingST) || 0;
      acc.salesTaxApplicable += Number(item.salesTaxApplicable) || 0;
      acc.furtherTax += Number(item.furtherTax) || 0;
      acc.extraTax +=
        item.extraTax === '' || item.extraTax == null ? 0 : Number(item.extraTax) || 0;
      acc.fedPayable += Number(item.fedPayable) || 0;
      acc.discount += Number(item.discount) || 0;
      acc.totalValues +=
        Number(item.totalValues) || calcItemTotal(item);
      return acc;
    },
    {
      valueSalesExcludingST: 0,
      salesTaxApplicable: 0,
      furtherTax: 0,
      extraTax: 0,
      fedPayable: 0,
      discount: 0,
      totalValues: 0,
    }
  );
}

export function formatMoney(n) {
  return Number(n || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
