#!/usr/bin/env node
// pattern-scorer.mjs — Rubrica de "Aderencia ao Design Pattern" da jornada + diff
// estrutural (modo Editar). NAO duplica qualidade generica de LWC: a rubrica PICKLES
// de 165pt (experience-lwc-generate) e o lint SLDS (design-systems-slds-apply) ja
// cobrem isso. Esta rubrica cobre SO o que e especifico da ORG, extraido 1:1 do
// snapshot da jornada (journeys/<slug>.json, gravado pela Skill 1).
//
// Uso:
//   # Modo Criar/Clonar — pontua o componente INTEIRO contra o aggregate da jornada:
//   node pattern-scorer.mjs --journey "Consorcio" --component <dir-do-componente>
//
//   # Modo Editar — pontua SO o DIFF estrutural (baseline vs proposto, por chave):
//   node pattern-scorer.mjs --journey "Consorcio" \
//     --baseline <dir-com-copia-do-componente-ANTES> --component <dir-do-componente-DEPOIS>
//
// Opcional:
//   --out-dir <dir>     base do snapshot (padrao: .lwc-pattern-documenter/lwc-design-system)
//   --extractor <path>  caminho do pattern-extractor.mjs da Skill 1 (padrao: sibling
//                       ../../lwc-pattern-documenter/scripts/pattern-extractor.mjs)
//
// Requisitos: Node 18+. Zero dependencias externas.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readJourneySnapshot } from './pattern-reader.mjs';

const DEFAULT_OUT_DIR = '.lwc-pattern-documenter/lwc-design-system';
const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_EXTRACTOR = path.join(THIS_DIR, '..', '..', 'lwc-pattern-documenter', 'scripts', 'pattern-extractor.mjs');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}

function uniq(arr) {
  return [...new Set((arr || []).filter((x) => x != null && x !== ''))];
}

