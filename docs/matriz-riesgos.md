# Matriz de Riesgos – UNA-chat

Escala: **Probabilidad** e **Impacto** de 1 (bajo) a 3 (alto). **Riesgo = P × I** → 1-2 Bajo · 3-4 Medio · 6-9 Alto.

| ID | Riesgo | OWASP Top 10 (2021) | Ubicación | P | I | Riesgo | Control / Mitigación | Fase SSDLC | Herramienta de detección |
|----|--------|---------------------|-----------|---|---|--------|----------------------|-----------|--------------------------|
| R01 | XSS almacenado/reflejado: el cliente inserta `nombre` y `mensaje` con `.html()` sin escapar | A03 Injection | `index.html` (render de mensajes) | 3 | 3 | **9 Alto** | Renderizar con `.text()`/`textContent`; escapar HTML en `validateMessage`; solo `<img>`/`<iframe>` generados por el servidor con URL validada | Implementación | owasp-checker, Semgrep, Snyk Code |
| R02 | Inyección de atributos en `<img src>` / `<iframe src>` por concatenación de la URL del usuario | A03 Injection | `libs/unalib.js` (`getImageTag`, `getEmbeddedCode`) | 2 | 3 | **6 Alto** | Lista blanca de URLs + escape de atributos; ID de YouTube restringido a `[\w-]{11}` | Implementación | Semgrep (`.semgrep.yml`) |
| R03 | Dependencias sin versión fija (`"*"`) y con CVEs conocidos | A06 Vulnerable and Outdated Components | `package.json` | 3 | 2 | **6 Alto** | Fijar versiones, `npm ci`, SBOM CycloneDX, escaneo SCA en CI | Implementación / Verificación | Snyk, npm audit, owasp-checker |
| R04 | Scripts de CDN sin Subresource Integrity (SRI) | A08 Software and Data Integrity Failures | `index.html` (socket.io, jQuery 1.11.1) | 2 | 3 | **6 Alto** | Servir socket.io desde el propio servidor; jQuery 3.7.x con `integrity` + `crossorigin` | Implementación | owasp-checker |
| R05 | Sin cabeceras de seguridad (CSP, X-Frame-Options, etc.) | A05 Security Misconfiguration | `server.js` | 3 | 2 | **6 Alto** | `helmet` con CSP | Implementación | Snyk Code, Nuclei (DAST) |
| R06 | Sin limitación de tasa → abuso / DoS de la ruta y del socket | A04 Insecure Design | `server.js` | 2 | 2 | **4 Medio** | `express-rate-limit`; métricas y alerta de 429 en Grafana | Implementación / Operación | Snyk Code, Grafana |
| R07 | Ejecución de código dinámico (`eval`, `new Function`) | A03 Injection | Cualquier `.js` | 1 | 3 | **3 Medio** | Reglas `no-eval` en ESLint + owasp-checker en pre-commit | Implementación | ESLint, owasp-checker |
| R08 | Secretos (tokens, API keys) commiteados al repositorio | A02 Cryptographic Failures / A07 | Repo completo | 2 | 3 | **6 Alto** | `.gitignore` de `.env`, GitHub Secrets / Key Vault, gitleaks en CI | Todas | gitleaks, GitHub Secret Scanning |
| R09 | Imagen de contenedor con CVEs del SO o corriendo como root | A06 / A05 | `Dockerfile` | 2 | 3 | **6 Alto** | Imagen base LTS alpine, multi-stage, usuario no root, Trivy en CI | Despliegue | Trivy |
| R10 | Falta de registro y monitoreo para detectar ataques | A09 Security Logging and Monitoring Failures | `server.js` | 3 | 2 | **6 Alto** | Logs JSON (pino), métricas Prometheus, trazas OTel, alertas en Grafana | Operación | Grafana Cloud |
| R11 | Bug lógico: validadores de imagen/video evaluaban `phone` en vez de `url` | A04 Insecure Design | `libs/unalib.js` | 3 | 1 | **3 Medio** | Corregido + pruebas BDD que lo cubren | Implementación / Verificación | Mocha (BDD) |

## Priorización

1. **Alto (6-9):** R01, R02, R03, R04, R05, R08, R09, R10 → se corrigen en las Fases 2 a 4 y en Monitoreo.
2. **Medio (3-4):** R06, R07, R11 → R07 y R11 ya se controlan desde la Fase 1.

## Estado

| ID | Estado | Evidencia |
|----|--------|-----------|
| R07 | Controlado (Fase 1) | `docs/evidencias/F1-*.txt` |
| R11 | Corregido (Fase 1) | commit `fix(unalib)` + `test/test.js` |
| Resto | Pendiente | Ver fases 2-4 |
