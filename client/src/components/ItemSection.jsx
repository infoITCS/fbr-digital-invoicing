import Field, { inputClass } from './Field';
import { RATE_OPTIONS, SALE_TYPE_OPTIONS, UOM_OPTIONS } from '../constants';
import { calcItemTotal, calcSalesTax } from '../utils/validation';

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

    if (field === 'valueSalesExcludingST' || field === 'rate') {
      next.salesTaxApplicable = calcSalesTax(
        field === 'valueSalesExcludingST' ? value : next.valueSalesExcludingST,
        field === 'rate' ? value : next.rate
      );
    }

    // Keep totalValues in sync as a convenience; user can still override
    if (
      [
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
            Invoice Items
          </h2>
          <p className="text-xs text-slate-500">
            Add one or more line items. Tax fields follow FBR DI API naming.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddItem}
          disabled={disabled}
          className="rounded bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add Item
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

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Field
                label="HS Code"
                name={`hsCode-${index}`}
                required
                error={itemError(itemErrors, index, 'hsCode')}
              >
                <input
                  id={`hsCode-${index}`}
                  className={inputClass(itemError(itemErrors, index, 'hsCode'))}
                  value={item.hsCode}
                  disabled={disabled}
                  placeholder="e.g. 0102.2930"
                  onChange={(e) => handleChange(index, 'hsCode', e.target.value)}
                />
              </Field>

              <Field
                label="Product Description"
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
                  onChange={(e) =>
                    handleChange(index, 'productDescription', e.target.value)
                  }
                />
              </Field>

              <Field
                label="Rate"
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
                label="Unit of Measurement (UOM)"
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
                  className={inputClass(itemError(itemErrors, index, 'quantity'))}
                  value={item.quantity}
                  disabled={disabled}
                  onChange={(e) =>
                    handleChange(index, 'quantity', num(e.target.value))
                  }
                />
              </Field>

              <Field label="Total Values" name={`totalValues-${index}`}>
                <input
                  id={`totalValues-${index}`}
                  type="number"
                  step="any"
                  className={inputClass()}
                  value={item.totalValues}
                  disabled={disabled}
                  onChange={(e) =>
                    handleChange(index, 'totalValues', num(e.target.value))
                  }
                />
              </Field>

              <Field
                label="Sales Value Excluding Sales Tax"
                name={`valueSalesExcludingST-${index}`}
                required
                error={itemError(itemErrors, index, 'valueSalesExcludingST')}
              >
                <input
                  id={`valueSalesExcludingST-${index}`}
                  type="number"
                  step="any"
                  className={inputClass(
                    itemError(itemErrors, index, 'valueSalesExcludingST')
                  )}
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

              <Field
                label="Fixed Notified Value or Retail Price"
                name={`fixedNotifiedValueOrRetailPrice-${index}`}
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
                label="Sales Tax Applicable"
                name={`salesTaxApplicable-${index}`}
              >
                <input
                  id={`salesTaxApplicable-${index}`}
                  type="number"
                  step="any"
                  className={inputClass()}
                  value={item.salesTaxApplicable}
                  disabled={disabled}
                  onChange={(e) =>
                    handleChange(index, 'salesTaxApplicable', num(e.target.value))
                  }
                />
              </Field>

              <Field
                label="Sales Tax Withheld at Source"
                name={`salesTaxWithheldAtSource-${index}`}
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
                label="Extra Tax"
                name={`extraTax-${index}`}
                hint='Leave empty ("") or enter a number — FBR may reject either depending on scenario.'
              >
                <input
                  id={`extraTax-${index}`}
                  className={inputClass()}
                  value={item.extraTax === null || item.extraTax === undefined ? '' : item.extraTax}
                  disabled={disabled}
                  placeholder="empty or number"
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

              <Field label="Further Tax" name={`furtherTax-${index}`}>
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

              <Field label="SRO Schedule Number" name={`sroScheduleNo-${index}`}>
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

              <Field label="FED Payable" name={`fedPayable-${index}`}>
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

              <Field label="Discount" name={`discount-${index}`}>
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
                label="Sale Type"
                name={`saleType-${index}`}
                required
                error={itemError(itemErrors, index, 'saleType')}
              >
                <select
                  id={`saleType-${index}`}
                  className={inputClass(itemError(itemErrors, index, 'saleType'))}
                  value={item.saleType}
                  disabled={disabled}
                  onChange={(e) => handleChange(index, 'saleType', e.target.value)}
                >
                  {SALE_TYPE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="SRO Item Serial Number"
                name={`sroItemSerialNo-${index}`}
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
          </div>
        ))}
      </div>
    </section>
  );
}
