// modulo de validacion y sanitizacion de mensajes del chat.

// Limites de longitud para evitar abuso de memoria / mensajes gigantes
var MAX_NOMBRE = 30;
var MAX_MENSAJE = 500;
var COLOR_POR_DEFECTO = '#000000';

// Caracteres HTML que se codifican (AGENTS.md, seccion de sanitizacion)
var HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;'
};

module.exports = {

    // codifica los caracteres especiales HTML de cualquier texto no confiable
    escapeHtml: function (texto) {
      return String(texto).replace(/[&<>"'/]/g, function (c) {
        return HTML_ESCAPES[c];
      });
    },

    // logica que valida si un telefono esta correcto...
    is_valid_phone: function (phone) {
      // inicializacion lazy
      var isValid = false;
      // expresion regular copiada de StackOverflow
      var re = /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/i;

      // validacion Regex
      try {
        isValid = re.test(phone);
      } catch (e) {
        console.log(e);
      } finally {
          return isValid;
      }
      // fin del try-catch block
    },

    // lista blanca: solo http(s), sin espacios ni caracteres que rompan atributos,
    // terminando en una extension de imagen
    is_valid_url_image: function (url) {
      if (typeof url !== 'string' || url.length > MAX_MENSAJE) {
        return false;
      }
      var re = /^https?:\/\/[^\s"'<>`]+\.(?:jpg|gif|png|jpeg|bmp|webp)$/i;
      return re.test(url);
    },

    // lista blanca: solo youtube.com / youtu.be con un ID de 11 caracteres [A-Za-z0-9_-]
    is_valid_yt_video: function (url) {
      return this.getYTVideoId(url) !== null;
    },

    // devuelve el ID del video o null si la URL no es de YouTube
    getYTVideoId: function (url) {
      if (typeof url !== 'string' || url.length > MAX_MENSAJE) {
        return null;
      }
      var re = /^(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([\w-]{11})(?:[?&][^\s"'<>`]*)?$/i;
      var match = url.match(re);
      return match ? match[1] : null;
    },

    getEmbeddedCode: function (url) {
      var id = this.getYTVideoId(url);
      if (id === null) {
        return '';
      }
      return '<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/' + id +
        '" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
    },

    // la URL ya paso la lista blanca, igual se escapa para no romper el atributo
    getImageTag: function (url) {
      return '<img src="' + this.escapeHtml(url) + '" style="max-height: 400px;max-width: 400px;">';
    },

    // solo colores hexadecimales (#rgb o #rrggbb); cualquier otra cosa usa el color por defecto
    sanitizeColor: function (color) {
      return (typeof color === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) ? color : COLOR_POR_DEFECTO;
    },

    // Procesa el mensaje recibido por socket y devuelve un JSON seguro:
    //   tipo: 'texto' | 'imagen' | 'video'
    //   nombre / mensaje: texto con HTML escapado
    //   url (imagen) / videoId (video): solo valores que pasaron la lista blanca
    validateMessage: function (msg) {
      var vacio = JSON.stringify({ nombre: '', color: COLOR_POR_DEFECTO, tipo: 'texto', mensaje: '' });

      if (!msg || typeof msg !== 'string') {
        return vacio;
      }

      var obj;
      try {
        obj = JSON.parse(msg);
      } catch {
        console.log('Mensaje con JSON invalido descartado');
        return vacio;
      }
      if (!obj || typeof obj !== 'object') {
        return vacio;
      }

      var nombre = String(obj.nombre || 'Anonimo').trim().slice(0, MAX_NOMBRE);
      var texto = String(obj.mensaje || '').trim().slice(0, MAX_MENSAJE);
      var salida = {
        nombre: this.escapeHtml(nombre),
        color: this.sanitizeColor(obj.color),
        tipo: 'texto',
        mensaje: this.escapeHtml(texto)
      };

      if (this.is_valid_url_image(texto)) {
        salida.tipo = 'imagen';
        salida.url = texto;
        salida.mensaje = this.getImageTag(texto);
      } else if (this.is_valid_yt_video(texto)) {
        salida.tipo = 'video';
        salida.videoId = this.getYTVideoId(texto);
        salida.mensaje = this.getEmbeddedCode(texto);
      }

      return JSON.stringify(salida);
    }

  // fin del modulo
  };
