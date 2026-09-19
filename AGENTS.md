# AGENTS.md — Salesforce LWC Developer

Instruções para qualquer agente de código que trabalhe **neste repositório**.
Vendor-neutral por design (Claude Code, OpenCode, Cursor, Codex e afins). `CLAUDE.md`
aponta para cá para que exista uma única fonte de verdade.

## O que é este repositório

Este repositório **é uma skill**, não um projeto Salesforce. Não existe `force-app/`
aqui. O que se entrega é o conteúdo de `.claude/` — 3 skills autorais, 2 skills oficiais
importadas e o `settings.json` de segurança — instalado dentro do projeto SFDX de outra
pessoa.

Arquitetura **híbrida**: o *craft* de LWC vem das skills oficiais da Salesforce
importadas; a **orquestração, o aprendizado de padrão e a captura de requisito** são o
conteúdo autoral. As 3 skills autorais são numeradas pela ordem de execução:

```
Skill 1  lwc-pattern-documenter  →  COMO se constrói nesta org  (design-patterns.md)
Skill 2  lwc-spec-writer         →  O QUE construir             (<slug>-spec.md)
Skill 3  lwc-pattern-generator   →  combina as duas e gera/edita o componente
```

Consequência prática para você: aqui você quase nunca escreve LWC. Você escreve
**instruções que outro agente vai executar contra uma org que já tem componentes em
produção** — e o modo EDITAR da Skill 3 toca bundles que já estão numa tela real.

## Disciplina comportamental

`.claude/rules/karpathy-guidelines.md` vale para o trabalho **neste repositório** tanto
quanto para a execução das skills:

1. **Pense antes de codar** — o GUIA INICIAL obrigatório das Skills 1 e 3 é isto: nunca
   "recebe input e sai processando". Divergência entre componentes se **documenta**, não
   se resolve por maioria.
2. **Simplicidade primeiro** — o craft já está importado. Reescrever regra de `@wire`,
   token SLDS ou Jest aqui é duplicar o upstream e divergir no próximo release dele.
3. **Mudanças cirúrgicas** — o alvo é componente em produção. Convenção antiga não é bug.
4. **Execução orientada a objetivo** — "o componente renderiza" não é o critério: o score
   de aderência mede *parece com esta org*, o critério de aceite mede *faz o que foi
   pedido*. Os dois, separados.

## Regras inegociáveis

### 1. As 2 skills importadas não se editam
`.claude/skills/experience-lwc-generate/` e `.claude/skills/design-systems-slds-apply/`
são cópia fiel de um snapshot pinado de [`forcedotcom/sf-skills`](https://github.com/forcedotcom/sf-skills)
(Apache-2.0, release `v1.31.0`). Correção que pertence a elas vai para o upstream:
editá-las aqui quebra a promessa do pin e o commit registrado em
`.claude/skills/VENDOR-ATTRIBUTION.md` deixa de descrever o que está no disco. Isso
inclui artefatos acidentais (`node_modules/`, `__pycache__/`, arquivos de lock) — nada
novo dentro dessas duas pastas.

### 2. Frontmatter: campo certo por mecanismo
Uma `SKILL.md` usa `name`, `description` e, quando precisa restringir ferramentas,
`allowed-tools`. O campo `tools:` é de **subagente** (`.claude/agents/`) e é **ignorado
em silêncio** numa skill. Este repositório não tem subagentes — só skills.

Uma skill só vira comando `/` se o `SKILL.md` estiver **um nível** abaixo de
`skills/` (`.claude/skills/<nome>/SKILL.md`). Mais fundo que isso é referência
consultada por caminho, não skill invocável.

### 3. Nada de nome real
Nenhum nome de componente, org, empresa, cliente ou endpoint vindo de uma org real — em
conteúdo, nomes de arquivo, mensagens de commit ou metadados de autoria do git. Os
exemplos usam nomes genéricos (`accountList`, `fooBar`, `myComponent`) ou a jornada
fictícia de exemplo (`consorcio*`); qualquer artefato novo segue a mesma convenção.

### 4. O `settings.json` é segurança, não configuração
`permissions.deny` (bloqueio duro de `sf project/org/data delete`) e o hook `PreToolUse`
do `guard.mjs` existem porque "editar" e "regerar por cima" parecem a mesma coisa para um
agente e não são. Ao instalar num projeto que já tem `settings.json` (ex.: o da
`apex-test-loop`), **mescle** — uma `deny` unificada e os dois hooks lado a lado.
Substituir o arquivo mata o guard da outra skill em silêncio.

### 5. As três skills escrevem em lugares separados
`design-patterns.md` + `journeys-index.json` (Skill 1), `<slug>-spec.md` (Skill 2),
bundle LWC (Skill 3), `RECOMMENDATIONS.md` (melhoria da própria skill, exige revisão
humana) e `agent-memory-local/` (fato operacional local, nunca versionado). Uma skill
nunca escreve no território da outra, e a Skill 1 faz **merge** por jornada — nunca
reescreve o arquivo inteiro.

### 6. Idioma
Conteúdo, regras e `README.md` em PT-BR. Falar com o usuário em PT-BR.

## Mapa do repositório

```
.claude/
├── rules/karpathy-guidelines.md   # disciplina comportamental (MIT) — carrega sempre
├── skills/
│   ├── lwc-pattern-documenter/    # Skill 1 — lê LWCs, documenta padrão por jornada
│   ├── lwc-spec-writer/           # Skill 2 — entrevista o requisito, grava a spec
│   ├── lwc-pattern-generator/     # Skill 3 — gera/clona/edita + guard.mjs + testes
│   ├── experience-lwc-generate/   # oficial Salesforce (Apache-2.0) — craft de LWC
│   ├── design-systems-slds-apply/ # oficial Salesforce (Apache-2.0) — craft de SLDS
│   └── VENDOR-ATTRIBUTION.md      # atribuição e pin do snapshot importado
├── agent-memory-local/            # memória local por skill, nunca versionada
└── settings.json                  # permissions.deny + hook do guard.mjs
docs/ARCHITECTURE.md               # arquitetura e decisões de design
docs/PLANEJAMENTO.md               # histórico de planejamento
```

## Definição de pronto

- [ ] Nada dentro de `experience-lwc-generate/` ou `design-systems-slds-apply/` mudou
- [ ] Frontmatter de skill nova tem `name` e `description`, e `SKILL.md` está um nível
      abaixo de `skills/`
- [ ] Nenhum nome real reintroduzido (componente, org, empresa, endpoint)
- [ ] Os testes da Skill 3 passam: `node --test .claude/skills/lwc-pattern-generator/tests/*.test.mjs`
- [ ] A mudança rastreia a um pedido explícito (nada especulativo)
- [ ] `README.md` / `INFORMACOES.md` / `docs/ARCHITECTURE.md` refletem mudanças estruturais
