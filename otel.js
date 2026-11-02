// Trazas, metricas y logs con OpenTelemetry exportados por OTLP (Grafana Cloud).
// Debe cargarse ANTES que todo lo demas (incluido Sentry y express).
//
// Se configura solo con variables de entorno estandar de OpenTelemetry:
//   OTEL_SERVICE_NAME (por defecto "una-chat"), OTEL_EXPORTER_OTLP_ENDPOINT,
//   OTEL_EXPORTER_OTLP_PROTOCOL, OTEL_RESOURCE_ATTRIBUTES (deployment.environment),
//   OTEL_EXPORTER_OTLP_HEADERS (credenciales: nunca en el repo),
//   OTEL_METRIC_EXPORT_INTERVAL (ms, opcional)
// Sin OTEL_EXPORTER_OTLP_ENDPOINT la app corre sin telemetria (asi en Render).

// .env local (ignorado por git). En Render no existe y se usan las variables del servicio.
try {
  process.loadEnvFile();
} catch {
  // sin .env: se usan solo las variables del proceso
}

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  var NodeSDK = require('@opentelemetry/sdk-node').NodeSDK;
  var getNodeAutoInstrumentations = require('@opentelemetry/auto-instrumentations-node').getNodeAutoInstrumentations;

  process.env.OTEL_SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'una-chat';

  // la exportacion OTLP no debe trazarse a si misma (spans que solo dicen /otlp)
  var gatewayHost = '';
  try {
    gatewayHost = new URL(process.env.OTEL_EXPORTER_OTLP_ENDPOINT).hostname;
  } catch {
    gatewayHost = '';
  }

  var sdk = new NodeSDK({
    instrumentations: [getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        ignoreOutgoingRequestHook: function (opciones) {
          return Boolean(gatewayHost) && opciones.hostname === gatewayHost;
        }
      },
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
