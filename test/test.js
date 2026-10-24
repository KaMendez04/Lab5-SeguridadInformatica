var val = require('../libs/unalib');
var assert = require('assert');

// Pruebas BDD: cada caso sigue el patron Dado-Cuando-Entonces (Given-When-Then).

describe('unalib', function(){

  describe('Funcionalidad: validacion de telefonos (is_valid_phone)', function(){

    it('Dado el telefono 8297-8547, cuando se valida, entonces debe ser aceptado', function(){
      // Dado
      var telefono = '8297-8547';
      // Cuando
      var resultado = val.is_valid_phone(telefono);
      // Entonces
      assert.strictEqual(resultado, true);
    });

    it('Dado el telefono con una letra 8297p-8547, cuando se valida, entonces debe ser rechazado', function(){
      // Dado
      var telefono = '8297p-8547';
      // Cuando
      var resultado = val.is_valid_phone(telefono);
      // Entonces
      assert.strictEqual(resultado, false);
    });

  });

  describe('Funcionalidad: validacion de URLs de imagen (is_valid_url_image)', function(){

    it('Dada una URL que termina en .jpg, cuando se valida, entonces debe reconocerse como imagen', function(){
      // Dado
      var url = 'http://image.com/image.jpg';
      // Cuando
      var resultado = val.is_valid_url_image(url);
      // Entonces
      assert.strictEqual(resultado, true);
    });

    it('Dada una URL que termina en .gif, cuando se valida, entonces debe reconocerse como imagen', function(){
      // Dado
      var url = 'http://image.com/image.gif';
      // Cuando
      var resultado = val.is_valid_url_image(url);
      // Entonces
      assert.strictEqual(resultado, true);
    });

    it('Dado un texto que no es URL, cuando se valida, entonces no debe reconocerse como imagen', function(){
      // Dado
      var texto = 'hola mundo';
      // Cuando
      var resultado = val.is_valid_url_image(texto);
      // Entonces
      assert.strictEqual(resultado, false);
    });

  });

  describe('Funcionalidad: validacion de videos de YouTube (is_valid_yt_video)', function(){

    it('Dado un enlace watch?v= de YouTube, cuando se valida, entonces debe reconocerse como video', function(){
      // Dado
      var url = 'https://www.youtube.com/watch?v=qYwlqx-JLok';
      // Cuando
      var resultado = val.is_valid_yt_video(url);
      // Entonces
      assert.strictEqual(resultado, true);
    });

    it('Dado un enlace de otro dominio, cuando se valida, entonces no debe reconocerse como video', function(){
      // Dado
      var url = 'https://www.example.com/watch?v=qYwlqx-JLok';
      // Cuando
      var resultado = val.is_valid_yt_video(url);
      // Entonces
      assert.strictEqual(resultado, false);
    });

  });

  describe('Funcionalidad: procesamiento de mensajes (validateMessage)', function(){

    it('Dado un mensaje de texto simple, cuando se procesa, entonces el texto se conserva', function(){
      // Dado
      var msg = JSON.stringify({ nombre: 'Ana', color: '#000', mensaje: 'hola' });
      // Cuando
      var resultado = JSON.parse(val.validateMessage(msg));
      // Entonces
      assert.strictEqual(resultado.mensaje, 'hola');
    });

    it('Dado un mensaje con URL de imagen, cuando se procesa, entonces se convierte en etiqueta img', function(){
      // Dado
      var msg = JSON.stringify({ nombre: 'Ana', color: '#000', mensaje: 'http://image.com/image.png' });
      // Cuando
      var resultado = JSON.parse(val.validateMessage(msg));
      // Entonces
      assert.strictEqual(resultado.tipo, 'imagen');
      assert.strictEqual(resultado.url, 'http://image.com/image.png');
      assert.ok(resultado.mensaje.indexOf('<img src="') === 0);
    });

    it('Dado un mensaje con enlace de YouTube, cuando se procesa, entonces se convierte en iframe embebido', function(){
      // Dado
      var msg = JSON.stringify({ nombre: 'Ana', color: '#000', mensaje: 'https://www.youtube.com/watch?v=qYwlqx-JLok' });
      // Cuando
      var resultado = JSON.parse(val.validateMessage(msg));
      // Entonces
      assert.strictEqual(resultado.tipo, 'video');
      assert.strictEqual(resultado.videoId, 'qYwlqx-JLok');
      assert.ok(resultado.mensaje.indexOf('https://www.youtube-nocookie.com/embed/qYwlqx-JLok') !== -1);
    });

    it('Dada una entrada vacia, cuando se procesa, entonces devuelve un mensaje vacio', function(){
      // Dado
      var msg = '';
      // Cuando
      var resultado = JSON.parse(val.validateMessage(msg));
      // Entonces
      assert.strictEqual(resultado.mensaje, '');
    });

    it('Dado un mensaje que no es JSON valido, cuando se procesa, entonces se descarta y devuelve un mensaje vacio', function(){
      // Dado
      var msg = '<script>alert(1)</script>';
      // Cuando
      var resultado = JSON.parse(val.validateMessage(msg));
      // Entonces
      assert.strictEqual(resultado.mensaje, '');
      assert.strictEqual(resultado.tipo, 'texto');
    });

    it('Dado un mensaje con solo espacios, cuando se procesa, entonces el mensaje queda vacio', function(){
      // Dado
      var msg = JSON.stringify({ nombre: 'Ana', color: '#000', mensaje: '    ' });
      // Cuando
      var resultado = JSON.parse(val.validateMessage(msg));
      // Entonces
      assert.strictEqual(resultado.mensaje, '');
    });

  });

  describe('Funcionalidad: mitigacion de XSS (OWASP A03)', function(){

    it('Dado un mensaje con un payload <script>alert("XSS")</script>, cuando se valida, entonces los tags quedan escapados y no hay HTML ejecutable', function(){
      // Dado
      var msg = JSON.stringify({ nombre: 'Ana', color: '#000', mensaje: '<script>alert("XSS")</script>' });
      // Cuando
      var resultado = JSON.parse(val.validateMessage(msg));
      // Entonces
      assert.strictEqual(resultado.tipo, 'texto');
      assert.ok(resultado.mensaje.indexOf('<') === -1);
      assert.strictEqual(resultado.mensaje, '&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
    });

    it('Dado un payload <img src=x onerror=alert(1)>, cuando se valida, entonces no se genera ninguna etiqueta img', function(){
      // Dado
      var msg = JSON.stringify({ nombre: 'Ana', color: '#000', mensaje: '<img src=x onerror=alert(1)>' });
      // Cuando
      var resultado = JSON.parse(val.validateMessage(msg));
      // Entonces
      assert.strictEqual(resultado.tipo, 'texto');
      assert.ok(resultado.mensaje.indexOf('<img') === -1);
    });

    it('Dado un nombre de usuario con HTML, cuando se valida, entonces el nombre queda escapado', function(){
      // Dado
      var msg = JSON.stringify({ nombre: '<b onmouseover=alert(1)>Eva</b>', color: '#000', mensaje: 'hola' });
      // Cuando
      var resultado = JSON.parse(val.validateMessage(msg));
      // Entonces
      assert.ok(resultado.nombre.indexOf('<') === -1);
      assert.ok(resultado.nombre.indexOf('&lt;b') === 0);
    });

    it('Dado un color con inyeccion de CSS/HTML, cuando se valida, entonces se reemplaza por el color por defecto', function(){
      // Dado
      var msg = JSON.stringify({ nombre: 'Ana', color: "red'><script>alert(1)</script>", mensaje: 'hola' });
      // Cuando
      var resultado = JSON.parse(val.validateMessage(msg));
      // Entonces
      assert.strictEqual(resultado.color, '#000000');
    });

    it('Dada una URL de imagen con comillas para romper el atributo, cuando se valida, entonces no se trata como imagen', function(){
      // Dado
      var msg = JSON.stringify({ nombre: 'Ana', color: '#000', mensaje: 'http://x.com/a.png" onerror="alert(1)' });
      // Cuando
      var resultado = JSON.parse(val.validateMessage(msg));
      // Entonces
      assert.strictEqual(resultado.tipo, 'texto');
      assert.ok(resultado.mensaje.indexOf('"') === -1);
    });

    it('Dada una URL javascript: con extension de imagen, cuando se valida, entonces no se acepta como imagen', function(){
      // Dado
      var url = 'javascript:alert(1)//a.png';
      // Cuando
      var resultado = val.is_valid_url_image(url);
      // Entonces
      assert.strictEqual(resultado, false);
    });

    it('Dado un enlace de YouTube con un ID manipulado, cuando se valida, entonces no se genera iframe', function(){
      // Dado
      var msg = JSON.stringify({ nombre: 'Ana', color: '#000', mensaje: 'https://www.youtube.com/watch?v="><script>alert(1)</script>' });
      // Cuando
      var resultado = JSON.parse(val.validateMessage(msg));
      // Entonces
      assert.strictEqual(resultado.tipo, 'texto');
      assert.ok(resultado.mensaje.indexOf('<iframe') === -1);
    });

    it('Dado un mensaje mas largo que el limite, cuando se valida, entonces se recorta a 500 caracteres', function(){
      // Dado
      var msg = JSON.stringify({ nombre: 'Ana', color: '#000', mensaje: new Array(2001).join('a') });
      // Cuando
      var resultado = JSON.parse(val.validateMessage(msg));
      // Entonces
      assert.strictEqual(resultado.mensaje.length, 500);
    });

  });

});
