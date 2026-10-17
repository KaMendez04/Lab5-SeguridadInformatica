<!-- Archivo de sincronización para agentes de IA (Claude Code / Antigravity / Copilot) -->
Consulte el archivo principal de reglas del equipo: [AGENTS.md](file:///c:/Users/kathe/OneDrive/Documentos/Seguridad%20Informatica/Lab5/Lab5-SeguridadInformatica/AGENTS.md)

Este repositorio sigue estrictamente las directrices definidas en `AGENTS.md`:
1. **Estilo de código y arquitectura:** Separación entre `server.js`, `libs/unalib.js` e `index.html`.
2. **BDD obligatorio:** Todas las pruebas deben estructurarse bajo el patrón Dado-Cuando-Entonces (Given-When-Then).
3. **Pre-commit Gates:** Pasar lint, sintaxis, pruebas unitarias (`npm test`), pruebas de integración (`npx jest tests/integration`) y pruebas E2E (`npx playwright test`) antes de cada commit.
4. **Zero Secrets:** Prohibido commitear credenciales, API keys o tokens; uso estricto de `.gitignore` y `.env`.
5. **Seguridad OWASP:** Mitigación estricta de XSS (Inyección de scripts), listas blancas para URLs de imágenes y videos, y sanitización de entradas.
