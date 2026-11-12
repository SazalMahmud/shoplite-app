const express = require("express");
const crypto = require("crypto");
const client = require("prom-client");
const logger = require("./logger");

function createApp({ db, queue }) {
  const app = express();
  app.use(express.json());

  const register = new client.Registry();
  client.collectDefaultMetrics({ register });

  const httpRequests = new client.Counter({
    name: "http_requests_total",
    help: "Total HTTP requests",
    labelNames: ["method", "route", "status"],
    registers: [register],
  });
  const httpDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration",
    labelNames: ["method", "route"],
    buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [register],
  });
  const ordersCreated = new client.Counter({
    name: "orders_created_total",
    help: "Orders created",
    registers: [register],
  });
  new client.Gauge({
    name: "order_queue_depth",
    help: "Pending orders in queue",
    registers: [register],
    async collect() {
      try {
        this.set(await queue.depth());
      } catch (e) {
        /* ignore */
      }
    },
  });

  // trace_id + metrics middleware
  app.use((req, res, next) => {
    req.traceId = req.headers["x-trace-id"] || crypto.randomBytes(16).toString("hex");
    res.setHeader("x-trace-id", req.traceId);
    const end = httpDuration.startTimer();
    res.on("finish", () => {
      const route = req.route ? req.baseUrl + req.route.path : "unmatched";
      httpRequests.inc({ method: req.method, route, status: res.statusCode });
      end({ method: req.method, route });
      if (route !== "/metrics" && route !== "/healthz") {
        logger.info("request", {
          trace_id: req.traceId,
          method: req.method,
          route,
          status: res.statusCode,
        });
      }
    });
    next();
  });

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const wrap = (fn) => (req, res) =>
    fn(req, res).catch((e) => {
      logger.error("unhandled error", { trace_id: req.traceId, error: e.message });
      res.status(500).json({ error: "internal error" });
    });

  app.get("/healthz", (req, res) => res.json({ status: "ok" }));

  app.get(
    "/readyz",
    wrap(async (req, res) => {
      try {
        await db.query("SELECT 1");
        await queue.ping();
        res.json({ status: "ready" });
      } catch (e) {
        res.status(503).json({ status: "not ready", error: e.message });
      }
    })
  );

  app.get(
    "/products",
    wrap(async (req, res) => {
      const { rows } = await db.query(
        "SELECT id, name, price::float AS price, stock FROM products ORDER BY id"
      );
      res.json(rows);
    })
  );

  app.get(
    "/products/:id",
    wrap(async (req, res) => {
      const latency = parseInt(process.env.CHAOS_LATENCY_MS || "0", 10);
      if (latency > 0 && Math.random() < 0.3) await sleep(latency);

      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) return res.status(404).json({ error: "not found" });
      const { rows } = await db.query(
        "SELECT id, name, price::float AS price, stock FROM products WHERE id=$1",
        [id]
      );
      if (rows.length === 0) return res.status(404).json({ error: "not found" });
      res.json(rows[0]);
    })
  );

  app.post(
    "/orders",
    wrap(async (req, res) => {
      const errRate = parseFloat(process.env.CHAOS_ERROR_RATE || "0");
      if (errRate > 0 && Math.random() < errRate) {
        logger.error("chaos error injected", { trace_id: req.traceId });
        return res.status(500).json({ error: "internal error" });
      }

      const { product_id, quantity } = req.body || {};
      if (!Number.isInteger(product_id) || !Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ error: "invalid product_id or quantity" });
      }
      const p = await db.query("SELECT id FROM products WHERE id=$1", [product_id]);
      if (p.rows.length === 0) return res.status(404).json({ error: "product not found" });

      const { rows } = await db.query(
        "INSERT INTO orders (product_id, quantity, status) VALUES ($1,$2,'PENDING') RETURNING id",
        [product_id, quantity]
      );
      const orderId = rows[0].id;
      await queue.push({ order_id: orderId, trace_id: req.traceId });
      ordersCreated.inc();
      logger.info("order created", { trace_id: req.traceId, order_id: orderId });
      res.status(201).json({ id: orderId, status: "PENDING" });
    })
  );

  app.get(
    "/orders/:id",
    wrap(async (req, res) => {
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) return res.status(404).json({ error: "not found" });
      const { rows } = await db.query(
        "SELECT id, product_id, quantity, status, created_at, completed_at FROM orders WHERE id=$1",
        [id]
      );
      if (rows.length === 0) return res.status(404).json({ error: "not found" });
      res.json(rows[0]);
    })
  );

  app.get("/metrics", async (req, res) => {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  });

  return app;
}

module.exports = { createApp };