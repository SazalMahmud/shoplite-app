const { test } = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const { createApp } = require("../src/app");

function makeApp(overrides = {}) {
  const pushed = [];
  const db = {
    query: async (sql, params) => {
      if (sql.includes("FROM products ORDER BY"))
        return { rows: [{ id: 1, name: "Mouse", price: 10, stock: 5 }] };
      if (sql.includes("FROM products WHERE id=$1") || sql.includes("SELECT id FROM products"))
        return params[0] === 1 ? { rows: [{ id: 1, name: "Mouse", price: 10, stock: 5 }] } : { rows: [] };
      if (sql.includes("INSERT INTO orders")) return { rows: [{ id: 42 }] };
      if (sql.includes("FROM orders WHERE id=$1"))
        return params[0] === 42 ? { rows: [{ id: 42, status: "PENDING" }] } : { rows: [] };
      return { rows: [{}] };
    },
    ...overrides,
  };
  const queue = { push: async (m) => pushed.push(m), depth: async () => 0, ping: async () => "PONG" };
  return { app: createApp({ db, queue }), pushed };
}

test("GET /products returns list", async () => {
  const { app } = makeApp();
  const res = await request(app).get("/products");
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.length, 1);
});

test("GET /products/:id returns 404 for unknown", async () => {
  const { app } = makeApp();
  const res = await request(app).get("/products/999");
  assert.strictEqual(res.status, 404);
});

test("POST /orders returns 201 and enqueues", async () => {
  const { app, pushed } = makeApp();
  const res = await request(app).post("/orders").send({ product_id: 1, quantity: 2 });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.id, 42);
  assert.strictEqual(pushed.length, 1);
});

test("POST /orders rejects invalid body", async () => {
  const { app } = makeApp();
  const res = await request(app).post("/orders").send({ product_id: "x" });
  assert.strictEqual(res.status, 400);
});

test("GET /orders/:id returns 404 when missing", async () => {
  const { app } = makeApp();
  const res = await request(app).get("/orders/1");
  assert.strictEqual(res.status, 404);
});

test("GET /healthz and /metrics work", async () => {
  const { app } = makeApp();
  assert.strictEqual((await request(app).get("/healthz")).status, 200);
  const m = await request(app).get("/metrics");
  assert.strictEqual(m.status, 200);
  assert.match(m.text, /http_requests_total/);
});