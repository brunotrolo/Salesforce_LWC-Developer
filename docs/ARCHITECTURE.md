# Arquitetura — Salesforce LWC Developer Skill

> **Status:** as **três** skills estão implementadas e integradas —
> `lwc-pattern-documenter` (Skill 1, o *guia de system design*),
> `lwc-spec-writer` (Skill 2, o *documento de spec-driven design*) e
> `lwc-pattern-generator` (Skill 3, que consome as duas fontes para gerar/editar).
> Ver "Status Atual" no fim e a seção 0.1 (modelo de duas fontes).

## Contexto

Este projeto nasce da experiência com a skill
[`apex-test-loop`](https://github.com/brunotrolo/Salesforce_Apex-Cover-Loop) (agent loop
de cobertura de testes Apex, com 3 camadas de segurança e autoaprendizado) e da
análise do repositório oficial [`forcedotcom/sf-skills`](https://github.com/forcedotcom/sf-skills)
(Apache-2.0), que define um modelo de *Ownership & Delegation* entre skills.

O objetivo aqui é diferente: em vez de testes, esta skill deve **aprender o design
system de LWCs de uma org com anos de desenvolvimento customizado** e **gerar/editar
componentes que respeitem esses padrões**, com um fluxo interativo, preview antes de
deploy, e um registro vivo de padrões aprendidos.

## 0. Decisão de Escopo — Duas Skills Sequenciais (revisão pós-validação com o usuário)

> Esta seção substitui a visão original de "uma skill monolítica com 5 fases" por uma
> abordagem **incremental em 2 skills independentes**, decidida após discussão com o
> usuário (ver `docs/PLANEJAMENTO.md`, seção "Refinamento — Duas Skills Sequenciais").

O motivo da mudança: em vez de escanear a org inteira de uma vez (arriscado, difícil de
validar, "big bang"), o usuário quer **controlar manualmente qual conjunto de
componentes alimenta qual padrão**, agrupado por **jornada ou produto** (ex.:
"Atendimento ao Cliente", "Vendas B2B") — e crescer o conhecimento **incrementalmente**,
uma jornada por vez, revisando cada documento gerado antes de confiar nele.

### Skill 1 — `lwc-pattern-documenter` (MVP, a implementar PRIMEIRO)

**Responsabilidade única:** dado um conjunto de arquivos LWC + um nome de
jornada/produto, extrair os padrões de design e **escrever/atualizar um documento
Markdown legível por humano**. Não gera código, não deploya, não decide nada sozinha —
só observa e documenta.

```
INPUT:
  - Lista de arquivos LWC (o usuário aponta quais componentes representam bem a jornada)
  - Nome da jornada/produto (ex.: "Atendimento ao Cliente")
  ↓
PROCESSO:
  1. Scan dos arquivos apontados (não a org inteira — só o que foi informado), via
     pattern-extractor.mjs (extração determinística; código comentado é ignorado)
  2. Extrai: estrutura/composição (skeleton, modalSkeleton, sharedUtils), naming,
     CSS/tokens/SLDS, slots + wiring pai↔filho, eventos (bubbles/composed/detail),
     @api + defaults + getters + @wire + forma do Apex, loading/erro, i18n, a11y, metadata
  3. O agente interpreta os sinais e monta a seção "## Padrão: <Jornada/Produto>"
  4. pattern-writer.mjs grava de forma DETERMINÍSTICA: jornada nova → ACRESCENTA;
     existente → substitui SÓ a seção dela; upsert do índice; trava aborta se perderia
     alguma jornada. A escrita nunca depende do modelo lembrar de preservar o resto.
  ↓
OUTPUT: .lwc-pattern-documenter/lwc-design-system/design-patterns.md + journeys-index.json
```

### Skill 3 — `lwc-pattern-generator` (a implementar DEPOIS, quando a Skill 1 estiver validada)

**Responsabilidade única:** dado um requisito de componente + qual jornada/produto usar
como referência, gerar um LWC que respeita o padrão **daquela jornada específica**.

```
INPUT:
  - Requisito do usuário ("preciso de um seletor de usuário filtrado por departamento")
  - Jornada/produto de referência ("seguir o padrão de Atendimento ao Cliente")
  ↓
PROCESSO: consulta a seção correspondente do documento de padrões → gera → valida
(rubrica 100pt) → preview → deploy (com aprovação)
```

Esta skill só entra em cena depois que o usuário validar, na prática, que a Skill 1
está extraindo padrões corretos o suficiente para servir de referência confiável.

### Por que essa ordem importa

- **Risco assimétrico:** Skill 1 é só leitura + escrita de Markdown (zero risco de
  quebrar produção). Skill 3 gera/edita código (risco maior — por isso as 3 camadas de
  segurança, seção 3). Validar a Skill 1 primeiro é o caminho mais seguro.
- **Curadoria manual no ponto certo:** o usuário escolhe quais arquivos representam bem
  uma jornada — não é um scan automático "confie em mim" da org inteira. Cada padrão
  documentado tem uma origem clara e auditável.
- **Crescimento incremental:** hoje documenta "Atendimento", semana que vem
  "Vendas B2B", mês que vem "Onboarding de Parceiros" — o documento cresce por seção,
  nunca é reescrito do zero.

## 0.1 Skill 2 (`lwc-spec-writer`) e o modelo de DUAS FONTES

Decisão posterior às duas primeiras skills, tomada com o usuário: a Skill 3 estava
misturando duas coisas diferentes numa única etapa de "coleta de requisito" — *o que* o
componente precisa fazer e *como* ele deve se parecer. Separá-las deu origem à **Skill
3**, e a Skill 3 passou a consumir as duas fontes explicitamente:

| | **Spec** (Skill 2) | **Padrão da jornada** (Skill 1) |
|---|---|---|
| Papel | **spec-driven design** — o QUE construir | **guia de system design** — COMO se constrói nesta org |
| Arquivo | `.lwc-spec-writer/specs/<slug>-spec.md` (1 por componente) | `journeys/<slug>.json` (1 por jornada) |
| Lido por | `spec-reader.mjs` | `pattern-reader.mjs` |
| Traz | requisito, escopo, **não-objetivos**, contrato de dados, **contrato público congelado**, critério de aceite | estrutura, naming, SLDS, `@api` idiomático, eventos, Apex, loading/erro, i18n, a11y |
| Se faltar | cai na coleta inline (etapa 3) ou sugere rodar a Skill 2 | **PARA** — nunca gera sem jornada confirmada |

**A spec também deriva o modo de operação:** o campo `Tipo` do cabeçalho
(Componente novo / Clonar e adaptar / Melhoria pontual) mapeia 1:1 para os 3 modos da
Skill 3 (Criar / Clonar / Editar) — quando a spec existe, o modo, a jornada e o
componente-alvo não são perguntados de novo.

**Ordem de precedência** (detalhe em `lwc-pattern-generator/references/two-source-model.md`):

1. **Contrato público congelado** da spec — trava dura. Um `@api`/evento listado ali não
   muda, nem para ficar mais aderente ao padrão. É o único mecanismo que protege
   consumidores que a skill não enxerga (outro LWC, um Flow, uma página do App Builder) —
   a detecção de regressão da Skill 3 só conhece o que está documentado na jornada.
2. **Não-objetivos** da spec — fronteira dura de escopo (a versão escrita da regra "nunca
   amplia o escopo").
3. **Requisito funcional** da spec — o QUE.
4. **Padrão da jornada** — a FORMA de tudo que a spec não amarrou.
5. **Conflito real entre 3 e 4 → pergunta.** Nunca escolhe silenciosamente.

**Pendências (`🚧 PENDENTE`)** marcadas pela Skill 2 são **trava, não sugestão**: se
afetam o trecho a ser gerado, a Skill 3 para e pergunta — nunca preenche com suposição
nem com "o que o padrão da jornada faria".

## 1. Visão Geral do Fluxo

```
FASE 1 (Skill 1): Pattern Documentation por Jornada/Produto
  Usuário aponta arquivos + nome da jornada → extrai padrões → escreve/acrescenta
  seção no documento Markdown de padrões
  ↓
  (repete para cada jornada/produto — incremental, sob demanda do usuário)
  ↓
FASE 2 (Skill 3): Onboarding Interativo
  Requirement gathering (passo-a-passo) → qual jornada/produto seguir → preview gate
  ↓
FASE 3 (Skill 3): Geração com Validação de Padrão
  Gera arquivos LWC → valida contra a seção da jornada escolhida → score 100pt →
  gate ≥80 mostra preview
  ↓
FASE 4 (Skill 3): Preview & Aprovação
  Live Preview (scratch org) → aprovação do usuário → resolução de conflitos
  ↓
FASE 5 (Skill 3): Deploy & Aprendizado
  Deploy (delega a platform-metadata-deploy) → atualiza a seção da jornada no
  documento de padrões → RECOMMENDATIONS.md
```

## 2. Ownership & Delegation

Padrão adotado do `sf-skills`: cada skill tem domínio único de ownership, com
hand-offs nomeados para skills peer — evita conflito quando múltiplos devs usam a
skill em paralelo. Com a divisão em 2 skills (seção 0), o ownership também se divide.

**`lwc-pattern-documenter` OWNS (autoridade exclusiva):**
- Extração de padrões a partir de arquivos apontados pelo usuário (não scan automático
  de toda a org)
- Escrita/atualização incremental do documento Markdown de padrões, por jornada/produto
- Nunca gera, edita ou deploya componentes — só lê e documenta

**`lwc-pattern-generator` OWNS (autoridade exclusiva, quando implementada):**
- Injeção dos padrões específicos da org (aprendidos pela Skill 1) na geração —
  isso NÃO é delegável, é o próprio motivo da skill existir
- Onboarding Interativo (modo guiado, perguntas, preview gate)
- Conflict Resolution (padrão vs. requisito → sempre pergunta ao usuário)

**`lwc-pattern-generator` delega o CRAFT de LWC para skills oficiais do `sf-skills`**
(confirmado por pesquisa factual no repositório — ver `docs/PLANEJAMENTO.md`, seção
"Pesquisa — Skills Oficiais de LWC/Design System no sf-skills"; nenhuma skill oficial
faz o que a `lwc-pattern-documenter` faz, então só a Skill 3 delega craft):

| Craft | Delega para | Razão |
|---|---|---|
| Autoria de LWC (bundle, `@wire`, Apex/GraphQL, a11y, Jest) | `experience-lwc-generate` | Mesmo princípio do `apex-test-loop`: não reinventar o "como escrever bem" — vem da skill oficial |
| Styling/tokens SLDS (Lightning Base Components > Blueprints > Styling Hooks > CSS) | `design-systems-slds-apply` | Craft de compliance visual vem da skill oficial, não de heurística nossa |

Ambas importadas **na íntegra** para `.claude/skills/` (Apache-2.0, com
`VENDOR-ATTRIBUTION.md` — ver seção 6), no Tier 2 (fundação da Skill 3). A
`lwc-pattern-documenter` (Skill 1) **não delega craft** — ela só lê e documenta, não
gera nada.

**Ambas as skills (1 e 2) também delegam para:**

| Tarefa | Delega para | Razão |
|---|---|---|
| Deploy de metadata | `platform-metadata-deploy` (ou `sf` direto) | Expertise em deployment |
| Criar campos custom faltantes | `platform-custom-field-generate` | Validação, picklist, etc. |
| Criar objetos custom faltantes | `platform-custom-object-generate` | Schema, sharing |
| Apex `@AuraEnabled` handlers | `platform-apex-generate` | Domínio Apex separado |
| Testes Jest/LWC | (futuro) | Fora do escopo inicial |

**Hard Boundaries (nenhuma das três skills faz):**
- Não mexe em Flow/Process/Automation
- Não cria managed packages
- Não deleta/move/renomeia diretórios LWC
- Não edita Apex
- (`lwc-pattern-documenter` especificamente) Não escreve nem edita nenhum arquivo
  `.js`/`.html`/`.css` de componente — só o Markdown de padrões

## 3. Segurança em 3 Camadas

Herdado diretamente da lição mais cara do `apex-test-loop` (o incidente de
sobrescrever uma classe de produção). As 3 camadas são redundantes de propósito.

**Camada 1 — `permissions.deny`:** bloqueia `sf project delete`, `sf org delete`,
`rm -rf **/lwc/**` no nível do shell.

**Camada 2 — hook `guard.mjs`:**
- `classify()`: bloqueia (`deny`) comandos destrutivos sobre `/lwc/` (rm, mv,
  `find -delete`)
- `classifyWrite()`: sobrescrita de LWC **existente** → `ask` (pede aprovação);
  arquivo novo ou teste → permitido sem prompt

**Camada 3 — "NUNCA FAÇA" (escrito no `SKILL.md`):** proibições explícitas em
linguagem humana — nunca apagar/mover LWC, nunca sobrescrever sem aprovação, nunca
editar Apex, nunca criar Flow, nunca "resolver" um erro de conformidade de padrão
editando silenciosamente (sempre negocia com o usuário).

## 4. Sistema de Aprendizado de Padrões — por Jornada/Produto (revisado)

> Substitui o "scan automático da org inteira em um `patterns.json`" pela abordagem
> incremental e curada da seção 0: o usuário aponta os arquivos, nomeia a jornada, e o
> documento cresce por seção.

**Descoberta (Skill 1):** o usuário roda a `lwc-pattern-documenter` informando (a) uma
lista de arquivos LWC que representam bem uma jornada/produto e (b) o nome dessa
jornada/produto. A skill extrai: estrutura/composição (skeleton, modalSkeleton,
sharedUtils), naming conventions, uso de slots + wiring pai↔filho, arquitetura CSS
(tokens, scoping), padrões JS (imports, decorators, contrato `@api` + defaults, getters,
eventos com bubbles/composed/detail, `@wire`, forma do Apex), acessibilidade (ARIA, foco)
— **só dos arquivos apontados**, não da org inteira.

**Armazenamento:** `.lwc-pattern-documenter/lwc-design-system/design-patterns.md` — um único documento Markdown,
versionado em git, legível por humano, organizado em **uma seção por
jornada/produto** (`## Padrão: <Nome da Jornada>`). Cada seção documenta:

- Componentes-fonte usados como referência (rastreabilidade — "de onde veio esse
  padrão")
- Data do último scan daquela jornada
- Estrutura/composição, naming, CSS/tokens, slots + wiring pai↔filho, eventos
  (contratos), dados (@api + defaults, getters, @wire, Apex), a11y — com exemplos de
  código reais extraídos dos componentes apontados
- **Elementos específicos de um componente** (pedido do usuário): itens que aparecem
  em UM só componente da jornada (um slot, evento, token, import que só aquele arquivo
  tem) são registrados numa subseção "Elementos específicos por componente", atrelados
  ao arquivo de origem — separados dos padrões compartilhados e das divergências. O
  `pattern-extractor.mjs` os detecta em `aggregate.componentSpecifics` (frequência 1
  entre os componentes analisados). Objetivo: registrar TUDO que foi identificado, sem
  perder o que é específico de um arquivo.

**Comportamento incremental (a regra central):**
- Jornada nova → **acrescenta** uma seção nova ao final do documento
- Jornada já existente, rodada de novo (ex.: mais componentes adicionados) →
  **atualiza** a seção existente (nunca duplica, nunca cria `design-patterns-v2.md`)
- Jornadas diferentes podem ter convenções diferentes entre si — isso é esperado e
  documentado, não "corrigido" automaticamente

### Regras de Confiança e Curadoria (decididas com o usuário em sessão de validação)

Antes de partir para o `SKILL.md` de verdade, 4 pontos em aberto foram validados
diretamente com o usuário — resolvem ambiguidades que mudariam o comportamento do
guia inicial:

1. **Seleção de arquivos — modo híbrido.** O usuário pode informar os caminhos
   diretamente (já sabe onde estão) OU pedir que a skill liste os LWCs existentes no
   projeto para escolher de um menu. O guia inicial (seção 7) sempre pergunta qual
   dos dois o usuário prefere — nunca assume.
2. **Quantidade saudável por jornada: piso 3 (hard), teto ~10 (soft).** Abaixo de 3
   componentes a skill **bloqueia a extração** (menos que isso não gera confiança para
   virar "padrão documentado"). Acima de ~10 (`recommendedMax`), a skill **não bloqueia**,
   mas **sugere dividir em sub-jornadas coesas** — listas longas aumentam o risco de o
   modelo (em especial os mais fracos) esquecer itens ao interpretar. Se o usuário
   preferir manter a lista inteira, a skill respeita e interpreta o resultado por seção.
3. **Divergência entre componentes da mesma jornada → documentada, nunca decidida
   pela skill.** Se os arquivos apontados para uma jornada usarem convenções
   diferentes entre si (ex.: 2 componentes com prefixo `c_` e 3 com `x_`), a skill
   **não escolhe a maioria automaticamente** — ela registra as variantes encontradas
   na seção do documento e sinaliza explicitamente como "convenção inconsistente
   nesta jornada", deixando a decisão para o usuário resolver quando quiser.
4. **Lista canônica de jornadas/produtos.** A skill mantém um índice de jornadas já
   documentadas no `journeys-index.json` e, ao receber um nome novo, verifica
   similaridade com os já existentes (ex.: "Atendimento" vs. "Atendimento ao
   Cliente") — avisando o usuário antes de criar uma seção potencialmente duplicada
   por variação de digitação.

Essas 4 regras são o que torna o guia inicial (seção 7) obrigatório: a skill nunca
pode simplesmente "receber input e sair processando" — cada uma delas exige uma
checagem ou pergunta antes da extração acontecer.

**Aplicação (Skill 3, quando existir):** ao gerar um componente, o usuário informa
qual jornada/produto usar como referência ("seguir o padrão de Atendimento ao
Cliente"); a skill consulta **apenas aquela seção** do documento — nunca mistura
convenções de jornadas diferentes sem perguntar.

**Resolução de conflito:** quando o requisito do usuário diverge do padrão
documentado para aquela jornada, a skill **sempre apresenta as opções** (adotar
padrão / usar preferência custom / pedir de novo) — nunca decide sozinha nem
sobrescreve silenciosamente.

### Exemplo de estrutura do documento

```markdown
# Design Patterns — Referências por Jornada/Produto

## Padrão: Atendimento ao Cliente
**Componentes-fonte:** c_userPicker, c_caseForm, c_statusTimeline
**Último scan:** 2026-07-20

### Naming Convention
Prefixo `c_`, kebab-case. Ex.: `c_userPicker`, `c_caseForm`.

### CSS & Design Tokens
CSS custom properties + tokens SLDS, nunca cor hardcoded.
\`\`\`css
:host { --color-primary: var(--slds-c-brand-border-color-default); }
\`\`\`

### Slots
`slot-header` (opcional), `slot-content` (obrigatório), `slot-footer` (opcional).

### Eventos
Padrão `on<Action>`: `onSelect`, `onSave`, `onCancel`.

---

## Padrão: Vendas B2B
**Componentes-fonte:** c_opportunityCard, c_accountSelector, c_dealTracker
**Último scan:** 2026-07-21

(seção independente — pode ter convenções diferentes de Atendimento)
```

## 5. Quality Gate — Rubrica de Aderência ao Design Pattern (100 pontos)

Implementada em `scripts/pattern-scorer.mjs`. **Não duplica** qualidade genérica de
LWC — isso já é coberto pelas skills delegadas (`experience-lwc-generate` tem sua
própria rubrica PICKLES de 165 pontos; `design-systems-slds-apply` exige o SLDS linter
oficial). A rubrica **própria** desta skill cobre só o que é específico da ORG,
extraído 1:1 do snapshot estruturado da jornada (`journeys/<slug>.json`):

| Dimensão | Pontos | Lê do snapshot (`aggregate.*`) |
|---|---|---|
| Estrutura (tag raiz) | 10 | `html.rootTags` |
| Naming | 10 | `naming.dominantStyle`, `naming.commonPrefix` |
| Vocabulário SLDS | 15 | `html.commonSldsClasses` |
| Contrato `@api` (nomes + defaults) | 20 | `js.allApiMembers`, `js.apiDefaults` |
| Getters/computed | 5 | `js.allGetters` |
| Utilitários compartilhados | 10 | `js.sharedUtils` |
| Contrato de eventos | 10 | `js.eventContracts` |
| Forma da chamada Apex | 5 | `js.apexCallStyle` |
| Loading & Erro | 5 | `html.spinnerUsers`, `js.toast.users` |
| i18n (Custom Labels) | 5 | `js.labelUsers` |
| Acessibilidade (baseline) | 5 | `html.a11yAvg` |

**Princípio central:** se a jornada não tem convenção registrada para um sinal, a
dimensão concede crédito integral — a skill nunca inventa regra nem penaliza por falta
de dado. **O preview sempre mostra os dois scores lado a lado:** aderência (gate formal
desta skill) + o resultado do craft delegado (PICKLES 165pt + SLDS lint) — garante que
ninguém "esqueça" de checar se o craft delegado realmente rodou.

**Modo Editar — diff estrutural, não o arquivo inteiro:** o scorer roda
`pattern-extractor.mjs` (Skill 1) duas vezes (baseline vs. proposto) e compara por
CHAVE. Dimensão sem alteração real → excluída do total/max (nem soma, nem penaliza —
"legado intocado não penaliza"). Dimensão com alteração → pontuada só com os itens
NOVOS. Item REMOVIDO que era convenção documentada → aviso de **regressão** explícito,
separado do score (nunca aceito nem bloqueado silenciosamente).

**Flag de novidade:** gatilho objetivo (não um "parece que sim") para sugerir "rode a
Skill 1 de novo" — dispara quando o componente usa um `@api`/evento/classe SLDS que não
aparece nem nos padrões compartilhados nem em `componentSpecifics` de nenhum
componente já documentado da jornada.

Detalhamento completo em `references/quality-rubric.md` (da própria skill).

> Nota: diferente do piso ≥99% do `apex-test-loop`. Ali é cobertura de teste
> (tudo-ou-nada, mensurável objetivamente); aqui é UI — "mínimo viável deployável" é
> funcionar + casar com o padrão, e a validação fina de verdade acontece no preview
> visual, não só no score.

## 6. Estrutura de Repositório Proposta

```
Salesforce_LWC-Developer/
├── .claude/
│   ├── settings.json                           # Camada 1+2 de seguranca da Skill 3 (permissions.deny + guard hook)
│   └── skills/
│       ├── lwc-pattern-documenter/             # SKILL 1 — implementada, testada
│       │   ├── SKILL.md                        # Triggers, owns, workflow de extração+escrita
│       │   ├── scripts/
│       │   │   ├── pattern-extractor.mjs       # Le arquivos apontados, extrai padroes (determinístico)
│       │   │   └── pattern-writer.mjs          # Grava/mescla design-patterns.md + índice + snapshot (determinístico)
│       │   └── references/
│       │       ├── extraction-signals.md       # O que extrair (estrutura, naming, css, eventos, dados...)
│       │       └── guided-mode.md              # Fluxo do guia inicial (secao 7) — passo a passo
│       │
│       ├── lwc-pattern-generator/              # SKILL 3 — implementada, testada
│       │   ├── SKILL.md                        # Triggers, owns/delegates, os 3 modos, NUNCA FACA
│       │   ├── RECOMMENDATIONS.md              # Ledger de autoaprendizado (R-XXXX)
│       │   ├── scripts/
│       │   │   ├── guard.mjs                   # Camada 2 de seguranca — trava factual, nao confia em "modo"
│       │   │   ├── spec-reader.mjs             # Le a spec da Skill 2; deriva modo/jornada/travas
│       │   │   ├── pattern-reader.mjs          # Le journeys/<slug>.json; --find-journey (lookup reverso)
│       │   │   └── pattern-scorer.mjs          # Rubrica de aderencia (100pt) + diff estrutural (modo Editar)
│       │   ├── references/
│       │   │   ├── two-source-model.md         # Spec (o QUE) vs. padrao (o COMO) + precedencia
│       │   │   ├── guided-mode.md              # As 10 etapas, os 3 modos, mensagens
│       │   │   ├── quality-rubric.md           # As 11 dimensoes + diff estrutural + flag de novidade
│       │   │   ├── security-gates.md           # Modelo de seguranca completo (guard factual)
│       │   │   ├── conflict-resolution.md      # Padrao da jornada vs. requisito do usuario
│       │   │   ├── clone-adapt-guide.md        # Separar convencao (reaproveitar) de especifico (adaptar)
│       │   │   └── edit-mode-guide.md          # Diff estrutural + deteccao de regressao
│       │   └── tests/                          # guard (27) + pattern-scorer (14) + spec-reader (28) = 69 casos
│       │
│       ├── lwc-spec-writer/                    # SKILL 2 — entrevista o requisito, grava a spec
│       │   ├── SKILL.md                        # Os 3 tipos de spec, NUNCA FACA, gate de completude
│       │   └── references/
│       │       ├── interview-guide.md          # Blocos 0..K adaptativos, condicionais, gate de completude
│       │       └── spec-template.md            # O template exato do spec.md (cabecalho em tabela)
│       │
│       ├── experience-lwc-generate/            # IMPORTADA na integra (sf-skills v1.31.0, Apache-2.0) ✅
│       ├── design-systems-slds-apply/          # IMPORTADA na integra (sf-skills v1.31.0, Apache-2.0) ✅
│       ├── VENDOR-ATTRIBUTION.md               # Atribuicao Apache-2.0 das 2 skills acima (padrao apex-test-loop)
│       ├── VENDOR-sf-skills-LICENSE-Apache-2.0.txt  # Texto da licenca Apache-2.0 do upstream
│       └── README.md                           # Indice das skills deste repo
├── .lwc-pattern-documenter/                     # SAIDA runtime da Skill 1 (criada no projeto, como .apex-test-loop/)
│   └── lwc-design-system/
│       ├── design-patterns.md                   # Documento vivo — 1 secao por jornada/produto
│       ├── journeys-index.json                  # Lista canonica de jornadas/produtos ja documentados
│       └── journeys/                            # Snapshot JSON estruturado por jornada (gravado com --data)
│           └── <slug>.json                      # Ex.: consorcio.json — o `aggregate` que a Skill 3 le de volta
├── force-app/main/default/lwc/                 # LWCs da org (Skill 1 le; Skill 3 cria/clona/edita)
└── LICENSE                                     # MIT
```

**Nao ha motor de templates proprio (`lwc-generator.mjs`/`.mustache`) na Skill 3** —
decisao revisada: o modelo comprovado (Skill 1, `apex-test-loop`) e "script extrai/
grava/pontua mecanicamente, o AGENTE escreve o codigo" usando o sinal +
`experience-lwc-generate` (que ja tem templates oficiais). Um motor proprio duplicaria
essa fonte e nao se adaptaria bem a estrutura especifica de cada jornada
(`representativeSkeleton`/`modalSkeleton` variam por jornada, nao sao genericos).

> **Nota:** a pasta `.lwc-pattern-documenter/` é criada **no projeto do usuário** em
> tempo de execução (não é versionada aqui, neste repo da skill) — exatamente como a
> `apex-test-loop` cria `.apex-test-loop/state/` no projeto, não no repo dela. É uma
> pasta **oculta, própria da ferramenta**, na raiz do projeto — nunca em `docs/`.

### Coexistência com a `apex-test-loop` (mesmo projeto Salesforce)

Quando o usuário quer as três skills (mais a `apex-test-loop`) lado a lado no mesmo
projeto Salesforce (não neste repo-fonte das skills, mas no projeto onde elas são
instaladas), regras que garantem que uma nunca sobrescreve a outra:

- **`.claude/settings.json` — atenção na instalação.** Este repo já traz um
  `settings.json` (Camadas 1+2 da Skill 3). Se o projeto-destino **já tiver** um
  `settings.json` da `apex-test-loop`, o correto é **MESCLAR** os dois (unir `deny` e
  os hooks `PreToolUse`, cada guard com seu próprio `matcher`/`command`), **nunca
  substituir o arquivo** — senão o guard de uma das skills morre. A **Skill 1** não
  precisa disso — ela não traz `settings.json` (instalação puramente aditiva).
- **Caminhos de saída isolados:** Skill 1 escreve só em
  `.lwc-pattern-documenter/lwc-design-system/`; a Skill 3 só gera/edita em
  `force-app/**/lwc/**`; a `apex-test-loop` usa `.apex-test-loop/state/` e
  `force-app/**/classes/**`. Sem interseção.
- **Os guards não competem, são aditivos:** o `guard.mjs` da `apex-test-loop` mira
  `.cls`/`.trigger`/`force-app/classes`; o `guard.mjs` da Skill 3 mira bundles LWC
  (`force-app/**/lwc/**`). Cada um libera o domínio do outro.
- **Sem colisão de gatilhos:** os blocos TRIGGER/DO NOT TRIGGER escopam cada skill ao
  seu domínio (documentação de LWC × geração/edição de LWC × cobertura de teste Apex).

## 7. Fluxo Interativo — Skill 1 (`lwc-pattern-documenter`), Guia Inicial Obrigatório

> **Princípio não-negociável (reforçado pelo usuário):** esta skill nunca "recebe
> input e sai processando". Toda execução abre com um guia — mesmo sendo uma skill
> só de leitura/documentação, ela decide coisas importantes (bloquear por poucos
> componentes, sinalizar divergência, evitar jornada duplicada) que exigem checkpoint
> humano antes de escrever qualquer coisa.

1. **Abre mostrando o estado atual:** lista as jornadas/produtos já documentadas em
   `design-patterns.md` (via `journeys-index.json`), se houver alguma.
2. **Pergunta: jornada nova ou atualizar uma existente?** Se o nome informado for
   parecido com uma jornada já indexada, avisa e confirma antes de prosseguir (regra
   4 da seção 4).
3. **Pergunta: você já tem os caminhos dos arquivos, ou quer que eu liste os LWCs do
   projeto para escolher?** — modo híbrido (regra 1 da seção 4).
4. **Confirma a lista final de arquivos antes de extrair** — checkpoint explícito,
   nunca assume que a primeira lista informada é a definitiva.
5. **Verifica o mínimo de 3 componentes** (regra 2 da seção 4). Se não bater, **para
   aqui** e pede mais exemplos — não escreve nada no documento.
6. **Extrai os padrões** dos arquivos confirmados (estrutura/composição, naming,
   CSS/tokens, slots + wiring pai↔filho, eventos, dados @api/getters/@wire/Apex, a11y —
   ver `extraction-signals.md`).
7. **Se encontrar divergência** entre os componentes da mesma jornada, documenta as
   variantes e sinaliza — nunca decide sozinha qual é a "oficial" (regra 3 da
   seção 4).
8. **Mostra um preview do que vai escrever** na seção do Markdown ANTES de salvar —
   aprovação explícita do usuário.
9. **Grava de forma determinística via `pattern-writer.mjs`** (nunca reescrevendo o
   arquivo à mão): jornada nova → ACRESCENTA a seção; existente → substitui só a seção
   dela; upsert do `journeys-index.json` (nome/componentes/data); trava de integridade
   aborta se o merge fosse perder qualquer jornada. Isso elimina a classe de bug em que
   um modelo, reescrevendo o arquivo inteiro, apaga uma jornada já documentada.

Detalhamento completo desse fluxo (mensagens exatas, formato das perguntas) fica em
`references/guided-mode.md` da própria skill, a escrever no Tier 0.

## 8. Fluxo Interativo — Skill 3 (`lwc-pattern-generator`), os 3 Modos

Revisão pós-implementação: a Skill 3 não tem um "modo automático" genérico — ela
sempre passa pelo guia, e o usuário escolhe explicitamente **qual dos 3 modos de
operação** quer usar (pedido explícito do usuário: "editar um LWC existente, clonar e
adaptar para novos cenários, ou criar do zero"). Detalhamento completo em
`references/guided-mode.md` (da própria skill).

| | **Criar** | **Clonar e Adaptar** | **Editar** |
|---|---|---|---|
| Risco | Baixo | Médio | Alto |
| Arquivo-alvo | Novo | Novo | Existente (produção) |
| Referência | `aggregate` da jornada | Jornada + 1 componente-fonte real | Jornada descoberta a partir do componente |
| Guard (`classifyWrite`) | `allow` | `allow` (checa colisão de nome antes) | `ask` obrigatório |

**Fluxo comum aos 3 modos:**
0. **Gate da spec:** procura a spec do componente (`spec-reader.mjs --component <nome>`)
   **antes de perguntar qualquer coisa**. Se existir, ela resolve o modo (`Tipo`), a
   jornada, o componente-alvo e o requisito, e traz as travas duras (contrato congelado,
   não-objetivos, pendências). Se não existir, cai na coleta inline — nunca inventa o
   requisito (ver seção 0.1).
1. **Gate inicial:** confirma que existe ao menos uma jornada documentada
   (`journeys-index.json`) — nunca gera sem referência confirmada, nem no modo Criar.
2. **[Só Editar] Lookup reverso** componente→jornada via
   `pattern-reader.mjs --find-journey` — nunca escolhe a jornada sozinho se o
   componente aparecer em mais de uma.
3. **Escolha explícita de modo**, depois jornada de referência (Criar/Clonar) ou já
   descoberta (Editar).
4. **Coleta de requisito** (varia por modo — Clonar dispara `platform-apex-generate`
   ANTES do LWC se precisar de Apex novo).
5. **Checagem proativa de colisão de nome/path** antes do guard entrar em ação.
6. **Preview do que será reaproveitado vs. adaptado** (Clonar,
   `references/clone-adapt-guide.md`) ou **diff proposto** (Editar,
   `references/edit-mode-guide.md`) — aprovação obrigatória.
7. **Gera/edita**, delegando craft para `experience-lwc-generate` (bundle, `@wire`,
   Apex/GraphQL, a11y, Jest) e `design-systems-slds-apply` (styling, verificação de
   hooks/classes reais antes de usar).
8. **Score de aderência (`pattern-scorer.mjs`) + score de craft/SLDS lado a lado** —
   ver seção 5 (rubrica). Modo Editar pontua só o diff estrutural.
9. **Deploy** com aprovação explícita; delega a `platform-metadata-deploy`.
10. **Aprendizado:** `RECOMMENDATIONS.md` se houve fricção; sugestão de "rode a Skill 1
    de novo" **só** se a flag de novidade disparar (gatilho objetivo — ver seção 5).
    **Nunca** reescreve `design-patterns.md`/`journeys-index.json`/`journeys/*.json` —
    território exclusivo da Skill 1.

## 9. Arquivos Críticos — Ordem de Implementação (status: ambas as skills implementadas)

- **Tier 0 (Skill 1, `lwc-pattern-documenter`) ✅:** `SKILL.md` +
  `pattern-extractor.mjs` + `pattern-writer.mjs` (incl. `--data` para o snapshot
  estruturado) + `extraction-signals.md` + `guided-mode.md` +
  `.lwc-pattern-documenter/lwc-design-system/{design-patterns.md,journeys-index.json,journeys/*.json}`.
- **Tier 1 (validação do MVP) ✅:** Skill 1 validada em jornadas reais (Sidebar Dados
  Cadastrais, Consórcio), revisada por 3 agentes paralelos + testes de borda, corrigida
  contra bugs reais (vazamento de comentários, escrita não determinística, sinais
  falsos de divergência).
- **Tier 2 (fundação da Skill 3, `lwc-pattern-generator`) ✅:** `SKILL.md`, `guard.mjs`
  (trava factual — nunca confia em "modo" autodeclarado), `settings.json` (Camadas 1+2)
  — as 2 skills oficiais já estavam importadas ✅.
- **Tier 2.5 (segurança testada — bloqueava o Tier 3) ✅:** `tests/guard.test.mjs`
  (27 casos: comandos destrutivos, colisão parcial de bundle, case-insensitive, etc.).
  Só avançou pro Tier 3 com esses testes passando — mesma lição da Skill 1 (nasceu sem
  testes, só ganhou depois de um bug real; a Skill 3 nasce testada por ser mais
  arriscada).
- **Tier 3 (leitura + scoring) ✅:** `pattern-reader.mjs` (+ `--find-journey` para o
  lookup reverso) + `pattern-scorer.mjs` (rubrica de aderência + diff estrutural) +
  `tests/pattern-scorer.test.mjs` (14 casos, cobrindo os 3 buckets: legado intocado não
  penaliza, item novo penaliza, remoção de convenção vira regressão). Validado também
  em integração ponta a ponta com o `pattern-extractor.mjs` real (não só fixtures
  sintéticas).
- **Tier 4 (UX/fluxo) ✅:** `guided-mode.md` (10 etapas, 3 modos), `quality-rubric.md`,
  `security-gates.md`, `conflict-resolution.md`, `clone-adapt-guide.md`,
  `edit-mode-guide.md`.
- **Tier 5 (aprendizado) ✅:** `RECOMMENDATIONS.md` + a flag de novidade (gatilho
  objetivo) ligada ao `pattern-scorer.mjs`.

Não há um "motor de templates" (Tier de geração separado) — decisão revisada na seção 6:
o agente escreve o código usando o sinal do `pattern-reader.mjs` + o craft delegado,
sem um script de templating próprio.

## 10. Reuso de `apex-test-loop` e `sf-skills`

| Componente | Origem | Adaptação |
|---|---|---|
| Estrutura SKILL.md (Owns/Delegates/NUNCA FAÇA) | sf-skills + apex-test-loop | Direto, adaptado ao domínio LWC |
| `guard.mjs` (classify/classifyWrite) | apex-test-loop | Regex adaptada para `/lwc/**` em vez de `.cls` |
| State file por item | apex-test-loop | `.apex-lwc-developer/state/<Componente>.md` |
| `RECOMMENDATIONS.md` (R-XXXX) | apex-test-loop | Mesmo formato, local-only, sem git push |
| Modo guiado PT passo-a-passo | apex-test-loop | Adaptado para perguntas de LWC |
| Templates + references estruturados | sf-skills | `assets/templates` + `references/*.md` |
| Rubrica de pontuação como gate | sf-skills (120pt) | Adaptado para 100pt, gate em 80 (não 99%) |
| Decision tree de root cause | sf-skills (`apex-test-run`) | A criar: LWC não renderiza / lento / falha validação |
| **Craft de autoria de LWC** (bundle, `@wire`, a11y, Jest, PICKLES) | sf-skills (`experience-lwc-generate`) | **Importada na íntegra** para a Skill 3 — mesmo princípio do `apex-test-loop` com as skills de teste Apex |
| **Craft de styling/tokens SLDS** | sf-skills (`design-systems-slds-apply`) | **Importada na íntegra** para a Skill 3 (Lightning Base Components > Blueprints > Styling Hooks > CSS) |

`sf-skills` é licenciado Apache-2.0 — qualquer trecho de texto/código reaproveitado
literalmente deve manter atribuição (NOTICE) no momento da implementação.
Confirmado por pesquisa direta no repositório (94 skills, v1.31.0, LICENSE.txt
Apache-2.0): **nenhuma skill oficial cobre o que a `lwc-pattern-documenter` faz**
(aprender padrões específicos da org, por jornada/produto) — só o craft de geração
(`experience-lwc-generate`) e de styling (`design-systems-slds-apply`) tem
equivalente oficial, e ambos ficam restritos à Skill 3. Detalhes da pesquisa em
`docs/PLANEJAMENTO.md`.

## 11. Decisões de Design (e porquês)

- **Score de aderência é informativo, não um gate numérico automático (diferente do
  piso ≥99% do `apex-test-loop`):** LWC é UI — "mínimo viável deployável" é funcionar +
  casar com o padrão, e a decisão de prosseguir é humana (aprovação explícita no
  preview, etapa 8 do guia), não um corte automático tipo "≥80 libera, <60 bloqueia".
  O score aponta ONDE o componente diverge; quem decide se isso é aceitável é o
  usuário — sobretudo porque divergência pode ser intencional (seção de resolução de
  conflito).
- **`guard` responde `ask` (não `deny`) para sobrescrita:** o usuário pode
  legitimamente querer refatorar um LWC existente; a skill não pode saber a intenção
  sozinha, então pede aprovação em vez de bloquear.
- **Registry em JSON:** legível, versionável, fácil de diffar em PRs.
- **Preview obrigatório antes de deploy:** prática padrão de desenvolvimento
  Salesforce para UI (Live Preview / Local Dev).
- **Conflito de padrão é sempre decisão do usuário** — a skill nunca decide sozinha
  qual convenção "vale mais".
- **Seleção de arquivos híbrida (caminho manual OU menu interativo):** cobre tanto o
  usuário que já sabe exatamente o que quer apontar quanto o que prefere que a skill
  ajude a descobrir os LWCs do projeto.
- **Mínimo de 3 componentes por jornada:** abaixo disso a extração vira "achismo" —
  um único componente não prova convenção, prova coincidência. Bloquear e pedir mais
  exemplos é mais barato que documentar um padrão falso que a Skill 3 usaria depois.
- **Divergência é documentada, nunca resolvida por maioria automática:** decidir por
  frequência esconderia uma inconsistência real da org por trás de uma escolha
  arbitrária do agente. Melhor deixar visível e permitir que o usuário decida com
  contexto que a skill não tem.
- **Lista canônica de jornadas/produtos:** sem ela, pequenas variações de digitação
  (“Atendimento” vs. “Atendimento ao Cliente”) fragmentariam o documento em seções
  redundantes — o índice existe só para evitar esse acidente, não para restringir
  nomes livres.
- **Guia inicial obrigatório mesmo numa skill "só leitura":** as 4 regras acima geram
  decisões (bloquear, sinalizar, confirmar, avisar duplicidade) que não podem
  acontecer silenciosamente — por isso a Skill 1 também tem um fluxo guiado (seção 7),
  não é "aponta arquivo e sai processando".
- **Craft de LWC delegado, não reinventado (só na Skill 3):** pesquisa confirmou que
  `experience-lwc-generate` e `design-systems-slds-apply` do `sf-skills` já cobrem
  autoria de LWC e styling/tokens SLDS com qualidade oficial — reinventar isso seria
  duplicar esforço sem ganho. A `lwc-pattern-generator` importa as 2 na íntegra (só
  as essenciais, sem `design-systems-slds-validate` por ora) e foca seu próprio
  valor em injetar os padrões específicos da org, que não têm equivalente oficial.

## Status Atual

Ambas as skills estão **implementadas e testadas** (seção 9 lista os tiers completos):

1. ✅ **Skill 1 (`lwc-pattern-documenter`)** — implementada, revisada por 3 agentes
   paralelos + testes de borda, corrigida contra bugs reais, validada em jornadas
   reais (Sidebar Dados Cadastrais, Consórcio).
2. ✅ **Skill 3 (`lwc-pattern-generator`)** — implementada com os 3 modos de operação
   (Criar/Clonar/Editar), guard com trava factual (nunca confia em "modo"
   autodeclarado), rubrica de aderência (não duplica o craft das skills oficiais),
   diff estrutural + detecção de regressão no modo Editar, flag de novidade como
   gatilho objetivo de retroalimentação para a Skill 1. 41 testes automatizados
   (`guard.test.mjs` + `pattern-scorer.test.mjs`), validados também em integração
   ponta a ponta com o `pattern-extractor.mjs` real.
3. ✅ **Extensão retroativa na Skill 1** para viabilizar a Skill 3: `pattern-writer.mjs`
   ganhou `--data` (persiste snapshot estruturado por jornada em `journeys/<slug>.json`,
   com validação de consistência contra `--components`) e `journeys-index.json`
   enriqueceu `components` para `{name, path}` (retrocompatível com o formato antigo).

4. ✅ **Skill 2 (`lwc-spec-writer`)** — entrevista adaptativa (blocos 0..K) que grava uma
   spec por componente, cobrindo os 3 tipos de trabalho (novo / clonar e adaptar /
   melhoria pontual, este último com **contrato público congelado** como fronteira de
   regressão). Gate de completude separa campo crítico (pergunta) de não-crítico
   (marca `🚧 PENDENTE`), com proibição explícita de inventar para preencher.
5. ✅ **Integração das duas fontes na Skill 3** — `spec-reader.mjs` (28 testes) resolve o
   slug do componente, lê a spec, deriva o modo de operação a partir do `Tipo`, e devolve
   `frozenContract`/`nonObjectives`/`pendencias` + avisos já formulados (rascunho, sem
   jornada, edição sem contrato congelado). Ordem de precedência e tratamento de
   divergência documentados em `references/two-source-model.md`. Total: **69 testes**.

Próximos passos em aberto (não bloqueantes): documentar mais jornadas reais da org do
usuário para ampliar a cobertura do `design-patterns.md` antes de usar a Skill 3 em
escala; considerar formalizar um "Tier 6" de aprendizado ativo se o ledger de
`RECOMMENDATIONS.md` acumular itens recorrentes; avaliar validação em scratch org
descartável antes do deploy no modo Editar.
