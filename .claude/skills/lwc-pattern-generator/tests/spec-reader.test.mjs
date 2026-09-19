// Testes do spec-reader.mjs — leitura deterministica da spec da Skill 2.
// Rodar: node --test .claude/skills/lwc-pattern-generator/tests/*.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  slugFromComponent,
  parseHeader,
  parseSpec,
  bulletsUnderHeading,
  findPendencias,
  listSections,
  readSpecForComponent,
  listSpecs,
  PENDING_MARK,
} from '../scripts/spec-reader.mjs';

// --- fixtures ----------------------------------------------------------------

const SPEC_MELHORIA = `# Spec: Consorcio Lista Cotas

| | |
|---|---|
| **Tipo** | Melhoria pontual |
| **Status** | Aprovada |
| **Versão** | 2 |
| **Jornada de referência** | Consórcio |
| **Componente** | \`force-app/main/default/lwc/consorcioListaCotas\` |
| **Ticket / Solicitante** | JIRA-123, Maria |
| **Data** | 2026-07-29 |

## 1. Objetivo

Adicionar filtro por status na lista de cotas.

## 2. Escopo

### No escopo
- Filtro por status

### Fora do escopo (não-objetivos)
- Não muda a paginação existente
- Não altera o layout do card

## 3. Estado atual e limites da mudança

**Comportamento atual (as-is):** lista todas as cotas sem filtro.

### ⛔ Contrato público congelado (o que NÃO pode mudar)
- \`@api recordId\` — consumido pela Record Page de Conta
- Evento \`cotaselected\` — escutado pelo componente pai
- <placeholder que deve ser ignorado>

**Consumidores conhecidos:** consorcioPainel, Flow "Atendimento Cota"

## 8. Comportamento e mensagens

### Eventos disparados
Nada novo.
`;

const SPEC_NOVO_COM_PENDENCIA = `# Spec: Seguro Card Resumo

| | |
|---|---|
| **Tipo** | Componente novo |
| **Status** | Rascunho |
| **Versão** | 1 |
| **Jornada de referência** | nenhuma documentada ainda |
| **Componente** | (a criar) |
| **Data** | <AAAA-MM-DD> |

## 1. Objetivo

Mostrar o resumo da apólice.

## 2. Escopo

### Fora do escopo (não-objetivos)
- Não faz edição de apólice

## 4. Dados e integração

### Saída esperada
${PENDING_MARK}: contrato de saída do Apex — aguardando definição do time de backend

## 11. Questões em aberto e riscos

### 🚧 Pendências (bloqueiam a implementação)
- ${PENDING_MARK}: contrato de saída do Apex — aguardando definição do time de backend
`;

