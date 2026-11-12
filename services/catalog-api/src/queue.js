const Redis = require("ioredis");

const QUEUE = "orders:pending";

function createQueue() {
  const client = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    maxRetriesPerRequest: 3,
  });
  return {
    push: (msg) => client.lpush(QUEUE, JSON.stringify(msg)),
    depth: () => client.llen(QUEUE),
    ping: () => client.ping(),
  };
}

module.exports = { createQueue };