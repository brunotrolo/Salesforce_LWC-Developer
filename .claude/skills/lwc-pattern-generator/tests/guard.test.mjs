// guard.test.mjs — Suite de regressao da Camada 2 de seguranca (guard.mjs).
//
// Tier 2.5 do plano: BLOQUEIA o Tier 3 (pattern-reader.mjs/pattern-scorer.mjs) ate
// esta suite passar. Risco da Skill 3 e maior que o da Skill 1 (edita codigo de
// producao, nao so Markdown) — por isso nasce testada, em vez de so ganhar testes
// depois de um bug real (a licao da Skill 1).
//
// Rodar: node --test .claude/skills/lwc-pattern-generator/tests/guard.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { classify, classifyWrite, parseLwcBundlePath } from '../scripts/guard.mjs';

describe('classify() — comandos destrutivos (Camada 1/2 de comando)', () => {
  test('rm -rf dentro de uma pasta lwc/ -> deny', () => {
    const cmd = ['rm', '-rf', 'force-app/main/default/lwc/fooBar'].join(' ');
    const v = classify(cmd);
    assert.equal(v.blocked, true);
    assert.equal(v.decision, 'deny');
  });

  test('rmdir dentro de lwc/ -> deny', () => {
    const cmd = ['rmdir', 'force-app/main/default/lwc/fooBar'].join(' ');
    assert.equal(classify(cmd).decision, 'deny');
  });

  test('REGRESSAO: rm -rf na propria pasta lwc (SEM barra final/subpasta) -> deny', () => {
    // Bug real encontrado ao escrever esta suite: a regex original exigia "/lwc/"
    // (barra dos dois lados), entao apagar a pasta lwc INTEIRA (sem nada depois do
    // nome) escapava do guard. Cenario mais perigoso que apagar so um componente.
    const cmd = ['rm', '-rf', 'force-app/main/default/lwc'].join(' ');
    assert.equal(classify(cmd).decision, 'deny');
  });

  test('find ... -delete sobre lwc/ (alvo e a propria pasta lwc, sem subpasta) -> deny', () => {
    const cmd = ['find', 'force-app/main/default/lwc', '-name', '"*.js"', '-delete'].join(' ');
    assert.equal(classify(cmd).decision, 'deny');
  });

  test('find ... -delete sobre uma subpasta de lwc/ -> deny', () => {
    const cmd = ['find', 'force-app/main/default/lwc/fooBar', '-delete'].join(' ');
    assert.equal(classify(cmd).decision, 'deny');
  });

  test('nome de bundle que COMECA com "lwc" (ex.: lwcUtils) NAO deve falso-positivar como a pasta lwc/', () => {
    // "lwc" tem que ser o SEGMENTO do caminho (delimitado por barra/fim), nao um
    // prefixo de nome de componente.
    const cmd = ['cat', 'force-app/main/default/lwc/lwcUtils/lwcUtils.js'].join(' ');
    assert.equal(classify(cmd).blocked, false);
  });

  test('mv de arquivo dentro de lwc/ -> deny (nunca move/renomeia componente)', () => {
    const cmd = ['mv', 'force-app/main/default/lwc/fooBar/fooBar.js', 'force-app/main/default/lwc/fooBar/fooBar.old.js'].join(' ');
    assert.equal(classify(cmd).decision, 'deny');
  });

  test(['sf', 'project', 'delete'].join(' ') + ' -> deny', () => {
    const cmd = ['sf', 'project', 'delete', '--no-prompt'].join(' ');
    assert.equal(classify(cmd).decision, 'deny');
  });

  test(['sf', 'org', 'delete'].join(' ') + ' -> deny', () => {
    const cmd = ['sf', 'org', 'delete', '-o', 'myorg'].join(' ');
    assert.equal(classify(cmd).decision, 'deny');
  });

  test(['sf', 'data', 'delete'].join(' ') + ' -> deny', () => {
    const cmd = ['sf', 'data', 'delete', 'record', '--sobject', 'Account', '--record-id', '001xx'].join(' ');
    assert.equal(classify(cmd).decision, 'deny');
  });

  test('destructive-changes em deploy -> deny', () => {
    const cmd = ['sf', 'project', 'deploy', 'start', '--pre-destructive-changes', 'destructiveChanges.xml'].join(' ');
    assert.equal(classify(cmd).decision, 'deny');
  });

  test('rm fora de lwc/ (ex.: arquivo temporario) -> NAO bloqueia (fora do escopo desta skill)', () => {
    const cmd = ['rm', '/tmp/scratch.txt'].join(' ');
    assert.equal(classify(cmd).blocked, false);
  });

  test('comando inofensivo (ls, cat, git status) -> NAO bloqueia', () => {
    assert.equal(classify(['ls', 'force-app/main/default/lwc'].join(' ')).blocked, false);
    assert.equal(classify(['git', 'status'].join(' ')).blocked, false);
    assert.equal(classify(['cat', 'force-app/main/default/lwc/fooBar/fooBar.js'].join(' ')).blocked, false);
  });

  test('case-insensitive: SF ORG DELETE em maiusculas tambem bloqueia', () => {
    const cmd = ['SF', 'ORG', 'DELETE', '-o', 'myorg'].join(' ');
    assert.equal(classify(cmd).decision, 'deny');
  });
});