function withTempSpecs(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-reader-test-'));
  try {
    for (const [name, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name), content, 'utf8');
    }
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// --- slug --------------------------------------------------------------------

describe('slugFromComponent() — contrato de nome de arquivo da spec', () => {
  test('camelCase vira kebab-case (nao gruda tudo)', () => {
    assert.equal(slugFromComponent('consorcioListaCotas'), 'consorcio-lista-cotas');
  });

  test('nome ja simples continua igual', () => {
    assert.equal(slugFromComponent('alertInfo'), 'alert-info');
    assert.equal(slugFromComponent('card'), 'card');
  });

  test('path completo usa so o basename', () => {
    assert.equal(
      slugFromComponent('force-app/main/default/lwc/consorcioListaCotas'),
      'consorcio-lista-cotas'
    );
  });

  test('barra no fim nao quebra o basename', () => {
    assert.equal(
      slugFromComponent('force-app/main/default/lwc/consorcioListaCotas/'),
      'consorcio-lista-cotas'
    );
  });

  test('acento e removido (mesma normalizacao das outras skills)', () => {
    assert.equal(slugFromComponent('apoliceResumo'), 'apolice-resumo');
    assert.equal(slugFromComponent('consórcio'), 'consorcio');
  });
});

// --- cabecalho ---------------------------------------------------------------

describe('parseHeader() — a tabela de metadados no topo', () => {
  test('extrai todas as chaves conhecidas', () => {
    const h = parseHeader(SPEC_MELHORIA);
    assert.equal(h.tipo, 'Melhoria pontual');
    assert.equal(h.status, 'Aprovada');
    assert.equal(h.versao, '2');
    assert.equal(h.jornada, 'Consórcio');
    assert.equal(h.ticket, 'JIRA-123, Maria');
    assert.equal(h.data, '2026-07-29');
    assert.match(h.componente, /consorcioListaCotas/);
  });

  test('placeholder nao preenchido do template e ignorado', () => {
    const h = parseHeader(SPEC_NOVO_COM_PENDENCIA);
    assert.equal(h.data, undefined, '"<AAAA-MM-DD>" nao pode virar valor');
  });

  test('mapeia Tipo -> modo de operacao da Skill 3', () => {
    assert.equal(parseHeader(SPEC_MELHORIA).mode, 'editar');
    assert.equal(parseHeader(SPEC_NOVO_COM_PENDENCIA).mode, 'criar');
    assert.equal(parseHeader('| **Tipo** | Clonar e adaptar |').mode, 'clonar');
  });

  test('tipo desconhecido nao vira modo (nao chuta)', () => {
    const h = parseHeader('| **Tipo** | Alguma coisa nova |');
    assert.equal(h.tipo, 'Alguma coisa nova');
    assert.equal(h.mode, null);
  });

  test('linha que nao e tabela nao polui o cabecalho', () => {
    const h = parseHeader('# Titulo\n\nTexto solto com **Tipo** no meio.\n');
    assert.deepEqual(h, {});
  });

  // Regressao (encontrada em teste ponta a ponta com uma spec real): a tabela
  // "Historico" do rodape tem o cabecalho `| Versao | Data | Mudanca |`, que casava
  // com as chaves conhecidas e sobrescrevia a Versao real do preambulo por "Data".
  test('tabela DEPOIS da primeira secao nao e lida como metadado', () => {
    const spec = [
      '# Spec: X',
      '',
      '| | |',
      '|---|---|',
      '| **Versão** | 2 |',
      '| **Tipo** | Componente novo |',
      '',
      '## 1. Objetivo',
      'algo',
      '',
      '## Histórico',
      '',
      '| Versão | Data | Mudança |',
      '|---|---|---|',
      '| 1 | 2026-01-01 | Spec inicial |',
    ].join('\n');
    const h = parseHeader(spec);
    assert.equal(h.versao, '2', 'a Versao do preambulo nao pode ser sobrescrita');
    assert.equal(h.data, undefined, 'nada da tabela de historico entra no cabecalho');
    assert.equal(h.mode, 'criar');
  });
});

// --- secoes e bullets --------------------------------------------------------

describe('bulletsUnderHeading() — extracao de listas criticas', () => {
  test('contrato publico congelado (a fronteira de regressao)', () => {
    const frozen = bulletsUnderHeading(SPEC_MELHORIA, /contrato publico congelado/);
    assert.equal(frozen.length, 2, 'placeholder <...> deve ser descartado');
    assert.match(frozen[0], /recordId/);
    assert.match(frozen[1], /cotaselected/);
  });

  test('nao-objetivos', () => {
    const nonObj = bulletsUnderHeading(SPEC_MELHORIA, /fora do escopo/);
    assert.deepEqual(nonObj, [
      'Não muda a paginação existente',
      'Não altera o layout do card',
    ]);
  });

  test('para no proximo heading (nao vaza bullet de outra secao)', () => {
    const content = [
      '### Fora do escopo',
      '- item A',
      '### Outra coisa',
      '- item B',
    ].join('\n');
    assert.deepEqual(bulletsUnderHeading(content, /fora do escopo/), ['item A']);
  });

  test('secao ausente devolve lista vazia (nao quebra)', () => {
    assert.deepEqual(bulletsUnderHeading(SPEC_NOVO_COM_PENDENCIA, /contrato publico congelado/), []);
  });
});

describe('listSections()', () => {
  test('lista os headings de nivel 2 e 3', () => {
    const titles = listSections(SPEC_MELHORIA).map((s) => s.title);
    assert.ok(titles.includes('1. Objetivo'));
    assert.ok(titles.includes('2. Escopo'));
    assert.ok(titles.includes('Fora do escopo (não-objetivos)'));
  });
});

// --- pendencias --------------------------------------------------------------

describe('findPendencias()', () => {
  test('encontra todas as marcacoes de pendente', () => {
    const p = findPendencias(SPEC_NOVO_COM_PENDENCIA);
    assert.equal(p.length, 2, 'aparece na secao de dados e na de questoes em aberto');
    assert.ok(p.every((l) => l.includes('contrato de saída do Apex')));
  });

  test('spec sem pendencia devolve vazio', () => {
    assert.deepEqual(findPendencias(SPEC_MELHORIA), []);
  });

  // Regressao (teste ponta a ponta): pendencia quebrada em 2 linhas no Markdown
  // chegava truncada no meio da frase.
  test('pendencia quebrada em varias linhas vem inteira', () => {
    const spec = [
      '- ' + PENDING_MARK + ': o filtro deve ser aplicado no Apex (server-side) ou no',
      '  client sobre a pagina atual? — aguardando o time de arquitetura',
      '',
      '- outro item qualquer',
    ].join('\n');
    const p = findPendencias(spec);
    assert.equal(p.length, 1);
    assert.match(p[0], /aguardando o time de arquitetura$/, 'deve juntar a continuacao');
    assert.ok(!p[0].includes('outro item'), 'nao pode engolir o proximo bullet');
  });
});

// --- parseSpec: os avisos que guiam o agente ---------------------------------

describe('parseSpec() — avisos', () => {
  test('spec completa e aprovada nao gera aviso', () => {
    const r = parseSpec(SPEC_MELHORIA, 'x-spec.md');
    assert.equal(r.warnings.length, 0);
    assert.equal(r.mode, 'editar');
    assert.equal(r.frozenContract.length, 2);
    assert.equal(r.nonObjectives.length, 2);
  });

  test('status Rascunho vira aviso', () => {
    const r = parseSpec(SPEC_NOVO_COM_PENDENCIA, 'x-spec.md');
    assert.ok(r.warnings.some((w) => /Rascunho/.test(w)));
  });

  test('pendencia vira aviso com a proibicao de inventar', () => {
    const r = parseSpec(SPEC_NOVO_COM_PENDENCIA, 'x-spec.md');
    const w = r.warnings.find((x) => /pendencia/i.test(x));
    assert.ok(w, 'deve avisar sobre pendencias');
    assert.match(w, /NUNCA invente/);
  });

  test('jornada "nenhuma documentada" vira aviso de falta de padrao', () => {
    const r = parseSpec(SPEC_NOVO_COM_PENDENCIA, 'x-spec.md');
    assert.ok(r.warnings.some((w) => /Skill 1|gate de aderencia/.test(w)));
  });

  test('melhoria pontual SEM contrato congelado vira aviso (fronteira de regressao)', () => {
    const semContrato = SPEC_MELHORIA.replace(
      /### ⛔ Contrato público congelado[\s\S]*?\n\n/,
      ''
    );
    const r = parseSpec(semContrato, 'x-spec.md');
    assert.ok(
      r.warnings.some((w) => /contrato publico congelado/i.test(w)),
      'spec de edicao sem fronteira de regressao tem que avisar'
    );
  });

  test('spec sem Tipo avisa que nao da para derivar o modo', () => {
    const r = parseSpec('# Spec: X\n\nsem cabecalho de tabela\n', 'x-spec.md');
    assert.equal(r.mode, null);
    assert.ok(r.warnings.some((w) => /nao declara o "Tipo"/.test(w)));
  });
});

// --- resolucao por componente ------------------------------------------------

describe('readSpecForComponent() / listSpecs()', () => {
  test('encontra a spec pelo slug derivado do nome do componente', () => {
    withTempSpecs({ 'consorcio-lista-cotas-spec.md': SPEC_MELHORIA }, (dir) => {
      const r = readSpecForComponent('consorcioListaCotas', dir);
      assert.equal(r.found, true);
      assert.equal(r.slug, 'consorcio-lista-cotas');
      assert.equal(r.mode, 'editar');
    });
  });

  test('encontra pelo path completo tambem', () => {
    withTempSpecs({ 'consorcio-lista-cotas-spec.md': SPEC_MELHORIA }, (dir) => {
      const r = readSpecForComponent('force-app/main/default/lwc/consorcioListaCotas', dir);
      assert.equal(r.found, true);
    });
  });

  // Regressao: nome com digito/sigla e onde o kebab-case escrito a mao diverge do
  // calculado ("consorcio-lances-2024" vs "consorcio-lances2024"). Sem o fallback, a
  // spec seria silenciosamente ignorada e a Skill 3 cairia na entrevista inline.
  test('acha a spec mesmo com o hifen em outro lugar (nome com digito)', () => {
    const spec = SPEC_MELHORIA.replace(
      '| **Componente** | `force-app/main/default/lwc/consorcioListaCotas` |',
      '| **Componente** | `force-app/main/default/lwc/consorcioLances2024` |'
    );
    withTempSpecs({ 'consorcio-lances-2024-spec.md': spec }, (dir) => {
      const r = readSpecForComponent('consorcioLances2024', dir);
      assert.equal(r.found, true, 'o fallback por chave compacta tem que achar');
      assert.equal(r.slug, 'consorcio-lances2024', 'o slug canonico continua sendo o calculado');
      assert.ok(
        r.warnings.some((w) => /nome canonico/.test(w)),
        'deve avisar que o arquivo foge do padrao, sem falhar'
      );
    });
  });

  test('nome canonico presente vence — nao vira ambiguidade', () => {
    withTempSpecs(
      {
        'consorcio-lances2024-spec.md': SPEC_MELHORIA, // canonico
        'consorcio-lances-2024-spec.md': SPEC_NOVO_COM_PENDENCIA, // variante
      },
      (dir) => {
        const r = readSpecForComponent('consorcioLances2024', dir);
        assert.equal(r.found, true);
        assert.match(r.specPath, /consorcio-lances2024-spec\.md$/);
        assert.equal(r.mode, 'editar', 'leu o canonico, nao a variante');
      }
    );
  });

  test('duas variantes ambiguas (nenhuma canonica) -> NAO escolhe sozinho', () => {
    withTempSpecs(
      {
        'consorcio-lances-2024-spec.md': SPEC_MELHORIA,
        'consorcio-lances-20-24-spec.md': SPEC_MELHORIA,
      },
      (dir) => {
        const r = readSpecForComponent('consorcioLances2024', dir);
        assert.equal(r.found, false);
        assert.equal(r.candidates.length, 2);
        assert.ok(r.warnings.some((w) => /NAO escolha sozinho/.test(w)));
      }
    );
  });

  test('spec ausente NAO e erro fatal — orienta as duas saidas', () => {
    withTempSpecs({}, (dir) => {
      const r = readSpecForComponent('naoExiste', dir);
      assert.equal(r.found, false);
      const w = r.warnings.join(' ');
      assert.match(w, /lwc-spec-writer/, 'deve oferecer rodar a Skill 2');
      assert.match(w, /etapa 3/, 'deve oferecer a coleta inline como alternativa');
      assert.match(w, /NUNCA invente/);
    });
  });

  test('listSpecs devolve o resumo de cada spec', () => {
    withTempSpecs(
      {
        'consorcio-lista-cotas-spec.md': SPEC_MELHORIA,
        'seguro-card-resumo-spec.md': SPEC_NOVO_COM_PENDENCIA,
        'ignorar.md': '# nao e spec',
      },
      (dir) => {
        const specs = listSpecs(dir);
        assert.equal(specs.length, 2, 'so arquivos *-spec.md contam');
        assert.equal(specs[0].mode, 'editar');
        assert.equal(specs[1].mode, 'criar');
        assert.equal(specs[1].status, 'Rascunho');
      }
    );
  });

  test('diretorio de specs inexistente devolve lista vazia (nao quebra)', () => {
    assert.deepEqual(listSpecs(path.join(os.tmpdir(), 'nao-existe-mesmo-12345')), []);
  });
});
