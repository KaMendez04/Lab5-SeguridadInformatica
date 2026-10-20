# De "funciona en mi máquina" a DevSecOps: cómo blindamos un chat en Node.js con un pipeline de seguridad gratuito

*Tutorial paso a paso para montar el mismo ambiente: hooks locales, CI con SAST/SCA, contenedor escaneado, despliegue continuo, DAST, E2E, monitoreo con alertas y secretos en un Key Vault.*

> **Para quién es:** equipos que tienen una app Node.js en GitHub y quieren agregarle seguridad en cada etapa del ciclo de vida sin pagar herramientas.
> **Tiempo estimado:** una tarde.
> **Repo de referencia:** https://github.com/KaMendez04/Lab5-SeguridadInformatica

---

## La idea en una imagen

Partimos de un chat (Express + Socket.IO) con un XSS clásico: el cliente insertaba los mensajes con `$(...).html()`. En vez de "arreglar y listo", montamos un pipeline que **detecta el problema, impide que llegue a producción y nos avisa si alguien intenta explotarlo**. En cada paso mostramos el **antes** (la herramienta bloqueando) y el **después** (corregido).

```
commit ─► pre-commit ─► secrets ─► lint ─► test ─► sast ─► container ─► deploy ─► dast + e2e
                                                                                  │
                                    Azure Key Vault (OIDC) ──► secretos del pipeline
                                    Grafana Cloud ◄── métricas, logs y trazas de la app
```

[IMAGEN: F2-12 · Pipeline completo en verde en GitHub Actions]

---

## Paso 0 · Herramientas

| Herramienta | Para qué | Instalación (Windows) |
|---|---|---|
| Git, Node.js LTS | base | `winget install Git.Git OpenJS.NodeJS.LTS` |
| GitHub CLI | PRs, secrets, rulesets | `winget install GitHub.cli` → `gh auth login` |
| Docker Desktop | contenedores | `winget install Docker.DockerDesktop` |
| Semgrep | SAST local | `pip install semgrep` |
| Snyk CLI | SCA local | `npm i -g snyk` → `snyk auth` |
| Trivy | escaneo de imágenes | `winget install AquaSecurity.Trivy` |
| Azure CLI | Key Vault | `winget install Microsoft.AzureCLI` → `az login` |

Cuentas gratuitas: GitHub, Snyk, Docker Hub, Render, Grafana Cloud y Azure for Students.

> **Tip:** después de instalar con `winget`, abrí una terminal nueva (o recargá el PATH); si no, los comandos "no existen".

---

## Paso 1 · Seguridad antes del commit (shift-left)

### 1.1 ESLint con reglas de seguridad

```bash
npm i -D eslint@9 @eslint/js@9 eslint-plugin-security globals
```

`eslint.config.js` (extracto):

```js
const pluginSecurity = require('eslint-plugin-security');
module.exports = [
  pluginSecurity.configs.recommended,
  { files: ['**/*.js'], rules: {
      'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-func': 'error'
  } }
];
```

> **Ojo:** `security/detect-eval-with-expression` **no** marca `eval("1+1")` (argumento literal). Por eso sumamos `no-eval`.

[IMAGEN: F1-07 · ESLint marcando `no-eval`]

### 1.2 Hook pre-commit con Husky + lint-staged + un checker OWASP propio

```bash
npm i -D husky lint-staged && npx husky init
```

`.husky/pre-commit`:

```sh
npx lint-staged
npm run security:check
npm test
```

`scripts/owasp-checker.js` revisa los archivos en stage con reglas simples (XSS con `.html()`/`innerHTML`, `eval`, scripts sin SRI, dependencias con `"*"`) y **bloquea el commit** si hay un hallazgo de severidad ALTA.

[IMAGEN: F1-08 · Commit bloqueado por ESLint]
[IMAGEN: F1-09 · Commit bloqueado por el owasp-checker (XSS en `.html()`)]

### 1.3 Matriz de riesgos y SBOM

- Matriz de riesgos OWASP Top 10 con probabilidad × impacto: [`docs/matriz-riesgos.md`](matriz-riesgos.md).
- SBOM CycloneDX: `npx @cyclonedx/cyclonedx-npm --output-file docs/sbom.json`.

---

## Paso 2 · CI con SAST y SCA en GitHub Actions

### 2.1 Ramas protegidas

Creamos `development` y protegimos `main` y `development` con un **ruleset**: PR obligatorio, sin force push, sin borrado y (al final del paso) **status checks requeridos**. Todo se puede hacer con `gh api repos/<owner>/<repo>/rulesets`.

### 2.2 El workflow

Jobs encadenados con `needs:` → si uno falla, los siguientes no corren.

