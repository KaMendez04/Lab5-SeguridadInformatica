// Metricas de la app en dos salidas con los mismos nombres:
//  - prom-client: endpoint /metrics (formato Prometheus)
//  - OpenTelemetry: se exportan por OTLP a Grafana Cloud (si el SDK esta activo)
var client = require('prom-client');
var otel = require('@opentelemetry/api');

var registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: 'una_chat_' });

var meter = otel.metrics.getMeter('una-chat');

// limites de los histogramas de duracion, en milisegundos
var BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

// en OTel los contadores no llevan _total: Prometheus/Mimir lo agrega al importar
var prom = {
  requests: new client.Counter({
    name: 'una_chat_http_requests_total',
    help: 'Peticiones HTTP atendidas',
    labelNames: ['method', 'route', 'status'],
    registers: [registry]
  }),
  requestDuration: new client.Histogram({
    name: 'una_chat_http_request_duration_ms',
    help: 'Duracion de las peticiones HTTP (ms)',
    labelNames: ['method', 'route', 'status'],
    buckets: BUCKETS_MS,
    registers: [registry]
  }),
  messageDuration: new client.Histogram({
    name: 'una_chat_message_duration_ms',
    help: 'Duracion del procesamiento de un mensaje de chat (ms)',
    labelNames: ['resultado'],
    buckets: BUCKETS_MS,
    registers: [registry]
  }),
  messages: new client.Counter({
    name: 'una_chat_messages_total',
    help: 'Mensajes de chat difundidos',
    labelNames: ['tipo'],
    registers: [registry]
  }),
  connections: new client.Gauge({
    name: 'una_chat_socket_connections',
    help: 'Conexiones socket activas',
    registers: [registry]
  }),
  errors: new client.Counter({
    name: 'una_chat_errors_total',
    help: 'Errores de la aplicacion',
    labelNames: ['origen'],
    registers: [registry]
  }),
  rateLimited: new client.Counter({
    name: 'una_chat_rate_limited_total',
    help: 'Peticiones o mensajes bloqueados por rate limit',
    labelNames: ['canal'],
    registers: [registry]
  })
};

var o = {
  requests: meter.createCounter('una_chat_http_requests', { description: 'Peticiones HTTP atendidas' }),
  // sin "unit" para que Mimir conserve el nombre (con unit agregaria _milliseconds)
  requestDuration: meter.createHistogram('una_chat_http_request_duration_ms', {
    description: 'Duracion de las peticiones HTTP (ms)',
    advice: { explicitBucketBoundaries: BUCKETS_MS }
  }),
  messageDuration: meter.createHistogram('una_chat_message_duration_ms', {
    description: 'Duracion del procesamiento de un mensaje de chat (ms)',
    advice: { explicitBucketBoundaries: BUCKETS_MS }
  }),
  messages: meter.createCounter('una_chat_messages', { description: 'Mensajes de chat difundidos' }),
  connections: meter.createUpDownCounter('una_chat_socket_connections', { description: 'Conexiones socket activas' }),
  errors: meter.createCounter('una_chat_errors', { description: 'Errores de la aplicacion' }),
  rateLimited: meter.createCounter('una_chat_rate_limited', { description: 'Peticiones o mensajes bloqueados por rate limit' })
};

module.exports = {
  registry: registry,

  request: function (method, route, status, durationMs) {
    var labels = { method: method, route: route, status: String(status) };
    prom.requests.inc(labels);
    o.requests.add(1, labels);
    prom.requestDuration.observe(labels, durationMs);
    o.requestDuration.record(durationMs, labels);
  },

  // resultado: 'ok' o 'error'
  messageProcessed: function (resultado, durationMs) {
    prom.messageDuration.observe({ resultado: resultado }, durationMs);
    o.messageDuration.record(durationMs, { resultado: resultado });
  },

  message: function (tipo) {
    prom.messages.inc({ tipo: tipo });
    o.messages.add(1, { tipo: tipo });
  },

  connection: function (delta) {
    prom.connections.inc(delta);
    o.connections.add(delta);
  },

  error: function (origen) {
    prom.errors.inc({ origen: origen });
    o.errors.add(1, { origen: origen });
  },

  rateLimited: function (canal) {
    prom.rateLimited.inc({ canal: canal });
    o.rateLimited.add(1, { canal: canal });
  }
};
