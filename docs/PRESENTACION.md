# Presentación · UNA-chat DevSecOps

Guion para la demo en vivo (≈15 min) + argumentos de negocio, retos y recomendaciones.

---

## 1. Mensaje central (30 s)

> "Tomamos un chat con un XSS real y le construimos un pipeline que **detecta** la vulnerabilidad, **impide** que llegue a producción y **avisa** si alguien intenta atacarla. Todo con herramientas gratuitas y sin un solo secreto guardado en el repositorio."

---

## 2. Guion de la demo

Tener abiertas de antemano: el repo, la pestaña Actions, la app en Render, el dashboard de Grafana, el correo y una terminal en el repo.

| # | Min | Qué mostrar | Qué decir | Evidencia de respaldo |
|---|---|---|---|---|
| 1 | 1 | `docs/matriz-riesgos.md` | "Antes de tocar código identificamos 11 riesgos OWASP y los priorizamos; el XSS era el más alto (9/9)." | — |
| 2 | 2 | Terminal: agregar `eval()` y hacer commit | "El primer control está en la máquina del desarrollador: el commit **ni siquiera se crea**." | F1-07, F1-08, F1-09 |
| 3 | 2 | Actions: run en rojo del PR #8 → Security | "Si algo se escapa del hook, el pipeline lo frena: Semgrep, Snyk y nuestro checker encontraron 37 problemas." | F2-10, F2-11 |
| 4 | 1 | Mismo PR en verde + alertas cerradas | "Corregimos en el mismo PR y lo demostramos con 8 pruebas BDD de XSS." | F2-12, F2-13 |
| 5 | 2 | Tabla Trivy node:16 vs alpine | "El mismo código en una imagen vieja trae 413 CVEs críticos/altos; endurecida, cero. Trivy no deja publicar si aparece uno." | F3-14, F3-15, F3-16 |
| 6 | 2 | App en Render: mandar `<script>alert(1)</script>` | "En producción, el ataque se muestra como texto. Playwright lo verifica en cada deploy con un navegador real." | F4-17, F4-20 |
| 7 | 1 | Reporte Nuclei | "Además atacamos la app desplegada con Nuclei: 0 hallazgos altos." | F4-19 |
| 8 | 3 | Terminal: `node scripts/simular-ataque.js ataque <url>` → Grafana → correo | "Ahora simulamos un ataque real. El rate limit responde 429, el dashboard lo muestra y en menos de 2 minutos llega la alerta." | F5-24, F5-25, F5-26 |
| 9 | 1 | Azure Key Vault + workflow | "Ningún token vive en GitHub: el pipeline se identifica ante Azure con OIDC y lee los secretos en el momento." | F5-21, F5-22 |

**Plan B:** si Render está dormido o la red falla, usar las capturas de `docs/evidencias/` y correr la demo 8 contra `http://localhost:3000` (`npm start`).

---

## 3. ¿Gasto o inversión?

### Lo que costó

| Concepto | Costo |
|---|---|
| GitHub Actions (repo público), Semgrep CE, Snyk Free, Trivy, Nuclei, gitleaks, Playwright | **$0** |
| Docker Hub, Render, Grafana Cloud (planes free) | **$0** |
| Azure Key Vault (Azure for Students: ~$0,03 por cada 10.000 operaciones) | **≈ $0** (cubierto por el crédito de $100) |
| Tiempo del equipo para montarlo | ~1 a 2 días-persona |
| Tiempo extra por PR (pipeline automático) | ~5 a 20 min de máquina, **0 min de persona** |

### Lo que evita

- **Costo promedio de una brecha de datos:** USD 4,88 millones a nivel global (IBM, *Cost of a Data Breach Report 2024*). Incluso una fracción mínima de eso supera por órdenes de magnitud el costo del pipeline.
- **Costo de corregir tarde:** un defecto encontrado en producción cuesta varias veces más que uno encontrado al escribir el código (incidente, hotfix, redeploy, comunicación, pérdida de confianza). Acá el XSS se frenó **en el commit**.
- **Tiempo de detección:** sin monitoreo, un ataque puede pasar desapercibido durante meses; con las alertas, el equipo se entera en **minutos**.
- **Cumplimiento:** el SBOM, los escaneos y las evidencias versionadas facilitan auditorías y responder a "¿estamos afectados por la CVE X?".

> **Argumento en una frase:** el pipeline cuesta prácticamente cero dólares y unos minutos de máquina por cambio; un solo incidente evitado lo paga cientos de veces.

---

## 4. Retos que enfrentamos

| Reto | Cómo lo resolvimos | Aprendizaje |
|---|---|---|
| Una regla Semgrep propia **nunca coincidía** (el `|` de YAML agregaba un salto de línea al regex) | Usar `|-` y probar la regla contra el código vulnerable | Validar que cada control detecte algo real |
| ESLint no marcaba `eval("1+1")` | Agregar `no-eval` | Las reglas "recomendadas" no cubren todo |
| El DAST chocaba con nuestro propio rate limit | Perfil acotado de Nuclei a 1 req/s | Seguridad y operación se diseñan juntas |
| Detrás del proxy de Render, todos los usuarios compartían la misma IP para el rate limit | `trust proxy` configurable | Probar en el entorno real, no solo en local |
| La imagen se publicaba sin `instrumentation.js` y no arrancaba | Smoke test del contenedor en el pipeline | Escanear no es lo mismo que ejecutar |
| Docker Hub rechazaba el login (usuario con mayúsculas) | Usuario en minúsculas | Los mensajes de error no siempre dicen la verdad |
| Azure for Students limita regiones y el formato OIDC de GitHub cambió | Región permitida + credencial federada con IDs inmutables | Leer las políticas de la suscripción |
| Historial de `main`/`development` divergía por los squash | Merge commit en los releases | Definir la estrategia de merge desde el inicio |
| Tokens pegados en el chat del equipo | Rotarlos y usar `gh secret set`/Key Vault sin pegarlos | La gestión de secretos también es cultura |

---

## 5. Recomendaciones

1. **Empezar por lo barato y automático:** hook pre-commit + SAST/SCA en CI dan el mayor retorno el primer día.
2. **Quality gates reales:** los escaneos solo sirven si **bloquean** (status checks obligatorios); los reportes que nadie lee no protegen.
3. **Fijar versiones y actions por SHA** y mantener el SBOM al día.
4. **Secretos fuera del repo desde el día uno**, con OIDC en vez de credenciales de larga duración; rotar cualquier secreto expuesto.
5. **Ambiente de staging** separado de producción para el DAST y las pruebas de carga.
6. **Próximos pasos:** pruebas de integración de Socket.IO (Jest + `socket.io-client`), firma de imágenes (cosign) con verificación en el deploy, DAST autenticado más profundo (OWASP ZAP), y Dependabot/Renovate para actualizar dependencias automáticamente.
