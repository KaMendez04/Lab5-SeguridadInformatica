#!/usr/bin/env node
/**
 * Simulador de trafico para la demo de alertas de Grafana.
 *
 * Uso:
 *   node scripts/simular-ataque.js pico   [url] [segundos]
 *   node scripts/simular-ataque.js ataque [url] [segundos]
 *
 *  pico   -> muchas peticiones a /healthz (no tiene rate limit): sube las
 *            requests/min y dispara la alerta "Pico de trafico".
 *  ataque -> flood a / y sondeo de rutas sensibles (/.env, /admin, ...):
 *            genera respuestas 429 (rate limit) y 404, y dispara la alerta
 *            "Posible ataque".
 *
 * SOLO usar contra la propia app (UNA-chat) en el contexto del laboratorio.
 */
const autocannon = require("autocannon");

const modo = process.argv[2];
const url = (process.argv[3] || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const segundos = Number(process.argv[4] || 180);

const MODOS = {
  pico: {
    descripcion: "Pico de trafico legitimo contra /healthz",
    opciones: { connections: 10, overallRate: 15, requests: [{ method: "GET", path: "/healthz" }] },
  },
  ataque: {
    descripcion: "Flood + sondeo de rutas sensibles (espera 429 y 404)",
    opciones: {
      connections: 20,
      overallRate: 30,
      requests: [
        { method: "GET", path: "/" },
        { method: "GET", path: "/.env" },
        { method: "GET", path: "/admin" },
        { method: "GET", path: "/wp-login.php" },
        { method: "GET", path: "/.git/config" },
      ],
    },
  },
};

if (!MODOS[modo]) {
  console.error("Uso: node scripts/simular-ataque.js <pico|ataque> [url] [segundos]");
  process.exit(1);
}

console.log(`Modo: ${modo} - ${MODOS[modo].descripcion}`);
console.log(`Objetivo: ${url} durante ${segundos}s\n`);

const instancia = autocannon(
  { url, duration: segundos, ...MODOS[modo].opciones },
  (err, resultado) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    const codigos = Object.entries(resultado.statusCodeStats || {})
      .map(([codigo, s]) => `${codigo}: ${s.count}`)
      .join("  ");
    console.log("\nResumen");
    console.log(`  Peticiones totales: ${resultado.requests.total}`);
    console.log(`  Promedio req/s:     ${resultado.requests.average}`);
    console.log(`  Codigos HTTP:       ${codigos}`);
  },
);

autocannon.track(instancia, { renderProgressBar: true, renderResultsTable: false });
