function formatCurrency(cents, currency) {
  const symbol = currency === 'USD' ? '$' : (currency === 'EUR' ? '€' : currency + ' ');
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

function sendOrderConfirmed(event) {
  const { orderId, items, totalCents, currency, userEmail } = event;
  
  const itemSummary = items.map(item => `${item.nameSnapshot} × ${item.quantity}`).join('\n');
  const total = formatCurrency(totalCents, currency);
  
  const text = `Order identifier: ${orderId}

Item summary lines:
${itemSummary}

Total line: ${total}

Status word: PAID`;

  return {
    from: 'orders@ecommerce.local',
    to: userEmail || 'customer@example.com',
    subject: `Order ${orderId} confirmed`,
    text: text
  };
}

function sendPaymentFailed(event, userEmail) {
  const { orderId, reason } = event;
  
  const text = `Order identifier: ${orderId}

Decline reason: ${reason}

Status word: PAYMENT_FAILED

Retry your purchase anytime with a fresh checkout.`;

  return {
    from: 'orders@ecommerce.local',
    to: userEmail || 'customer@example.com',
    subject: `Order ${orderId} payment failed`,
    text: text
  };
}

module.exports = {
  sendOrderConfirmed,
  sendPaymentFailed
};
