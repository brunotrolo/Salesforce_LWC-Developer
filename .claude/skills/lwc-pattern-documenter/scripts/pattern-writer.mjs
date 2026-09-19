#!/usr/bin/env node
/**
 * pattern-writer.mjs — Merge writer DETERMINISTICO do documento de design system.
 *
 * POR QUE EXISTE: a escrita NUNCA pode depender de o modelo lembrar de preservar o
 * resto do arquivo. Um modelo fraco ja sobrescreveu o design-patterns.md inteiro
 * (apagando uma jornada ja documentada) em vez de anexar uma secao nova. Este script
 * faz o merge mecanicamente:
 *   - Jornada nova     -> ANEXA a secao; toda jornada existente permanece intacta.
 *   - Jornada existente -> substitui SO a secao `## Padrao: <nome>` dela, mantendo o
 *                          cabecalho, a ordem e as demais jornadas.
 * E faz upsert do journeys-index.json do mesmo jeito seguro (nunca zera o array).
 *
 * Uso:
 *   node pattern-writer.mjs \
 *     --journey "Consorcio" \
 *     --components compA,compB,compC \
 *     --section /caminho/para/section.md        # o Markdown aprovado DESTA jornada
 *
 *   # a secao tambem pode vir por stdin:
 *   cat section.md | node pattern-writer.mjs --journey "X" --components a,b,c --stdin
 *
 * Opcional:
 *   --out-dir <dir>   base (padrao: .lwc-pattern-documenter/lwc-design-system)
 *   --dry-run         imprime o merge no stdout, nao grava nada
 *   --data <arquivo>  saida COMPLETA do pattern-extractor.mjs (ou so o objeto `aggregate`)
 *                     para esta jornada. Se fornecida, persiste um snapshot JSON
 *                     estruturado em journeys/<slug>.json — a fonte determinística que a
 *                     Skill 3 (lwc-pattern-generator) le de volta, em vez de reparsear a
 *                     prosa Markdown. Valida que os componentes do arquivo batem com
 *                     --components (aborta sem gravar nada se nao baterem — o snapshot
 *                     precisa corresponder exatamente ao que foi documentado).
 */

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_OUT_DIR = '.lwc-pattern-documenter/lwc-design-system';
const DOC_HEADER = '# Design Patterns LWC — Documentação por Jornada';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { journey: '', components: [], sectionFile: '', stdin: false, outDir: DEFAULT_OUT_DIR, dryRun: false, dataFile: '' };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--journey': opts.journey = args[++i] || ''; break;
      case '--components': opts.components = (args[++i] || '').split(',').map((c) => c.trim()).filter(Boolean); break;
      case '--section': opts.sectionFile = args[++i] || ''; break;
      case '--stdin': opts.stdin = true; break;
      case '--out-dir': opts.outDir = args[++i] || DEFAULT_OUT_DIR; break;
      case '--dry-run': opts.dryRun = true; break;
      case '--data': opts.dataFile = args[++i] || ''; break;
      default: break;
    }
  }
  return opts;
}

function today() {
  // Script node normal (nao Workflow) — new Date() e permitido aqui.
  return new Date().toISOString().slice(0, 10);
}

