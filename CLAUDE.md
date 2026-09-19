# CLAUDE.md

**As regras deste repositório estão em [`AGENTS.md`](AGENTS.md). Leia-o antes de qualquer
mudança.** Fonte única, vendor-neutral — este arquivo não as duplica, para não divergir.

O essencial, em três linhas:

1. Este repositório **é uma skill**, não um projeto Salesforce. Não existe `force-app/`
   aqui; o que se entrega é o conteúdo de `.claude/`.
2. As 2 skills importadas da Salesforce são snapshot pinado — **não se editam**. Correção
   que pertence a elas vai para o upstream.
3. O modo EDITAR da Skill 3 toca componente que já está em produção. Convenção antiga não
   é bug: reporte, não corrija.

## Específico do Claude Code

- **Campo certo por mecanismo:** uma `SKILL.md` usa `allowed-tools`; `tools:` é de
  subagente (`.claude/agents/`) e numa skill é ignorado **em silêncio**. Este repositório
  não tem subagentes.
- **Skill invocável:** só o `SKILL.md` um nível abaixo de `skills/` vira comando `/`.
  As cinco pastas daqui estão nesse nível — as cinco são invocáveis.
- **`.claude/rules/karpathy-guidelines.md`** não tem `paths:`, então carrega sempre.
- **O hook `PreToolUse` do `guard.mjs` roda de verdade** ao instalar estas skills: ele
  intercepta `Bash|PowerShell|Write|Edit` e trava sobrescrita de bundle LWC existente.
  Se você mexer em `.claude/settings.json` ou no `guard.mjs`, rode
  `node --test .claude/skills/lwc-pattern-generator/tests/*.test.mjs` antes de dar por pronto.
- **`defaultMode: bypassPermissions`** no `settings.json` é intencional (o loop não pode
  parar a cada prompt) — e é justamente por isso que a `deny` e o guard existem. Não
  relaxe um sem o outro.