```yaml
jobs:
  lint:  { runs-on: ubuntu-latest, steps: [checkout, setup-node, "npm ci", "npm run lint"] }
  test:  { needs: lint, ... "npm test" }
  sast:
    needs: test
    permissions: { contents: read, security-events: write }
    steps:
      - run: semgrep scan --config auto --config .semgrep.yml --error --sarif --output semgrep.sarif
      - run: snyk test --severity-threshold=high --sarif-file-output=snyk-deps.sarif
      - run: snyk code test --sarif-file-output=snyk-code.sarif
      - uses: github/codeql-action/upload-sarif@<sha>   # hallazgos a la pestaña Security
```

> **Buenas prácticas que aprendimos:**
> - Fijá cada action por **SHA**, no por tag (Semgrep lo marca como `github-actions-mutable-action-tag`).
> - En reglas Semgrep propias, usá `pattern-regex: |-` y no `|`: el `|` agrega un salto de línea al regex y la regla **nunca coincide**.
> - Poné los pasos de escaneo con `if: ${{ !cancelled() }}` para que corran todos aunque falle uno, y así ver el panorama completo.

### 2.3 El antes: abrir el PR con el código vulnerable

Abrimos el PR **sin corregir nada**: el pipeline queda en rojo y la pestaña *Security → Code scanning* se llena (XSS, falta de SRI, 31 CVEs en dependencias, falta de rate limit).

[IMAGEN: F2-10 · Pipeline en rojo (sast falla)]
[IMAGEN: F2-11 · Pestaña Security con los hallazgos]

### 2.4 El después: corregir en el mismo PR

| Hallazgo | Corrección |
|---|---|
| XSS con `.html()` | El servidor escapa HTML (`unalib.validateMessage`); el cliente arma el DOM con `createElement` + `textContent` y solo crea `<img>`/`<iframe>` con URLs que pasaron una **lista blanca** |
| Scripts de CDN sin SRI | Socket.IO servido por el propio servidor y **sin jQuery** → `script-src 'self'` |
| Dependencias con `"*"` y CVEs | Versiones fijas + `npm update` de transitivas → Snyk: 0 |
| Sin rate limit | `express-rate-limit` (HTTP) + límite por socket + `helmet` con CSP |
| CSRF (Semgrep) | No aplica (sin cookies ni rutas que cambien estado); el equivalente en websockets se mitiga validando `Origin` |

Y pruebas BDD que demuestran que el XSS ya no pasa:

```js
it('Dado un payload <img src=x onerror=alert(1)>, cuando se valida, entonces no se genera ninguna etiqueta img', () => {
  // Dado
  const msg = JSON.stringify({ nombre: 'Ana', color: '#000', mensaje: '<img src=x onerror=alert(1)>' });
  // Cuando
  const resultado = JSON.parse(val.validateMessage(msg));
  // Entonces
  assert.ok(resultado.mensaje.indexOf('<img') === -1);
});
```

[IMAGEN: F2-12 · Pipeline en verde]
[IMAGEN: F2-13 · Alertas cerradas en Security]

### 2.5 Revisión de PR con IA

En el ruleset activamos **"Automatically request Copilot code review"** (regla `copilot_code_review`). Requiere una cuenta con Copilot habilitado (el Student Developer Pack lo incluye).

---

## Paso 3 · Contenedor endurecido + Trivy

```dockerfile
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:24-alpine
ENV NODE_ENV=production PORT=3000 TRUST_PROXY=1
WORKDIR /app
RUN apk upgrade --no-cache && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json server.js instrumentation.js index.html ./
COPY --chown=node:node libs ./libs
COPY --chown=node:node public ./public
USER node
EXPOSE 3000
HEALTHCHECK CMD node -e "require('http').get('http://127.0.0.1:3000/healthz',r=>process.exit(r.statusCode===200?0:1))"
CMD ["node", "server.js"]
```

**Antes vs después** (mismo código, distinta imagen):

| Imagen | Tamaño | CVE CRITICAL/HIGH | Usuario |
|---|---|---|---|
| `node:16` (Debian 10) | 1,47 GB | **413** | root |
| `node:24-alpine` endurecida | 266 MB | **0** | node |

[IMAGEN: F3-14 · Trivy sobre la imagen node:16]
[IMAGEN: F3-15 · Trivy sobre la imagen endurecida]

En el pipeline, el job `container` construye la imagen, la escanea con `aquasecurity/trivy-action` (`exit-code: 1` con `CRITICAL,HIGH`) y **solo si pasa** la publica en Docker Hub con el tag `development`.

> **Trampa:** el usuario de Docker Hub va en **minúsculas**. Con mayúsculas, el login falla con un engañoso *"malformed HTTP Authorization header"*.

[IMAGEN: F3-16 · Imagen en Docker Hub con tag development]

---

## Paso 4 · Despliegue continuo, DAST y E2E

### 4.1 Render (plan free)

