// Trazas, metricas y logs con OpenTelemetry exportados por OTLP (Grafana Cloud).
// Debe cargarse ANTES que express/http para que la auto-instrumentacion funcione.
//
// Se configura solo con variables de entorno estandar de OpenTelemetry:
//   OTEL_SERVICE_NAME, OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_PROTOCOL,
//   OTEL_EXPORTER_OTLP_HEADERS (credenciales: nunca en el repo),
//   OTEL_METRIC_EXPORT_INTERVAL (ms, opcional)
// Sin OTEL_EXPORTER_OTLP_ENDPOINT la app corre sin telemetria.

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  var NodeSDK = require('@opentelemetry/sdk-node').NodeSDK;
  var getNodeAutoInstrumentations = require('@opentelemetry/auto-instrumentations-node').getNodeAutoInstrumentations;

  var sdk = new NodeSDK({
    instrumentations: [getNodeAutoInstrumentations({
      // ruido sin valor para esta app
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
      '@opentelemetry/instrumentation-net': { enabled: false }
    })]
  });

  sdk.start();

  process.on('SIGTERM', function () {
    sdk.shutdown().finally(function () { process.exit(0); });
  });
}