describe('parseLwcBundlePath() — reconhecimento de caminho de bundle', () => {
  test('arquivo direto do bundle', () => {
    const p = parseLwcBundlePath('force-app/main/default/lwc/fooBar/fooBar.js');
    assert.deepEqual(p, { bundleDir: 'force-app/main/default/lwc/fooBar', bundleName: 'fooBar', fileName: 'fooBar.js' });
  });

  test('arquivo de teste dentro de __tests__/', () => {
    const p = parseLwcBundlePath('force-app/main/default/lwc/fooBar/__tests__/fooBar.test.js');
    assert.deepEqual(p, { bundleDir: 'force-app/main/default/lwc/fooBar', bundleName: 'fooBar', fileName: 'fooBar.test.js' });
  });

  test('arquivo js-meta.xml', () => {
    const p = parseLwcBundlePath('force-app/main/default/lwc/fooBar/fooBar.js-meta.xml');
    assert.equal(p.fileName, 'fooBar.js-meta.xml');
  });

  test('caminho fora de lwc/ -> null', () => {
    assert.equal(parseLwcBundlePath('docs/ARCHITECTURE.md'), null);
    assert.equal(parseLwcBundlePath('force-app/main/default/classes/Foo.cls'), null);
  });

  test('caminho com barras invertidas (Windows) tambem funciona', () => {
    const p = parseLwcBundlePath('force-app\\main\\default\\lwc\\fooBar\\fooBar.js');
    assert.equal(p.bundleName, 'fooBar');
    assert.equal(p.fileName, 'fooBar.js');
  });
});

describe('classifyWrite() — bundle-aware, trava factual (nunca confia em "modo")', () => {
  test('bundle NOVO (nenhum arquivo existente) -> allow (cobre Criar e Clonar)', () => {
    const v = classifyWrite('force-app/main/default/lwc/novoComp/novoComp.js', { bundleFilesOverride: [] });
    assert.equal(v.blocked, false);
  });

  test('bundle com TODOS os arquivos ja existentes -> ask (cobre Editar)', () => {
    const v = classifyWrite('force-app/main/default/lwc/existente/existente.js', {
      bundleFilesOverride: ['existente.js', 'existente.html', 'existente.css', 'existente.js-meta.xml'],
    });
    assert.equal(v.blocked, true);
    assert.equal(v.decision, 'ask');
  });

  test('COLISAO PARCIAL: so 1 dos arquivos do bundle ja existe -> ask no BUNDLE INTEIRO', () => {
    // Escrevendo o .html de um bundle onde so o .js-meta.xml ja existe (ex.: alguem
    // criou o meta manualmente antes) -- deve travar o bundle inteiro, nao so quando
    // o .js-meta.xml especifico for escrito.
    const v = classifyWrite('force-app/main/default/lwc/parcial/parcial.html', {
      bundleFilesOverride: ['parcial.js-meta.xml'],
    });
    assert.equal(v.blocked, true);
    assert.equal(v.decision, 'ask');
  });

  test('escrever o PROPRIO arquivo que colide -> tambem ask (nao so os irmaos)', () => {
    const v = classifyWrite('force-app/main/default/lwc/parcial/parcial.js-meta.xml', {
      bundleFilesOverride: ['parcial.js-meta.xml'],
    });
    assert.equal(v.blocked, true);
    assert.equal(v.decision, 'ask');
  });

  test('arquivo FORA de uma pasta lwc/ -> NAO bloqueia (fora do escopo deste guard)', () => {
    const v = classifyWrite('docs/ARCHITECTURE.md', { bundleFilesOverride: ['ARCHITECTURE.md'] });
    assert.equal(v.blocked, false);
  });

  test('arquivo dentro de lwc/ mas extensao nao reconhecida (.md perdido na pasta) -> NAO bloqueia', () => {
    const v = classifyWrite('force-app/main/default/lwc/fooBar/README.md', { bundleFilesOverride: [] });
    assert.equal(v.blocked, false);
  });

  test('teste Jest novo (__tests__/x.test.js) num bundle ja existente -> ask (parte do bundle)', () => {
    const v = classifyWrite('force-app/main/default/lwc/existente/__tests__/existente.test.js', {
      bundleFilesOverride: ['existente.js'],
    });
    assert.equal(v.blocked, true);
    assert.equal(v.decision, 'ask');
  });

  test('sem bundleFilesOverride, le do disco de verdade (bundle inexistente -> allow)', () => {
    // Usa um caminho que certamente nao existe no filesystem real desta suite.
    const v = classifyWrite('force-app/main/default/lwc/__definitivamente_nao_existe__/x.js');
    assert.equal(v.blocked, false);
  });
});
