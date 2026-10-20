// Pruebas E2E BDD (Dado-Cuando-Entonces) del chat en un navegador real.
// Cada prueba usa un nombre unico porque los mensajes se difunden a todos los
// clientes conectados (la app desplegada puede tener otros usuarios).
const { test, expect } = require('@playwright/test');

function nombreUnico(prefijo) {
  return prefijo + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

async function abrirChat(page, nombre) {
  await page.goto('/');
  await expect(page.locator('#form')).toBeVisible();
  await page.fill('#nombre', nombre);
}

async function enviar(page, texto) {
  await page.fill('#m', texto);
  await page.press('#m', 'Enter');
}

function mensajeDe(page, nombre) {
  return page.locator('#messages li', { has: page.locator('b', { hasText: nombre }) });
}

test.describe('Funcionalidad: chat en tiempo real', () => {

  test('Dado un usuario que abre el chat, cuando carga la pagina, entonces ve el formulario y la CSP restrictiva', async ({ page }) => {
    // Dado / Cuando
    const respuesta = await page.goto('/');
    // Entonces
    await expect(page).toHaveTitle('Chat Socket.IO UNA');
    await expect(page.locator('#nombre')).toBeVisible();
    await expect(page.locator('#m')).toBeVisible();
    expect(respuesta.headers()['content-security-policy']).toContain("script-src 'self'");
  });

  test('Dado un usuario en el chat, cuando envia un texto, entonces el mensaje aparece en la lista', async ({ page }) => {
    // Dado
    const nombre = nombreUnico('texto');
    await abrirChat(page, nombre);
    // Cuando
    await enviar(page, 'hola desde Playwright');
    // Entonces
    await expect(mensajeDe(page, nombre)).toContainText('hola desde Playwright');
  });

  test('Dado un usuario en el chat, cuando envia una URL de imagen, entonces se muestra un elemento img con esa URL', async ({ page }) => {
    // Dado
    const nombre = nombreUnico('imagen');
    const url = 'https://picsum.photos/id/237/200/200.jpg';
    await abrirChat(page, nombre);
    // Cuando
    await enviar(page, url);
    // Entonces
    const img = mensajeDe(page, nombre).locator('img');
    await expect(img).toHaveCount(1);
    await expect(img).toHaveAttribute('src', url);
  });

  test('Dado un usuario en el chat, cuando envia un enlace de YouTube, entonces se embebe un iframe de youtube-nocookie', async ({ page }) => {
    // Dado
    const nombre = nombreUnico('video');
    await abrirChat(page, nombre);
    // Cuando
    await enviar(page, 'https://www.youtube.com/watch?v=qYwlqx-JLok');
    // Entonces
    const iframe = mensajeDe(page, nombre).locator('iframe');
    await expect(iframe).toHaveCount(1);
    await expect(iframe).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/qYwlqx-JLok');
  });

});

test.describe('Funcionalidad: mitigacion de XSS en el navegador (OWASP A03)', () => {

  const payloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    '"><iframe src=javascript:alert(1)>'
  ];

  for (const payload of payloads) {
    test(`Dado un atacante en el chat, cuando envia ${payload}, entonces se muestra como texto y no se ejecuta`, async ({ page }) => {
      // Dado
      let alertaEjecutada = false;
      page.on('dialog', async (dialog) => {
        alertaEjecutada = true;
        await dialog.dismiss();
      });
      const nombre = nombreUnico('xss');
      await abrirChat(page, nombre);
      // Cuando
      await enviar(page, payload);
      // Entonces
      const mensaje = mensajeDe(page, nombre);
      await expect(mensaje).toContainText(payload);
      await expect(mensaje.locator('script, img, svg, iframe')).toHaveCount(0);
      await page.waitForTimeout(1000);
      expect(alertaEjecutada).toBe(false);
    });
  }

  test('Dado un atacante, cuando usa HTML en su nombre de usuario, entonces el nombre se muestra como texto', async ({ page }) => {
    // Dado
    let alertaEjecutada = false;
    page.on('dialog', async (dialog) => {
      alertaEjecutada = true;
      await dialog.dismiss();
    });
    // el nombre admite 30 caracteres: payload corto + marca unica
    const marca = Math.random().toString(36).slice(2, 10);
    await abrirChat(page, `<i onclick=x>${marca}</i>`);
    // Cuando
    await enviar(page, 'hola');
    // Entonces
    const mensaje = mensajeDe(page, marca);
    await expect(mensaje.locator('b')).toHaveText(`<i onclick=x>${marca}</i>`);
    await expect(mensaje.locator('i')).toHaveCount(0);
    expect(alertaEjecutada).toBe(false);
  });

});