// Normaliza um titulo de jornada para comparacao (sem acento, minusculo).
function normHeading(name) {
  return String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

// Slug de arquivo para o snapshot journeys/<slug>.json — reaproveita normHeading (mesma
// normalizacao usada no merge do Markdown/indice) e so acrescenta a troca de espacos/
// caracteres especiais por hifen. Garante 1:1 nome<->slug<->json<->secao<->indice.
function slugFromHeading(name) {
  const slug = normHeading(name).replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
  return slug || 'journey';
}

// Divide o doc num cabecalho + lista ORDENADA de secoes { name, text }.
function parseDoc(content) {
  const lines = content.split('\n');
  const sections = [];
  const headerLines = [];
  let current = null;
  let inSection = false;
  for (const line of lines) {
    const m = line.match(/^##\s+Padr[aã]o:\s*(.+?)\s*$/);
    if (m) {
      if (current) sections.push(current);
      current = { name: m[1].trim(), lines: [line] };
      inSection = true;
    } else if (inSection) {
      current.lines.push(line);
    } else {
      headerLines.push(line);
    }
  }
  if (current) sections.push(current);
  return {
    header: headerLines.join('\n').replace(/\s+$/, ''),
    sections: sections.map((s) => ({ name: s.name, text: s.lines.join('\n').replace(/\s+$/, '') })),
  };
}

function buildDoc(header, sections) {
  const h = header && header.trim() ? header.trim() : DOC_HEADER;
  const parts = [h, ''];
  for (const s of sections) { parts.push(s.text.trim()); parts.push(''); }
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n';
}

function ensureSectionHeading(sectionMd, journey) {
  const trimmed = sectionMd.replace(/^\s+/, '').replace(/\s+$/, '');
  if (/^##\s+Padr[aã]o:/.test(trimmed)) return trimmed;
  return `## Padrao: ${journey}\n\n${trimmed}`;
}

function mergeDoc(existingContent, journey, sectionMd) {
  const section = ensureSectionHeading(sectionMd, journey);
  const target = normHeading(journey);
  if (!existingContent || !existingContent.trim()) {
    return buildDoc(DOC_HEADER, [{ name: journey, text: section }]);
  }
  const { header, sections } = parseDoc(existingContent);
  const idx = sections.findIndex((s) => normHeading(s.name) === target);
  if (idx >= 0) sections[idx] = { name: journey, text: section };
  else sections.push({ name: journey, text: section });
  return buildDoc(header, sections);
}

// Enriquece cada componente (recebido como PATH, ex.: force-app/.../lwc/fooBar) para
// { name, path } — elimina ambiguidade de nome duplicado entre pastas e e a base do
// lookup reverso componente->jornada (Skill 3). NAO e breaking: entradas antigas do
// indice (strings soltas) continuam existindo intactas ate serem re-escritas; quem le
// o indice deve aceitar os dois formatos (`typeof c === 'string' ? {name: c, path: null} : c`).
function enrichComponents(rawComponents) {
  return rawComponents.map((c) => ({ name: path.basename(c), path: c }));
}

function mergeIndex(existingJson, journey, components) {
  let arr = [];
  if (existingJson && existingJson.trim()) {
    let parsed;
    try { parsed = JSON.parse(existingJson); } catch {
      throw new Error('journeys-index.json existe mas nao e um JSON de array valido. Corrija manualmente antes de gravar (nao vou sobrescrever para nao perder jornadas).');
    }
    if (Array.isArray(parsed)) arr = parsed;
  }
  const target = normHeading(journey);
  const idx = arr.findIndex((e) => e && normHeading(e.journey) === target);
  const entry = {
    journey,
    components: components.length ? enrichComponents(components) : idx >= 0 ? arr[idx].components : [],
    lastScan: today(),
  };
  if (idx >= 0) arr[idx] = entry; else arr.push(entry);
  return arr;
}

// Le e valida o --data (saida completa do pattern-extractor.mjs, ou so o `aggregate`).
// Aceita as duas formas: se tiver `.aggregate`, trata como saida completa (usa
// `.components[].name` para validar); senao trata o proprio objeto como o aggregate
// (sem lista de componentes para validar contra --components).
// Aborta (retorna erro) se os nomes nao baterem com --components — o snapshot precisa
// corresponder EXATAMENTE ao que foi documentado, nunca uma amostra diferente.
function loadDataSnapshot(dataFile, journey, components) {
  if (!fs.existsSync(dataFile)) {
    throw new Error(`--data: arquivo nao encontrado: ${dataFile}`);
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch {
    throw new Error(`--data: ${dataFile} nao e um JSON valido.`);
  }
  const aggregate = raw && raw.aggregate ? raw.aggregate : raw;
  const dataComponentNames = Array.isArray(raw?.components)
    ? raw.components.map((c) => c && c.name).filter(Boolean)
    : null;

  if (dataComponentNames) {
    const wanted = new Set(components.map((c) => path.basename(c)));
    const got = new Set(dataComponentNames);
    const missingFromData = [...wanted].filter((w) => !got.has(w));
    const extraInData = [...got].filter((g) => !wanted.has(g));
    if (missingFromData.length || extraInData.length) {
      throw new Error(
        `--data nao bate com --components. Faltando no --data: ${missingFromData.join(', ') || '(nenhum)'}; ` +
        `a mais no --data: ${extraInData.join(', ') || '(nenhum)'}. Abortando sem gravar (o snapshot precisa ` +
        `corresponder exatamente ao que foi documentado).`
      );
    }
  }

  return {
    journey,
    lastScan: today(),
    componentsScanned: dataComponentNames ? dataComponentNames.length : (raw?.componentsScanned ?? null),
    components: enrichComponents(components),
    aggregate,
  };
}

function main() {
  const opts = parseArgs();
  if (!opts.journey) { console.error('ERRO: --journey e obrigatorio.'); process.exit(1); }

  // Valida o --data ANTES de qualquer escrita (nao so no final) — se nao bater com
  // --components, aborta sem tocar em nada, exatamente como a trava de integridade
  // de jornadas abaixo.
  let snapshot = null;
  if (opts.dataFile) {
    try {
      snapshot = loadDataSnapshot(opts.dataFile, opts.journey, opts.components);
    } catch (e) {
      console.error(`ERRO: ${e.message}`);
      process.exit(2);
    }
  }

  let sectionMd = '';
  if (opts.stdin) sectionMd = fs.readFileSync(0, 'utf8');
  else if (opts.sectionFile) {
    if (!fs.existsSync(opts.sectionFile)) { console.error(`ERRO: arquivo de secao nao encontrado: ${opts.sectionFile}`); process.exit(1); }
    sectionMd = fs.readFileSync(opts.sectionFile, 'utf8');
  } else { console.error('ERRO: forneca a secao via --section <arquivo> ou --stdin.'); process.exit(1); }
  if (!sectionMd.trim()) { console.error('ERRO: a secao Markdown esta vazia. Nao vou gravar.'); process.exit(1); }

  const docPath = path.join(opts.outDir, 'design-patterns.md');
  const indexPath = path.join(opts.outDir, 'journeys-index.json');
  const existingDoc = fs.existsSync(docPath) ? fs.readFileSync(docPath, 'utf8') : '';
  const existingIndex = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';

  const beforeJourneys = existingDoc ? parseDoc(existingDoc).sections.map((s) => s.name) : [];
  const mergedDoc = mergeDoc(existingDoc, opts.journey, sectionMd);
  const mergedIndex = mergeIndex(existingIndex, opts.journey, opts.components);
  const afterJourneys = parseDoc(mergedDoc).sections.map((s) => s.name);

  // INVARIANTE DE SEGURANCA: gravar a jornada N nunca pode perder as jornadas 1..N-1.
  const lost = beforeJourneys.filter((b) => !afterJourneys.some((a) => normHeading(a) === normHeading(b)));
  if (lost.length) { console.error(`ERRO DE INTEGRIDADE: o merge perderia jornada(s): ${lost.join(', ')}. Abortando sem gravar.`); process.exit(2); }

  const isNew = !beforeJourneys.some((b) => normHeading(b) === normHeading(opts.journey));

  const journeysDir = path.join(opts.outDir, 'journeys');
  const slug = slugFromHeading(opts.journey);
  const snapshotPath = snapshot ? path.join(journeysDir, `${slug}.json`) : null;

  if (opts.dryRun) {
    console.log('===== design-patterns.md (merged) =====\n' + mergedDoc);
    console.log('===== journeys-index.json (merged) =====\n' + JSON.stringify(mergedIndex, null, 2));
    if (snapshot) console.log(`===== ${snapshotPath} (novo) =====\n` + JSON.stringify(snapshot, null, 2));
    console.log('\n[dry-run] nada foi gravado.');
    return;
  }

  fs.mkdirSync(opts.outDir, { recursive: true });
  fs.writeFileSync(docPath, mergedDoc, 'utf8');
  fs.writeFileSync(indexPath, JSON.stringify(mergedIndex, null, 2) + '\n', 'utf8');
  if (snapshot) {
    fs.mkdirSync(journeysDir, { recursive: true });
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  }

  console.log(JSON.stringify({
    ok: true, action: isNew ? 'appended' : 'updated', journey: opts.journey,
    journeysBefore: beforeJourneys.length, journeysAfter: afterJourneys.length,
    allJourneys: afterJourneys, docPath, indexPath, snapshotPath,
  }, null, 2));
}

main();
