const SERVICE = process.env.SERVICE_NAME || "order-worker";

function log(level, message, extra = {}) {
  const { trace_id = null, ...rest } = extra;
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: SERVICE,
      message,
      trace_id,
      ...rest,
    })
  );
}

module.exports = {
  info: (m, e) => log("info", m, e),
  warn: (m, e) => log("warn", m, e),
  error: (m, e) => log("error", m, e),
};