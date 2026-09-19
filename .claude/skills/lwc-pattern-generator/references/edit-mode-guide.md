# Modo Editar — guia detalhado

O modo de **maior risco**: mexe num componente que ja existe (potencialmente em
producao). Duas garantias centrais que nao podem ser puladas: (1) diff/preview
obrigatorio antes de escrever; (2) o score de aderencia avalia **so o que a edicao
mudou**, nunca o arquivo inteiro — para nao "corrigir" ou penalizar codigo legado que
a edicao nao tocou.

## 0. Ler a spec da mudanca, se existir

```bash
node .claude/skills/lwc-pattern-generator/scripts/spec-reader.mjs \
  --component <nomeDoComponente>
```

Uma spec do tipo **"Melhoria pontual"** (Skill 2) foi feita exatamente para este modo —
ela traz a jornada (pula o passo 1), o comportamento atual vs. desejado, os consumidores
conhecidos, os testes que precisam continuar passando, e sobretudo:

**⛔ `frozenContract[]` — o contrato publico congelado.** `@api`, eventos e propriedades
que **NAO podem mudar**, porque outros consumidores dependem deles. Trate como **trava
dura**, acima ate da aderencia ao padrao:

- **Antes de aplicar a edicao:** confira que nenhum item do `frozenContract` esta sendo
  renomeado, removido ou tendo o formato alterado pela sua proposta.
- **Se a mudanca pedida exigir mexer num item congelado:** **PARE**. Nao aplique.
  Apresente o conflito ao usuario — *"a spec marca `@api recordId` como contrato
  congelado (consumido por X), mas a mudanca pedida exige alterar isso. Quer atualizar a
  spec via Skill 2 e avisar os consumidores, ou buscamos outra abordagem?"*
- **Nunca "melhore" um item congelado** para ficar mais aderente ao padrao da jornada
  (ex.: renomear `customerId` para `recordId` porque a jornada usa esse nome).

> **Por que isso nao e redundante com a deteccao de regressao (passo 5):** aquela so
> conhece o que esta documentado **na jornada**. Ela nao tem como saber que um `@api`
> especifico e lido por um Flow ou por uma pagina montada no App Builder. So a spec sabe
> — e por isso essa trava vem antes, e e mais forte.

Sem spec, siga normalmente a partir do passo 1 (a deteccao de regressao do passo 5
continua valendo como rede de seguranca).

## 1. Descobrir a jornada de referencia (lookup reverso)

```bash
node .claude/skills/lwc-pattern-generator/scripts/pattern-reader.mjs \
  --find-journey force-app/main/default/lwc/nomeDoComponente
```
Trate `count: 0` (documentar/craft-only/jornada aproximada) e `count > 1` (perguntar
qual usar) conforme `references/guided-mode.md`, etapa 0.

## 2. Capturar o baseline (antes da edicao)

Antes de tocar no arquivo, guarde uma copia do estado atual — precisa dela intacta para
o diff estrutural depois:
```bash
mkdir -p /tmp/baseline-<nomeDoComponente>
cp force-app/main/default/lwc/<nomeDoComponente>/*.{js,html,css,js-meta.xml} /tmp/baseline-<nomeDoComponente>/
```
(Ou, se preferir, use `git show HEAD:<caminho>` para cada arquivo — o que for mais
simples dado o estado da working tree.)

Confirme a working tree limpa antes de aplicar a edicao de verdade:
```bash
git status --short force-app/main/default/lwc/<nomeDoComponente>
```
Se houver mudancas nao commitadas alheias a esta edicao, avise o usuario antes de
prosseguir — o rollback via `git checkout -- <arquivo>` so e seguro numa tree limpa.

## 3. Mostrar o diff proposto (aprovacao obrigatoria)

Aplique a edicao (ou prepare o conteudo proposto) e mostre o diff real (`git diff` ou
equivalente) para os arquivos alterados. **So prossiga apos o "ok" explicito.**

## 4. (Recomendado) Pre-visualizar o resultado antes de aprovar o diff

Ler o diff (passo 3) confirma O QUE mudou no codigo, mas nao mostra o RESULTADO
renderizado — e isso importa especialmente quando a edicao depende de regra de negocio
(dado de `@wire`/Apex, condicao que so aparece com um registro real) que nao da para
conferir só lendo o codigo. Antes de aprovar o diff ou rodar o score, ofereca ao usuario
pre-visualizar com o **Local Dev Server** do Salesforce CLI (plugin
`@salesforce/plugin-lightning-dev`) — preview local, sem esperar o deploy final (passo 9):