// ===========================================================================
// EXTRACAO — invoca o pattern-extractor.mjs da Skill 1 (mesmo determinismo, nao
// reinventado aqui). Retorna o objeto de sinais do UNICO componente passado.
// ===========================================================================
export function extractComponentSignals(componentDir, extractorPath) {
  let raw;
  try {
    raw = execFileSync('node', [extractorPath, '--components', componentDir, '--journey', '_pattern_scorer_internal_'], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 16,
    });
  } catch (e) {
    throw new Error(`Falha ao rodar pattern-extractor.mjs em "${componentDir}": ${e.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`pattern-extractor.mjs nao devolveu JSON valido para "${componentDir}".`);
  }
  if (!Array.isArray(parsed.components) || parsed.components.length === 0) {
    throw new Error(`Componente nao encontrado ou ilegivel: ${componentDir}` + (parsed.missing ? ` (${JSON.stringify(parsed.missing)})` : ''));
  }
  return parsed.components[0];
}

// ===========================================================================
// RUBRICA — cada dimensao e uma funcao pura (candidateSignals, aggregate) ->
// { label, points, max, note }. Soma 100. Nao duplica craft generico (a11y fino,
// performance, etc. ficam com as skills delegadas) — so aderencia ao padrao da org.
// ===========================================================================

function itemsOf(freqTable) {
  return (freqTable || []).map((e) => e.item);
}

function dimEstrutura(c, agg) {
  const rootTags = agg?.html?.rootTags || {};
  const entries = Object.entries(rootTags);
  if (!entries.length) return { label: 'Estrutura (tag raiz)', points: 10, max: 10, note: 'jornada sem convencao de tag raiz registrada — credito integral' };
  const dominant = entries.sort((a, b) => b[1] - a[1])[0][0];
  const match = c?.html?.rootTag === dominant;
  return {
    label: 'Estrutura (tag raiz)',
    points: match ? 10 : 0,
    max: 10,
    note: match ? `usa "${dominant}" (dominante da jornada)` : `esperado "${dominant}", componente usa "${c?.html?.rootTag || '(nenhuma)'}"`,
  };
}

function dimNaming(c, agg) {
  let points = 0;
  const notes = [];
  const dominantStyle = agg?.naming?.dominantStyle;
  if (!dominantStyle || c?.naming?.style === dominantStyle) {
    points += 5;
    notes.push(dominantStyle ? `estilo "${c?.naming?.style}" bate com o dominante` : 'sem estilo dominante registrado');
  } else {
    notes.push(`esperado estilo "${dominantStyle}", componente e "${c?.naming?.style}"`);
  }
  const prefix = agg?.naming?.commonPrefix;
  if (!prefix) {
    points += 5;
    notes.push('sem prefixo comum registrado');
  } else if (String(c?.name || '').toLowerCase().startsWith(String(prefix).toLowerCase())) {
    points += 5;
    notes.push(`nome comeca com o prefixo "${prefix}"`);
  } else {
    notes.push(`esperado prefixo "${prefix}", nome "${c?.name}" nao comeca com ele`);
  }
  return { label: 'Naming', points, max: 10, note: notes.join('; ') };
}

function dimSlds(c, agg) {
  const common = new Set(itemsOf(agg?.html?.commonSldsClasses));
  const candidateClasses = uniq(c?.html?.sldsClasses);
  if (!common.size) return { label: 'Vocabulario SLDS', points: 15, max: 15, note: 'jornada sem vocabulario SLDS comum registrado — credito integral' };
  if (!candidateClasses.length) return { label: 'Vocabulario SLDS', points: 0, max: 15, note: 'componente nao usa nenhuma classe slds-*, mas a jornada tem vocabulario comum estabelecido' };
  const overlap = candidateClasses.filter((cl) => common.has(cl));
  const ratio = overlap.length / candidateClasses.length;
  const points = Math.round(15 * Math.max(ratio, overlap.length > 0 ? 0.5 : 0));
  return {
    label: 'Vocabulario SLDS',
    points: Math.min(points, 15),
    max: 15,
    note: overlap.length ? `reaproveita ${overlap.length}/${candidateClasses.length} classes do vocabulario comum` : 'nenhuma classe do componente aparece no vocabulario comum da jornada',
  };
}

function dimApiContract(c, agg) {
  const allApi = new Set(agg?.js?.allApiMembers || []);
  const candidateApi = uniq(c?.js?.apiMembers);
  let namePoints = 12;
  let nameNote = 'sem contrato @api registrado na jornada — credito integral';
  if (allApi.size) {
    if (!candidateApi.length) {
      namePoints = 0;
      nameNote = 'jornada tem contrato @api comum, componente nao expoe nenhum @api';
    } else {
      const overlap = candidateApi.filter((m) => allApi.has(m));
      namePoints = Math.round(12 * (overlap.length / candidateApi.length));
      nameNote = `${overlap.length}/${candidateApi.length} membros @api batem com o contrato conhecido da jornada`;
    }
  }
  const defaultsMap = new Map((agg?.js?.apiDefaults || []).map((d) => [d.name, d.value]));
  let defPoints = 8;
  let defNote = 'sem defaults de @api documentados — credito integral';
  if (defaultsMap.size) {
    const candidateDefaults = c?.js?.apiDefaults || [];
    const relevant = candidateDefaults.filter((d) => defaultsMap.has(d.name));
    if (!relevant.length) {
      const namesWithDefaultsUsedByCandidate = candidateApi.filter((m) => defaultsMap.has(m));
      defPoints = namesWithDefaultsUsedByCandidate.length ? 0 : 8;
      defNote = namesWithDefaultsUsedByCandidate.length
        ? `membro(s) ${namesWithDefaultsUsedByCandidate.join(', ')} tem default documentado na jornada, componente nao define`
        : 'componente nao usa nenhum @api que tenha default documentado — credito integral';
    } else {
      const matching = relevant.filter((d) => d.value === defaultsMap.get(d.name));
      defPoints = Math.round(8 * (matching.length / relevant.length));
      defNote = `${matching.length}/${relevant.length} defaults batem com o valor documentado da jornada`;
    }
  }
  return { label: 'Contrato @api (nomes + defaults)', points: namePoints + defPoints, max: 20, note: `${nameNote}; ${defNote}` };
}

function dimGetters(c, agg) {
  const allGetters = new Set(agg?.js?.allGetters || []);
  if (!allGetters.size) return { label: 'Getters/computed', points: 5, max: 5, note: 'sem getters recorrentes registrados — credito integral' };
  const candidateGetters = uniq(c?.js?.getters);
  if (!candidateGetters.length) return { label: 'Getters/computed', points: 2, max: 5, note: 'jornada usa getters recorrentes, componente nao define nenhum (pode ser legitimo dependendo do caso)' };
  const overlap = candidateGetters.filter((g) => allGetters.has(g));
  const points = Math.round(5 * (overlap.length / candidateGetters.length || 1));
  return { label: 'Getters/computed', points: Math.max(points, overlap.length ? points : 2), max: 5, note: `${overlap.length}/${candidateGetters.length} getters batem com os recorrentes da jornada` };
}

function dimSharedUtils(c, agg) {
  const shared = agg?.js?.sharedUtils || [];
  if (!shared.length) return { label: 'Utilitarios compartilhados', points: 10, max: 10, note: 'jornada sem utilitario compartilhado (sharedUtils) — credito integral' };
  const modules = shared.map((s) => s.module);
  const imports = uniq(c?.js?.imports);
  const used = modules.filter((m) => imports.includes(m));
  if (used.length) return { label: 'Utilitarios compartilhados', points: 10, max: 10, note: `reaproveita ${used.join(', ')}` };
  return {
    label: 'Utilitarios compartilhados',
    points: 3,
    max: 10,
    note: `jornada tem utilitario(s) compartilhado(s) (${modules.join(', ')}) usados por varios componentes; este componente nao importa nenhum — revisar se nao esta reinventando logica ja existente`,
  };
}

function dimEventContracts(c, agg) {
  const contracts = new Map((agg?.js?.eventContracts || []).map((e) => [e.name, e]));
  const candidateEvents = c?.js?.eventDetails || [];
  const relevant = candidateEvents.filter((e) => contracts.has(e.name));
  if (!relevant.length) return { label: 'Contrato de eventos', points: 10, max: 10, note: candidateEvents.length ? 'eventos do componente nao coincidem em nome com nenhum evento conhecido da jornada — nada para comparar' : 'componente nao dispara eventos — nada para comparar' };
  let matchedScore = 0;
  const details = [];
  for (const e of relevant) {
    const ref = contracts.get(e.name);
    let m = 0;
    if (e.bubbles === ref.bubbles) m++;
    if (e.composed === ref.composed) m++;
    const refKeys = new Set(ref.detailKeys || []);
    const keyOverlap = (e.detailKeys || []).filter((k) => refKeys.has(k)).length;
    const keyRatio = refKeys.size ? keyOverlap / refKeys.size : 1;
    matchedScore += (m / 2) * 0.6 + keyRatio * 0.4;
    if (m < 2) details.push(`"${e.name}": bubbles/composed diferem do padrao (${JSON.stringify(ref)} vs ${JSON.stringify(e)})`);
  }
  const points = Math.round(10 * (matchedScore / relevant.length));
  return { label: 'Contrato de eventos', points, max: 10, note: details.length ? details.join('; ') : `${relevant.length} evento(s) seguem o contrato da jornada (bubbles/composed/detail)` };
}

function dimApexCallStyle(c, agg) {
  if (!c?.js?.apexCallStyle) return { label: 'Forma da chamada Apex', points: 5, max: 5, note: 'componente nao usa Apex imperativo — nada para comparar' };
  const acs = agg?.js?.apexCallStyle || {};
  // So ha uma "forma dominante" de verdade se algum componente da jornada de fato usa
  // Apex imperativo (senao "dominant" seria fabricado do nada e penalizaria a toa).
  const totalSignals = (acs.usesThen || 0) + (acs.usesAwait || 0) + (acs.usesTryCatch || 0);
  if (totalSignals === 0) {
    return { label: 'Forma da chamada Apex', points: 5, max: 5, note: 'jornada sem convencao de forma de chamada Apex registrada — credito integral' };
  }
  const dominant = (acs.usesAwait || 0) >= (acs.usesThen || 0) ? 'usesAwait' : 'usesThen';
  const match = !!c.js.apexCallStyle[dominant];
  return {
    label: 'Forma da chamada Apex',
    points: match ? 5 : 2,
    max: 5,
    note: match
      ? `usa ${dominant}, consistente com a jornada`
      : `jornada e dominantemente ${dominant} (${Math.max(acs.usesThen || 0, acs.usesAwait || 0)} ocorrencias), componente nao usa essa forma`,
  };
}

function dimLoadingErro(c, agg) {
  let points = 0;
  const notes = [];
  const spinnerConv = (agg?.html?.spinnerUsers || 0) > 0;
  if (!spinnerConv || c?.js?.hasLoadingState) {
    points += 2.5;
    notes.push(spinnerConv ? 'estado de loading presente, como a jornada convenciona' : 'jornada sem convencao de loading');
  } else {
    notes.push('jornada padroniza estado de loading, componente nao tem');
  }
  const toastConv = (agg?.js?.toast?.users || 0) > 0;
  if (!toastConv || c?.js?.usesShowToast) {
    points += 2.5;
    notes.push(toastConv ? 'usa ShowToastEvent, como a jornada convenciona' : 'jornada sem convencao de toast');
  } else {
    notes.push('jornada padroniza feedback via ShowToastEvent, componente nao usa');
  }
  return { label: 'Loading & Erro', points, max: 5, note: notes.join('; ') };
}

function dimI18n(c, agg) {
  const conv = (agg?.js?.labelUsers || 0) > 0;
  if (!conv) return { label: 'i18n (Custom Labels)', points: 5, max: 5, note: 'jornada sem convencao de Custom Labels — credito integral' };
  const uses = (c?.js?.labels || []).length > 0;
  return { label: 'i18n (Custom Labels)', points: uses ? 5 : 1, max: 5, note: uses ? 'usa Custom Labels, como a jornada convenciona' : 'jornada usa Custom Labels como convencao, componente usa texto hardcoded' };
}

function dimA11y(c, agg) {
  const avg = agg?.html?.a11yAvg || 0;
  const score = c?.html?.a11yScore || 0;
  if (avg === 0) return { label: 'Acessibilidade (baseline)', points: 5, max: 5, note: 'jornada sem media de a11y registrada (nenhum sinal observado) — credito integral' };
  if (score >= avg) return { label: 'Acessibilidade (baseline)', points: 5, max: 5, note: `score ${score} >= media da jornada (${avg})` };
  return { label: 'Acessibilidade (baseline)', points: 2, max: 5, note: `score ${score} abaixo da media da jornada (${avg}) — nao bloqueia, mas revisar` };
}

const DIMENSIONS = [
  dimEstrutura, dimNaming, dimSlds, dimApiContract, dimGetters,
  dimSharedUtils, dimEventContracts, dimApexCallStyle, dimLoadingErro, dimI18n, dimA11y,
];

// Pontua um componente (candidato INTEIRO, ou um "delta" no modo Editar) contra o
// aggregate da jornada. Retorna { total, max, dimensions: [...] }.
export function scoreCandidate(candidateSignals, journeyAggregate) {
  const dimensions = DIMENSIONS.map((fn) => fn(candidateSignals, journeyAggregate || {}));
  const total = dimensions.reduce((s, d) => s + d.points, 0);
  const max = dimensions.reduce((s, d) => s + d.max, 0);
  return { total: Math.round(total), max, dimensions };
}

// ===========================================================================
// DIFF ESTRUTURAL (modo Editar) — compara baseline (antes) vs proposto (depois) POR
// CHAVE, nao por linha. So o que e NOVO/ALTERADO entra na pontuacao (via um "delta
// pseudo-componente" que so tem os itens adicionados); sinal legado intocado nao
// penaliza. Deteccao SEPARADA de regressao: itens REMOVIDOS que eram convencao
// documentada da jornada viram aviso explicito, distinto de "legado intocado".
// ===========================================================================

const LIST_FIELDS = [
  ['js', 'apiMembers'], ['js', 'getters'], ['js', 'imports'], ['js', 'labels'],
  ['html', 'sldsClasses'], ['html', 'lightningTags'], ['html', 'customTags'],
  ['html', 'eventListeners'], ['html', 'boundAttributes'],
];

function getPath(obj, keys) {
  return keys.reduce((o, k) => (o ? o[k] : undefined), obj) || [];
}
function setPath(obj, keys, value) {
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) { o[keys[i]] = o[keys[i]] || {}; o = o[keys[i]]; }
  o[keys[keys.length - 1]] = value;
}

// Retorna { delta, removed } — `delta` e um pseudo-componente com SO os itens novos
// (para pontuar), `removed` lista o que sumiu por campo (para checar regressao).
export function diffSignals(baseline, after) {
  const delta = JSON.parse(JSON.stringify(after || {}));
  const removed = {};

  for (const keys of LIST_FIELDS) {
    const beforeList = uniq(getPath(baseline, keys));
    const afterList = uniq(getPath(after, keys));
    const beforeSet = new Set(beforeList);
    const afterSet = new Set(afterList);
    setPath(delta, keys, afterList.filter((x) => !beforeSet.has(x)));
    const rem = beforeList.filter((x) => !afterSet.has(x));
    if (rem.length) setPath(removed, keys, rem);
  }

  // eventDetails: novo = evento cujo nome nao existia antes; removido = existia antes, nao existe depois.
  const beforeEvents = new Map((baseline?.js?.eventDetails || []).map((e) => [e.name, e]));
  const afterEvents = after?.js?.eventDetails || [];
  const newEvents = afterEvents.filter((e) => !beforeEvents.has(e.name));
  const removedEvents = [...beforeEvents.keys()].filter((n) => !afterEvents.some((e) => e.name === n));
  setPath(delta, ['js', 'eventDetails'], newEvents);
  setPath(delta, ['js', 'events'], newEvents.map((e) => e.name));
  if (removedEvents.length) setPath(removed, ['js', 'events'], removedEvents);

  // Flags booleanas: so contam como "delta" se a transicao foi false->true (nova
  // adocao); false->false ou true->true (ja existia) nao entram no delta.
  const becameTrue = (b, a) => !b && a;
  delta.js = delta.js || {};
  delta.js.hasLoadingState = becameTrue(baseline?.js?.hasLoadingState, after?.js?.hasLoadingState);
  delta.js.usesShowToast = becameTrue(baseline?.js?.usesShowToast, after?.js?.usesShowToast);
  if (baseline?.js?.hasLoadingState && !after?.js?.hasLoadingState) setPath(removed, ['js', 'loadingState'], true);
  if (baseline?.js?.usesShowToast && !after?.js?.usesShowToast) setPath(removed, ['js', 'toast'], true);

  return { delta, removed };
}

// Indice das dimensoes (mesma ordem de DIMENSIONS) que decide se algo REALMENTE mudou
// para aquela dimensao entre baseline e depois. Se NADA mudou, a dimensao e EXCLUIDA
// do total/max (nao e pontuada como cheia nem como zero) — e assim que "sinal legado
// intocado nao penaliza" e implementado: em vez de reusar o mesmo candidato inteiro
// (o que faria uma lista de delta vazia parecer "zero classes SLDS" e penalizar por
// engano), so avaliamos as dimensoes onde delta/removed mostram alteracao real.
const DIMENSION_CHANGE_CHECKS = [
  (delta, removed, before, after) => (before?.html?.rootTag || null) !== (after?.html?.rootTag || null), // Estrutura
  (delta, removed, before, after) => (before?.naming?.style || null) !== (after?.naming?.style || null) || (before?.name || null) !== (after?.name || null), // Naming
  (delta, removed) => (delta?.html?.sldsClasses || []).length > 0 || getPath(removed, ['html', 'sldsClasses']).length > 0, // SLDS
  (delta, removed, before, after) =>
    (delta?.js?.apiMembers || []).length > 0 ||
    getPath(removed, ['js', 'apiMembers']).length > 0 ||
    JSON.stringify(before?.js?.apiDefaults || []) !== JSON.stringify(after?.js?.apiDefaults || []), // @api
  (delta, removed) => (delta?.js?.getters || []).length > 0 || getPath(removed, ['js', 'getters']).length > 0, // Getters
  (delta, removed, before, after, agg) => {
    // So conta como "mudou" se a presenca de um modulo SHARED (nao qualquer import
    // qualquer) mudou — senao remover um import nao relacionado (ex.: ShowToastEvent)
    // re-litigaria esta dimensao por engano.
    const sharedModules = (agg?.js?.sharedUtils || []).map((s) => s.module);
    if (!sharedModules.length) return false;
    const beforeSet = new Set(before?.js?.imports || []);
    const afterSet = new Set(after?.js?.imports || []);
    return sharedModules.some((m) => beforeSet.has(m) !== afterSet.has(m));
  }, // sharedUtils
  (delta, removed) => (delta?.js?.eventDetails || []).length > 0 || getPath(removed, ['js', 'events']).length > 0, // eventos
  (delta, removed, before, after) => JSON.stringify(before?.js?.apexCallStyle || null) !== JSON.stringify(after?.js?.apexCallStyle || null), // apex call style
  (delta, removed) => !!(delta?.js?.hasLoadingState || delta?.js?.usesShowToast || removed?.js?.loadingState || removed?.js?.toast), // loading/erro
  (delta, removed) => (delta?.js?.labels || []).length > 0 || getPath(removed, ['js', 'labels']).length > 0, // i18n
  (delta, removed, before, after) => (before?.html?.a11yScore || 0) !== (after?.html?.a11yScore || 0), // a11y
];

// Pontua SO o DIFF estrutural (modo Editar): dimensoes sem alteracao real sao
// EXCLUIDAS do total/max (nao contam nem a favor nem contra); dimensoes com
// alteracao sao pontuadas com o `delta` (so os itens novos), reusando as mesmas
// funcoes de dimensao do modo inteiro.
export function scoreDiff(delta, removed, baselineSignals, afterSignals, aggregate) {
  const all = DIMENSIONS.map((fn, i) => ({ i, result: fn(delta, aggregate || {}) }));
  const changed = all.filter(({ i }) => DIMENSION_CHANGE_CHECKS[i](delta, removed, baselineSignals, afterSignals, aggregate));
  const skippedUnchanged = all
    .filter(({ i }) => !DIMENSION_CHANGE_CHECKS[i](delta, removed, baselineSignals, afterSignals, aggregate))
    .map(({ result }) => result.label);
  const total = changed.reduce((s, { result }) => s + result.points, 0);
  const max = changed.reduce((s, { result }) => s + result.max, 0);
  return { total: Math.round(total), max, dimensions: changed.map((x) => x.result), skippedUnchanged };
}

// Cruza os itens REMOVIDOS com o que e convencao DOCUMENTADA da jornada (aparece nos
// sinais compartilhados do aggregate) — so isso vira aviso de regressao explicito.
export function detectRegressions(removed, aggregate) {
  const warnings = [];
  const commonApi = new Set(aggregate?.js?.allApiMembers || []);
  for (const m of getPath(removed, ['js', 'apiMembers'])) {
    if (commonApi.has(m)) warnings.push(`REGRESSAO: removeu o membro @api "${m}", que faz parte do contrato comum da jornada.`);
  }
  const commonEvents = new Set((aggregate?.js?.eventContracts || []).map((e) => e.name));
  for (const ev of getPath(removed, ['js', 'events'])) {
    if (commonEvents.has(ev)) warnings.push(`REGRESSAO: removeu o evento "${ev}", que faz parte do contrato de eventos da jornada.`);
  }
  if (removed?.js?.loadingState && (aggregate?.html?.spinnerUsers || 0) > 0) {
    warnings.push('REGRESSAO: removeu o estado de loading, que e convencao desta jornada (spinner).');
  }
  if (removed?.js?.toast && (aggregate?.js?.toast?.users || 0) > 0) {
    warnings.push('REGRESSAO: removeu o feedback via ShowToastEvent, que e convencao desta jornada.');
  }
  const labelsRemoved = getPath(removed, ['js', 'labels']);
  if (labelsRemoved.length && (aggregate?.js?.labelUsers || 0) > 0) {
    warnings.push(`REGRESSAO: removeu o uso de Custom Label(s) (${labelsRemoved.join(', ')}), que e convencao desta jornada (i18n).`);
  }
  return warnings;
}

// ===========================================================================
// FLAG DE NOVIDADE — gatilho objetivo para sugerir "rode a Skill 1 de novo": um item
// usado pelo candidato que NAO aparece nem nos padroes compartilhados nem em
// componentSpecifics de NENHUM componente da jornada.
// ===========================================================================
export function detectNovelty(candidateSignals, aggregate) {
  const known = new Set([
    ...(aggregate?.js?.allApiMembers || []),
    ...(aggregate?.js?.allEvents || []),
    ...(aggregate?.html?.commonSldsClasses || []).map((e) => e.item),
    ...(aggregate?.partialConventions?.sldsClasses || []).map((e) => e.item),
  ]);
  for (const specifics of Object.values(aggregate?.componentSpecifics || {})) {
    for (const items of Object.values(specifics?.unique || {})) {
      for (const it of items) known.add(it);
    }
  }
  const candidateItems = [
    ...uniq(candidateSignals?.js?.apiMembers),
    ...uniq(candidateSignals?.js?.events),
    ...uniq(candidateSignals?.html?.sldsClasses),
  ];
  const novel = candidateItems.filter((it) => !known.has(it));
  return { novel: novel.length > 0, items: uniq(novel) };
}

// ===========================================================================
// CLI
// ===========================================================================
function main() {
  const journeyName = arg('journey');
  const componentDir = arg('component');
  const baselineDir = arg('baseline');
  const outDirArg = arg('out-dir', DEFAULT_OUT_DIR);
  const outDir = typeof outDirArg === 'string' ? outDirArg : DEFAULT_OUT_DIR;
  const extractorArg = arg('extractor', DEFAULT_EXTRACTOR);
  const extractorPath = typeof extractorArg === 'string' ? extractorArg : DEFAULT_EXTRACTOR;

  if (typeof journeyName !== 'string' || typeof componentDir !== 'string') {
    console.error('Uso: --journey "Nome" --component <dir> [--baseline <dir>] [--out-dir <dir>] [--extractor <path>]');
    process.exit(2);
  }

  const snap = readJourneySnapshot(journeyName, outDir);
  if (!snap.found) {
    console.log(JSON.stringify({ ok: false, warnings: snap.warnings }, null, 2));
    process.exit(1);
  }
  const aggregate = snap.snapshot.aggregate;

  let afterSignals;
  try {
    afterSignals = extractComponentSignals(componentDir, extractorPath);
  } catch (e) {
    console.log(JSON.stringify({ ok: false, warnings: [e.message] }, null, 2));
    process.exit(1);
  }

  let result;
  if (typeof baselineDir === 'string') {
    let baselineSignals;
    try {
      baselineSignals = extractComponentSignals(baselineDir, extractorPath);
    } catch (e) {
      console.log(JSON.stringify({ ok: false, warnings: [e.message] }, null, 2));
      process.exit(1);
    }
    const { delta, removed } = diffSignals(baselineSignals, afterSignals);
    const score = scoreDiff(delta, removed, baselineSignals, afterSignals, aggregate);
    const regressions = detectRegressions(removed, aggregate);
    result = { ok: true, mode: 'diff', journey: snap.journey, stale: snap.stale, score, removed, regressions };
  } else {
    const score = scoreCandidate(afterSignals, aggregate);
    result = { ok: true, mode: 'whole', journey: snap.journey, stale: snap.stale, score };
  }

  const novelty = detectNovelty(afterSignals, aggregate);
  result.novelty = novelty;
  result.warnings = snap.warnings || [];
  console.log(JSON.stringify(result, null, 2));
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) main();
