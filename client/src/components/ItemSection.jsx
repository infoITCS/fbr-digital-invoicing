import Field, { inputClass } from './Field';
import { RATE_OPTIONS, SALE_TYPE_OPTIONS, UOM_OPTIONS } from '../constants';
import {
  calcItemTotal,
  calcSalesTax,
  calcSalesValueExcludingST,
  deriveUnitPrice,
} from '../utils/validation';

function itemError(itemErrors, index, field) {
  const row = (itemErrors || []).find((e) => e.index === index);
  return row?.[field];
}

export default function ItemSection({
  items,
  itemErrors,
  disabled,
  onChangeItem,
  onAddItem,
  onRemoveItem,
}) {
  const handleChange = (index, field, value) => {
    const next = { ...items[index], [field]: value };

    if (field === 'quantity' || field === 'unitPrice') {
      next.valueSalesExcludingST = calcSalesValueExcludingST(
        next.quantity,
        next.unitPrice
      );
      next.salesTaxApplicable = calcSalesTax(
        next.valueSalesExcludingST,
        next.rate
      );
    } else if (field === 'valueSalesExcludingST' || field === 'rate') {
      if (field === 'valueSalesExcludingST') {
        next.unitPrice = deriveUnitPrice(next.quantity, value);
      }
      next.salesTaxApplicable = calcSalesTax(
        next.valueSalesExcludingST,
        next.rate
      );
    }

    // Keep totalValues in sync as a convenience; user can still override
    if (
      [
        'quantity',
        'unitPrice',
        'valueSalesExcludingST',
        'rate',
        'salesTaxApplicable',
        'furtherTax',
        'extraTax',
        'fedPayable',
        'discount',
      ].includes(field)
    ) {
      next.totalValues = calcItemTotal(next);
    }

    onChangeItem(index, next);
  };

  const num = (v) => (v === '' || v == null ? '' : Number(v));

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
            What are you selling?
          </h2>
          <p className="text-xs text-slate-500">
            Enter quantity and unit price — amount before tax is calculated for
            you.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddItem}
          disabled={disabled}
          className="rounded bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add another item
        </button>
      </div>

      <div className="divide-y divide-slate-100 p-4">
        {items.map((item, index) => (
          <div key={index} className="space-y-3 py-4 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-teal-900">
                Item {index + 1}
              </h3>
              {items.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onRemoveItem(index)}
                  disabled={disabled}
                  className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                <Field
                  label="Item / service description"
                  name={`productDescription-${index}`}
                  required
                  error={itemError(itemErrors, index, 'productDescription')}
                  className="md:col-span-2"
                >
                  <input
                    id={`productDescription-${index}`}
                    className={inputClass(
                      itemError(itemErrors, index, 'productDescription')
                    )}
                    value={item.productDescription}
                    disabled={disabled}
                    placeholder="What was sold or provided?"
                    onChange={(e) =>
                      handleChange(index, 'productDescription', e.target.value)
                    }
                  />
                </Field>

                <Field
                  label="HS code"
                  name={`hsCode-${index}`}
                  required
                  error={itemError(itemErrors, index, 'hsCode')}
                  hint="Customs / PCT code for this item."
                >
                  <input
                    id={`hsCode-${index}`}
                    className={inputClass(itemError(itemErrors, index, 'hsCode'))}
                    value={item.hsCode}
                    disabled={disabled}
                    placeholder="e.g. 0102.2930"
                    onChange={(e) =>
                      handleChange(index, 'hsCode', e.target.value)
                    }
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                <Field
                  label="Quantity"
                  name={`quantity-${index}`}
                  required
                  error={itemError(itemErrors, index, 'quantity')}
                >
                  <input
                    id={`quantity-${index}`}
                    type="number"
                    step="any"
                    min="0"
                    className={inputClass(
                      itemError(itemErrors, index, 'quantity')
                    )}
                    value={item.quantity}
                    disabled={disabled}
                    onChange={(e) =>
                      handleChange(index, 'quantity', num(e.target.value))
                    }
                  />
                </Field>

                <Field
                  label="Unit"
                  name={`uoM-${index}`}
                  required
                  error={itemError(itemErrors, index, 'uoM')}
                >
                  <select
                    id={`uoM-${index}`}
                    className={inputClass(itemError(itemErrors, index, 'uoM'))}
                    value={item.uoM}
                    disabled={disabled}
                    onChange={(e) => handleChange(index, 'uoM', e.target.value)}
                  >
                    {UOM_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Price per unit"
                  name={`unitPrice-${index}`}
                  required
                  error={itemError(itemErrors, index, 'unitPrice')}
                  hint="Before sales tax."
                >
                  <input
                    id={`unitPrice-${index}`}
                    type="number"
                    step="any"
                    min="0"
                    className={inputClass(
                      itemError(itemErrors, index, 'unitPrice')
                    )}
                    value={item.unitPrice}
                    disabled={disabled}
                    placeholder="e.g. 1000"
                    onChange={(e) =>
                      handleChange(index, 'unitPrice', num(e.target.value))
                    }
                  />
                </Field>

                <Field
                  label="Amount before tax"
                  name={`valueSalesExcludingST-${index}`}
                  required
                  error={itemError(itemErrors, index, 'valueSalesExcludingST')}
                  hint="Quantity × price per unit."
                >
                  <input
                    id={`valueSalesExcludingST-${index}`}
                    type="number"
                    step="any"
                    className={`${inputClass(
                      itemError(itemErrors, index, 'valueSalesExcludingST')
                    )} bg-slate-50`}
                    value={item.valueSalesExcludingST}
                    disabled={disabled}
                    onChange={(e) =>
                      handleChange(
                        index,
                        'valueSalesExcludingST',
                        num(e.target.value)
                      )
                    }
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                <Field
                  label="Sales tax rate"
                  name={`rate-${index}`}
                  required
                  error={itemError(itemErrors, index, 'rate')}
                >
                  <select
                    id={`rate-${index}`}
                    className={inputClass(itemError(itemErrors, index, 'rate'))}
                    value={item.rate}
                    disabled={disabled}
                    onChange={(e) => handleChange(index, 'rate', e.target.value)}
                  >
                    {RATE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Sales tax"
                  name={`salesTaxApplicable-${index}`}
                  hint="Calculated from rate × amount before tax."
                >
                  <input
                    id={`salesTaxApplicable-${index}`}
                    type="number"
                    step="any"
                    className={`${inputClass()} bg-slate-50`}
                    value={item.salesTaxApplicable}
                    disabled={disabled}
                    onChange={(e) =>
                      handleChange(
                        index,
                        'salesTaxApplicable',
                        num(e.target.value)
                      )
                    }
                  />
                </Field>

                <Field
                  label="Line total"
                  name={`totalValues-${index}`}
                  hint="Amount before tax + taxes − discount."
                >
                  <input
                    id={`totalValues-${index}`}
                    type="number"
                    step="any"
                    className={`${inputClass()} bg-slate-50 font-semibold`}
                    value={item.totalValues}
                    disabled={disabled}
                    onChange={(e) =>
                      handleChange(index, 'totalValues', num(e.target.value))
                    }
                  />
                </Field>

                <Field
                  label="Sale category"
                  name={`saleType-${index}`}
                  required
                  error={itemError(itemErrors, index, 'saleType')}
                >
                  <select
                    id={`saleType-${index}`}
                    className={inputClass(
                      itemError(itemErrors, index, 'saleType')
                    )}
                    value={item.saleType}
                    disabled={disabled}
                    onChange={(e) =>
                      handleChange(index, 'saleType', e.target.value)
                    }
                  >
                    {SALE_TYPE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <details className="rounded-md border border-slate-200 bg-slate-50/70">
                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700">
                  More tax details (usually leave as 0)
                </summary>
                <div className="grid grid-cols-1 gap-3 border-t border-slate-200 bg-white p-3 md:grid-cols-2 lg:grid-cols-3">
                  <Field
                    label="Discount"
                    name={`discount-${index}`}
                    optional
                  >
                    <input
                      id={`discount-${index}`}
                      type="number"
                      step="any"
                      className={inputClass()}
                      value={item.discount}
                      disabled={disabled}
                      onChange={(e) =>
                        handleChange(index, 'discount', num(e.target.value))
                      }
                    />
                  </Field>

                  <Field
                    label="Further tax"
                    name={`furtherTax-${index}`}
                    optional
                  >
                    <input
                      id={`furtherTax-${index}`}
                      type="number"
                      step="any"
                      className={inputClass()}
                      value={item.furtherTax}
                      disabled={disabled}
                      onChange={(e) =>
                        handleChange(index, 'furtherTax', num(e.target.value))
                      }
                    />
                  </Field>

                  <Field
                    label="Extra tax"
                    name={`extraTax-${index}`}
                    optional
                    hint="Leave blank unless this sale type requires it."
                  >
                    <input
                      id={`extraTax-${index}`}
                      className={inputClass()}
                      value={
                        item.extraTax === null || item.extraTax === undefined
                          ? ''
                          : item.extraTax
                      }
                      disabled={disabled}
                      placeholder="Leave blank if not applicable"
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          handleChange(index, 'extraTax', '');
                        } else if (!Number.isNaN(Number(raw))) {
                          handleChange(index, 'extraTax', Number(raw));
                        } else {
                          handleChange(index, 'extraTax', raw);
                        }
                      }}
                    />
                  </Field>

                  <Field
                    label="FED payable"
                    name={`fedPayable-${index}`}
                    optional
                  >
                    <input
                      id={`fedPayable-${index}`}
                      type="number"
                      step="any"
                      className={inputClass()}
                      value={item.fedPayable}
                      disabled={disabled}
                      onChange={(e) =>
                        handleChange(index, 'fedPayable', num(e.target.value))
                      }
                    />
                  </Field>

                  <Field
                    label="Tax withheld at source"
                    name={`salesTaxWithheldAtSource-${index}`}
                    optional
                  >
                    <input
                      id={`salesTaxWithheldAtSource-${index}`}
                      type="number"
                      step="any"
                      className={inputClass()}
                      value={item.salesTaxWithheldAtSource}
                      disabled={disabled}
                      onChange={(e) =>
                        handleChange(
                          index,
                          'salesTaxWithheldAtSource',
                          num(e.target.value)
                        )
                      }
                    />
                  </Field>

                  <Field
                    label="Notified / retail price"
                    name={`fixedNotifiedValueOrRetailPrice-${index}`}
                    optional
                    hint="Only if this sale type uses a notified or retail price."
                  >
                    <input
                      id={`fixedNotifiedValueOrRetailPrice-${index}`}
                      type="number"
                      step="any"
                      className={inputClass()}
                      value={item.fixedNotifiedValueOrRetailPrice}
                      disabled={disabled}
                      onChange={(e) =>
                        handleChange(
                          index,
                          'fixedNotifiedValueOrRetailPrice',
                          num(e.target.value)
                        )
                      }
                    />
                  </Field>

                  <Field
                    label="SRO / schedule"
                    name={`sroScheduleNo-${index}`}
                    optional
                  >
                    <input
                      id={`sroScheduleNo-${index}`}
                      className={inputClass()}
                      value={item.sroScheduleNo}
                      disabled={disabled}
                      placeholder="e.g. EIGHTH SCHEDULE Table 1"
                      onChange={(e) =>
                        handleChange(index, 'sroScheduleNo', e.target.value)
                      }
                    />
                  </Field>

                  <Field
                    label="SRO item serial"
                    name={`sroItemSerialNo-${index}`}
                    optional
                  >
                    <input
                      id={`sroItemSerialNo-${index}`}
                      className={inputClass()}
                      value={item.sroItemSerialNo}
                      disabled={disabled}
                      onChange={(e) =>
                        handleChange(index, 'sroItemSerialNo', e.target.value)
                      }
                    />
                  </Field>
                </div>
              </details>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
