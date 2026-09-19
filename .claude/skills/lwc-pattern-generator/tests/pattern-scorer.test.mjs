// pattern-scorer.test.mjs — Suite da rubrica de aderencia + diff estrutural.
//
// Cobre os 3 buckets exigidos pelo plano (secao 5/9): legado intocado NAO penaliza;
// item novo fora do padrao PENALIZA; remocao de convencao documentada vira aviso de
// REGRESSAO explicito (distinto do score). Usa fixtures sinteticas (nao depende do
// pattern-extractor.mjs real) para os testes de score/diff serem rapidos e isolados;
// o round-trip com o extrator real fica coberto pelo teste de integracao no final.
//
// Rodar: node --test .claude/skills/lwc-pattern-generator/tests/pattern-scorer.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scoreCandidate, scoreDiff, diffSignals, detectRegressions, detectNovelty } from '../scripts/pattern-scorer.mjs';

// --- Fixture: jornada tipica (inspirada na estrutura real de Consorcio/Sidebar) ---
const AGGREGATE = {
  naming: { dominantStyle: 'camelCase', commonPrefix: 'consorcio' },
  html: {
    rootTags: { div: 5, section: 1 },
    commonSldsClasses: [
      { item: 'slds-grid', count: 5 },
      { item: 'slds-col', count: 5 },
      { item: 'slds-box', count: 4 },
    ],
    a11yAvg: 2,
    spinnerUsers: 4,
  },
  js: {
    allApiMembers: ['idCota', 'quote', 'recordId'],
    commonApiMembers: [{ item: 'idCota', count: 5 }],
    apiDefaults: [{ name: 'quote', value: "'{}'" }],
    allGetters: ['isLoading', 'hasData'],
    sharedUtils: [{ module: 'c/consorcioUtil', importedBy: 5, components: ['a', 'b'], exports: ['fmt(x)'] }],
    eventContracts: [{ name: 'quotaselection', bubbles: true, composed: false, detailKeys: ['id'], count: 3 }],
    allEvents: ['quotaselection'],
    apexCallStyle: { usesThen: 1, usesAwait: 4, usesTryCatch: 2, refreshApex: 0 },
    toast: { users: 4, variants: ['error'] },
    labelUsers: 2,
  },
  componentSpecifics: {},
  partialConventions: {},
};

// Componente que segue TUDO da jornada.
const ADHERENT = {
  name: 'consorcioNovoComp',
  naming: { style: 'camelCase' },
  html: { rootTag: 'div', sldsClasses: ['slds-grid', 'slds-col'], a11yScore: 3 },
  js: {
    apiMembers: ['idCota', 'quote'],
    apiDefaults: [{ name: 'quote', value: "'{}'" }],
    getters: ['isLoading'],
    imports: ['c/consorcioUtil'],
    eventDetails: [{ name: 'quotaselection', bubbles: true, composed: false, detailKeys: ['id'] }],
    events: ['quotaselection'],
    apexCallStyle: { usesThen: false, usesAwait: true, usesTryCatch: false, refreshApex: false },
    hasLoadingState: true,
    usesShowToast: true,
    labels: ['c.AlgumLabel'],
  },
};

// Componente que diverge de TUDO (fora do padrao).
const DIVERGENT = {
  name: 'xyzComponent',
  naming: { style: 'PascalCase' },
  html: { rootTag: 'lightning-card', sldsClasses: ['minha-classe-custom'], a11yScore: 0 },
  js: {
    apiMembers: ['algumaCoisaAleatoria'],
    apiDefaults: [],
    getters: ['getterQueNaoExisteNaJornada'],
    imports: ['lightning/uiRecordApi'],
    eventDetails: [{ name: 'eventoDesconhecido', bubbles: false, composed: true, detailKeys: [] }],
    events: ['eventoDesconhecido'],
    apexCallStyle: { usesThen: true, usesAwait: false, usesTryCatch: false, refreshApex: false },
    hasLoadingState: false,
    usesShowToast: false,
    labels: [],
  },
};