- **`sf lightning dev app -o <org>`** — abre uma pagina/app real da org via proxy local,
  com hot-reload das edicoes locais (nao precisa reimplantar a cada mudanca). Funciona
  com `@wire`/Apex/dados reais, mas exige que o componente ja esteja numa pagina/app
  existente na org (a real, ou uma App Page descartavel numa scratch/dev org). **Use
  esta opcao quando a edicao depender de regra de negocio** — o caso mais comum no
  modo Editar.
- **`sf lightning dev component --name <nome> -o <org>`** — preview isolado, sem
  precisar de pagina. Mais rapido para iterar em UI/markup/CSS puros, mas hoje **nao
  suporta bem `@wire`/Apex/Lightning Data Service** — nao usar quando o resultado
  depende de dado vindo do Apex.

Requer habilitar Local Dev na org (Setup -> "Local Dev" -> "Enable Local Dev") ou, em
scratch org, `"enableLightningPreviewPref": true` no `config/project-scratch-def.json`.
O agente **nao inicia esse servidor sozinho** (roda fora do fluxo de arquivos) — sugira
o comando e deixe o usuario com o preview aberto numa aba enquanto a edicao acontece: o
servidor recarrega sozinho a cada arquivo salvo. Detalhes e o comparativo completo em
`../../../../INFORMACOES.md`, secao "Como pre-visualizar o componente".

## 5. Pontuar so o diff estrutural

```bash
node .claude/skills/lwc-pattern-generator/scripts/pattern-scorer.mjs \
  --journey "Nome da Jornada" \
  --baseline /tmp/baseline-<nomeDoComponente> \
  --component force-app/main/default/lwc/<nomeDoComponente>
```

### Como funciona por baixo (para interpretar o resultado)

O `pattern-scorer.mjs` roda o `pattern-extractor.mjs` da Skill 1 **duas vezes**
(baseline e proposto) e compara os dois JSONs de sinais **por chave**, nao por linha:

- **`score.dimensions`** — so as dimensoes onde algo **realmente mudou** (adicionado ou
  removido) entre antes/depois. Pontuadas usando **so os itens novos** (o "delta") —
  um `@api` que ja existia e continua igual nao entra na conta.
- **`score.skippedUnchanged`** — as dimensoes onde **nada mudou**. Ficam de fora do
  `total`/`max` por completo (nem somam a favor, nem penalizam). Isso e o mecanismo
  que garante "codigo legado intocado, mesmo que ja divergisse do padrao antes da
  edicao, nao vira penalidade nova".
- **`regressions`** (campo separado do `score`) — itens **removidos** pela edicao que
  eram convencao documentada da jornada (ex.: um `@api` do contrato comum, o toast de
  erro, o estado de loading, um evento do `eventContracts`). **Sempre apresente como
  aviso explicito e confirme a intencao** — nunca aceite nem bloqueie silenciosamente.
- **`novelty`** — se a edicao introduziu algo que nao existe em nenhum lugar
  documentado da jornada (nem compartilhado, nem `componentSpecifics` de nenhum
  componente). Gatilho objetivo para sugerir rodar a Skill 1 de novo (etapa 9 do guia).

### Exemplo de leitura do resultado

```json
{
  "score": {
    "total": 8, "max": 20,
    "dimensions": [
      { "label": "Contrato @api (nomes + defaults)", "points": 8, "max": 20, "note": "..." }
    ],
    "skippedUnchanged": ["Estrutura (tag raiz)", "Vocabulario SLDS", "..."]
  },
  "regressions": [
    "REGRESSAO: removeu o membro @api \"recordId\", que faz parte do contrato comum da jornada."
  ],
  "novelty": { "novel": true, "items": ["somethingBrandNewNotInJourney"] }
}
```
Leitura: a edicao só mexeu no contrato `@api` (as outras 10 dimensões nem entram na
conta — não foram tocadas); ela **removeu** um `@api` que era convenção comum (avisar e
confirmar); e **introduziu** um `@api` novo desconhecido da jornada (sugerir documentar
depois, se for virar convenção).

## 6. Nunca "corrigir" convencao antiga fora do escopo pedido

Se durante a edicao voce notar que o componente JA divergia do padrao antes (por
exemplo, usa `.then()` quando a jornada e dominantemente `async/await`, mas isso nao
tem nada a ver com o que foi pedido) — **nao mexa nisso**. Mencione no resumo de
encerramento como observacao, mas a edicao deve fazer SO o que foi pedido. "Aproveitar
que estou editando" para alinhar mais coisas ao padrao é uma ampliação de escopo não
autorizada (Camada 3, "NUNCA FAÇA").
