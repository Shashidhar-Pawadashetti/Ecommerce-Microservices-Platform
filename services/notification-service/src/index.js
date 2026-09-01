const { Kafka } = require('kafkajs');
const nodemailer = require('nodemailer');
const http = require('http');
const { sendOrderConfirmed, sendPaymentFailed } = require('./email');

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
});

const consumer = kafka.consumer({ groupId: 'notification-service' });

let isKafkaConnected = false;

consumer.on(consumer.events.CONNECT, () => {
  isKafkaConnected = true;
  console.log('Kafka consumer connected.');
});

consumer.on(consumer.events.DISCONNECT, () => {
  isKafkaConnected = false;
  console.log('Kafka consumer disconnected.');
});

consumer.on(consumer.events.CRASH, () => {
  isKafkaConnected = false;
  console.log('Kafka consumer crashed.');
});

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
  isKafkaConnected = true;
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

// HTTP Health Check Endpoint for Kubernetes & Docker Compose probes
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/healthz') {
    if (isKafkaConnected) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'UP', service: 'notification-service', kafka: 'CONNECTED' }));
    } else {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'DOWN', service: 'notification-service', kafka: 'DISCONNECTED' }));
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});

const PORT = parseInt(process.env.PORT || '8084', 10);
server.listen(PORT, () => {
  console.log(`Notification health probe listening on port ${PORT}`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down consumer and health server...');
  isKafkaConnected = false;
  server.close();
  await consumer.disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