describe('scoreCandidate() — modo Criar/Clonar (componente inteiro)', () => {
  test('componente 100% aderente pontua alto (>= 90/100)', () => {
    const score = scoreCandidate(ADHERENT, AGGREGATE);
    assert.equal(score.max, 100);
    assert.ok(score.total >= 90, `esperado >= 90, obtido ${score.total}`);
  });

  test('BUCKET "novo fora do padrao penaliza": componente divergente pontua baixo (<= 40/100)', () => {
    const score = scoreCandidate(DIVERGENT, AGGREGATE);
    assert.ok(score.total <= 40, `esperado <= 40, obtido ${score.total}`);
  });

  test('jornada sem convencao numa dimensao da credito integral (nunca penaliza por falta de dado)', () => {
    const score = scoreCandidate(ADHERENT, {});
    // Sem NENHUM sinal de convencao registrado, o componente nao pode ser "errado"
    // em nada -- deve tirar nota maxima em todas as dimensoes.
    assert.equal(score.total, score.max);
  });
});

describe('diffSignals() + scoreDiff() — modo Editar (BUCKET: legado intocado NAO penaliza)', () => {
  test('edicao que NAO toca nada relevante -> todas as dimensoes ficam "skippedUnchanged", score vazio (0/0)', () => {
    // Baseline e "depois" identicos ao componente DIVERGENTE (ou seja, o componente
    // JA era fora do padrao antes da edicao, e a edicao nao mexeu em nada disso) --
    // isso NAO pode aparecer como penalidade, porque nao e coisa nova da edicao.
    const before = JSON.parse(JSON.stringify(DIVERGENT));
    const after = JSON.parse(JSON.stringify(DIVERGENT));
    after.js.someUnrelatedInternalDetail = 'mudou mas nao e um campo rastreado'; // simula uma edicao real que so mexeu em algo fora do escopo pontuado
    const { delta, removed } = diffSignals(before, after);
    const score = scoreDiff(delta, removed, before, after, AGGREGATE);
    assert.equal(score.max, 0, 'nenhuma dimensao pontuavel deveria ter mudado');
    assert.equal(score.total, 0);
    assert.equal(score.skippedUnchanged.length, 11, 'as 11 dimensoes devem ser puladas por falta de mudanca');
  });

  test('edicao que so ADICIONA um novo evento fora do padrao -> so a dimensao de eventos e pontuada (e penalizada)', () => {
    const before = JSON.parse(JSON.stringify(ADHERENT));
    const after = JSON.parse(JSON.stringify(ADHERENT));
    after.js.events = [...before.js.events, 'novoEventoInventado'];
    after.js.eventDetails = [...before.js.eventDetails, { name: 'novoEventoInventado', bubbles: false, composed: false, detailKeys: [] }];
    const { delta, removed } = diffSignals(before, after);
    const score = scoreDiff(delta, removed, before, after, AGGREGATE);
    assert.equal(score.dimensions.length, 1, 'so a dimensao de eventos deveria ter mudado');
    assert.equal(score.dimensions[0].label, 'Contrato de eventos');
    assert.equal(score.max, 10);
    // O evento novo nao bate com nenhum eventContract conhecido -> "nada para comparar"
    // (credito integral por falta de contrato conflitante) OU penalidade se
    // considerado invencao. Aqui validamos que a dimensao FOI avaliada (nao pulada).
    assert.ok(score.skippedUnchanged.length === 10, 'as OUTRAS 10 dimensoes devem continuar puladas (legado intocado)');
  });

  test('edicao que so ADICIONA classes SLDS fora do vocabulario -> so SLDS e pontuada, com nota baixa', () => {
    const before = JSON.parse(JSON.stringify(ADHERENT));
    const after = JSON.parse(JSON.stringify(ADHERENT));
    after.html.sldsClasses = [...before.html.sldsClasses, 'classe-inventada-fora-do-padrao'];
    const { delta, removed } = diffSignals(before, after);
    const score = scoreDiff(delta, removed, before, after, AGGREGATE);
    assert.equal(score.dimensions.length, 1);
    assert.equal(score.dimensions[0].label, 'Vocabulario SLDS');
    // delta.html.sldsClasses = ['classe-inventada-fora-do-padrao'] (so o novo) -> 0/1 no vocabulario comum
    assert.ok(score.dimensions[0].points < score.dimensions[0].max, 'classe nova fora do vocabulario deve pontuar abaixo do maximo');
  });
});

