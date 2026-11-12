const http = require("http");
const { Pool } = require("pg");
const Redis = require("ioredis");
const client = require("prom-client");
const logger = require("./logger");

const QUEUE = "orders:pending";

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  user: process.env.DB_USER || "shoplite",
  password: process.env.DB_PASSWORD || "shoplite",
  database: process.env.DB_NAME || "shoplite",
});

// Separate connections: BRPOP blocks its connection, so depth checks need their own.
const redisOpts = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
};
const popClient = new Redis(redisOpts);
const statClient = new Redis(redisOpts);

// ---- Metrics ----
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const processed = new client.Counter({
  name: "orders_processed_total",
  help: "Orders processed",
  labelNames: ["result"],
  registers: [register],
});
const processingSeconds = new client.Histogram({
  name: "order_processing_seconds",
  help: "Order processing time",
  buckets: [0.1, 0.5, 1, 1.5, 2, 3, 5, 10],
  registers: [register],
});
new client.Gauge({
  name: "order_queue_depth",
  help: "Pending orders in queue",
  registers: [register],
  async collect() {
    try {
      this.set(await statClient.llen(QUEUE));
    } catch (e) {
      /* ignore */
    }
  },
});

// ---- Chaos flags ----
const leak = []; // CHAOS_MEMORY_LEAK: grows forever when enabled
const chaosLeak = () => process.env.CHAOS_MEMORY_LEAK === "true";
const chaosSlowDb = () => process.env.CHAOS_SLOW_DB === "true";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let shuttingDown = false;
let busy = false;

async function processOrder(msg) {
  const { order_id, trace_id } = msg;
  const end = processingSeconds.startTimer();
  try {
    await pool.query("UPDATE orders SET status='PROCESSING' WHERE id=$1", [order_id]);
    logger.info("processing order", { trace_id, order_id });

    await sleep(1000 + Math.random() * 1000); // simulate 1-2s of work

    if (chaosSlowDb()) await pool.query("SELECT pg_sleep(2)");
    await pool.query(
      "UPDATE orders SET status='COMPLETED', completed_at=now() WHERE id=$1",
      [order_id]
    );

    if (chaosLeak()) leak.push({ order_id, payload: Buffer.alloc(1024 * 1024, "x") });

    processed.inc({ result: "success" });
    logger.info("order completed", { trace_id, order_id });
  } catch (e) {
    processed.inc({ result: "failed" });
    logger.error("order failed", { trace_id, order_id, error: e.message });
    try {
      await pool.query("UPDATE orders SET status='FAILED' WHERE id=$1", [order_id]);
    } catch (e2) {
      /* ignore */
    }
  } finally {
    end();
  }
}

async function loop() {
  while (!shuttingDown) {
    try {
      const res = await popClient.brpop(QUEUE, 2); // 2s timeout so we can check shuttingDown
      if (!res) continue;
      busy = true;
      await processOrder(JSON.parse(res[1]));
      busy = false;
    } catch (e) {
      busy = false;
      if (shuttingDown) break;
      logger.error("loop error", { error: e.message });
      await sleep(1000);
    }
  }
  logger.info("worker loop stopped");
  await pool.end().catch(() => {});
  popClient.disconnect();
  statClient.disconnect();
  process.exit(0);
}

// ---- Metrics/health server (worker has no HTTP API otherwise) ----
const server = http.createServer(async (req, res) => {
  if (req.url === "/metrics") {
    res.setHeader("Content-Type", register.contentType);
    return res.end(await register.metrics());
  }
  if (req.url === "/healthz") {
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ status: "ok" }));
  }
  res.statusCode = 404;
  res.end();
});
server.listen(parseInt(process.env.METRICS_PORT || "9100", 10));

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, finishing current order then exiting", { busy });
  shuttingDown = true;
  server.close();
});

logger.info("worker started");
loop();