1. *New → Web Service → Existing Image* → `docker.io/<usuario>/una-chat:development`.
2. *Settings → Deploy Hook*: guardá la URL como secreto (es una credencial).
3. El job `deploy` dispara el hook y **espera a que `/healthz` devuelva el SHA del commit** (la imagen se construye con `--build-arg APP_VERSION=${{ github.sha }}`). Así sabemos que se probó la versión nueva y no la anterior.

> Detrás del proxy de Render, `express-rate-limit` necesita `app.set('trust proxy', 1)`; si no, todos los usuarios comparten la misma IP y el mismo límite.

[IMAGEN: F4-17 · App desplegada en Render]
[IMAGEN: F4-18 · Job deploy esperando la versión nueva]

### 4.2 DAST con Nuclei

Nuclei corre contra la URL pública. Como la app tiene rate limit (100 req/min), lo corremos a `-rl 1` con un perfil acotado (cabeceras, CORS, TLS, CSP, cookies + exposiciones/misconfig HIGH/CRITICAL) y fallamos solo con HIGH/CRITICAL. Resultado: 7 hallazgos *info* (dos cabeceras faltantes); agregamos `Permissions-Policy` y documentamos por qué **no** usamos COEP (rompería las imágenes y videos embebidos).

[IMAGEN: F4-19 · Reporte de Nuclei]

### 4.3 E2E con Playwright

`tests/e2e/chat.spec.js` abre el chat en Chromium y verifica: texto, URL de imagen → `<img>`, YouTube → `<iframe>`, y **5 payloads XSS que se muestran como texto sin disparar ningún `alert`**. En PRs corre contra un servidor local; en `development`, contra Render. El reporte HTML queda como artifact.

[IMAGEN: F4-20 · Reporte HTML de Playwright]

---

## Paso 5 · Monitoreo, alertas y secretos

### 5.1 Instrumentación

- `prom-client` → `/metrics` (en producción solo con token).
- `pino` → logs JSON con `trace_id`.
- OpenTelemetry (`@opentelemetry/sdk-node` + auto-instrumentación) → OTLP a Grafana Cloud. **Se configura solo con variables `OTEL_*`**, cargadas en Render.

### 5.2 Dashboard y alertas en Grafana Cloud

Creados por API y versionados en `monitoring/grafana/`:

- **Pico de tráfico:** `sum(rate(una_chat_http_requests_total[1m]))*60 > 300` durante 1 min.
- **Posible ataque:** `sum(increase(una_chat_http_requests_total{status=~"4.."}[2m])) > 100` (429 + 404 de sondeos).

Para la demo: `node scripts/simular-ataque.js pico|ataque <url>`.

[IMAGEN: F5-24 · Dashboard durante el pico]
[IMAGEN: F5-25 · Alerta en estado Firing]
[IMAGEN: F5-26 · Correo de la alerta]

### 5.3 Secretos en Azure Key Vault con OIDC

1. `az keyvault create ... --enable-rbac-authorization true` (en Azure for Students, revisá las **regiones permitidas** por la política de la suscripción).
2. Identidad administrada + **credenciales federadas** para GitHub (sin App Registration, que los tenants universitarios suelen bloquear).
3. Rol *Key Vault Secrets User* para la identidad.
4. En el workflow:

```yaml
permissions: { id-token: write }
steps:
  - uses: azure/login@<sha>
    with: { client-id: ${{ vars.AZURE_CLIENT_ID }}, tenant-id: ..., subscription-id: ... }
  - run: |
      valor=$(az keyvault secret show --vault-name "${{ vars.AZURE_KEYVAULT }}" -n snyk-token --query value -o tsv)
      echo "::add-mask::$valor"
      echo "SNYK_TOKEN=$valor" >> "$GITHUB_ENV"
```

> **Trampa:** GitHub ahora puede emitir el *subject* OIDC con IDs inmutables (`repo:owner@<id>/repo@<id>:pull_request`). Si el login falla con `AADSTS700213`, registrá ese formato en la credencial federada.

[IMAGEN: F5-22 · Secretos en el Key Vault]

### 5.4 Secret scanning con gitleaks

Primer job del pipeline: gitleaks sobre **todo el historial** (`fetch-depth: 0`), porque un secreto borrado sigue en git.

[IMAGEN: F5-21 · gitleaks detectando un token]

---

## Lecciones aprendidas

1. **Mostrá el antes.** Un pipeline en verde no convence; uno que primero bloquea y después pasa, sí.
2. **Las herramientas también tienen bugs** (la regla Semgrep que nunca coincidía): validá que cada control detecte algo real.
3. **Seguridad y operación se tocan:** el rate limit, el proxy de Render, el DAST y las alertas tuvieron que diseñarse juntos.
4. **Nada de secretos en el repo ni en el chat del equipo.** Si uno se filtra, rotalo.
