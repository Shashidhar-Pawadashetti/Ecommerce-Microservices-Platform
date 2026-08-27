// totals.js — server-side cart total computation (threat T-04-02).
//
// Totals are computed SOLELY from the catalog price map returned by
// catalogClient.batchPrice. Request bodies never carry price fields and are
// never read here. Money is integer cents end-to-end (docs/json-interop.md
// Rule 2); no floating-point arithmetic.
//
// Lines whose product is absent from the price map (retired from catalog after
// the line was added) are omitted from the view rather than failing the read —
// the cart in Redis still holds them; only the priced view skips them.

export function buildCartView(userId, items, priceMap, updatedAt) {
  const viewItems = [];

  for (const line of items) {
    const price = priceMap.get(line.productId);
    if (!price) continue; // product no longer in catalog — skip in priced view

    const unitPriceCents = price.priceCents;
    const lineTotalCents = unitPriceCents * line.quantity;

    viewItems.push({
      productId: line.productId,
      name: price.name,
      quantity: line.quantity,
      unitPriceCents,
      lineTotalCents,
    });
  }

  const grandTotalCents = viewItems.reduce((sum, item) => sum + item.lineTotalCents, 0);

  return {
    userId,
    items: viewItems,
    grandTotalCents,
    currency: 'USD',
    updatedAt: updatedAt || new Date().toISOString(),
  };
}
