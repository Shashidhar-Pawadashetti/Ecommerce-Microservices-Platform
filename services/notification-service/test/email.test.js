const { test } = require('node:test');
const assert = require('node:assert');
const { sendOrderConfirmed, sendPaymentFailed } = require('../src/email');

test('sendOrderConfirmed returns expected payload', () => {
  const event = {
    eventId: '7d39c26e-9b34-4b6e-a1f0-5c2e8d9a4b10',
    orderId: 'ord-1001',
    userEmail: 'shopper@example.com',
    items: [
      { nameSnapshot: 'Mechanical Keyboard', quantity: 1, unitPriceCents: 12999 },
      { nameSnapshot: 'USB-C Cable', quantity: 2, unitPriceCents: 999 }
    ],
    totalCents: 14997,
    currency: 'USD'
  };

  const payload = sendOrderConfirmed(event);

  assert.strictEqual(payload.from, 'orders@ecommerce.local');
  assert.strictEqual(payload.to, 'shopper@example.com');
  assert.strictEqual(payload.subject, 'Order ord-1001 confirmed');
  
  const expectedText = `Order identifier: ord-1001

Item summary lines:
Mechanical Keyboard × 1
USB-C Cable × 2

Total line: $149.97

Status word: PAID`;
  
  assert.strictEqual(payload.text, expectedText);
});

test('sendPaymentFailed returns expected payload', () => {
  const event = {
    eventId: 'c2a9e0d4-6f21-4c58-9a7b-3e5d1f8a2c44',
    orderId: 'ord-1001',
    outcome: 'DECLINED',
    reason: 'Issuer declined: insufficient funds'
  };

  const payload = sendPaymentFailed(event, 'shopper@example.com');

  assert.strictEqual(payload.from, 'orders@ecommerce.local');
  assert.strictEqual(payload.to, 'shopper@example.com');
  assert.strictEqual(payload.subject, 'Order ord-1001 payment failed');
  
  const expectedText = `Order identifier: ord-1001

Decline reason: Issuer declined: insufficient funds

Status word: PAYMENT_FAILED

Retry your purchase anytime with a fresh checkout.`;
  
  assert.strictEqual(payload.text, expectedText);
});
