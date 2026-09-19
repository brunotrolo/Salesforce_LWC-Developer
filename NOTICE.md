# Atribuição de terceiros

O Salesforce LWC Developer é distribuído sob licença MIT (ver `LICENSE`) e redistribui
material de terceiros sob as licenças originais.

O conteúdo **autoral** deste repositório são as 3 skills `lwc-pattern-documenter/`,
`lwc-spec-writer/` e `lwc-pattern-generator/`, mais a rule
`.claude/rules/karpathy-guidelines.md` (derivada — ver abaixo). As 2 skills restantes são
importadas.

## Skills oficiais Salesforce — Apache License 2.0

**Caminho:** `.claude/skills/experience-lwc-generate/` e
`.claude/skills/design-systems-slds-apply/`
**Origem:** [forcedotcom/sf-skills](https://github.com/forcedotcom/sf-skills)

A atribuição completa — o commit e a release pinados do snapshot e as obrigações da
Apache-2.0 cumpridas — está em
[`.claude/skills/VENDOR-ATTRIBUTION.md`](.claude/skills/VENDOR-ATTRIBUTION.md), com o
texto integral da licença em
`.claude/skills/VENDOR-sf-skills-LICENSE-Apache-2.0.txt`.

Foram importadas **na íntegra, sem modificação**. Uma correção que pertence a elas vai
para o upstream: editá-las aqui quebraria a promessa do snapshot e o commit pinado
deixaria de descrever o que está no disco.

## Karpathy Guidelines — MIT

**Caminho:** `.claude/rules/karpathy-guidelines.md`
**Origem:** [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills)

As quatro diretrizes comportamentais (Pense Antes de Codar, Simplicidade Primeiro,
Mudanças Cirúrgicas, Execução Orientada a Objetivo) são reproduzidas **na íntegra**. Os
blocos marcados `Neste projeto` são contextualização própria deste repositório para
geração de LWC guiada por padrão numa org com componentes em produção — acrescentam, não
substituem nem relaxam a orientação original.

As diretrizes derivam de
[observações de Andrej Karpathy](https://x.com/karpathy/status/2015883857489522876)
sobre armadilhas de LLM em programação.

## Convenções de anonimização

Os exemplos usam nomes de componente genéricos (`accountList`, `fooBar`, `myComponent`)
ou a jornada fictícia de exemplo (`consorcio*`). Nenhum nome de empresa, org, cliente,
componente real ou endpoint aparece neste repositório — e qualquer artefato novo segue a
mesma convenção.
