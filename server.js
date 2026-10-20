// OpenTelemetry primero: debe instrumentar http/express antes de que se carguen
require('./instrumentation');

// npm install para descargar los paquetes...

// librerias
var path = require('path');
var express = require('express');
var helmet = require('helmet');
var rateLimit = require('express-rate-limit').rateLimit;
var validation = require('./libs/unalib');
var logger = require('./libs/logger');
var metrics = require('./libs/metrics');

// No hay sesiones ni cookies ni rutas HTTP que cambien estado (solo GET de
// archivos), por lo que no aplica un token CSRF. El vector equivalente en
// websockets (Cross-Site WebSocket Hijacking) se mitiga validando el Origin.
var app = express(); // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage
var http = require('http').Server(app);
var port = process.env.PORT || 3000;
var version = process.env.APP_VERSION || 'dev';

// detras de un proxy (Render) la IP real viene en X-Forwarded-For; sin esto
// el rate limit trataria a todos los clientes como una sola IP
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY));
}

// solo se aceptan conexiones socket desde el mismo host que sirve la pagina
function origenPermitido(req, callback) {
  var origin = req.headers.origin;
  var permitido = false;
  try {
    permitido = !origin || new URL(origin).host === req.headers.host;
  } catch {
    permitido = false;
  }
  if (!permitido) {
    logger.warn({ origin: origin }, 'conexion socket rechazada por Origin');
  }
  callback(null, permitido);
}

var io = require('socket.io')(http, {
  maxHttpBufferSize: 1e4, // mensajes de hasta 10 KB
  allowRequest: origenPermitido
});

// metrica por peticion; la ruta se agrupa para no crear una serie por URL
app.use(function(req, res, next){
  res.on('finish', function(){
    var route = req.route ? req.route.path : (res.statusCode === 404 ? 'no-encontrada' : 'estatico');
    metrics.request(req.method, route, res.statusCode);
    if (res.statusCode >= 400) {
      logger.warn({ method: req.method, url: req.originalUrl, status: res.statusCode, ip: req.ip }, 'respuesta de error');
    }
  });
  next();
});

// cabeceras de seguridad + CSP: solo scripts/estilos propios, imagenes externas
// y videos embebidos desde youtube-nocookie
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'https:', 'http:', 'data:'],
      frameSrc: ['https://www.youtube-nocookie.com'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
}));

// hallazgo de Nuclei (F4): la app no usa APIs sensibles del navegador
app.use(function(req, res, next){
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  next();
});

// estado y version desplegada (lo usa el pipeline para esperar el deploy)
app.get('/healthz', function(req, res){
  res.json({ status: 'ok', version: version });
});

// limita las peticiones HTTP por IP (mitiga abuso / DoS)
app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: function(req, res, next, options){
    metrics.rateLimited('http');
    res.status(options.statusCode).send(options.message);
  }
}));

// metricas Prometheus. En produccion solo con METRICS_TOKEN (Bearer): exponerlas
// abiertas revela informacion interna del servicio
app.get('/metrics', function(req, res){
  var token = process.env.METRICS_TOKEN;
  if (token ? req.get('authorization') !== 'Bearer ' + token : process.env.NODE_ENV === 'production') {
    return res.status(404).send('Not Found');
  }
  metrics.registry.metrics().then(function(cuerpo){
    res.set('Content-Type', metrics.registry.contentType);
    res.send(cuerpo);
  });
});

// archivos estaticos del cliente (chat.js, chat.css)
app.use(express.static(path.join(__dirname, 'public')));

// root: presentar html
app.get('/', function(req, res){
  res.sendFile(path.join(__dirname, 'index.html'));
});

// errores no controlados: se registran sin filtrar detalles al cliente
app.use(function(err, req, res, next){ // eslint-disable-line no-unused-vars
  metrics.error('http');
  logger.error({ err: err, url: req.originalUrl }, 'error no controlado');
  res.status(500).send('Error interno');
});

// maximo de mensajes por socket en una ventana de tiempo
var MAX_MENSAJES = 20;
var VENTANA_MS = 10 * 1000;

// escuchar una conexion por socket
io.on('connection', function(socket){
  var ventanaInicio = Date.now();
  var mensajesEnVentana = 0;
  metrics.connection(1);
  socket.on('disconnect', function(){
    metrics.connection(-1);
  });

  // si se escucha "chat message"
  socket.on('Evento-Mensaje-Server', function(msg){
    var ahora = Date.now();
    if (ahora - ventanaInicio > VENTANA_MS) {
      ventanaInicio = ahora;
      mensajesEnVentana = 0;
    }
    mensajesEnVentana++;
    if (mensajesEnVentana > MAX_MENSAJES) {
      metrics.rateLimited('socket');
      if (mensajesEnVentana === MAX_MENSAJES + 1) {
        logger.warn({ socket: socket.id }, 'socket excede el limite de mensajes');
      }
      return; // se descarta el mensaje por exceso de tasa
    }

    try {
      msg = validation.validateMessage(msg);
      metrics.message(JSON.parse(msg).tipo);
      // volvemos a emitir el mensaje ya sanitizado
      io.emit('Evento-Mensaje-Server', msg);
    } catch (err) {
      metrics.error('socket');
      logger.error({ err: err }, 'error procesando mensaje');
    }
  });
});

http.listen(port, function(){
  logger.info({ port: port, version: version }, 'UNA-chat escuchando');
});
