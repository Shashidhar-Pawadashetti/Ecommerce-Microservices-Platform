const { Kafka } = require('kafkajs');
const nodemailer = require('nodemailer');
const { sendOrderConfirmed, sendPaymentFailed } = require('./email');

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
});

const consumer = kafka.consumer({ groupId: 'notification-service' });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '1025', 10),
  ignoreTLS: true,
});

// In-memory idempotency state
const processedEvents = new Set();
// Store userEmails from order.created for use in payment.completed
const orderEmails = new Map();

async function start() {
  await consumer.connect();
  console.log('Connected to Kafka.');

  await consumer.subscribe({ topic: 'order.created', fromBeginning: true });
  await consumer.subscribe({ topic: 'payment.completed', fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const payload = JSON.parse(message.value.toString());
      const eventId = payload.eventId;

      if (processedEvents.has(eventId)) {
        console.log(`Duplicate event ignored: ${eventId}`);
        return;
      }

      try {
        let emailPayload = null;

        if (topic === 'order.created') {
          if (payload.userEmail) {
            orderEmails.set(payload.orderId, payload.userEmail);
          }
          emailPayload = sendOrderConfirmed(payload);
        } else if (topic === 'payment.completed') {
          if (payload.outcome === 'DECLINED') {
            const userEmail = orderEmails.get(payload.orderId) || 'shopper@example.com';
            emailPayload = sendPaymentFailed(payload, userEmail);
          } else {
            console.log(`Payment APPROVED for order ${payload.orderId}, ignoring since order.created handles confirmation.`);
          }
        }

        if (emailPayload) {
          const info = await transporter.sendMail(emailPayload);
          console.log(`Email sent for event ${eventId}: ${info.messageId}`);
        }

        processedEvents.add(eventId);
      } catch (error) {
        console.error(`Error processing event ${eventId}:`, error);
        throw error; // Let Kafka retry
      }
    },
  });
}

start().catch(console.error);

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down consumer...');
  await consumer.disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
