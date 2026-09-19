#!/usr/bin/env node
// spec-reader.mjs — Leitor DETERMINISTICO da spec de um componente (gravada pela
// lwc-spec-writer, Skill 2, em .lwc-spec-writer/specs/<slug>-spec.md).
//
// Papel das DUAS fontes que a Skill 3 consome (nunca uma sem a outra, quando ambas
// existem):
//   - SPEC (este script)      -> "O QUE construir": requisito, escopo, nao-objetivos,
//                                contrato publico congelado. Spec-driven design.
//   - PADRAO (pattern-reader) -> "COMO construir nesta org": estrutura, naming, SLDS,
//                                contrato @api idiomatico. Guia de system design.
//
// Mesma filosofia dos outros scripts: LE de forma mecanica e sinaliza; o agente JULGA.
// Nunca "resolve" uma pendencia da spec inventando resposta — so reporta.
//
// Uso:
//   node spec-reader.mjs --component <nomeOuPath> [--specs-dir <dir>]
//     -> resolve o slug do componente, le a spec correspondente, devolve o cabecalho
//        estruturado + pendencias + contrato congelado + nao-objetivos + avisos.
//
//   node spec-reader.mjs --spec <caminho-do-arquivo>
//     -> le uma spec apontada diretamente (util quando o nome do arquivo foge do slug).
//
//   node spec-reader.mjs --list [--specs-dir <dir>]
//     -> lista as specs disponiveis (arquivo + tipo + status + componente).
//
//   node spec-reader.mjs --slug-for <nomeDoComponente>
//     -> devolve o nome de arquivo CANONICO da spec daquele componente. A Skill 2 chama
//        isto antes de gravar, para o arquivo nascer com o nome que a Skill 3 procura.
//
// Opcional:
//   --specs-dir <dir>   base (padrao: .lwc-spec-writer/specs)
//
// Requisitos: Node 18+. Zero dependencias externas.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_SPECS_DIR = '.lwc-spec-writer/specs';

// Precisa ser IDENTICA a normHeading/slugFromHeading do pattern-reader.mjs e do
// pattern-writer.mjs (Skill 1). Duplicada de proposito — as skills sao dominios
// independentes, mas o CONTRATO nome->slug tem que ser identico nos tres lados.
export function normHeading(name) {
  return String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}
export function slugFromHeading(name) {
  const slug = normHeading(name).replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
  return slug || 'component';
}

