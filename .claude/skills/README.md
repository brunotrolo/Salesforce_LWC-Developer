# Skills deste repositório

Skills para Claude Code / OpenCode que compõem o **Salesforce LWC Developer**. Cada
skill vive na própria pasta abaixo de `.claude/skills/` e é carregada automaticamente
pela ferramenta a partir do frontmatter do seu `SKILL.md`.

### Nossas skills

Numeradas na **ordem de execução**: documenta o padrão → escreve a spec → gera o código.

| # | Skill | Estado | O que faz |
|---|---|---|---|
| **1** | [`lwc-pattern-documenter/`](lwc-pattern-documenter/) | ✅ Implementada | Aprende e **documenta** os padrões de design de LWC, por jornada/produto, num Markdown vivo. É o **guia de system design** (o COMO se constrói nesta org). Só lê e documenta — nunca gera componentes. |
| **2** | [`lwc-spec-writer/`](lwc-spec-writer/) | ✅ Implementada | **Entrevista** o requisito e grava uma spec — um arquivo por componente — em `.lwc-spec-writer/specs/`. É o **documento de spec-driven design** (o QUE construir). Cobre os 3 tipos (componente novo, clonar/adaptar, **melhoria pontual em existente** — com contrato público congelado). Não gera código. |
| **3** | [`lwc-pattern-generator/`](lwc-pattern-generator/) | ✅ Implementada | **Cria, clona/adapta ou edita** LWCs combinando as **duas fontes** acima. 3 modos de operação, craft delegado às skills oficiais abaixo, e score de aderência ao padrão da org. |

### Skills oficiais da Salesforce importadas (craft — `forcedotcom/sf-skills`, Apache-2.0)

Importadas **na íntegra** (snapshot `v1.31.0`), sem modificação. Atribuição e obrigações
da licença em [`VENDOR-ATTRIBUTION.md`](VENDOR-ATTRIBUTION.md).

| Skill oficial | Para que serve |
|---|---|
| [`experience-lwc-generate/`](experience-lwc-generate/) | Craft de autoria/edição de LWC (bundle, `@wire`, Apex/GraphQL, SLDS2, a11y, Jest). |
| [`design-systems-slds-apply/`](design-systems-slds-apply/) | Craft de styling/tokens SLDS (Lightning Base Components > Blueprints > Styling Hooks > CSS). |

Arquitetura completa das três skills e as decisões de design: [`../../docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).

## Coexistência com a `apex-test-loop`

Estas skills foram desenhadas para conviver no MESMO projeto Salesforce que a
[`apex-test-loop`](https://github.com/brunotrolo/Salesforce_Apex-Cover-Loop) **sem
sobrescrever nada**:

- A `lwc-pattern-documenter` (Skill 1) **não traz `.claude/settings.json`** (instalação
  puramente aditiva) e escreve apenas em `.lwc-pattern-documenter/lwc-design-system/`.
- A `lwc-pattern-generator` (Skill 3) **traz um `.claude/settings.json`** (segurança
  contra sobrescrita de bundle LWC — ver `lwc-pattern-generator/references/security-gates.md`).
  Se o projeto-destino já tiver um `settings.json` da `apex-test-loop`, **mescle os
  dois** (`deny` unificado + os dois hooks `PreToolUse` lado a lado) em vez de
  substituir o arquivo — senão o guard de uma das skills morre.

Detalhes completos em [`../../INFORMACOES.md`](../../INFORMACOES.md), seção
"Coexistência com a `apex-test-loop`".
