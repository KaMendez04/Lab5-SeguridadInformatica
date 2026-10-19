#!/usr/bin/env node
/**
 * OWASP checker - revision de seguridad en cada commit (pre-commit hook).
 *
 * Uso:
 *   node scripts/owasp-checker.js          -> revisa solo los archivos en stage (git)
 *   node scripts/owasp-checker.js --all    -> revisa todo el proyecto (reporte completo)
 *
 * Severidad ALTA bloquea el commit (exit 1). MEDIA solo avisa.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const RULES = [
  {
    id: "A03-XSS-html",
    sev: "ALTA",
    ext: [".js", ".html"],
    re: /\.html\(\s*[^)'"\s]/,
    msg: "Inserta HTML sin sanitizar con .html() (XSS). Usar .text() o escapar la entrada.",
  },
  {
    id: "A03-XSS-innerHTML",
    sev: "ALTA",
    ext: [".js", ".html"],
    re: /\.innerHTML\s*=/,
    msg: "Asignacion a innerHTML (XSS). Usar textContent o sanitizar.",
  },
  {
    id: "A03-eval",
    sev: "ALTA",
    ext: [".js", ".html"],
    re: /\beval\s*\(|new Function\s*\(/,
    msg: "Ejecucion de codigo dinamico (eval / new Function).",
  },
  {
    id: "A03-cmd-injection",
    sev: "ALTA",
    ext: [".js"],
    re: /child_process['"]\)\.exec\(|\bexec\s*\(\s*[`'"].*\$\{/,
    msg: "Posible inyeccion de comandos con exec(). Usar execFile con argumentos.",
  },
  {
    id: "A02-hardcoded-secret",
    sev: "ALTA",
    ext: [".js", ".json", ".html", ".yml", ".yaml"],
    re: /(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*['"][^'"]{6,}['"]/i,
    msg: "Posible secreto escrito en el codigo. Usar variables de entorno / KeyVault.",
  },
  {
    id: "A08-missing-sri",
    sev: "MEDIA",
    ext: [".html"],
    re: /<script[^>]+src=["']https?:\/\/(?![^>]*integrity=)[^>]*>/i,
    msg: "Script externo sin atributo integrity (SRI).",
  },
  {
    id: "A06-wildcard-version",
    sev: "MEDIA",
    ext: [".json"],
    re: /"[\w@/.-]+"\s*:\s*"(\*|latest)"/,
    msg: 'Dependencia sin version fija ("*" o "latest").',
  },
  {
    id: "A05-http-url",
    sev: "MEDIA",
    ext: [".js", ".html"],
    re: /['"]http:\/\/(?!localhost|127\.0\.0\.1)[^'"]+['"]/,
    msg: "Recurso cargado por HTTP sin cifrar.",
  },
];

const IGNORE = [
  "node_modules",
  ".git",
  "coverage",
  "package-lock.json",
  path.join("docs", "sbom.json"), // inventario generado, no codigo
  path.join("scripts", "owasp-checker.js"),
  "test",
];

function isIgnored(file) {
  const norm = path.normalize(file);
  return IGNORE.some((i) => norm === i || norm.startsWith(i + path.sep));
}

function listAll(dir = ".") {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // entry.name viene de readdirSync sobre el propio repo, no de entrada de usuario
    const p = path.join(dir, entry.name); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    if (isIgnored(path.relative(".", p))) continue;
    if (entry.isDirectory()) out = out.concat(listAll(p));
    else out.push(path.relative(".", p));
  }
  return out;
}

function listStaged() {
  const raw = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACM"],
    { encoding: "utf8" },
  );
  return raw
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean)
    .filter((f) => !isIgnored(f));
}

const all = process.argv.includes("--all");
const files = all ? listAll() : listStaged();
const findings = [];

for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  const rules = RULES.filter((r) => r.ext.includes(ext));
  if (!rules.length || !fs.existsSync(file)) continue;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const r of rules) {
      if (r.re.test(line))
        findings.push({
          file,
          line: i + 1,
          ...r,
          code: line.trim().slice(0, 100),
        });
    }
  });
}

console.log(
  `\nOWASP checker - ${files.length} archivo(s) revisado(s) (${all ? "proyecto completo" : "archivos en stage"})\n`,
);
if (!findings.length) {
  console.log("Sin hallazgos. OK\n");
  process.exit(0);
}
for (const f of findings) {
  console.log(
    `[${f.sev}] ${f.id}  ${f.file}:${f.line}\n   ${f.msg}\n   > ${f.code}\n`,
  );
}
const high = findings.filter((f) => f.sev === "ALTA").length;
console.log(
  `Total: ${findings.length} hallazgo(s), ${high} de severidad ALTA.`,
);
if (high > 0) {
  console.log("Commit BLOQUEADO: corrija los hallazgos de severidad ALTA.\n");
  process.exit(1);
}
console.log("Solo advertencias, se permite continuar.\n");