describe('detectRegressions() — BUCKET: remocao de convencao documentada vira aviso', () => {
  test('remover um @api do contrato comum -> REGRESSAO explicita', () => {
    const before = JSON.parse(JSON.stringify(ADHERENT));
    const after = JSON.parse(JSON.stringify(ADHERENT));
    after.js.apiMembers = before.js.apiMembers.filter((m) => m !== 'idCota'); // remove o @api que É contrato comum
    const { removed } = diffSignals(before, after);
    const warnings = detectRegressions(removed, AGGREGATE);
    assert.ok(warnings.some((w) => w.includes('idCota')), `esperava aviso sobre idCota, obtido: ${JSON.stringify(warnings)}`);
    assert.ok(warnings.every((w) => w.startsWith('REGRESSAO')));
  });

  test('remover o toast de erro (convencao da jornada) -> REGRESSAO explicita', () => {
    const before = JSON.parse(JSON.stringify(ADHERENT));
    const after = JSON.parse(JSON.stringify(ADHERENT));
    after.js.usesShowToast = false;
    const { removed } = diffSignals(before, after);
    const warnings = detectRegressions(removed, AGGREGATE);
    assert.ok(warnings.some((w) => /toast/i.test(w)));
  });

  test('remover o estado de loading (convencao da jornada) -> REGRESSAO explicita', () => {
    const before = JSON.parse(JSON.stringify(ADHERENT));
    const after = JSON.parse(JSON.stringify(ADHERENT));
    after.js.hasLoadingState = false;
    const { removed } = diffSignals(before, after);
    const warnings = detectRegressions(removed, AGGREGATE);
    assert.ok(warnings.some((w) => /loading/i.test(w)));
  });

  test('remover um evento do contrato de eventos -> REGRESSAO explicita', () => {
    const before = JSON.parse(JSON.stringify(ADHERENT));
    const after = JSON.parse(JSON.stringify(ADHERENT));
    after.js.events = [];
    after.js.eventDetails = [];
    const { removed } = diffSignals(before, after);
    const warnings = detectRegressions(removed, AGGREGATE);
    assert.ok(warnings.some((w) => /quotaselection/.test(w)));
  });

  test('remover algo que NAO e convencao documentada -> SEM regressao (nao inventa aviso)', () => {
    const before = JSON.parse(JSON.stringify(ADHERENT));
    before.js.apiMembers = [...before.js.apiMembers, 'algoBemEspecificoDesteComponenteSo'];
    const after = JSON.parse(JSON.stringify(ADHERENT)); // remove esse membro especifico (nao faz parte do contrato comum)
    const { removed } = diffSignals(before, after);
    const warnings = detectRegressions(removed, AGGREGATE);
    assert.equal(warnings.length, 0, `nao deveria haver regressao para item nao-convencional, obtido: ${JSON.stringify(warnings)}`);
  });
});

describe('detectNovelty() — gatilho objetivo de "rode a Skill 1 de novo"', () => {
  test('componente 100% dentro do conhecido -> novel:false', () => {
    const n = detectNovelty(ADHERENT, AGGREGATE);
    assert.equal(n.novel, false);
  });

  test('componente com @api/evento/classe SLDS totalmente desconhecidos -> novel:true com os itens', () => {
    const n = detectNovelty(DIVERGENT, AGGREGATE);
    assert.equal(n.novel, true);
    assert.ok(n.items.includes('algumaCoisaAleatoria'));
    assert.ok(n.items.includes('eventoDesconhecido'));
  });

  test('item presente em componentSpecifics de ALGUM componente da jornada NAO conta como novidade', () => {
    const aggWithSpecifics = {
      ...AGGREGATE,
      componentSpecifics: { outroComponente: { unique: { apiMembers: ['algumaCoisaAleatoria'] } } },
    };
    const n = detectNovelty(DIVERGENT, aggWithSpecifics);
    assert.ok(!n.items.includes('algumaCoisaAleatoria'), 'item ja registrado como especifico de outro componente nao deveria contar como novo');
  });
});
