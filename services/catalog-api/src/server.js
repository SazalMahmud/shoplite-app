const { createApp } = require("./app");
const db = require("./db");
const { createQueue } = require("./queue");
const logger = require("./logger");

async function main() {
  await db.init();
  const app = createApp({ db: db.pool, queue: createQueue() });
  const port = parseInt(process.env.PORT || "3000", 10);
  const server = app.listen(port, () => logger.info(`listening on ${port}`));

  process.on("SIGTERM", () => {
    logger.info("SIGTERM received, shutting down");
    server.close(() => process.exit(0));
  });
}

main().catch((e) => {
  logger.error("startup failed", { error: e.message });
  process.exit(1);
});