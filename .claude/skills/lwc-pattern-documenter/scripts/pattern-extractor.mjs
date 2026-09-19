#!/usr/bin/env node
// pattern-extractor.mjs
// ---------------------------------------------------------------------------
// Extrator DETERMINISTICO de sinais de design de Lightning Web Components (LWC).
//
// E o "sinal deterministico" da skill lwc-pattern-documenter: em vez de o agente
// ler cada arquivo e adivinhar convencoes, ele recebe um JSON compacto com os
// sinais ja extraidos — POR componente e AGREGADO, com deteccao de DIVERGENCIA e
// de CONVENCOES PARCIAIS. Alem do basico (naming, imports/decorators/eventos no JS,
// slots/ARIA no HTML, custom properties/cores no CSS, metadados), extrai a RECEITA
// necessaria para GERAR um componente no estilo da jornada: esqueleto estrutural do
// HTML (composicao), classes utilitarias SLDS, padrao de loading/erro (spinner/toast),
// forma da chamada Apex (then/await/try-catch/refreshApex), Custom Labels e testes Jest.
//
// Filosofia (herdada do apex-test-loop): o SCRIPT mede/extrai de forma mecanica;
// o AGENTE julga, negocia divergencia com o usuario, e escreve o Markdown. O
// script NUNCA escreve arquivo de componente nem de documentacao — so le e emite.
//
// Uso:
//   node pattern-extractor.mjs --components <p1,p2,...> [--journey "Nome"]
//   node pattern-extractor.mjs --list <lwc-root>        (lista LWCs p/ o menu)
//
//   --components  caminhos de PASTAS de LWC (cada uma com .js/.html/.css/.js-meta.xml)
//                 ou de arquivos soltos; separados por virgula.
//   --journey     nome da jornada/produto (so ecoado no output, p/ rastreio).
//   --list        lista os componentes LWC sob uma raiz (para o modo de selecao
//                 interativo — regra 1 da arquitetura: caminho manual OU menu).
//   --min N       minimo de componentes para considerar o padrao confiavel
//                 (padrao 3 — regra 2 da arquitetura; abaixo disso, minComponentsMet=false).
//   --max N       teto RECOMENDADO de componentes por analise (padrao 10). NAO bloqueia:
//                 acima dele, withinRecommendedMax=false + warning sugerindo dividir em
//                 sub-jornadas coesas (o modelo fraco tende a esquecer itens em listas grandes).
//
// Requisitos: Node 18+. Zero dependencias externas.
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { basename, join, extname } from 'node:path';

function arg(name, def = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}

function emit(obj, code = 0) {
  console.log(JSON.stringify(obj, null, 2));
  process.exit(code);
}

function readSafe(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

// Todos os matches de um regex global (retorna o grupo 1, ou o match inteiro).
function allMatches(re, str, group = 1) {
  const out = [];
  let m;
  const rx = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  while ((m = rx.exec(str)) !== null) {
    out.push(m[group] !== undefined ? m[group] : m[0]);
    if (m.index === rx.lastIndex) rx.lastIndex++;
  }
  return out;
}

function uniq(arr) {
  return [...new Set(arr.filter((x) => x != null && x !== ''))];
}

// Remocao de COMENTARIOS antes de qualquer extracao. Codigo comentado NAO e padrao —
// se vazasse, o extrator reportaria imports/eventos/tags/cores/ARIA que nao existem e a
// Skill 3 geraria em cima de "fantasmas". Estrategia conservadora: comentarios de bloco
// (/* */ e <!-- -->) + comentarios de LINHA INTEIRA (^//). Evita mexer em `//` dentro de
// strings/URLs (esses nunca comecam a linha), cobrindo o caso real de codigo comentado.
function stripJsComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}
function stripHtmlComments(src) {
  return src.replace(/<!--[\s\S]*?-->/g, '');
}
function stripCssComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '');
}

// ---------------------------------------------------------------------------
// MODO --list: enumerar LWCs sob uma raiz (para o menu de selecao interativo)
// ---------------------------------------------------------------------------
function listComponents(root) {
  const found = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    // Uma pasta e um LWC se contem <nome>.js + <nome>.js-meta.xml
    const name = basename(dir);
    const hasBundle =
      existsSync(join(dir, `${name}.js`)) && existsSync(join(dir, `${name}.js-meta.xml`));
    if (hasBundle) {
      found.push({ name, path: dir });
      return; // nao desce dentro de um bundle
    }
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
        walk(join(dir, e.name));
      }
    }
  };
  walk(root);
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Resolucao: cada --components pode ser uma PASTA de bundle ou um arquivo solto.
// Retorna { name, path, files: {js, html, css, meta} } por componente.
// ---------------------------------------------------------------------------
function resolveComponent(p) {
  if (!existsSync(p)) return { name: basename(p), path: p, missing: true, files: {} };
  const st = statSync(p);
  if (st.isDirectory()) {
    const name = basename(p);
    const pick = (ext) => {
      const f = join(p, `${name}${ext}`);
      return existsSync(f) ? f : null;
    };
    // Teste Jest companheiro: <name>.test.js na pasta ou em __tests__/
    const testFile =
      pick('.test.js') ||
      (existsSync(join(p, '__tests__', `${name}.test.js`))
        ? join(p, '__tests__', `${name}.test.js`)
        : null);
    return {
      name,
      path: p,
      files: {
        js: pick('.js'),
        html: pick('.html'),
        css: pick('.css'),
        meta: pick('.js-meta.xml'),
        test: testFile,
      },
    };
  }
  // Arquivo solto: agrupa pelos irmaos de mesmo basename
  const dir = p.slice(0, p.length - basename(p).length) || '.';
  const stem = basename(p).replace(/\.(js|html|css)$|\.js-meta\.xml$/i, '');
  const pick = (ext) => {
    const f = join(dir, `${stem}${ext}`);
    return existsSync(f) ? f : null;
  };
  return {
    name: stem,
    path: dir,
    files: { js: pick('.js'), html: pick('.html'), css: pick('.css'), meta: pick('.js-meta.xml') },
  };
}

