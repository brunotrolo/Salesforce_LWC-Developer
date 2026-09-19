# Atribuição — skills oficiais importadas (forcedotcom/sf-skills)

As seguintes pastas de skill em `.claude/skills/` foram **importadas na íntegra**,
sem modificação, do repositório oficial da Salesforce:

- `experience-lwc-generate/` — craft de autoria/edição de LWC (bundle, `@wire`,
  Apex/GraphQL, SLDS2, acessibilidade, Jest, metodologia "PICKLES").
- `design-systems-slds-apply/` — craft de styling/tokens SLDS (Lightning Base
  Components > Blueprints > Styling Hooks > CSS custom), com blueprints e styling hooks.

## Origem

- **Repositório:** https://github.com/forcedotcom/sf-skills
- **Licença:** Apache License 2.0 — texto completo em
  `VENDOR-sf-skills-LICENSE-Apache-2.0.txt` (nesta pasta).
- **Copyright:** © 2026 Salesforce, Inc.
- **Snapshot (pin):** commit `a0b7442d8fa0dc506606f545fbbc2b4c1d8db240`,
  release `v1.31.0`, de 2026-07-17.

## Obrigações Apache-2.0 (cumpridas)

- Mantido o texto da licença e o aviso de copyright (arquivo acima).
- **Nenhuma modificação** foi feita nessas 2 pastas — são cópia fiel do upstream.
  Qualquer skill nossa vive **fora** delas (`lwc-pattern-documenter/`,
  `lwc-spec-writer/` e `lwc-pattern-generator/`).
- O upstream não distribui arquivo `NOTICE`, então não há aviso adicional a reproduzir.

## Por que importar (pin) em vez de referenciar

O sf-skills muda entre releases ("skills may be renamed/restructured"). Importar um
snapshot fixo evita quebra por *drift* e nos dá controle de versão. Para atualizar,
troque as pastas por um snapshot mais novo e atualize o commit/versão acima.

## Como se relacionam com as nossas skills

Estas 2 são o **craft** de LWC (como escrever um bom componente e como aplicar SLDS).
A nossa **`lwc-pattern-documenter/`** (Skill 1) e a **`lwc-spec-writer/`** (Skill 2) não
dependem delas — uma só lê e documenta padrões, a outra só escreve a spec. A
**`lwc-pattern-generator/`** (Skill 3) é que **delega** a geração de LWC a
`experience-lwc-generate` e o styling a `design-systems-slds-apply`, injetando por cima
os padrões específicos da org aprendidos pela Skill 1 — mesmo princípio de "orquestração
nossa + craft oficial" do projeto `apex-test-loop`.

> Cada skill importada tem os próprios blocos TRIGGER / DO NOT TRIGGER no frontmatter,
> então coexistem sem colisão com as nossas e entre si.
