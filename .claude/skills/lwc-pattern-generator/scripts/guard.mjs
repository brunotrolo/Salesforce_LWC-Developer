#!/usr/bin/env node
// guard.mjs — Guarda de seguranca (hook PreToolUse) da skill lwc-pattern-generator.
// ---------------------------------------------------------------------------
// Adaptado do guard.mjs da apex-test-loop (mesmo modelo de 3 camadas), trocando
// `.cls`/`.trigger`/`force-app/classes` por bundles LWC (`.js`/`.html`/`.css`/
// `.js-meta.xml` dentro de `force-app/**/lwc/**`). Cobre DOIS vetores:
//
//   1) Comandos (Bash/PowerShell): apagar/mover diretorio de componente LWC,
//      apagar org, apagar registros em massa.
//   2) Escrita de arquivo (Write/Edit): sobrescrever um BUNDLE LWC que ja existe.
//
// REGRA DE SEGURANCA QUE NAO PODE SER VIOLADA (decisao de arquitetura, ver
// docs/ARCHITECTURE.md secao "Seguranca em 3 Camadas"): este guard NUNCA confia
// em qual "modo" (Criar/Clonar/Editar) o agente alega estar executando. A decisao
// ask/allow olha SO a existencia factual de arquivo no disco — nunca uma flag que
// o agente declara. Um agente confuso (ou um prompt malicioso) autodeclarando
// "modo criar" nao pode contornar o prompt de aprovacao numa sobrescrita real.
//
// COLISAO PARCIAL DE BUNDLE: um componente LWC e 4-5 arquivos (.js/.html/.css/
// .js-meta.xml/.test.js) escritos em chamadas SEPARADAS. Se so UM desses arquivos
// ja existir no disco, o guard trata o BUNDLE INTEIRO como `ask` — nunca escreve
// os outros 3-4 arquivos sem prompt e trava so no ultimo, deixando o componente
// pela metade.
//
// LIMITACAO honesta (herdada do modelo original): matching por texto/caminho nao
// e uma fronteira criptografica — wrappers exoticos, variaveis de ambiente ou
// substituicao de comando podem, em tese, escapar. Por isso as instrucoes do
// SKILL.md (Camada 3 — "NUNCA FACA") continuam essenciais.
// ---------------------------------------------------------------------------

import { existsSync, readdirSync } from 'node:fs';

// --- Camada de COMANDOS ----------------------------------------------------
export const DESTRUCTIVE_RULES = [
  {
    re: /\bsf\b[\s\S]*\bproject\b[\s\S]*\bdelete\b/,
    why: 'sf project delete (apaga codigo-fonte do disco e/ou da org)',
  },
  {
    re: /\bsf\b[\s\S]*\borg\b[\s\S]*\bdelete\b/,
    why: 'sf org delete (apaga uma org)',
  },
  {
    re: /\bsf\b[\s\S]*\bdata\b[\s\S]*\bdelete\b/,
    why: 'sf data delete (apaga registros)',
  },
  {
    re: /destructive-?changes/,
    why: 'deploy destrutivo (--pre/--post-destructive-changes) apaga metadados da org',
  },
  {
    // rm/rmdir/del de qualquer coisa dentro de uma pasta lwc/ — pode apagar um
    // componente inteiro ou o diretorio lwc/ inteiro.
    re: /\b(rm|rmdir|rd|unlink|del|erase|remove-item|ri)\b(?=[\s\S]*[\\/]lwc\b)/,
    why: 'exclusao de arquivo/diretorio dentro de force-app/.../lwc — pode apagar um componente existente',
  },
  {
    // find ... -delete sobre uma pasta lwc/ (sem o verbo rm, a regra acima nao pega).
    re: /\bfind\b(?=[\s\S]*-delete\b)(?=[\s\S]*[\\/]lwc\b)/,
    why: 'find ... -delete sobre force-app/.../lwc',
  },
  {
    // mover/renomear arquivo dentro de lwc/ — o "NUNCA FACA" proibe mover/renomear
    // componentes LWC (perde rastreabilidade com o design-patterns.md documentado).
    re: /\b(mv|move)\b(?=[\s\S]*[\\/]lwc\b)/,
    why: 'mover/renomear arquivo dentro de force-app/.../lwc (a skill nunca move/renomeia componentes)',
  },
];

// Classificacao de comando: texto -> { blocked, why, decision }.
// Comando destrutivo -> 'deny' (bloqueio duro, sem aprovacao possivel).
export function classify(cmd) {
  const c = String(cmd || '').toLowerCase();
  for (const r of DESTRUCTIVE_RULES) {
    if (r.re.test(c)) return { blocked: true, why: r.why, decision: 'deny' };
  }
  return { blocked: false };
}

// --- Camada de ESCRITA DE ARQUIVO (bundle-aware) ---------------------------

const BUNDLE_EXTS = ['.js', '.html', '.css', '.js-meta.xml']; // .test.js conta via ".js"

