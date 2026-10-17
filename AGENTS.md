# AGENTS.md - Reglas de Desarrollo y Estándares del Equipo
> **Proyecto:** UNA Chat - Seguridad Informática  
> **Institución:** Universidad Nacional (UNA) | Sede Regional Chorotega, Campus Nicoya  
> **Curso:** Seguridad Informática (Laboratorio 5)  
> **Docente:** Ing. Alex Villegas Carranza, M.Sc.  
> **Propósito:** Guía de operación, diseño y control de calidad obligatoria para desarrolladores y agentes autónomos de IA.

---

## 1. Visión General del Proyecto y Arquitectura

UNA Chat es una plataforma de mensajería en tiempo real orientada a la demostración, mitigación y validación de vulnerabilidades de seguridad web (especialmente prevención de Script Injection / XSS y manejo seguro de contenido multimedia).

### Componentes Principales
- **Backend:** Node.js con Express y Socket.IO ([server.js](file:///c:/Users/kathe/OneDrive/Documentos/Seguridad%20Informatica/Lab5/Lab5-SeguridadInformatica/server.js)).
- **Librería Central de Seguridad:** [libs/unalib.js](file:///c:/Users/kathe/OneDrive/Documentos/Seguridad%20Informatica/Lab5/Lab5-SeguridadInformatica/libs/unalib.js), responsable de la validación, sanitización y transformación de entradas de usuario.
- **Frontend:** [index.html](file:///c:/Users/kathe/OneDrive/Documentos/Seguridad%20Informatica/Lab5/Lab5-SeguridadInformatica/index.html) (HTML5, Socket.IO client, jQuery para manipulación del DOM).
- **Suites de Pruebas:**
  - **Unitarias:** [test/test.js](file:///c:/Users/kathe/OneDrive/Documentos/Seguridad%20Informatica/Lab5/Lab5-SeguridadInformatica/test/test.js) (Mocha/Jest).
  - **Integración:** `tests/integration/chat.test.js` (Jest + Supertest / `socket.io-client`).
  - **End-to-End (E2E):** `tests/e2e/chat.spec.js` (Playwright con Chromium).

---

## 2. Reglas del Equipo y Estándares de Código

### 2.1. Estilo y Calidad de Código
1. **Convenciones de Nombres:**
   - Funciones y variables: `camelCase` (ej. `validarMensaje`, `isValidImageUrl`).
   - Constantes y variables de configuración: `UPPER_SNAKE_CASE` (ej. `MAX_MESSAGE_LENGTH`, `ALLOWED_IMAGE_DOMAINS`).
   - Nombres de archivos de prueba: `*.test.js` o `*.spec.js`.
2. **Defensividad y Robustez:**
   - Nunca asumir que el payload recibido en el backend o en la librería es un string o un JSON válido.
   - Todo bloque de parsing (`JSON.parse`) y expresiones regulares debe estar encapsulado en estructuras controladas contra fallos (evitar caídas del servidor ante payloads maliciosos o ReDoS).
   - Validar parámetros de entrada (`null`, `undefined`, tipos inesperados) antes de operar con ellos.
3. **Principio de Responsabilidad Única (SRP):**
   - El frontend ([index.html](file:///c:/Users/kathe/OneDrive/Documentos/Seguridad%20Informatica/Lab5/Lab5-SeguridadInformatica/index.html)) es una interfaz de visualización; **nunca** confiar en validaciones exclusivas del lado cliente.
   - La lógica de seguridad (sanitización, detección de inyecciones y whitelist de URLs) reside centralizada en [libs/unalib.js](file:///c:/Users/kathe/OneDrive/Documentos/Seguridad%20Informatica/Lab5/Lab5-SeguridadInformatica/libs/unalib.js).
   - El backend ([server.js](file:///c:/Users/kathe/OneDrive/Documentos/Seguridad%20Informatica/Lab5/Lab5-SeguridadInformatica/server.js)) orquesta eventos y delega obligatoriamente la validación a `unalib`.
4. **Limpieza:**
   - Prohibido dejar `console.log` de depuración temporal en commits.
   - Prohibido código comentado en desuso o funciones huérfanas sin tests.

---

## 3. Metodología BDD Obligatoria (Behavior-Driven Development)

El equipo adopta **BDD** de manera estricta para garantizar que cada requerimiento de seguridad y funcionalidad se defina y verifique en función del comportamiento esperado del sistema.

### 3.1. Estructura Obligatoria de Casos de Prueba (Given-When-Then)
Todas las suites de prueba (unitarias, integración y E2E) deben redactarse siguiendo la semántica:
- **Dado (Given):** El contexto, precondiciones o estado inicial del sistema.
- **Cuando (When):** La acción ejecutada por el usuario o cliente (envío de mensaje, click, evento).
- **Entonces (Then):** El resultado observable esperado (código de estado, DOM seguro, sanitización aplicada, ausencia de alertas XSS).

#### Ejemplo en Pruebas Unitarias ([libs/unalib.js](file:///c:/Users/kathe/OneDrive/Documentos/Seguridad%20Informatica/Lab5/Lab5-SeguridadInformatica/libs/unalib.js)):
```javascript
describe('Feature: Validación y Sanitización de Mensajes de Chat', () => {
  describe('Escenario: Detección y Neutralización de Inyección de Scripts', () => {
    it('Dado un mensaje con un payload <script>alert("XSS")</script>, cuando se valida, entonces debe rechazarlo o sanitizar los tags maliciosos sin ejecutar JavaScript', () => {
      // Given
      const maliciousPayload = JSON.stringify({
        nombre: 'Atacante',
        mensaje: '<script>alert("Inyección de script");</script>'
      });

      // When
      const resultado = unalib.validateMessage(maliciousPayload);
      const parsed = JSON.parse(resultado);

      // Then
      expect(parsed.mensaje).not.toContain('<script>');
      expect(parsed.mensaje).not.toMatch(/alert\(/i);
    });
  });
});
```

### 3.2. Pirámide de Pruebas Requerida
El proyecto debe mantener los 3 niveles de prueba requeridos por el laboratorio:

| Nivel | Herramienta | Objetivo | Archivo Objetivo |
| :--- | :--- | :--- | :--- |
| **Unitarias** | Mocha / Jest | Validación de lógica pura en `unalib` (teléfono, URLs de imagen/video, detección de scripts). | `test/test.js` |
| **Integración** | Jest + Supertest / Socket.io-client | Comunicación entre backend Node.js (`server.js`) y `unalib.js`. Confirmar que la ruta HTTP o evento socket procesa y sanitiza entradas. | `tests/integration/chat.test.js` |
| **End-to-End (E2E)** | Playwright (Chromium) | Automatización del navegador real. Probar interacción de UI, carga de imágenes, reproductor de video e interceptación de diálogos alert (`page.on('dialog')`). | `tests/e2e/chat.spec.js` |

---

## 4. Quality Gates y Pre-Commit Checklist (Obligatorio)

**Ningún cambio puede ser subido al repositorio ni fusionado en `main`/`master` sin haber pasado el 100% de los controles previos.**

### 4.1. Pasos de Verificación Previa a Cada Commit
Antes de ejecutar `git commit`, el desarrollador o agente debe ejecutar y verificar en verde:

1. **Lint & Sintaxis:**
   ```bash
   node --check server.js libs/unalib.js
   ```
2. **Pruebas Unitarias:**
   ```bash
   npm test
   ```
3. **Pruebas de Integración:**
   ```bash
   npx jest tests/integration --runInBand --env=node
   ```
4. **Pruebas End-to-End (E2E):**
   ```bash
   npx playwright test --project=chromium --headed
   ```
5. **Aislamiento de Suites en Jest:**
   - En la configuración de Jest (`package.json` o `jest.config.js`), asegurarse de ignorar `tests/e2e` en `testPathIgnorePatterns` para que `npm test` no interfiera con Playwright:
   ```json
   "jest": {
     "testPathIgnorePatterns": ["/node_modules/", "/tests/e2e/"]
   }
   ```

---

## 5. Gestión Estricta de Secretos (Zero Secrets Policy)

1. **Cero Secretos en el Repositorio:**
   - Prohibido commitear contraseñas, tokens JWT, API keys, certificados SSL, URLs con credenciales incrustadas o llaves privadas.
2. **Variables de Entorno:**
   - Toda configuración sensible o variable por entorno (puertos, secretos de sesión) debe manejarse a través de `process.env`.
   - Se debe mantener un archivo `.env.example` en la raíz con valores ficticios como referencia.
3. **Reglas de [.gitignore](file:///c:/Users/kathe/OneDrive/Documentos/Seguridad%20Informatica/Lab5/Lab5-SeguridadInformatica/.gitignore):**
   - Asegurar que `.gitignore` incluya explícitamente:
     ```gitignore
     node_modules/
     .env
     .env.local
     *.log
     playwright-report/
     test-results/
     .DS_Store
     Thumbs.db
     ```
4. **Inspección de Staged Changes:**
   - Ejecutar siempre `git status` y `git diff --staged` antes de confirmar un commit para verificar que ningún artefacto sensible o temporal sea incluido.

---

## 6. Seguridad y Reglas OWASP

El código y las revisiones de pull request deben evaluar activamente el **OWASP Top 10**, con enfoque crítico en las siguientes categorías aplicadas a UNA Chat:

### 6.1. OWASP A03:2021 - Injection & Cross-Site Scripting (XSS)
- **Problema Detectado en Laboratorio:** El mensaje del usuario es inyectado sin sanitización previa en el DOM mediante `$('<li>').html(mensajeDisplay)` en [index.html](file:///c:/Users/kathe/OneDrive/Documentos/Seguridad%20Informatica/Lab5/Lab5-SeguridadInformatica/index.html).
- **Regla de Defensa:**
  1. **Sanitización Estricta:** Reemplazar o codificar caracteres especiales HTML (`&`, `<`, `>`, `"`, `'`, `/`) en cualquier texto que no sea un recurso validado.
  2. **Validación de URLs (Allowlist / Lista Blanca):**
     - Solo permitir esquemas seguros: `https://` (o `http://` en desarrollo controlado).
     - **Imágenes:** Validar extensiones reconocidas (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`) y rechazar URLs con caracteres de inyección (`" onload=...`, `javascript:`).
     - **Videos:** Aceptar únicamente dominios de confianza predeterminados (ej. `youtube.com/watch?v=`, `youtu.be/`) extrayendo exclusivamente el ID alfanumérico seguro para el iframe.
  3. **Generación Segura de HTML:** Al armar etiquetas `<img>` o `<iframe>`, encapsular y validar los atributos para evitar que un atacante cierre las comillas e inyecte atributos de eventos (`onerror`, `onload`).

### 6.2. OWASP A04:2021 - Insecure Design
- Diseñar la seguridad de forma multicapa:
  - **Capa 1 (Validación de entrada en unalib):** Limpieza, validación de esquemas y tipos.
  - **Capa 2 (Backend en server.js):** Validación de payload de socket o request HTTP antes de emitir broadcast.
  - **Capa 3 (Renderizado en cliente):** Renderizar texto usando `.text()` o elementos DOM seguros; reservar inserción HTML únicamente para etiquetas multimedia validadas por el servidor.

### 6.3. OWASP A05:2021 - Security Misconfiguration
- No exponer trazas completas de error de la aplicación ni detalles del stack de Node.js a los clientes de socket o respuestas HTTP.
- Definir cabeceras de seguridad adecuadas (CSP - Content Security Policy) para mitigar ejecución no autorizada de scripts externos.

### 6.4. OWASP A06:2021 - Vulnerable and Outdated Components
- Ejecutar periódicamente:
  ```bash
  npm audit
  ```
- Mantener las dependencias (`socket.io`, `express`, `playwright`, `jest`, `supertest`) en versiones estables y libres de vulnerabilidades críticas conocidas (CVEs).

---

## 7. Flujo de Trabajo y Entregables del Laboratorio 5

Para asegurar la máxima calificación (3% del curso), el equipo y los agentes deben seguir la generación y organización de evidencias requeridas:

### 7.1. Mapeo de Evidencias
- **Evidencia 1 (JPG):** Captura de pantalla de la ejecución de Script Injection inicial en el chat (`<script>alert('Inyección de script');</script>`) evidenciando la vulnerabilidad inicial.
- **Evidencia 2 (JPG):** Captura de pantalla de la ejecución de las **pruebas unitarias** (`npm test`) pasando al 100% (validación de URLs de imágenes, videos y bloqueo de inyecciones).
- **Evidencia 3 (JPG):** Captura de pantalla de la ejecución de las **pruebas de integración** (`tests/integration/chat.test.js`) ejecutadas con Jest (`npx jest tests/integration --runInBand --env=node`).
- **Evidencia 4 (JPG):** Captura de pantalla de la ejecución de las **pruebas E2E con Playwright** (`npx playwright test --project=chromium --headed`) con el navegador interactuando y la suite en verde.
- **repositorio.txt:** Archivo en la entrega que contiene el enlace al repositorio de GitHub con el código fuente y las 3 suites configuradas.

### 7.2. Comandos Frecuentes
| Acción | Comando |
| :--- | :--- |
| Iniciar aplicación UNA Chat | `npm start` |
| Ejecutar pruebas unitarias | `npm test` |
| Ejecutar pruebas de integración | `npx jest tests/integration --runInBand --env=node` |
| Ejecutar pruebas E2E con Playwright | `npx playwright test --project=chromium --headed` |
| Ver reporte visual de Playwright | `npx playwright show-report` |
| Auditar dependencias npm | `npm audit` |

---

> **Nota:** La adhesión a este documento es obligatoria para cualquier contribución al repositorio. Las violaciones a las reglas de OWASP, fallos en las pruebas o inclusión de secretos invalidarán el pull request.
