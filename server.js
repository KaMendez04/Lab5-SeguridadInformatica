
// npm install para descargar los paquetes...

// librerias
var path = require('path');
var express = require('express');
var helmet = require('helmet');
var rateLimit = require('express-rate-limit').rateLimit;
var validation = require('./libs/unalib');

// No hay sesiones ni cookies ni rutas HTTP que cambien estado (solo GET de
// archivos), por lo que no aplica un token CSRF. El vector equivalente en
// websockets (Cross-Site WebSocket Hijacking) se mitiga validando el Origin.
var app = express(); // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage
var http = require('http').Server(app);
var port = process.env.PORT || 3000;

// solo se aceptan conexiones socket desde el mismo host que sirve la pagina
function origenPermitido(req, callback) {
  var origin = req.headers.origin;
  var permitido = false;
  try {
    permitido = !origin || new URL(origin).host === req.headers.host;
  } catch {
    permitido = false;
  }
  callback(null, permitido);
}

var io = require('socket.io')(http, {
  maxHttpBufferSize: 1e4, // mensajes de hasta 10 KB
  allowRequest: origenPermitido
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

// limita las peticiones HTTP por IP (mitiga abuso / DoS)
app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false
}));

// archivos estaticos del cliente (chat.js, chat.css)
app.use(express.static(path.join(__dirname, 'public')));

// root: presentar html
app.get('/', function(req, res){
  res.sendFile(path.join(__dirname, 'index.html'));
});

// maximo de mensajes por socket en una ventana de tiempo
var MAX_MENSAJES = 20;
var VENTANA_MS = 10 * 1000;

// escuchar una conexion por socket
io.on('connection', function(socket){
  var ventanaInicio = Date.now();
  var mensajesEnVentana = 0;

  // si se escucha "chat message"
  socket.on('Evento-Mensaje-Server', function(msg){
    var ahora = Date.now();
    if (ahora - ventanaInicio > VENTANA_MS) {
      ventanaInicio = ahora;
      mensajesEnVentana = 0;
    }
    mensajesEnVentana++;
    if (mensajesEnVentana > MAX_MENSAJES) {
      return; // se descarta el mensaje por exceso de tasa
    }

    msg = validation.validateMessage(msg);
    // volvemos a emitir el mensaje ya sanitizado
    io.emit('Evento-Mensaje-Server', msg);
  });
});

http.listen(port, function(){
  console.log('listening on *:' + port);
});
