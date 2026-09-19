# Planejamento — Trilha de Pesquisa e Decisão

> **O que é este documento:** o registro completo do processo de planejamento que
> gerou a [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) — incluindo a pesquisa comparativa
> com o `apex-test-loop` e com o repositório oficial `forcedotcom/sf-skills` que
> embasou as decisões de arquitetura. Mantido aqui como referência futura: se uma
> decisão parecer estranha mais tarde, o "porquê" está registrado neste arquivo.
>
> Para a arquitetura final proposta (sem o histórico de pesquisa), veja
> [`docs/ARCHITECTURE.md`](ARCHITECTURE.md).

## Contexto

O usuário completou a skill `apex-test-loop` (agent loop de cobertura de testes Apex,
repositório [`Salesforce_Apex-Cover-Loop`](https://github.com/brunotrolo/Salesforce_Apex-Cover-Loop))
e quis criar uma nova skill complexa em repositório separado: **Salesforce LWC
Developer**. Esta skill deveria:
- Analisar padrões de design LWC da org (4-5 anos de desenvolvimento customizado)
- Gerar/editar LWCs respeitando o design system existente
- Fornecer workflow interativo para capturar requisitos
- Manter registro de padrões aprendidos
- Suportar preview (Live Preview ou Local Dev)

Antes de desenhar a arquitetura, o objetivo foi **analisar padrões oficiais
(sf-skills) e a experiência de `apex-test-loop`**, para não repetir erros iniciais e
aproveitar as lições de segurança em 3 camadas + autoaprendizado.

## Fase 1 — Estado Atual do `apex-test-loop` (o que já tínhamos)

Mapa de capacidades (de `.claude/skills/apex-test-loop/` no repo `Salesforce_Apex-Cover-Loop`):
- **Loop de cobertura** auto-corretivo (deploy→run test→ler linhas não cobertas→
  melhorar), meta ≥99% com asserts reais; modos automático e guiado; `--test-only`
  e modo scaffold (dev/treino).
- **Segurança em 3 camadas** (o que NÃO podia se perder):
  - `SKILL.md` "🚫 NUNCA FAÇA";
  - `permissions.deny` (`sf project/org/data delete`);
  - hook `PreToolUse` `guard.mjs`: `classify` (comandos destrutivos) + `classifyWrite`
    (bloqueia sobrescrever `.cls`/`.trigger` de produção **existente**; libera arquivo
    novo e classe de teste).
- **Scripts**: `apex-coverage.mjs` (contrato JSON determinístico: `uncoveredLines`,
  `blockedByDependency`, `otherClassesTouched`, `--test-only`/`--deploy`/`--scaffold`);
  `guard.mjs` (funções exportadas e testadas).
- **Autoaprendizado**: `RECOMMENDATIONS.md` (ledger de recomendações) + fase de
  retrospectiva.

**Específico daquele projeto (perde-se se substituído por skill externa genérica):** o
modelo de segurança em 3 camadas + o contrato do `apex-coverage.mjs` + `--test-only` +
modo scaffold + o ledger de autoaprendizado + o modo guiado em PT.

**Genérico/sobreponível (bom candidato a vir de lib oficial):** o craft de teste Apex
em si (mocks, asserts, bulk, DML, async).

## Fase 1 — Inventário do Repositório Oficial da Salesforce

Existem **dois** repositórios oficiais candidatos; o relevante NÃO foi o citado
inicialmente.

### A) [`forcedotcom/sf-skills`](https://github.com/forcedotcom/sf-skills) — o que realmente importa

- Org oficial de engenharia da Salesforce (mesma de CLI/LWC). **730★, 268 forks,
  v1.31.0 (jul/2026), 49 releases, muito ativo.**
- **Licença: Apache-2.0** → reuso comercial OK com atribuição + NOTICE.
  Reuso-friendly.
- **Formato:** Agent Skills spec aberto — pasta com `SKILL.md` (frontmatter com
  triggers) + `assets/` + `references/*.md` + `scripts/*.py`. Compatível com Claude
  Code. Instala via `npx skills add forcedotcom/sf-skills`.
- **96+ skills** em 11+ categorias: Apex (4), Agentforce (5), Flow/Automation,
  Platform Customization, SOQL/Dados, Experience Cloud/LWC (13), OmniStudio (8), DX
  (13), Integration, Data360, Commerce B2B, Design Systems, Mobile.
- **Aviso explícito no README:** "Expect frequent changes; the Salesforce skills
  library is evolving rapidly" — não segue estabilidade de API GA.

### B) [`SalesforceAIResearch/agentforce-adlc`](https://github.com/SalesforceAIResearch/agentforce-adlc) (o que se suspeitava inicialmente)

- Org de **pesquisa** oficial (não engenharia). ~89★, v0.9 (pré-1.0).
- **Licença: CC BY-NC 4.0 → NÃO-COMERCIAL.** Não copiar código/texto para produto
  comercial.
- Foco no ciclo de vida de **agentes Agentforce** (DSL `.agent`), não TDD Apex. Apex é
  periférico (só scaffold de invocable). **~Zero sobreposição** com `apex-test-loop`.

**Decisão:** alvo correto de estudo = `forcedotcom/sf-skills`. O `agentforce-adlc`
ficou de fora (não-comercial, sem Apex) — no máximo inspiração conceitual, nunca
código copiado.

## Fase 1 — Análise Skill-a-Skill (comparando com `apex-test-loop`)

### `platform-apex-test-generate` (sf-skills)

Gera classes de teste production-ready com ciclo geração→run→análise→fix.

| Aspecto | sf-skills | apex-test-loop |
|---|---|---|
| Meta de cobertura | 75% mín / 90%+ rec | **≥99% piso fixo** |
| Loop iterations | Max 3 | Max 6 (dinâmico até plateau) |
| Security layers | 0 explícitas | **3 camadas** |
| Modo guiado | Não mencionado | PT, passo-a-passo |
| Test-only mode | Não | Sim, `--test-only` + `--scaffold` |
| Ledger/retrospectiva | Não | `RECOMMENDATIONS.md` |
| Assertion rigor | Exatas (com mensagens) | MVP allow guards; `--rigoroso` proíbe |

**Veredito:** `ADAPTAR` — pegar estrutura de assets/templates; manter as 3 camadas +
meta 99%.

### `platform-apex-test-run` (sf-skills)

Executa testes, análise de cobertura, fix loop com rubrica de 120 pontos.

| Aspecto | sf-skills | apex-test-loop |
|---|---|---|
| Métrica | 120-point score | % linhas (≥99%) |
| Parser | Python JSON determinístico | `apex-coverage.mjs` (JS, determinístico) |
| Root cause tree | Explícita (NullPtr, Dml, Limit, Query, Type) | Heurístico |
| Cross-skill delegation | Sim (→ apex-generate) | Opcional |
| Scope discovery | Narrowest first | Inventário no Passo 0 |

**Veredito:** `ADAPTAR` — pegar decision tree de root cause + conceito de scoring
rubric; manter parser próprio + meta 99%.

### Padrão arquitetônico chave do repositório: Ownership & Delegation Model

Cada skill tem **domínio único de ownership**, com **hand-offs nomeados** para skills
peer. Exemplo do fluxo Apex:

```
platform-apex-generate (autoria de código)
  → platform-apex-test-generate (autoria de teste)
  ↔ platform-apex-test-run (execução de teste)
  ↔ platform-apex-logs-debug (diagnóstico)
```

**Hard Boundaries:** cada skill documenta explicitamente o que NÃO faz (ex.:
`platform-apex-generate`: "Does NOT deploy, run tests, query metadata"). Isso garante
foco e evita duplicação — especialmente relevante quando vários desenvolvedores usam
a mesma skill em paralelo.

**Metadados de `SKILL.md`:** `Triggers`, `Owns`, `Delegates To`, `Hard Constraints`,
workflow steps com validation gates.

**Quality Scoring:** cada skill usa uma rubrica de pontos (120, 130, 165 conforme a
skill) como gate de progressão antes de considerar o trabalho pronto.

## Matriz Comparativa — Decisão REUSAR / ADAPTAR / MANTER (para o `apex-test-loop`)

| Capacidade | sf-skills | apex-test-loop | Veredito |
|---|---|---|---|
| Meta de Cobertura | 75% mín / 90%+ rec | ≥99% (piso) | **MANTER NOSSO** |
| Loop Iterations | Max 3 | Max 6 (dinâmico) | **MANTER NOSSO** |
| Security (3 camadas) | 0 explícitas | guard.mjs + deny + NUNCA FAÇA | **MANTER NOSSO** |
| Assertion Rigor | Exatas + mensagens | MVP allow guards; `--rigoroso` proíbe | **MANTER NOSSO** |
| Test Data Templates | test-class, data-factory, bulk-251+ | Templates + TestDataFactory | **ADAPTAR** |
| Mocking Patterns | HttpCalloutMock, DML mock, SOSL | Similar | **ADAPTAR** |
| Async Testing | Batch, Queueable, scheduled, platform event | Similar | **ADAPTAR** |
| Parser JSON | Python | `apex-coverage.mjs` (JS) | **MANTER NOSSO** |
| Root Cause Decision Tree | Explícita | Heurístico | **ADAPTAR** |
| Quality Scoring Rubric | 120/165-point | % linhas | **ADAPTAR** (conceito, sem substituir piso 99%) |
| Modo Guiado | Não mencionado | PT, passo-a-passo | **MANTER NOSSO** |
| Test-Only Mode | Não | `--test-only`, `--scaffold` | **MANTER NOSSO** |
| Ledger Autoaprendizado | Não | `RECOMMENDATIONS.md` | **MANTER NOSSO** |
| Ownership & Delegation | Explícito | Implícito | **ADAPTAR** |

Esta matriz gerou uma recomendação separada para o `apex-test-loop` em si (fora do
escopo deste repositório) — registrada aqui só como contexto de origem, já que foi
essa análise que revelou o padrão de Ownership & Delegation reaproveitado na
arquitetura do LWC Developer.

## Fase 2 — Estado do Repositório no Início do Projeto

No início deste projeto, `brunotrolo/Salesforce_LWC-Developer` estava **vazio**: só
README com o título, 1 commit inicial, sem LICENSE, sem `.claude/`, sem estrutura —
pronto para construir do zero.

## Fase 2 — Como as Lições Viraram Arquitetura

As "Lições de sf-skills" abaixo foram o ponte entre a pesquisa (Fase 1) e a proposta
final em [`docs/ARCHITECTURE.md`](ARCHITECTURE.md):

1. **Ownership & Delegation Model** → seção 2 do ARCHITECTURE.md (Owns/Delegates/Hard
   Boundaries do LWC Developer).
2. **Hard Constraints & Quality Scoring** → seção 5 do ARCHITECTURE.md (rubrica de
   100 pontos, gate em 80).
3. **Templates + References Estruturados** → seção 6 do ARCHITECTURE.md (estrutura
   de repositório com `assets/templates`, `assets/patterns`, `references/`).
4. **Decision Tree para Root Cause** → adaptado para os cenários de LWC (não
   renderiza / lento / falha de validação de design system) — a formalizar em
   `references/` quando a skill for implementada.
5. **3 camadas de segurança + autoaprendizado do `apex-test-loop`** → seção 3
   (segurança) e seção 4 (registry de padrões + `RECOMMENDATIONS.md`) do
   ARCHITECTURE.md.

## Decisões Confirmadas com o Usuário

- **Alvo de pesquisa:** `forcedotcom/sf-skills` (Apache-2.0), não `agentforce-adlc`
  (CC BY-NC, fora do escopo Apex).
- **Uso pessoal/estudo** — reuso flexível, mas com atribuição/NOTICE quando trechos
  literais do `sf-skills` forem incorporados.
- **Estratégia:** análise skill-a-skill primeiro (matriz de decisão), decisão de
  integração/implementação como passo posterior.
- **Registro da arquitetura:** commit direto na `main` do repositório (sem
  branch/PR), já que o repo estava vazio e o documento é material de discussão, não
  código funcional.
- **Licença do novo repositório:** MIT — mesma do `apex-test-loop`, simples e
  consistente entre os dois projetos.

## Verificação da Fase de Pesquisa

- ✅ Análise skill-a-skill das 2 skills Apex mais próximas + overview do repositório
  oficial completo.
- ✅ Cada afirmação sobre o conteúdo do `sf-skills` citou a URL/arquivo real (via
  WebFetch no GitHub público), não memória.
- ✅ Matriz de decisão com veredito explícito (REUSAR/ADAPTAR/MANTER) para cada
  capacidade comparada.
- ✅ Nenhuma mudança de código foi feita no `apex-test-loop` durante esta fase — só
  análise e, depois, o novo documento de arquitetura neste repositório.
- ✅ Requisitos de atribuição Apache-2.0 (NOTICE) documentados para quando templates
  do `sf-skills` forem de fato incorporados na implementação.

## Fase 3 — Refinamento: Duas Skills Sequenciais (pivô decidido com o usuário)

Depois de registrar a arquitetura original (5 fases dentro de uma única skill,
scan automático de toda a org num `patterns.json`), o usuário levantou uma dúvida
central: **como garantir, na prática, que o documento de padrões realmente reflita o
design system da org** — sem depender de um scan "confie em mim" de tudo de uma vez?

### A pergunta que gerou o pivô

> "minha maior duvida e como criar um markdown para respeitar o design system da
> minha org"

Resposta discutida: o mecanismo concreto é (1) scan automático extrai padrões em JSON
→ (2) geração consulta o JSON e nunca inventa convenção → (3) rubrica de 100 pontos
valida antes do preview → (4) conflito sempre negocia com o usuário. Esse mecanismo
segue válido — mas o usuário então perguntou se alguém já fazia algo assim (pesquisa
de viabilidade — ver resposta na conversa: **não existe ferramenta que combine** scan
de padrões org-específicos + geração conforme + modo guiado + preview; peças soltas
existem — Figma→LWC plugin da Salesforce, `sf-skills`, Storybook — mas não a
combinação completa).

### A proposta do usuário (o pivô real)

> "acho que a primeira skill deve ser a identificacao de padrao de design dos
> componentes // a ideia seria eu passar uma lista de arquivos e determinar um nome
> de jornada ou produto e o opencode ou claude code escreveria o padrao de design e
> escreveria em um documento // dai se eu precisar treinar ele com outra jornada e
> produto ele acrescenta o padrao deste produto e jornada e assim por diante // quando
> eu for pedir para desenvolver preciso informar qual a jornada ou produto a
> referencia de design deve seguir"

Isso muda 3 coisas na arquitetura original:

1. **De "scan automático da org inteira" para "o usuário aponta os arquivos".** Mais
   seguro (não há como o agente "escanear errado" algo que nunca devia tocar) e mais
   curado (cada padrão documentado tem uma origem clara e rastreável).
2. **De "1 registry JSON global" para "1 documento Markdown com 1 seção por
   jornada/produto".** Jornadas diferentes podem ter convenções diferentes entre si —
   isso vira algo esperado e documentado, não "unificado" à força.
3. **De "1 skill monolítica com 5 fases" para "2 skills sequenciais e independentes":**
   `lwc-pattern-documenter` (MVP, só lê arquivos e escreve Markdown — zero risco) e
   `lwc-pattern-generator` (implementada depois, quando a primeira já estiver
   validada na prática).

### Por que esse pivô é melhor que o plano original

- **Risco assimétrico administrado:** a Skill 1 não toca em nenhum componente — só lê
  e documenta. Isso permite validar o "cérebro" (extração de padrões) antes de
  arriscar o "corpo" (geração/edição de código real).
- **MVP genuíno:** dá pra usar e tirar valor da Skill 1 sozinha, sem esperar a
  arquitetura inteira ficar pronta.
- **Sem "big bang":** o usuário controla o ritmo — documenta uma jornada, revisa,
  documenta a próxima. Erros de extração aparecem cedo, numa jornada só, não
  espalhados pelo registry inteiro.

### O que mudou no `docs/ARCHITECTURE.md`

- Nova seção 0 ("Decisão de Escopo — Duas Skills Sequenciais") explica o pivô.
- Seção 1 (Visão Geral do Fluxo) reorganizada em torno das 2 skills.
- Seção 2 (Ownership & Delegation) dividida entre as duas skills.
- Seção 4 (Sistema de Aprendizado de Padrões) reescrita: de `patterns.json` global
  para `.lwc-pattern-documenter/lwc-design-system/design-patterns.md` com 1 seção por jornada/produto, incremental
  (acrescenta jornada nova, atualiza jornada existente, nunca sobrescreve as outras).
- Seção 6 (Estrutura de Repositório) e seção 8 (Ordem de Implementação) atualizadas
  para refletir 2 pastas de skill e um Tier 0 dedicado ao MVP da Skill 1.

## Fase 4 — Dúvidas Levantadas Antes do Desenvolvimento (resolvidas)

Antes de começar o `SKILL.md` de verdade, o usuário pediu explicitamente: *"antes de
seguirmos para o desenvolvimento da primeira skill, vc tem alguma duvida quanto ao
objetivo e minha visao sobre este skill?"* — e lembrou de um ponto crítico: *"este
skill vai precisar de um guia inicial sempre que iniciar pois nao é simplesmente
pedir e sair criando um LWC"*.

Isso valia mesmo para a Skill 1, que não gera LWC nenhum — ela também toma decisões
(bloquear, sinalizar, confirmar) que não podem acontecer silenciosamente. Levantei 4
dúvidas reais sobre a arquitetura original que mudariam o desenho do guia inicial, e
o usuário decidiu cada uma:

| # | Dúvida | Decisão do usuário |
|---|---|---|
| 1 | Como apontar os arquivos de uma jornada? | **Híbrido** — caminho manual OU menu interativo (a skill lista os LWCs do projeto se o usuário preferir) |
| 2 | Mínimo de componentes para confiar num padrão? | **Mínimo 3** — abaixo disso, bloqueia e pede mais exemplos |
| 3 | E se os componentes da mesma jornada divergirem entre si? | **Documenta a divergência** — a skill nunca decide sozinha por maioria; registra as variantes e sinaliza |
| 4 | Nome de jornada/produto livre ou controlado? | **Lista controlada** — mantém um índice (`journeys-index.json`) e avisa se o nome novo parece duplicado |

### Como isso virou o fluxo guiado (seção 7 do ARCHITECTURE.md)

As 4 decisões acima implicam 9 passos obrigatórios sempre que a Skill 1 roda: (1)
mostra jornadas já documentadas, (2) pergunta se é jornada nova ou atualização —
checando duplicidade pela regra 4, (3) pergunta o modo de seleção de arquivos pela
regra 1, (4) confirma a lista final antes de extrair, (5) verifica o mínimo de 3 pela
regra 2 — bloqueia se não bater, (6) extrai os padrões, (7) documenta divergência se
houver pela regra 3, (8) mostra preview do que vai escrever antes de salvar, (9)
escreve/atualiza o documento e o índice.

### O que mudou no `docs/ARCHITECTURE.md`

- Seção 4 ganhou a subseção "Regras de Confiança e Curadoria" com as 4 decisões.
- Nova seção 7: "Fluxo Interativo — Skill 1, Guia Inicial Obrigatório" (os 9 passos).
- Antiga seção 7 (fluxo da Skill 3) virou seção 8, e as seguintes foram renumeradas
  (9 = Ordem de Implementação, 10 = Reuso, 11 = Decisões de Design).
- Seção 6 (Estrutura de Repositório) ganhou `journeys-index.json` e
  `references/guided-mode.md` na pasta da Skill 1.
- Seção 11 (Decisões de Design) ganhou o porquê de cada uma das 4 regras.

## Fase 5 — Pesquisa: Skills Oficiais de LWC/Design System no sf-skills

O usuário questionou diretamente (em maiúsculas, sinal de que era um ponto que
deveria ter sido checado antes): *"VC ESTA CONSIDERANDO A IMPORTACAO DA SKILL PADRAO
DO SALESFORCE?"* — referência direta ao que o `apex-test-loop` já fez (importou 7
skills oficiais de Apex do `sf-skills` em vez de reinventar o craft, com
`VENDOR-ATTRIBUTION.md`). Era uma lacuna real: a arquitetura da LWC Developer tinha
sido desenhada sem verificar se o próprio `sf-skills` já cobria parte do escopo.

### Método

Pesquisa factual (não de memória) via GitHub API + `raw.githubusercontent.com`
direto no repositório `forcedotcom/sf-skills`: listagem completa das 94 skills,
leitura do `SKILL.md` real de cada skill nas categorias LWC/Design Systems/Experience
Cloud, e confirmação de licença (`LICENSE.txt`) e versão (`1.31.0`, 17/07/2026).

### Achados

- **Licença confirmada:** Apache-2.0 (`LICENSE.txt`, Copyright Salesforce Inc. 2026).
- **13 skills `experience-*`** existem, mas a maioria cobre **React UI Bundles** (um
  framework diferente, mais recente, para Experience Cloud) — irrelevante para LWC
  clássico.
- **`experience-lwc-generate`**: craft de autoria de LWC (bundle, `@wire`,
  Apex/GraphQL, SLDS2, a11y, Jest, metodologia "PICKLES"). Não faz pattern-learning.
- **`design-systems-slds-apply`**: craft de styling/tokens SLDS (Lightning Base
  Components > Blueprints > Styling Hooks > CSS custom). Não faz pattern-learning.
- **`design-systems-slds-validate`**: audita LWCs existentes contra compliance SLDS
  **genérico** (linter + scorecard A-F) — mais próximo de "scan de componentes
  existentes", mas contra regras oficiais do SLDS, não contra convenções específicas
  da org do usuário nem por jornada/produto.
- **Confirmação central:** nenhuma das 94 skills aprende o design system específico
  de uma org a partir de componentes existentes, agrupado por jornada/produto — a
  `lwc-pattern-documenter` **não tem equivalente oficial**, é funcionalidade
  genuinamente nova.

### Decisão do usuário

Apresentadas 3 opções (as 2 essenciais / as 3 completas com auditoria / decidir
depois), o usuário escolheu **as 2 essenciais**: importar `experience-lwc-generate` +
`design-systems-slds-apply` na íntegra para a Skill 3 (`lwc-pattern-generator`), sem
`design-systems-slds-validate` por ora.

### O que mudou no `docs/ARCHITECTURE.md`

- Seção 2 (Ownership & Delegation): nova tabela de delegação de craft, só para a
  `lwc-pattern-generator` — a `lwc-pattern-documenter` não delega craft (não gera nada).
- Seção 6 (Estrutura de Repositório): `.claude/skills/` ganhou
  `experience-lwc-generate/`, `design-systems-slds-apply/` e `VENDOR-ATTRIBUTION.md`.
- Seção 9 (Tier 2): agora inclui a importação das 2 skills como parte da fundação da
  Skill 3.
- Seção 10 (Reuso): tabela ganhou as 2 skills com a nota de confirmação da pesquisa.
- Seção 11 (Decisões de Design): novo item explicando por que delegar em vez de
  reinventar.

## Próximos Passos (atualizado após a pesquisa de skills oficiais)

Este planejamento e o `docs/ARCHITECTURE.md` formam a base de discussão antes de
qualquer código da skill ser escrito. Estado da validação item a item:

1. ✅ **Decidido:** 2 skills sequenciais, começando pela `lwc-pattern-documenter`
   (Tier 0 do MVP).
2. ✅ **Decidido:** as 4 regras de confiança e curadoria (seleção híbrida, mínimo 3
   componentes, divergência documentada, lista canônica de jornadas) e o guia
   inicial obrigatório de 9 passos que elas implicam.
3. ✅ **Decidido:** a Skill 3 importa `experience-lwc-generate` +
   `design-systems-slds-apply` do `sf-skills` para o craft de LWC — confirmado que
   nenhuma skill oficial cobre o pattern-learning da `lwc-pattern-documenter`.
4. Confirmar formato exato do `.lwc-pattern-documenter/lwc-design-system/design-patterns.md` e do `journeys-index.json` —
   os templates propostos servem, ou precisam de ajustes?
5. Confirmar quais sinais entram no `extraction-signals.md` e em que ordem de
   prioridade, usando a primeira jornada real do usuário como teste (Tier 1).
6. (Só relevante mais adiante, quando a Skill 3 entrar em cena) 3 camadas de
   segurança e rubrica de 100 pontos — sem mudanças por enquanto.

**Próximo passo prático:** implementar o Tier 0 (Skill 1, `lwc-pattern-documenter`) —
`SKILL.md`, `pattern-extractor.mjs`, `extraction-signals.md`, `guided-mode.md`,
`design-patterns.md` e `journeys-index.json`.
