import { computeInvoiceTotal } from "../route";

describe("computeInvoiceTotal", () => {
  it("handles a single line item with no tax or discount", () => {
    const result = computeInvoiceTotal([{ description: "Widget", qty: 2, unit_price: 10.5 }]);
    expect(result).toEqual({
      subtotal: 21,
      discount: 0,
      taxable: 21,
      tax: 0,
      total: 21,
      line_totals: [21],
    });
  });

  it("handles multiple line items with no tax or discount", () => {
    const result = computeInvoiceTotal([
      { description: "Item A", qty: 3, unit_price: 5 },
      { description: "Item B", qty: 1, unit_price: 12.99 },
    ]);
    expect(result).toEqual({
      subtotal: 27.99,
      discount: 0,
      taxable: 27.99,
      tax: 0,
      total: 27.99,
      line_totals: [15, 12.99],
    });
  });

  it("applies discount only (no tax)", () => {
    const result = computeInvoiceTotal(
      [{ description: "Service", qty: 1, unit_price: 200 }],
      undefined,
      10
    );
    expect(result).toEqual({
      subtotal: 200,
      discount: 20,
      taxable: 180,
      tax: 0,
      total: 180,
      line_totals: [200],
    });
  });

  it("applies tax only (no discount)", () => {
    const result = computeInvoiceTotal(
      [{ description: "Product", qty: 2, unit_price: 50 }],
      8
    );
    expect(result).toEqual({
      subtotal: 100,
      discount: 0,
      taxable: 100,
      tax: 8,
      total: 108,
      line_totals: [100],
    });
  });

  it("stacks tax on discounted taxable amount", () => {
    const result = computeInvoiceTotal(
      [{ description: "Consulting", qty: 1, unit_price: 1000 }],
      7.5,
      20
    );
    expect(result).toEqual({
      subtotal: 1000,
      discount: 200,
      taxable: 800,
      tax: 60,
      total: 860,
      line_totals: [1000],
    });
  });

  it("handles multi-line items with discount and tax stacking", () => {
    const result = computeInvoiceTotal(
      [
        { description: "Item 1", qty: 4, unit_price: 9.99 },
        { description: "Item 2", qty: 2, unit_price: 24.99 },
      ],
      5,
      15
    );
    // line_totals: [39.96, 49.98]
    // subtotal: 89.94
    // discount: 89.94 * 0.15 = 13.491 -> 13.49
    // taxable: 89.94 - 13.49 = 76.45
    // tax: 76.45 * 0.05 = 3.8225 -> 3.82
    // total: 76.45 + 3.82 = 80.27
    expect(result).toEqual({
      subtotal: 89.94,
      discount: 13.49,
      taxable: 76.45,
      tax: 3.82,
      total: 80.27,
      line_totals: [39.96, 49.98],
    });
  });

  it("applies zero percent tax and discount correctly", () => {
    const result = computeInvoiceTotal(
      [{ description: "Item", qty: 5, unit_price: 2 }],
      0,
      0
    );
    expect(result).toEqual({
      subtotal: 10,
      discount: 0,
      taxable: 10,
      tax: 0,
      total: 10,
      line_totals: [10],
    });
  });

  it("rounds intermediate values to cent precision", () => {
    const result = computeInvoiceTotal(
      [{ description: "Odd", qty: 3, unit_price: 1.333 }],
      3.333,
      3.333
    );
    expect(result.line_totals[0]).toBeCloseTo(4.0, 2);
    expect(result.subtotal).toBeCloseTo(4.0, 2);
    expect(result.discount).toBeCloseTo(0.13, 2);
    expect(result.taxable).toBeCloseTo(3.87, 2);
    expect(result.tax).toBeCloseTo(0.13, 2);
    expect(result.total).toBeCloseTo(4.0, 2);
  });
});
