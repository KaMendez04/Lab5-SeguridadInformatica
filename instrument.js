// Sentry: errores y trazas del servidor. Debe cargarse ANTES que express/http.
//
// Se configura solo con variables de entorno (el DSN nunca va en el codigo):
//   SENTRY_DSN          DSN del proyecto; sin el, Sentry queda apagado
//   SENTRY_ENVIRONMENT  ambiente (por defecto "production")
//   SENTRY_RELEASE      version; en Render se usa el commit desplegado
//   SENTRY_TRACES_SAMPLE_RATE  fraccion de trazas (opcional)
var Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  var produccion = process.env.NODE_ENV === 'production';

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || 'production',
    release: process.env.SENTRY_RELEASE || process.env.RENDER_GIT_COMMIT,
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE
      ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
      : (produccion ? 0.1 : 1.0),
    // los chequeos de disponibilidad (Cronitor cada minuto) no son trazas utiles
    // (en v11 se filtra con ignoreSpans; ignoreTransactions ya no aplica)
    ignoreSpans: [/^GET \/(health|healthz|metrics)$/]
    // Sin dataCollection ni includeLocalVariables: el SDK queda en modo
    // conservador y no envia IPs, cookies, cuerpos ni el texto de los mensajes.
  });
}

module.exports = Sentry;