// camelCase -> kebab-case ANTES da normalizacao, senao "consorcioListaCotas" viraria
// "consorciolistacotas" (tudo junto) em vez de "consorcio-lista-cotas".
export function slugFromComponent(nameOrPath) {
  const base = path.basename(String(nameOrPath).replace(/[\\/]+$/, ''));
  const spaced = base.replace(/([a-z0-9])([A-Z])/g, '$1-$2');
  return slugFromHeading(spaced);
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

// --- parsing do cabecalho em tabela -------------------------------------------
// O template da Skill 2 grava o cabecalho como tabela `| **Chave** | valor |`.
const HEADER_KEYS = {
  'tipo': 'tipo',
  'status': 'status',
  'versao': 'versao',
  'jornada de referencia': 'jornada',
  'componente': 'componente',
  'componente-fonte': 'componenteFonte',
  'componente fonte': 'componenteFonte',
  'ticket / solicitante': 'ticket',
  'ticket/solicitante': 'ticket',
  'data': 'data',
};

// Tipo da spec (Skill 2) -> modo de operacao da Skill 3. Mapeamento deterministico:
// o agente nao deve "deduzir" o modo da prosa quando a spec ja o declara.
const TIPO_TO_MODE = {
  'componente novo': 'criar',
  'novo': 'criar',
  'clonar e adaptar': 'clonar',
  'clonar': 'clonar',
  'melhoria pontual': 'editar',
  'melhoria': 'editar',
};

export function parseHeader(content) {
  const header = {};
  for (const line of content.split(/\r?\n/)) {
    // O cabecalho de metadados fica no PREAMBULO (antes da secao 1). Parar no primeiro
    // heading de nivel 2+ evita ler outras tabelas do documento como se fossem
    // metadado — em especial a tabela "Historico" do rodape, cujo cabecalho
    // (`| Versao | Data | Mudanca |`) casaria com as chaves conhecidas.
    if (/^#{2,}\s/.test(line)) break;
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').map((c) => c.trim());
    // linha valida: ['', 'chave', 'valor', ''] -> pelo menos 4 pedacos
    if (cells.length < 4) continue;
    const rawKey = cells[1].replace(/\*\*/g, '').trim();
    if (!rawKey) continue;
    const key = HEADER_KEYS[normHeading(rawKey)];
    if (!key) continue;
    const value = cells[2].trim();
    // ignora placeholder nao preenchido do template (ex.: "<AAAA-MM-DD>")
    if (!value || /^<.*>$/.test(value)) continue;
    header[key] = value;
  }
  if (header.tipo) header.mode = TIPO_TO_MODE[normHeading(header.tipo)] || null;
  return header;
}

// --- extracao de secoes --------------------------------------------------------
export function listSections(content) {
  const out = [];
  for (const line of content.split(/\r?\n/)) {
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (m) out.push({ level: m[1].length, title: m[2] });
  }
  return out;
}

// Extrai os bullets de uma secao cujo titulo casa com `matcher` (regex).
// Para ate o proximo heading de nivel igual ou superior.
export function bulletsUnderHeading(content, matcher) {
  const lines = content.split(/\r?\n/);
  const bullets = [];
  let inside = false;
  let headingLevel = 0;
  for (const line of lines) {
    const h = /^(#{2,4})\s+(.+?)\s*$/.exec(line);
    if (h) {
      const level = h[1].length;
      if (inside && level <= headingLevel) break; // fim da secao
      if (!inside && matcher.test(normHeading(h[2]))) {
        inside = true;
        headingLevel = level;
      }
      continue;
    }
    if (!inside) continue;
    const b = /^\s*[-*]\s+(.+?)\s*$/.exec(line);
    if (b) {
      const text = b[1].trim();
      if (!/^<.*>$/.test(text)) bullets.push(text); // ignora placeholder do template
    }
  }
  return bullets;
}

export const PENDING_MARK = '\u{1F6A7} PENDENTE';

// Junta as linhas de continuacao de um item de lista/paragrafo, para uma pendencia
// quebrada em duas linhas no Markdown nao chegar truncada no meio da frase.
export function logicalLines(content) {
  const out = [];
  for (const raw of content.split(/\r?\n/)) {
    const isNewBlock =
      raw.trim() === '' ||
      /^\s*[-*]\s+/.test(raw) ||
      /^#{1,6}\s/.test(raw) ||
      raw.trim().startsWith('|') ||
      raw.trim().startsWith('```');
    if (isNewBlock || out.length === 0) out.push(raw);
    else out[out.length - 1] = `${out[out.length - 1].replace(/\s+$/, '')} ${raw.trim()}`;
  }
  return out;
}

export function findPendencias(content) {
  return logicalLines(content)
    .filter((l) => l.includes(PENDING_MARK))
    .map((l) => l.replace(/^\s*[-*]\s*/, '').trim());
}

// --- leitura completa ----------------------------------------------------------
export function parseSpec(content, specPath) {
  const header = parseHeader(content);
  const pendencias = findPendencias(content);
  const frozenContract = bulletsUnderHeading(content, /contrato publico congelado/);
  const nonObjectives = bulletsUnderHeading(content, /fora do escopo/);
  const sections = listSections(content);
  const warnings = [];

  if (!header.tipo) {
    warnings.push(
      'A spec nao declara o "Tipo" no cabecalho. Sem isso nao da para derivar o modo de ' +
      'operacao (Criar/Clonar/Editar) — confirme o modo com o usuario antes de prosseguir.'
    );
  } else if (!header.mode) {
    warnings.push(
      `Tipo "${header.tipo}" nao reconhecido (esperado: "Componente novo", "Clonar e ` +
      'adaptar" ou "Melhoria pontual"). Confirme o modo com o usuario.'
    );
  }

  if (header.status && normHeading(header.status) === 'rascunho') {
    warnings.push(
      'A spec esta com Status = Rascunho. Confirme com o usuario se ela ja pode guiar a ' +
      'implementacao, ou se falta revisao/aprovacao antes.'
    );
  }

  if (pendencias.length) {
    warnings.push(
      `A spec tem ${pendencias.length} pendencia(s) marcada(s) como PENDENTE. NUNCA invente ` +
      'a resposta de um campo pendente — pergunte ao usuario antes de gerar o que depende dele.'
    );
  }

  if (header.mode === 'editar' && frozenContract.length === 0) {
    warnings.push(
      'Spec do tipo "Melhoria pontual" SEM contrato publico congelado preenchido. Esse campo ' +
      'e a fronteira de regressao (o que outros consumidores dependem e nao pode mudar). ' +
      'Confirme com o usuario o que NAO pode mudar antes de editar.'
    );
  }

  if (header.jornada && /nenhuma/.test(normHeading(header.jornada))) {
    warnings.push(
      'A spec foi escrita sem jornada de referencia ("nenhuma documentada ainda"). Nao ha ' +
      'padrao da org para comparar — ofereca rodar a Skill 1 antes, ou siga so com o craft ' +
      'delegado, avisando que nao havera gate de aderencia.'
    );
  }

  return {
    found: true,
    specPath,
    header,
    mode: header.mode || null,
    pendencias,
    frozenContract,
    nonObjectives,
    sections: sections.map((s) => s.title),
    warnings,
  };
}

export function readSpecFile(specPath) {
  if (!fs.existsSync(specPath)) {
    return {
      found: false,
      specPath,
      warnings: [`Spec nao encontrada em ${specPath}.`],
    };
  }
  return parseSpec(fs.readFileSync(specPath, 'utf8'), specPath);
}

// Chave "compacta" (so alfanumerico, sem hifen) para casar variacoes de kebab-case que
// diferem so em ONDE o hifen caiu — o caso real e nome com digito ou sigla:
// "consorcio-lances2024" vs "consorcio-lances-2024" -> a mesma coisa.
function compactKey(s) {
  return normHeading(s).replace(/[^a-z0-9]/g, '');
}

function cleanComponentField(value) {
  return String(value || '').replace(/`/g, '').replace(/[\\/]+$/, '').trim();
}

export function readSpecForComponent(nameOrPath, specsDir) {
  const slug = slugFromComponent(nameOrPath);
  const specPath = path.join(specsDir, `${slug}-spec.md`);
  const component = String(nameOrPath);

  if (fs.existsSync(specPath)) {
    return { ...readSpecFile(specPath), component, slug };
  }

  // Fallback: o arquivo pode ter sido nomeado com o hifen em outro lugar (spec escrita
  // a mao, ou por um agente que derivou o kebab-case por conta propria). Varre o
  // diretorio e casa pela chave compacta — do nome do arquivo OU do campo "Componente"
  // do cabecalho. Sem isso a spec seria silenciosamente ignorada.
  const wanted = compactKey(path.basename(component.replace(/[\\/]+$/, '')));
  const candidates = listSpecs(specsDir).filter((s) => {
    const fileKey = compactKey(s.file.replace(/-spec\.md$/, ''));
    const compKey = compactKey(path.basename(cleanComponentField(s.componente)));
    return fileKey === wanted || (compKey && compKey === wanted);
  });

  if (candidates.length === 1) {
    const hit = candidates[0];
    const parsed = readSpecFile(hit.specPath);
    return {
      ...parsed,
      component,
      slug,
      warnings: [
        `A spec foi encontrada em "${hit.file}", mas o nome canonico para "${component}" ` +
        `seria "${slug}-spec.md". Funciona, mas vale renomear para o padrao (rode ` +
        '`spec-reader.mjs --slug-for <componente>` para obter o nome canonico).',
        ...(parsed.warnings || []),
      ],
    };
  }

  if (candidates.length > 1) {
    return {
      found: false,
      component,
      slug,
      specPath,
      candidates: candidates.map((c) => c.file),
      warnings: [
        `Mais de uma spec parece corresponder a "${component}": ` +
        `${candidates.map((c) => c.file).join(', ')}. NAO escolha sozinho — pergunte ao ` +
        'usuario qual usar, ou aponte o arquivo direto com --spec.',
      ],
    };
  }

  return {
    found: false,
    component,
    slug,
    specPath,
    warnings: [
      `Nenhuma spec encontrada para "${component}" (procurei em ${specPath} e varri ` +
      `${specsDir}). Ofereca ao usuario: (a) rodar a lwc-spec-writer (Skill 2) para ` +
      'escrever a spec primeiro, ou (b) seguir com a coleta de requisito inline do guia ' +
      '(etapa 3). NUNCA invente um requisito que nao foi informado.',
    ],
  };
}

export function listSpecs(specsDir) {
  if (!fs.existsSync(specsDir)) return [];
  return fs
    .readdirSync(specsDir)
    .filter((f) => f.endsWith('-spec.md'))
    .sort()
    .map((file) => {
      const full = path.join(specsDir, file);
      let header = {};
      try {
        header = parseHeader(fs.readFileSync(full, 'utf8'));
      } catch {
        /* arquivo ilegivel: devolve so o nome */
      }
      return {
        file,
        specPath: full,
        componente: header.componente || null,
        tipo: header.tipo || null,
        mode: header.mode || null,
        status: header.status || null,
        jornada: header.jornada || null,
      };
    });
}

function main() {
  const specsDirArg = arg('specs-dir', DEFAULT_SPECS_DIR);
  const specsDir = typeof specsDirArg === 'string' ? specsDirArg : DEFAULT_SPECS_DIR;

  // Usado pela lwc-spec-writer (Skill 2) ANTES de gravar: garante que o nome do arquivo
  // e exatamente o que esta skill vai procurar depois. Evita a spec ser escrita com o
  // hifen em outro lugar e ficar "invisivel" para a Skill 3.
  const slugFor = arg('slug-for');
  if (typeof slugFor === 'string') {
    const slug = slugFromComponent(slugFor);
    emit({
      mode: 'slug-for',
      component: slugFor,
      slug,
      fileName: `${slug}-spec.md`,
      specPath: path.join(specsDir, `${slug}-spec.md`),
    });
  }

  if (arg('list')) {
    emit({ mode: 'list', specsDir, specs: listSpecs(specsDir) });
  }

  const specPath = arg('spec');
  if (typeof specPath === 'string') {
    const result = readSpecFile(specPath);
    emit({ mode: 'spec', ...result }, result.found ? 0 : 1);
  }

  const component = arg('component');
  if (typeof component === 'string') {
    const result = readSpecForComponent(component, specsDir);
    emit({ mode: 'component', ...result }, result.found ? 0 : 1);
  }

  console.error(
    'Uso: --component <nomeOuPath> | --spec <arquivo> | --list | --slug-for <componente>  [--specs-dir <dir>]'
  );
  process.exit(2);
}

// So roda o CLI quando executado diretamente (mesmo padrao do pattern-reader.mjs):
// importar para teste nunca pode disparar process.exit().
import { fileURLToPath } from 'node:url';
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) main();
