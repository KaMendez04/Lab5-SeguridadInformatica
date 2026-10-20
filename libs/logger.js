// Logs estructurados en JSON (stdout). Con OpenTelemetry activo, la
// instrumentacion de pino agrega trace_id/span_id y los envia por OTLP.
var pino = require('pino');

module.exports = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: process.env.OTEL_SERVICE_NAME || 'una-chat' },
  // nunca registrar credenciales aunque lleguen en cabeceras
  redact: ['req.headers.authorization', 'req.headers.cookie']
});