// ---------------------------------------------------------------------------
// EXTRACAO por linguagem
// ---------------------------------------------------------------------------
function extractJs(src) {
  if (!src) return null;
  src = stripJsComments(src); // codigo comentado nao e padrao — remove antes de extrair
  const imports = uniq(allMatches(/import\s+[^;]*?from\s+['"]([^'"]+)['"]/g, src));
  const decorators = {
    api: allMatches(/@api\b/g, src).length,
    track: allMatches(/@track\b/g, src).length,
    wire: allMatches(/@wire\b/g, src).length,
  };
  // Contrato publico: NOMES das propriedades/getters/metodos @api (o que o componente
  // expoe por fora — o primeiro codigo que a geracao escreve). Consome TODOS os
  // modificadores (async/static/get/set) antes do nome — senao `@api async reload()`
  // reportaria "async" como membro publico (bug real).
  const apiMembers = uniq(allMatches(/@api\s+(?:(?:async|static|get|set)\s+)*(\w+)/g, src));
  // (#GAP1) Defaults do contrato @api: `@api label = 'X'` — o valor default e metade do
  // contrato (muda comportamento). A Skill 3 precisa gerar `@api label = 'X'`, nao `@api label;`.
  const apiDefaults = allMatches(/@api\s+(?:(?:async|static)\s+)*(\w+)\s*=\s*([^;\n]+)/g, src, 0)
    .map((full) => {
      const mm = full.match(/@api\s+(?:(?:async|static)\s+)*(\w+)\s*=\s*([^;\n]+)/);
      return { name: mm[1], value: mm[2].trim() };
    });
  // (#GAP4) Getters/computed properties (spine do LWC idiomatico): get name() {...}.
  // Nome do getter e a receita; o corpo fica no arquivo. Exclui os que ja sao @api getter.
  const getters = uniq(allMatches(/(?:^|[^.\w])get\s+(\w+)\s*\(\s*\)/g, src));
  // Alvos do @wire: o adapter conectado (getRecord, getObjectInfo, CurrentPageReference,
  // ou um metodo Apex importado) — padrao de acesso a dados.
  const wireAdapters = uniq(allMatches(/@wire\s*\(\s*(\w+)/g, src));
  // Eventos customizados: new CustomEvent('nome', { bubbles, composed, detail }).
  // (#GAP2) Captura tambem a FIACAO do evento — bubbles/composed decidem se o evento
  // chega ao pai / cruza shadow DOM (decisoes opostas), e as chaves de `detail` sao o
  // contrato de payload que o handler do pai consome.
  const eventDetails = allMatches(/new\s+CustomEvent\s*\(\s*['"`]([^'"`]+)['"`]([\s\S]{0,220}?\))/g, src, 0)
    .map((full) => {
      const nameM = full.match(/new\s+CustomEvent\s*\(\s*['"`]([^'"`]+)['"`]/);
      const name = nameM[1];
      const bubbles = /bubbles\s*:\s*true/.test(full);
      const composed = /composed\s*:\s*true/.test(full);
      const detailBlock = (full.match(/detail\s*:\s*\{([^}]*)\}/) || [])[1] || '';
      const detailKeys = uniq(allMatches(/(\w+)\s*:/g, detailBlock));
      return { name, bubbles, composed, detailKeys };
    });
  const events = uniq(eventDetails.map((e) => e.name));
  const lifecycle = uniq(
    allMatches(
      /\b(connectedCallback|disconnectedCallback|renderedCallback|errorCallback|constructor)\s*\(/g,
      src
    )
  );
  const usesApex = /@salesforce\/apex\//.test(src);
  // GraphQL: baseado em IMPORT real do adapter (nao substring "graphql" solta).
  const usesGraphql = imports.some((i) => /uiGraphQLApi|graphql/i.test(i));

  // (#5) Custom Labels / i18n — imports de @salesforce/label/Namespace.Nome
  const labels = uniq(allMatches(/@salesforce\/label\/([^'"`]+)/g, src));

  // (#3) Erro/feedback — ShowToastEvent e as variantes usadas (error/success/warning/info)
  const usesShowToast = /ShowToastEvent/.test(src);
  const toastVariants = uniq(allMatches(/variant\s*:\s*['"`](error|success|warning|info)['"`]/gi, src));

  // (#3) Estado de loading — nomes de flag especificos (evita casar a palavra "loading"
  // solta em qualquer string/identificador).
  const hasLoadingState = /\b(isLoading|showSpinner|spinnerVisible|isBusy|_loading|loadingState)\b/.test(src);

  // (#4) Forma da chamada Apex imperativa
  const apexCallStyle = usesApex
    ? {
        usesThen: /\.then\s*\(/.test(src),
        usesAwait: /\bawait\b/.test(src),
        usesTryCatch: /\btry\s*\{/.test(src),
        refreshApex: /refreshApex/.test(src),
      }
    : null;

  return {
    imports,
    decorators,
    apiMembers,
    apiDefaults,
    getters,
    wireAdapters,
    events,
    eventDetails,
    lifecycle,
    usesApex,
    usesGraphql,
    labels,
    usesShowToast,
    toastVariants,
    hasLoadingState,
    apexCallStyle,
  };
}

function extractHtml(src) {
  if (!src) return null;
  src = stripHtmlComments(src); // markup comentado nao e padrao — remove antes de extrair
  // Slots: <slot name="x"> (nomeados) e <slot> (default)
  const named = uniq(allMatches(/<slot\b[^>]*\bname\s*=\s*['"]([^'"]+)['"]/g, src));
  const hasDefaultSlot = /<slot\b(?![^>]*\bname\s*=)[^>]*>/.test(src);
  const slots = [...named];
  if (hasDefaultSlot) slots.push('(default)');
  // Diretivas de template LWC
  const directives = uniq(
    allMatches(/\b(for:each|for:item|iterator:|if:true|if:false|lwc:if|lwc:elseif|lwc:else)\b/g, src, 0)
  );
  // Acessibilidade: atributos aria-* , role, tabindex, alt
  const aria = uniq(allMatches(/\b(aria-[a-z]+)\s*=/g, src));
  const roles = uniq(allMatches(/\brole\s*=\s*['"]([^'"]+)['"]/g, src));
  const hasTabindex = /\btabindex\s*=/.test(src);
  const hasAlt = /\balt\s*=/.test(src);
  // Base components lightning-* e componentes custom c-* usados
  const lightningTags = uniq(allMatches(/<(lightning-[a-z0-9-]+)\b/g, src));
  const customTags = uniq(allMatches(/<(c-[a-z0-9-]+)\b/g, src));

  // (#GAP5) Fiacao pai↔filho — a outra metade do contrato de composicao/eventos:
  //  - eventListeners: handlers `on*={...}` (a quais eventos o componente REAGE).
  //  - boundAttributes: atributos kebab passados por binding `attr={...}` (o que o pai
  //    seta nos filhos/base components — o contrato @api visto do lado de quem consome).
  const eventListeners = uniq(allMatches(/\bon([a-z][a-zA-Z0-9]*)\s*=\s*\{/g, src));
  const boundAttributes = uniq(allMatches(/\b([a-z][a-z0-9-]*)\s*=\s*\{[^}]+\}/g, src)
    .filter((a) => !/^on[a-z]/i.test(a) && !['key', 'class', 'style'].includes(a)));

  // (#2) Classes utilitarias SLDS usadas no HTML (class="slds-...") — parte enorme
  // da convencao real de LWC/SLDS que so olhar o CSS nao captura.
  const classVals = allMatches(/class\s*=\s*["']([^"']+)["']/g, src);
  const sldsClasses = uniq(
    classVals.flatMap((v) => v.split(/\s+/)).filter((c) => /^slds-/.test(c))
  );

  // (#1) Esqueleto estrutural — a "receita" de composicao (o que gerar exige)
  const skeleton = htmlSkeleton(src);
  const rootTag = skeleton.length ? skeleton[0].trim().replace(/[\s.[].*$/, '') : null;

  return {
    slots,
    directives,
    aria,
    roles,
    hasTabindex,
    hasAlt,
    a11yScore: aria.length + roles.length + (hasTabindex ? 1 : 0) + (hasAlt ? 1 : 0),
    lightningTags,
    customTags,
    eventListeners,
    boundAttributes,
    sldsClasses,
    rootTag,
    skeleton,
  };
}

// (#1) Esqueleto estrutural do HTML: um outline indentado dos elementos ESTRUTURAIS
// (lightning-*, c-*, containers de bloco, templates com diretiva), com dica de classe
// SLDS e de diretiva. Nao e um parser completo — e um proxy deterministico da
// composicao, suficiente para a Skill 3 saber "como os componentes desta jornada sao
// montados" (nao so quais tags aparecem). Profundidade <= 3, ate 30 linhas.
function htmlSkeleton(src) {
  if (!src) return [];
  const s = stripHtmlComments(src);
  const STRUCT =
    /^(lightning-[a-z0-9-]+|c-[a-z0-9-]+|div|section|article|header|footer|main|aside|ul|ol|li|table|thead|tbody|tr|form|nav)$/i;
  // Atributos-chave que fazem parte da RECEITA (nao so a tag): variante/label de botao,
  // icone, role/aria do modal, etc. Ajudam a Skill 3 a reproduzir o componente, nao so a
  // arvore de tags.
  const KEY_ATTRS = ['variant', 'label', 'icon-name', 'type', 'role', 'aria-modal', 'name', 'title'];
  const lines = [];
  const stack = [];
  // O grupo de atributos aceita `>` DENTRO de aspas (ex.: data-tip="a > b") — senao o
  // regex cortaria no `>` interno e perderia class/atributos daquela tag.
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>/g;
  let m;
  while ((m = tagRe.exec(s)) !== null) {
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrs = m[3] || '';
    const selfClose = m[4] === '/';
    if (closing) {
      const idx = stack.lastIndexOf(tag);
      if (idx !== -1) stack.length = idx;
      continue;
    }
    const dir = (attrs.match(/\b(for:each|lwc:if|lwc:elseif|lwc:else|if:true|if:false)\b/) || [])[1];
    const isStruct = STRUCT.test(tag) || (tag === 'template' && dir);
    if (!isStruct) continue;
    if (stack.length <= 3 && lines.length < 30) {
      const cls = (attrs.match(/class\s*=\s*["']([^"']+)["']/) || [])[1] || '';
      const slds = cls.split(/\s+/).filter((c) => /^slds-/.test(c)).slice(0, 3);
      const keyAttrs = KEY_ATTRS
        .map((a) => {
          const v = (attrs.match(new RegExp('\\b' + a.replace(/[-]/g, '\\-') + '\\s*=\\s*["\']([^"\']+)["\']')) || [])[1];
          return v ? `${a}="${v}"` : null;
        })
        .filter(Boolean)
        .slice(0, 3);
      let label = tag;
      if (dir) label += ` [${dir}]`;
      if (keyAttrs.length) label += ' ' + keyAttrs.join(' ');
      if (slds.length) label += ' .' + slds.join(' .');
      lines.push('  '.repeat(stack.length) + label);
    }
    if (!selfClose) stack.push(tag);
  }
  return lines;
}

function extractCss(src) {
  if (!src) return null;
  src = stripCssComments(src);
  // Custom properties CONSUMIDAS: var(--x)  e DEFINIDAS: --x:
  const consumed = uniq(allMatches(/var\(\s*(--[a-z0-9-]+)/gi, src));
  const defined = uniq(allMatches(/(^|[;{]\s*)(--[a-z0-9-]+)\s*:/gi, src, 2));
  const usesHost = /:host\b/.test(src);
  const usesSlds = consumed.some((v) => /^--slds-|^--lwc-|^--sds-/i.test(v));
  // Cores HARDCODED de verdade (o anti-sinal). Antes de escanear, remove os falsos
  // positivos que confundiam a divergencia "tokens x hardcoded":
  //  (a) string literals (`content: "#000"`),
  //  (b) valores de DEFINICAO de token (`--brand: #1b96ff;` e tokenizacao, nao hardcode),
  //  (c) fallbacks dentro de `var(--x, #005fb2)`.
  const scan = src
    .replace(/"[^"]*"|'[^']*'/g, '""')
    .replace(/--[a-z0-9-]+\s*:\s*[^;}]+/gi, '')
    .replace(/var\([^)]*\)/g, '');
  const hardcodedColors = uniq([
    ...allMatches(/#[0-9a-fA-F]{3,8}\b/g, scan, 0),
    ...allMatches(/\brgba?\([^)]*\)/g, scan, 0),
    ...allMatches(/\bhsla?\([^)]*\)/g, scan, 0),
  ]);
  return { customPropsConsumed: consumed, customPropsDefined: defined, usesHost, usesSlds, hardcodedColors };
}

function extractMeta(src) {
  if (!src) return null;
  const apiVersion = (src.match(/<apiVersion>([^<]+)<\/apiVersion>/) || [])[1] || null;
  const isExposed = /<isExposed>\s*true\s*<\/isExposed>/i.test(src);
  const targets = uniq(allMatches(/<target>([^<]+)<\/target>/g, src));
  return { apiVersion, isExposed, targets };
}

// ---------------------------------------------------------------------------
// Naming: estilo de caixa do nome do bundle
// ---------------------------------------------------------------------------
function caseStyle(name) {
  if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) return 'camelCase';
  if (/^[a-z][a-z0-9]*$/.test(name)) return 'lowercase';
  if (/^[A-Z]/.test(name)) return 'PascalCase';
  if (name.includes('_')) return 'snake_case';
  if (name.includes('-')) return 'kebab-case';
  return 'other';
}

// Maior prefixo alfabetico comum entre 2+ nomes (>= 3 chars para valer)
function commonPrefix(names) {
  if (names.length < 2) return null;
  let p = names[0];
  for (const n of names.slice(1)) {
    let i = 0;
    while (i < p.length && i < n.length && p[i] === n[i]) i++;
    p = p.slice(0, i);
    if (!p) break;
  }
  const clean = p.replace(/[^a-zA-Z].*$/, '');
  return clean.length >= 3 ? clean : null;
}

// ---------------------------------------------------------------------------
// Utilitarios locais compartilhados (c/xUtil): quando varios componentes importam
// o MESMO modulo local `c/algo`, o extrator LE o .js desse modulo e lista os EXPORTS
// (a superficie de API que a jornada assume como base). E o sinal que mais impacta a
// GERACAO: se 14/18 componentes importam `c/consorcioUtil`, o componente novo TEM que
// usa-lo — e a Skill 3 precisa saber quais funcoes existem. Deterministico.
// ---------------------------------------------------------------------------
function resolveSharedUtils(valid) {
  const usage = {}; // mod -> Set(nomes de componentes que importam)
  for (const c of valid) {
    for (const imp of c.js?.imports || []) {
      const m = imp.match(/^c\/(\w+)/);
      if (m) (usage[m[1]] = usage[m[1]] || new Set()).add(c.name);
    }
  }
  const parents = uniq(valid.map((c) => join(c.path || '.', '..')));
  const shared = [];
  for (const [mod, users] of Object.entries(usage)) {
    if (users.size < 2) continue; // "compartilhado" = usado por 2+
    let src = '';
    for (const parent of parents) {
      const p = join(parent, mod, `${mod}.js`);
      if (existsSync(p)) { src = readSafe(p); break; }
    }
    let exportsList = [];
    if (src) {
      src = stripJsComments(src);
      // funcoes (inclui `export default function nome()`)
      const fns = allMatches(/export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g, src, 0).map((full) => {
        const mm = full.match(/function\s+(\w+)\s*\(([^)]*)\)/);
        return `${mm[1]}(${mm[2].trim()})`;
      });
      // export const nome = ...  E  export const { parseA, parseB } = ... (destructuring)
      const consts = allMatches(/export\s+const\s+(\w+)/g, src);
      const constDestruct = allMatches(/export\s+const\s+\{\s*([^}]+)\s*\}/g, src).flatMap((grp) =>
        grp.split(',').map((x) => x.trim().split(/[:=]/)[0].trim()).filter(Boolean)
      );
      // export { a, b as c } → o nome IMPORTAVEL e o depois de `as` (c), senao o proprio (a)
      const named = allMatches(/export\s*\{\s*([^}]+)\s*\}/g, src).flatMap((grp) =>
        grp.split(',').map((x) => {
          const parts = x.trim().split(/\s+as\s+/);
          return (parts[1] || parts[0] || '').trim();
        }).filter(Boolean)
      );
      const classes = allMatches(/export\s+(?:default\s+)?class\s+(\w+)/g, src).map((n) => `class ${n}`);
      exportsList = uniq([...fns, ...consts, ...constDestruct, ...named, ...classes]);
    }
    shared.push({ module: `c/${mod}`, importedBy: users.size, components: [...users].sort(), exports: exportsList });
  }
  return shared.sort((a, b) => b.importedBy - a.importedBy);
}

// ---------------------------------------------------------------------------
// AGREGACAO + deteccao de divergencia entre componentes da jornada
// ---------------------------------------------------------------------------
function aggregate(components) {
  const valid = components.filter((c) => !c.missing);
  const divergences = [];

  // Naming
  const styles = valid.map((c) => c.naming?.style).filter(Boolean);
  const styleCounts = tally(styles);
  if (Object.keys(styleCounts).length > 1) {
    divergences.push({
      signal: 'naming.style',
      detail: `Estilos de nome divergentes entre os componentes: ${fmtCounts(styleCounts)}.`,
    });
  }

  // Tokens vs cor hardcoded
  const withTokens = valid.filter((c) => c.css?.usesSlds || (c.css?.customPropsConsumed || []).length);
  const withHardcoded = valid.filter((c) => (c.css?.hardcodedColors || []).length);
  if (withTokens.length && withHardcoded.length) {
    divergences.push({
      signal: 'css.colorStrategy',
      detail:
        `${withTokens.length} componente(s) usam tokens/custom properties, mas ` +
        `${withHardcoded.length} usam cor hardcoded (ex.: ${withHardcoded
          .map((c) => `${c.name}: ${(c.css.hardcodedColors || [])[0]}`)
          .slice(0, 3)
          .join(', ')}).`,
    });
  }

  // Event naming: consistencia do ESTILO dos nomes de evento. LWC dispara em minusculas,
  // mas a org pode misturar all-lowercase (`quotaselection`) com camelCase (`quotaSelection`)
  // ou kebab (`quota-selection`). Se ha mistura real, e uma divergencia a documentar.
  const allEvents = uniq(valid.flatMap((c) => c.js?.events || []));
  if (allEvents.length > 1) {
    const evStyle = (e) => (/-/.test(e) ? 'kebab-case' : /[A-Z]/.test(e) ? 'camelCase' : 'lowercase');
    const evStyles = uniq(allEvents.map(evStyle));
    if (evStyles.length > 1) {
      divergences.push({
        signal: 'js.eventNaming',
        detail: `Estilos de nome de evento inconsistentes (${evStyles.join(' vs ')}): ${allEvents.join(', ')}.`,
      });
    }
  }

  // Slots: uns usam, outros nao (informativo, nao necessariamente divergencia ruim)
  const withSlots = valid.filter((c) => (c.html?.slots || []).length);

  return {
    componentsScanned: valid.length,
    // Elementos ESPECIFICOS: itens que aparecem em UM SO componente da jornada (nao
    // compartilhados). Ex.: um slot, evento, token, import ou tag lightning-* que so
    // aquele arquivo tem. A skill registra estes atrelados ao componente de origem
    // (pedido explicito do usuario), separado dos padroes compartilhados.
    componentSpecifics: computeSpecifics(valid),
    naming: {
      styleCounts,
      dominantStyle: dominant(styleCounts),
      commonPrefix: commonPrefix(valid.map((c) => c.name)),
    },
    css: {
      withTokens: withTokens.length,
      withHardcodedColors: withHardcoded.length,
      allTokensSeen: uniq(valid.flatMap((c) => c.css?.customPropsConsumed || [])),
    },
    js: {
      allEvents: uniq(allEvents),
      wireUsers: valid.filter((c) => (c.js?.decorators?.wire || 0) > 0).length,
      apexUsers: valid.filter((c) => c.js?.usesApex).length,
      // Contrato publico @api: nomes recorrentes (o que os componentes expoem por fora)
      commonApiMembers: freqTable(valid.flatMap((c) => uniq(c.js?.apiMembers || [])), 2),
      allApiMembers: uniq(valid.flatMap((c) => c.js?.apiMembers || [])),
      // (#GAP1) Defaults do contrato @api (name = value) — metade do contrato; o
      // componente novo deve nascer com `@api label = 'X'`, nao `@api label;`.
      apiDefaults: dedupeBy(valid.flatMap((c) => c.js?.apiDefaults || []), (d) => `${d.name}=${d.value}`),
      // (#GAP4) Getters/computed properties (spine do LWC idiomatico) recorrentes
      commonGetters: freqTable(valid.flatMap((c) => uniq(c.js?.getters || [])), 2),
      allGetters: uniq(valid.flatMap((c) => c.js?.getters || [])),
      // (#GAP2) Contrato de eventos: bubbles/composed + chaves de `detail` por evento
      eventContracts: eventContracts(valid),
      // Alvos do @wire: adapters conectados (getRecord, getObjectInfo, Apex, page ref)
      wireAdapters: freqTable(valid.flatMap((c) => uniq(c.js?.wireAdapters || [])), 1),
      // (#4) Forma da chamada Apex imperativa — a "receita" do call, nao so "usa Apex"
      apexCallStyle: {
        usesThen: valid.filter((c) => c.js?.apexCallStyle?.usesThen).length,
        usesAwait: valid.filter((c) => c.js?.apexCallStyle?.usesAwait).length,
        usesTryCatch: valid.filter((c) => c.js?.apexCallStyle?.usesTryCatch).length,
        refreshApex: valid.filter((c) => c.js?.apexCallStyle?.refreshApex).length,
      },
      // (#3) Erro/feedback via toast
      toast: {
        users: valid.filter((c) => c.js?.usesShowToast).length,
        variants: uniq(valid.flatMap((c) => c.js?.toastVariants || [])),
      },
      // (#3) Estado de loading
      loadingStateUsers: valid.filter((c) => c.js?.hasLoadingState).length,
      // (#5) Custom Labels / i18n
      labelUsers: valid.filter((c) => (c.js?.labels || []).length).length,
      allLabels: uniq(valid.flatMap((c) => c.js?.labels || [])),
      // Utilitarios locais compartilhados (c/xUtil) + superficie de API (exports)
      sharedUtils: resolveSharedUtils(valid),
    },
    html: {
      componentsWithSlots: withSlots.length,
      allSlots: uniq(valid.flatMap((c) => c.html?.slots || [])),
      allLightningTags: uniq(valid.flatMap((c) => c.html?.lightningTags || [])),
      allCustomTags: uniq(valid.flatMap((c) => c.html?.customTags || [])),
      // (#GAP5) Fiacao pai↔filho: handlers on* que os componentes escutam, e atributos
      // passados por binding (o contrato @api visto do lado de quem consome o filho).
      allEventListeners: uniq(valid.flatMap((c) => c.html?.eventListeners || [])),
      commonBoundAttributes: freqTable(valid.flatMap((c) => uniq(c.html?.boundAttributes || [])), 2),
      // (#2) Classes utilitarias SLDS — as mais recorrentes (freq >= 2), com contagem
      commonSldsClasses: freqTable(valid.flatMap((c) => uniq(c.html?.sldsClasses || [])), 2),
      // (#1) Tag raiz mais comum (wrapper de topo) — parte da receita de composicao
      rootTags: tally(valid.map((c) => c.html?.rootTag).filter(Boolean)),
      // (#1) Esqueleto REPRESENTATIVO (o componente com mais estrutura) e, se a jornada
      // tem arquetipo de modal, o esqueleto de MODAL mais completo — ja escolhidos,
      // prontos para colar na secao Estrutura. Sao a "receita" copiavel para gerar.
      representativeSkeleton: pickSkeleton(valid),
      modalSkeleton: pickSkeleton(valid, (c) => (c.html?.sldsClasses || []).some((x) => /^slds-modal/.test(x))),
      spinnerUsers: valid.filter((c) => (c.html?.lightningTags || []).includes('lightning-spinner')).length,
      a11yAvg:
        valid.length ? Math.round((valid.reduce((s, c) => s + (c.html?.a11yScore || 0), 0) / valid.length) * 10) / 10 : 0,
    },
    // (#6) Testes Jest companheiros
    tests: {
      componentsWithTests: valid.filter((c) => c.present?.test).length,
      total: valid.length,
    },
    // Convencoes PARCIAIS: itens usados por um SUBCONJUNTO (2..n-1) — nem compartilhado
    // por todos, nem unico de um. Fecha o "vao" (ex.: cor #888 em 2 de 9) que nao e
    // divergencia formal nem elemento especifico. O agente registra como observacao.
    partialConventions: partialConventions(valid),
    divergences,
  };
}

// Itens usados por um subconjunto de componentes (freq entre 2 e n-1), por dimensao
// relevante para geracao. Retorna so as dimensoes com algum item parcial (cap 12/dim).
function partialConventions(valid) {
  const n = valid.length;
  if (n < 3) return {};
  const dims = {
    sldsClasses: (c) => c.html?.sldsClasses || [],
    lightningTags: (c) => c.html?.lightningTags || [],
    imports: (c) => c.js?.imports || [],
    labels: (c) => c.js?.labels || [],
    hardcodedColors: (c) => c.css?.hardcodedColors || [],
    events: (c) => c.js?.events || [],
    getters: (c) => c.js?.getters || [],
    eventListeners: (c) => c.html?.eventListeners || [],
    boundAttributes: (c) => c.html?.boundAttributes || [],
  };
  const out = {};
  for (const [dim, get] of Object.entries(dims)) {
    const t = {};
    for (const c of valid) for (const it of uniq(get(c))) t[it] = (t[it] || 0) + 1;
    const partial = Object.entries(t)
      .filter(([, cnt]) => cnt >= 2 && cnt < n)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([item, cnt]) => ({ item, count: cnt }));
    if (partial.length) out[dim] = partial;
  }
  return out;
}

// Tabela de frequencia { item: count } para itens com freq >= min, ordenada desc.
function freqTable(arr, min = 1) {
  const t = {};
  for (const x of arr) t[x] = (t[x] || 0) + 1;
  return Object.entries(t)
    .filter(([, c]) => c >= min)
    .sort((a, b) => b[1] - a[1])
    .map(([item, count]) => ({ item, count }));
}

// Elementos unicos de cada componente: para cada dimensao (slots, eventos, tokens,
// tags lightning-*, imports, diretivas, aria), lista os itens que SO aquele
// componente tem (frequencia 1 entre os analisados). Retorna so os componentes que
// tem algum item exclusivo.
function computeSpecifics(valid) {
  const dims = {
    slots: (c) => c.html?.slots || [],
    events: (c) => c.js?.events || [],
    tokens: (c) => c.css?.customPropsConsumed || [],
    lightningTags: (c) => c.html?.lightningTags || [],
    customTags: (c) => c.html?.customTags || [],
    sldsClasses: (c) => c.html?.sldsClasses || [],
    imports: (c) => c.js?.imports || [],
    labels: (c) => c.js?.labels || [],
    apiMembers: (c) => c.js?.apiMembers || [],
    getters: (c) => c.js?.getters || [],
    wireAdapters: (c) => c.js?.wireAdapters || [],
    eventListeners: (c) => c.html?.eventListeners || [],
    boundAttributes: (c) => c.html?.boundAttributes || [],
    directives: (c) => c.html?.directives || [],
    aria: (c) => c.html?.aria || [],
    hardcodedColors: (c) => c.css?.hardcodedColors || [],
  };
  const freq = {};
  for (const [dim, get] of Object.entries(dims)) {
    freq[dim] = {};
    for (const c of valid) for (const it of uniq(get(c))) freq[dim][it] = (freq[dim][it] || 0) + 1;
  }
  return valid
    .map((c) => {
      const unique = {};
      for (const [dim, get] of Object.entries(dims)) {
        const u = uniq(get(c)).filter((it) => freq[dim][it] === 1);
        if (u.length) unique[dim] = u;
      }
      return { component: c.name, unique };
    })
    .filter((x) => Object.keys(x.unique).length);
}

// Escolhe o esqueleto mais completo (mais linhas) entre os componentes que passam no
// filtro opcional. Retorna { component, skeleton } ou null. Usado para o esqueleto
// representativo da jornada e para o esqueleto de modal (filtro slds-modal).
function pickSkeleton(valid, filter = null) {
  const cands = valid
    .filter((c) => (c.html?.skeleton || []).length && (!filter || filter(c)))
    .sort((a, b) => (b.html.skeleton.length - a.html.skeleton.length));
  return cands.length ? { component: cands[0].name, skeleton: cands[0].html.skeleton } : null;
}

function tally(arr) {
  const o = {};
  for (const x of arr) o[x] = (o[x] || 0) + 1;
  return o;
}

// Dedup preservando ordem, por chave computada.
function dedupeBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (!seen.has(k)) { seen.add(k); out.push(x); }
  }
  return out;
}

// (#GAP2) Contrato de eventos agregado: por nome de evento, se ALGUM componente o
// dispara com bubbles/composed e a uniao das chaves de `detail`. E o que decide se o
// evento chega ao pai / cruza shadow DOM — receita que a Skill 3 precisa reproduzir.
function eventContracts(valid) {
  const map = {};
  for (const c of valid) {
    for (const e of c.js?.eventDetails || []) {
      const m = (map[e.name] = map[e.name] || { name: e.name, bubbles: false, composed: false, detail: new Set(), count: 0 });
      m.bubbles = m.bubbles || e.bubbles;
      m.composed = m.composed || e.composed;
      (e.detailKeys || []).forEach((k) => m.detail.add(k));
      m.count++;
    }
  }
  return Object.values(map)
    .sort((a, b) => b.count - a.count)
    .map((m) => ({ name: m.name, bubbles: m.bubbles, composed: m.composed, detailKeys: [...m.detail], count: m.count }));
}
function fmtCounts(o) {
  return Object.entries(o)
    .map(([k, v]) => `${k}×${v}`)
    .join(', ');
}
function dominant(o) {
  let best = null,
    n = -1;
  for (const [k, v] of Object.entries(o)) if (v > n) (best = k), (n = v);
  return best;
}

// ===========================================================================
// MAIN
// ===========================================================================
const listRoot = arg('list');
if (typeof listRoot === 'string') {
  const comps = listComponents(listRoot);
  emit({ mode: 'list', root: listRoot, count: comps.length, components: comps });
}

const compArg = arg('components');
if (typeof compArg !== 'string') {
  emit(
    {
      error:
        'Informe --components <pasta1,pasta2,...> (bundles LWC) ou --list <raiz>. ' +
        'Ex.: node pattern-extractor.mjs --components force-app/main/default/lwc/consorcioListaCotas --journey "Consorcio"',
    },
    2
  );
}

const journey = typeof arg('journey') === 'string' ? arg('journey') : null;
const minN = Number(arg('min', 3)) || 3;
// Teto RECOMENDADO (nao bloqueia) — acima disso, o modelo (em especial os mais fracos)
// corre risco de "esquecer" itens ao interpretar. Sugere quebrar em sub-jornadas coesas.
const maxN = Number(arg('max', 10)) || 10;

const paths = compArg.split(',').map((s) => s.trim()).filter(Boolean);
const components = paths.map((p) => {
  const c = resolveComponent(p);
  if (c.missing) return c;
  const js = extractJs(readSafe(c.files.js));
  const html = extractHtml(readSafe(c.files.html));
  const css = extractCss(readSafe(c.files.css));
  const meta = extractMeta(readSafe(c.files.meta));
  return {
    name: c.name,
    path: c.path,
    present: {
      js: !!c.files.js,
      html: !!c.files.html,
      css: !!c.files.css,
      meta: !!c.files.meta,
      test: !!c.files.test,
    },
    naming: { raw: c.name, style: caseStyle(c.name) },
    js,
    html,
    css,
    meta,
  };
});

const missing = components.filter((c) => c.missing).map((c) => c.path);
const agg = aggregate(components);
const minComponentsMet = agg.componentsScanned >= minN;
// Teto recomendado: SOFT (nunca bloqueia). Acima dele, sugere dividir em sub-jornadas.
const withinRecommendedMax = agg.componentsScanned <= maxN;

const warnings = [];
if (!minComponentsMet) {
  warnings.push(
    `Apenas ${agg.componentsScanned} componente(s) valido(s) — minimo ${minN} para documentar com confianca ` +
      `(regra 2 da arquitetura). BLOQUEIE a escrita e peca mais exemplos.`
  );
}
if (!withinRecommendedMax) {
  warnings.push(
    `${agg.componentsScanned} componentes excede o TETO RECOMENDADO de ${maxN} para uma unica analise. ` +
      `Isso NAO bloqueia — mas SUGIRA ao usuario quebrar em sub-jornadas coesas (ex.: ` +
      `"${journey || '<Jornada>'} – <Subtema A>", "${journey || '<Jornada>'} – <Subtema B>"), cada uma como ` +
      `sua propria secao, para o modelo nao esquecer itens no caminho (regra 2, teto). ` +
      `Se o usuario preferir manter a LISTA INTEIRA, RESPEITE: prossiga com todos, e interprete ` +
      `o 'aggregate' por SECAO (estrutura, depois naming, depois CSS...) em vez de tudo de uma vez.`
  );
}
if (missing.length) warnings.push(`Caminhos nao encontrados: ${missing.join(', ')}.`);
if (agg.divergences.length) {
  warnings.push(
    `${agg.divergences.length} divergencia(s) de convencao detectada(s) — DOCUMENTE as variantes, ` +
      `nunca decida sozinho pela maioria (regra 3 da arquitetura).`
  );
}

emit({
  mode: 'extract',
  journey,
  min: minN,
  minComponentsMet,
  recommendedMax: maxN,
  withinRecommendedMax,
  componentsScanned: agg.componentsScanned,
  components: components.filter((c) => !c.missing),
  missing: missing.length ? missing : undefined,
  aggregate: agg,
  warnings,
});
