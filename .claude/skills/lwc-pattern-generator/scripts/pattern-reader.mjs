#!/usr/bin/env node
// pattern-reader.mjs — Leitor DETERMINISTICO do snapshot de design pattern de uma
// jornada (gravado pela lwc-pattern-documenter via `pattern-writer.mjs --data`), mais
// lookup reverso componente->jornada. Mesma filosofia da Skill 1: o script LE de forma
// mecanica; o agente JULGA e decide (nunca escolhe a primeira jornada silenciosamente
// quando ha mais de um match).
//
// Uso:
//   node pattern-reader.mjs --journey "Consorcio" [--out-dir <dir>]
//     -> emite o snapshot estruturado da jornada (journeys/<slug>.json), com aviso
//        de STALENESS se o journeys-index.json tiver um lastScan diferente (a jornada
//        foi re-documentada sem passar --data da ultima vez).
//
//   node pattern-reader.mjs --find-journey <nome-ou-path-do-componente> [--out-dir <dir>]
//     -> lookup reverso (modo Editar, etapa 0): retorna TODAS as jornadas cujo
//        journeys-index.json lista aquele componente. Nunca escolhe a primeira
//        silenciosamente se houver mais de um match.
//
//   node pattern-reader.mjs --list [--out-dir <dir>]
//     -> lista as jornadas ja documentadas (nome + quantidade de componentes + data).
//
// Opcional:
//   --out-dir <dir>   base (padrao: .lwc-pattern-documenter/lwc-design-system)
//
// Requisitos: Node 18+. Zero dependencias externas.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_OUT_DIR = '.lwc-pattern-documenter/lwc-design-system';

// Precisam ser IDENTICAS a normHeading/slugFromHeading do pattern-writer.mjs (Skill 1)
// para o lookup de slug bater. Duplicadas aqui de proposito — as duas skills sao
// pastas/dominios independentes (nao compartilham modulo), mas o CONTRATO de nomes
// (nome de jornada -> slug de arquivo) tem que ser identico dos dois lados.
export function normHeading(name) {
  return String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}
export function slugFromHeading(name) {
  const slug = normHeading(name).replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
  return slug || 'journey';
}

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}

function emit(obj, code = 0) {
  console.log(JSON.stringify(obj, null, 2));
  process.exit(code);
}

