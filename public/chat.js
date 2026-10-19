/* global io */
// Cliente del chat. Nunca inserta HTML recibido: construye los nodos con
// createElement + textContent, y solo crea <img>/<iframe> con URLs que el
// servidor ya valido (y que aqui se vuelven a comprobar).

(function () {
  var colorHexTxt = '';

  // genera colores aleatorios en hexadecimal
  function getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  // el servidor envia el texto con HTML escapado; DOMParser lo decodifica
  // sin ejecutar scripts y el resultado se usa solo como textContent
  function decodificar(texto) {
    var doc = new DOMParser().parseFromString(String(texto), 'text/html');
    return doc.documentElement.textContent;
  }

  function crearContenido(msg) {
    if (msg.tipo === 'imagen' && /^https?:\/\//i.test(msg.url)) {
      var img = document.createElement('img');
      img.src = msg.url;
      img.alt = 'imagen compartida';
      return img;
    }
    if (msg.tipo === 'video' && /^[\w-]{11}$/.test(msg.videoId)) {
      var iframe = document.createElement('iframe');
      iframe.width = '560';
      iframe.height = '315';
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + msg.videoId;
      iframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      return iframe;
    }
    return document.createTextNode(decodificar(msg.mensaje));
  }

  var socket = io();
  var form = document.getElementById('form');
  var inputNombre = document.getElementById('nombre');
  var inputMensaje = document.getElementById('m');
  var lista = document.getElementById('messages');

  // emite evento al servidor
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (colorHexTxt === '') {
      colorHexTxt = getRandomColor();
    }
    var jsonMsg = {
      nombre: inputNombre.value || 'Anonimo',
      mensaje: inputMensaje.value,
      color: colorHexTxt
    };
    socket.emit('Evento-Mensaje-Server', JSON.stringify(jsonMsg));
    inputMensaje.value = '';
  });

  socket.on('Evento-Mensaje-Server', function (raw) {
    var msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    var li = document.createElement('li');
    var nombre = document.createElement('b');
    nombre.textContent = decodificar(msg.nombre);
    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(msg.color)) {
      nombre.style.color = msg.color;
    }
    li.appendChild(nombre);
    li.appendChild(document.createTextNode(': '));
    li.appendChild(crearContenido(msg));
    lista.appendChild(li);
    window.scrollTo(0, document.body.scrollHeight);
  });
})();
