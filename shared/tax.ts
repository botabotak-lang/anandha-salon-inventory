/** 税率はパーセント整数（8, 10, 0=非課税）。金額は円の整数。 */

export function taxPartsFromIncluded(taxIncluded: number, taxRatePercent: number) {
  if (taxRatePercent === 0) {
    return {
      taxExcluded: taxIncluded,
      taxAmount: 0,
      taxIncluded,
    };
  }
  const denom = 100 + taxRatePercent;
  const taxExcluded = Math.round((taxIncluded * 100) / denom);
  const taxAmount = taxIncluded - taxExcluded;
  return { taxExcluded, taxAmount, taxIncluded };
}

export function taxIncludedFromExcluded(taxExcluded: number, taxRatePercent: number) {
  if (taxRatePercent === 0) return taxExcluded;
  return Math.round((taxExcluded * (100 + taxRatePercent)) / 100);
}

export function taxPartsFromExcluded(taxExcluded: number, taxRatePercent: number) {
  const taxIncluded = taxIncludedFromExcluded(taxExcluded, taxRatePercent);
  const taxAmount = taxIncluded - taxExcluded;
  return { taxExcluded, taxAmount, taxIncluded };
}
