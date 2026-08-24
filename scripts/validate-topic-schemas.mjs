#!/usr/bin/env node
// validate-topic-schemas.mjs — Kafka topic payload validator (CONTR-02).
//
// Node stdlib ONLY (node:fs). Reads the topic-contract markdown, extracts the
// fenced ```json payload blocks in document order, maps them onto the two
// frozen topics, and asserts the contracted shapes:
//   order.created      keys exactly: eventId, orderId, userId, userEmail,
//                      items, totalCents, currency, createdAt
//   payment.completed  keys exactly: eventId, orderId, outcome, reason,
//                      processedAt
// Plus: outcome ∈ APPROVED|DECLINED; every items[] element carries exactly
// productId/nameSnapshot/unitPriceCents/quantity; totalCents parses as an
// integer (Number.isInteger) — integer minor units everywhere, never floats.
//
// Exit codes: 0 = payloads valid (or target file not authored yet -> SKIP),
//             1 = contract violations found.

import { readFileSync } from "node:fs";

const REQUIRED = {
  "order.created": [
    "eventId", "orderId", "userId", "userEmail",
    "items", "totalCents", "currency", "createdAt",
  ],
  "payment.completed": [
    "eventId", "orderId", "outcome", "reason", "processedAt",
  ],
};
const TOPIC_ORDER = ["order.created", "payment.completed"];
const ITEM_KEYS = ["productId", "nameSnapshot", "unitPriceCents", "quantity"];

const file = process.argv[2];
if (!file) {
  console.error("usage: node validate-topic-schemas.mjs <topics-markdown>");
  process.exit(1);
}

let markdown;
try {
  markdown = readFileSync(file, "utf8");
} catch {
  console.log(`SKIP: ${file} does not exist yet (authored by Plan 05) — topic-schema stage deferred`);
  process.exit(0);
}

let failed = false;
const fail = (msg) => { console.error(`FAIL: ${msg}`); failed = true; };
const keySet = (obj) => Object.keys(obj).sort().join(",");

const blocks = [...markdown.matchAll(/```json[ \t]*\r?\n([\s\S]*?)```/g)].map((m) => m[1]);
if (blocks.length !== TOPIC_ORDER.length) {
  fail(`expected exactly ${TOPIC_ORDER.length} fenced json payload blocks (one per topic: ${TOPIC_ORDER.join(", ")}), found ${blocks.length}`);
}

TOPIC_ORDER.forEach((topic, i) => {
  if (i >= blocks.length) return;
  let payload;
  try {
    payload = JSON.parse(blocks[i]);
  } catch (err) {
    fail(`${topic}: payload block ${i + 1} is not parseable JSON (${err.message})`);
    return;
  }
  const expectedKeys = [...REQUIRED[topic]].sort().join(",");
  if (keySet(payload) !== expectedKeys) {
    fail(`${topic}: key set mismatch — expected exactly [${REQUIRED[topic].join(", ")}], got [${Object.keys(payload).join(", ") || "<none>"}]`);
    return;
  }
  console.log(`ok: ${topic} required-key set exact`);

  if (topic === "order.created") {
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      fail("order.created: items must be a non-empty array");
    } else {
      const expectedItems = [...ITEM_KEYS].sort().join(",");
      payload.items.forEach((item, idx) => {
        if (typeof item !== "object" || item === null || Array.isArray(item)) {
          fail(`order.created: items[${idx}] must be an object`);
        } else if (keySet(item) !== expectedItems) {
          fail(`order.created: items[${idx}] key mismatch — expected exactly [${ITEM_KEYS.join(", ")}], got [${Object.keys(item).join(", ")}]`);
        }
      });
    }
    if (!Number.isInteger(payload.totalCents)) {
      fail(`order.created: totalCents must parse as an integer (got ${JSON.stringify(payload.totalCents)})`);
    }
  }

  if (topic === "payment.completed") {
    if (payload.outcome !== "APPROVED" && payload.outcome !== "DECLINED") {
      fail(`payment.completed: outcome must be APPROVED|DECLINED (got ${JSON.stringify(payload.outcome)})`);
    }
  }
});

if (failed) process.exit(1);
console.log("ok: topic payload schemas valid");
