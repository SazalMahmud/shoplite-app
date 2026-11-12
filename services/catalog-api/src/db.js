const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  user: process.env.DB_USER || "shoplite",
  password: process.env.DB_PASSWORD || "shoplite",
  database: process.env.DB_NAME || "shoplite",
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function init() {
  for (let i = 0; i < 30; i++) {
    try {
      await pool.query("SELECT 1");
      break;
    } catch (e) {
      if (i === 29) throw e;
      await sleep(2000);
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      price NUMERIC(10,2) NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ
    );
  `);

  const { rows } = await pool.query("SELECT COUNT(*)::int AS c FROM products");
  if (rows[0].c === 0) {
    await pool.query(`
      INSERT INTO products (name, price, stock) VALUES
      ('Wireless Mouse', 15.99, 100),
      ('Mechanical Keyboard', 59.90, 50),
      ('USB-C Hub', 29.50, 80),
      ('27" Monitor', 189.00, 25),
      ('Laptop Stand', 24.99, 60),
      ('Webcam HD', 39.95, 70),
      ('Headphones', 79.00, 40),
      ('External SSD 1TB', 99.99, 35),
      ('Desk Lamp', 19.49, 90),
      ('Phone Charger', 12.99, 200),
      ('Bluetooth Speaker', 45.00, 55),
      ('Gaming Chair', 149.00, 15)
    `);
  }
}

module.exports = { pool, init };