export function readIndex(outDir) {
  const p = path.join(outDir, 'journeys-index.json');
  if (!fs.existsSync(p)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Aceita os DOIS formatos de item em `components`: string solta (indices antigos) OU
// { name, path } (enriquecido). Nunca falha ao ler o formato antigo.
function componentName(c) {
  return typeof c === 'string' ? c : (c && c.name) || '';
}
function componentPath(c) {
  return typeof c === 'string' ? null : (c && c.path) || null;
}

// --- modo --list -------------------------------------------------------------
export function listJourneys(outDir) {
  return readIndex(outDir).map((e) => ({
    journey: e.journey,
    componentCount: Array.isArray(e.components) ? e.components.length : 0,
    lastScan: e.lastScan || null,
  }));
}

// --- modo --find-journey <query> ---------------------------------------------
// Lookup reverso: dado um nome OU path de componente, retorna TODAS as jornadas que
// o listam. Compara por nome (case-insensitive) e, se o item tiver path, tambem por
// path exato ou basename — cobre tanto "consorcioLances" quanto o path completo.
export function findJourney(query, outDir) {
  const idx = readIndex(outDir);
  const qFull = String(query);
  const qName = path.basename(qFull).toLowerCase();
  const looksLikePath = /[\\/]/.test(qFull); // so rotula "matchedAs: path" se a query em si parecer um path
  const matches = [];
  for (const entry of idx) {
    if (!Array.isArray(entry.components)) continue;
    for (const c of entry.components) {
      const name = componentName(c);
      const p = componentPath(c);
      const nameMatch = name && name.toLowerCase() === qName;
      const pathMatch = p && (p === qFull || (looksLikePath && path.basename(p).toLowerCase() === qName));
      if (nameMatch || pathMatch) {
        matches.push({
          journey: entry.journey,
          lastScan: entry.lastScan || null,
          matchedComponent: { name, path: p },
          matchedAs: pathMatch ? 'path' : 'name',
        });
        break; // 1 match por jornada basta (nao duplica se o item aparecer 2x na mesma lista)
      }
    }
  }
  return matches;
}

// --- modo --journey <nome> -----------------------------------------------------
export function readJourneySnapshot(journeyName, outDir) {
  const idx = readIndex(outDir);
  const target = normHeading(journeyName);
  const indexEntry = idx.find((e) => e && normHeading(e.journey) === target);

  if (!indexEntry) {
    return {
      found: false,
      journey: journeyName,
      warnings: [
        `Jornada "${journeyName}" nao encontrada em journeys-index.json. Rode a ` +
        'lwc-pattern-documenter (Skill 1) primeiro, ou confira o nome exato com --list. ' +
        'NUNCA gere sem uma jornada de referencia confirmada.',
      ],
    };
  }

  const slug = slugFromHeading(indexEntry.journey);
  const snapshotPath = path.join(outDir, 'journeys', `${slug}.json`);
  if (!fs.existsSync(snapshotPath)) {
    return {
      found: false,
      journey: indexEntry.journey,
      indexEntry,
      warnings: [
        `Jornada "${indexEntry.journey}" esta documentada em design-patterns.md, mas NAO ` +
        `tem snapshot estruturado (journeys/${slug}.json). Na ultima vez que a Skill 1 ` +
        'rodou para esta jornada, --data nao foi passado ao pattern-writer.mjs. Peca para ' +
        're-rodar a Skill 1 com --data, ou prossiga so com o craft delegado (sem gate de ' +
        'aderencia baseado em sinais estruturados — informe isso ao usuario).',
      ],
    };
  }

  let snapshot;
  try {
    snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  } catch {
    return {
      found: false,
      journey: indexEntry.journey,
      warnings: [`Snapshot em ${snapshotPath} existe mas nao e um JSON valido. Corrija manualmente.`],
    };
  }

  const warnings = [];
  const stale = !!(indexEntry.lastScan && snapshot.lastScan && indexEntry.lastScan !== snapshot.lastScan);
  if (stale) {
    warnings.push(
      `STALENESS: o snapshot estruturado (lastScan=${snapshot.lastScan}) esta desatualizado ` +
      `em relacao ao journeys-index.json (lastScan=${indexEntry.lastScan}). A jornada foi ` +
      're-documentada sem passar --data — os sinais abaixo podem nao refletir a ultima ' +
      'versao do design-patterns.md. Considere pedir para re-rodar a Skill 1 com --data.'
    );
  }

  return { found: true, journey: indexEntry.journey, stale, snapshotPath, indexEntry, snapshot, warnings };
}

function main() {
  const outDirArg = arg('out-dir', DEFAULT_OUT_DIR);
  const outDir = typeof outDirArg === 'string' ? outDirArg : DEFAULT_OUT_DIR;

  if (arg('list')) {
    emit({ mode: 'list', journeys: listJourneys(outDir) });
  }

  const findQuery = arg('find-journey');
  if (typeof findQuery === 'string') {
    const matches = findJourney(findQuery, outDir);
    const warnings = [];
    if (matches.length === 0) {
      warnings.push(
        `Nenhuma jornada documentada contem o componente "${findQuery}". Ofereca ao usuario: ` +
        '(a) documentar via Skill 1, (b) seguir so com craft sem gate de aderencia, ou ' +
        '(c) escolher manualmente uma jornada aproximada como referencia.'
      );
    } else if (matches.length > 1) {
      warnings.push(
        `"${findQuery}" aparece em ${matches.length} jornadas diferentes — NAO escolha ` +
        'automaticamente, pergunte ao usuario qual usar como referencia.'
      );
    }
    emit({ mode: 'find-journey', query: findQuery, count: matches.length, matches, warnings });
  }

  const journeyName = arg('journey');
  if (typeof journeyName === 'string') {
    const result = readJourneySnapshot(journeyName, outDir);
    emit({ mode: 'journey', ...result }, result.found ? 0 : 1);
  }

  console.error('Uso: --journey "Nome" | --find-journey <nome-ou-path> | --list  [--out-dir <dir>]');
  process.exit(2);
}

// So roda o CLI (main) quando executado diretamente. Quando importado (ex.: por
// pattern-scorer.mjs, ou em testes), so as funcoes exportadas ficam disponiveis —
// importar nao pode disparar process.exit() por baixo dos panos.
import { fileURLToPath } from 'node:url';
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) main();
