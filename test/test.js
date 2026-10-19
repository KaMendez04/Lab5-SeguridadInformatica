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
      assert.ok(resultado.mensaje.indexOf('<img src="http://image.com/image.png"') === 0);
    });

    it('Dado un mensaje con enlace de YouTube, cuando se procesa, entonces se convierte en iframe embebido', function(){
      // Dado
      var msg = JSON.stringify({ nombre: 'Ana', color: '#000', mensaje: 'https://www.youtube.com/watch?v=qYwlqx-JLok' });
      // Cuando
      var resultado = JSON.parse(val.validateMessage(msg));
      // Entonces
      assert.ok(resultado.mensaje.indexOf('https://www.youtube.com/embed/qYwlqx-JLok') !== -1);
    });

    it('Dada una entrada vacia, cuando se procesa, entonces devuelve un mensaje vacio', function(){
      // Dado
      var msg = '';
      // Cuando
      var resultado = JSON.parse(val.validateMessage(msg));
      // Entonces
      assert.strictEqual(resultado.mensaje, '');
    });

  });

});