function isBundleFileName(fileName) {
  const lower = String(fileName).toLowerCase();
  return BUNDLE_EXTS.some((ext) => lower.endsWith(ext));
}

// Reconhece um caminho de arquivo de bundle LWC (`.../lwc/<bundleName>/<arquivo>`,
// incluindo `.../lwc/<bundleName>/__tests__/<arquivo>`). Retorna null se o caminho
// nao estiver dentro de uma pasta `lwc/`.
export function parseLwcBundlePath(filePath) {
  const norm = String(filePath).replace(/\\/g, '/');
  const m = norm.match(/^(.*\/lwc\/([^/]+))\/(?:__tests__\/)?([^/]+)$/i);
  if (!m) return null;
  return { bundleDir: m[1], bundleName: m[2], fileName: m[3] };
}

// Lista, dentre os arquivos existentes no diretorio do bundle, quais SAO arquivos
// de bundle LWC (ignora arquivos estranhos que nao sejam .js/.html/.css/.js-meta.xml).
function listExistingBundleFiles(bundleDir) {
  if (!existsSync(bundleDir)) return [];
  let entries;
  try {
    entries = readdirSync(bundleDir);
  } catch {
    return [];
  }
  return entries.filter((f) => isBundleFileName(f));
}

// Bloqueia sobrescrever um BUNDLE LWC que ja existe (qualquer arquivo dele no
// disco), independente de qual arquivo especifico esta sendo escrito agora e
// independente do "modo" que o agente alega estar executando.
//  - Caminho fora de uma pasta lwc/, ou nome de arquivo que nao e do bundle
//    (.js/.html/.css/.js-meta.xml) -> fora do escopo deste guard, permitido.
//  - Bundle NOVO (nenhum arquivo do bundle existe no disco ainda) -> permitido
//    (cobre os modos Criar e Clonar-e-Adaptar).
//  - Bundle que JA TEM algum arquivo no disco (mesmo que so 1 dos 4-5) -> pede
//    aprovacao (`ask`) para o BUNDLE INTEIRO (cobre o modo Editar, e evita
//    escrever so parte de um bundle que colide parcialmente com um existente).
// `opts.bundleFilesOverride` (opcional): lista de nomes de arquivo que "existem"
// no bundle, para testar sem tocar no disco.
export function classifyWrite(filePath, opts = {}) {
  const parsed = parseLwcBundlePath(filePath);
  if (!parsed || !isBundleFileName(parsed.fileName)) return { blocked: false };

  const existingSiblings =
    opts.bundleFilesOverride !== undefined
      ? opts.bundleFilesOverride
      : listExistingBundleFiles(parsed.bundleDir);

  if (existingSiblings.length > 0) {
    return {
      blocked: true,
      decision: 'ask',
      why:
        `o bundle "${parsed.bundleName}" ja tem arquivo(s) existente(s) no disco ` +
        `(${existingSiblings.join(', ')}) — tratando o BUNDLE INTEIRO como sobrescrita, ` +
        'independente do que foi declarado como "modo" (criar/clonar/editar). Nunca ' +
        'escreva parte de um bundle sem prompt quando ele ja existe.',
    };
  }
  return { blocked: false };
}

// --- Mensagem e hook -------------------------------------------------------
function reasonMessage(verdict) {
  if (verdict.decision === 'ask') {
    return (
      'ATENCAO (lwc-pattern-generator): esta escrita atinge um componente LWC que JA ' +
      'EXISTE no disco (ou tem arquivo(s) do bundle ja existentes) — ' +
      verdict.why +
      '. Confirme antes de prosseguir; aprovar por engano pode sobrescrever um ' +
      'componente em producao. Na duvida, recuse e confirme o nome/caminho com o usuario.'
    );
  }
  return (
    'BLOQUEADO pela skill lwc-pattern-generator: acao destrutiva proibida — ' +
    verdict.why +
    '. Nunca apagar/mover componentes LWC, apagar org ou registros. Se realmente ' +
    'precisa, faca manualmente/fora do agente, com revisao humana.'
  );
}

function runHook() {
  let raw = '';
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    let ti = {};
    try {
      ti = JSON.parse(raw || '{}').tool_input || {};
    } catch {
      process.exit(0); // nao conseguiu parsear -> nao bloqueia
    }

    let verdict = { blocked: false };
    if (ti.command !== undefined) {
      verdict = classify(ti.command);
    } else if (ti.file_path !== undefined) {
      verdict = classifyWrite(ti.file_path);
    } else {
      // fallback: varre o JSON inteiro por padrao de comando destrutivo
      verdict = classify(JSON.stringify(ti));
    }

    if (verdict.blocked) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: verdict.decision || 'deny',
            permissionDecisionReason: reasonMessage(verdict),
          },
        })
      );
    }
    process.exit(0);
  });
}

// So roda o hook (le stdin) quando executado diretamente pelo Claude Code.
// Quando importado (em testes), apenas as funcoes acima ficam disponiveis.
import { fileURLToPath } from 'node:url';
const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) runHook();
