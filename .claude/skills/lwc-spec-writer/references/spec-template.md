# Template — `.lwc-spec-writer/specs/<slug>-spec.md`

**Regra de preenchimento nº 1:** seção que não se aplica ao caso é **omitida por
inteiro** — não deixe cabeçalho com "N/A" embaixo. Uma spec de ajuste de CSS tem 4
seções; uma spec de componente novo com Apex e Console tem 12. As duas estão certas.

**Regra nº 2:** campo crítico que o usuário não soube responder vira
`🚧 PENDENTE: <o que falta / quem decide>` e é repetido na seção "Questões em aberto".
Nunca preencha com suposição plausível.

---

## Template

```markdown
# Spec: <Nome do Componente>

| | |
|---|---|
| **Tipo** | <Componente novo \| Clonar e adaptar \| Melhoria pontual> |
| **Status** | <Rascunho \| Aprovada \| Implementada> |
| **Versão** | 1 |
| **Jornada de referência** | <nome em journeys-index.json \| nenhuma documentada ainda> |
| **Componente** | `force-app/main/default/lwc/<nome>` <(a criar) se for novo> |
| **Componente-fonte** | <só no tipo "Clonar e adaptar"> |
| **Ticket / Solicitante** | <ID do ticket, quem pediu — omita a linha se não houver> |
| **Data** | <AAAA-MM-DD> |

## 1. Objetivo

<Uma frase: o que resolve, para quem. No tipo "Melhoria pontual", o que a MUDANÇA resolve.>

**Onde vive:** <Record Page | App Page | Utility Bar | Aba do Console | Experience Cloud
| Flow Screen | componente filho>

## 2. Escopo

### No escopo
- <item>

### Fora do escopo (não-objetivos)
- <o que deliberadamente NÃO faz parte desta entrega>

## 3. Estado atual e limites da mudança

> Seção exclusiva do tipo **Melhoria pontual**. Omita nos outros tipos.

**Comportamento atual (as-is):** <só a parte que a mudança toca>

**Comportamento desejado (to-be):** <o que muda, concretamente>

### ⛔ Contrato público congelado (o que NÃO pode mudar)
- <@api / evento / propriedade que outros consomem e precisa continuar idêntico>

**Consumidores conhecidos:** <outros LWCs, Flows, páginas do App Builder, Experience Cloud>

**Testes existentes que devem continuar passando:** <cenários>

## 4. Dados e integração

**Fonte:** <Apex existente: `Classe.metodo` | Apex novo (a gerar) | Lightning Data
Service (`@wire getRecord`) | GraphQL | sem backend (recebe via @api)>

### Entrada
<parâmetros que o LWC envia>

### Saída esperada
\`\`\`json
{
  // estrutura exata, OU lista campo + tipo + obrigatoriedade se não houver exemplo
}
\`\`\`

### Volume e performance
<registros esperados (média/pior caso), paginação/scroll infinito/carga única>

### Cache e atualização
<cacheable ou sempre fresco; precisa refresh após salvar / refreshApex / notificação>

### Segurança de dados
<restrição por perfil/permission set, CRUD/FLS, sharing, o que esconder de quem não tem
permissão>

## 5. Exposição e configuração

### Targets (`.js-meta.xml`)
- `lightning__RecordPage` — objetos: <Account, Case...>
- <outros targets>

### Propriedades configuráveis (App Builder / Flow)
| Propriedade | Tipo | Default | Descrição |
|---|---|---|---|
| <nome> | <String/Boolean/Integer> | <valor> | <o que faz> |

<No Flow Screen, marque entrada/saída: inputOnly / outputOnly.>

### Contrato `@api` público
- `<nome>` (<tipo>) — <para que serve, valor default se houver>

## 6. Visual e estados

**Protótipo:** <caminho do arquivo de imagem | descrito em texto abaixo>

<Descrição do layout — da imagem lida e CONFIRMADA pelo usuário, ou da descrição textual>

### Estados visuais
- **Loading:** <descrição>
- **Sucesso:** <descrição>
- **Erro:** <descrição>
- **Vazio:** <descrição>
- <estados específicos do cenário>

**Form factor:** <desktop-only | desktop + mobile | segue a convenção da jornada>

## 7. Console e navegação

> Omita esta seção inteira se o componente não roda no Service Console.

### Workspace API
<ações concretas: abrir/fechar sub-aba, refresh, alerta de dados não salvos, foco>

### Lightning Message Service
<canal(is) + direção (publica / assina / ambos)>

## 8. Comportamento e mensagens

### Eventos disparados
| Evento | `detail` | Sobe para o pai? |
|---|---|---|
| `<nome>` | <chaves> | <bubbles/composed> |

### Mensagens ao usuário
| Situação | Tipo | Texto |
|---|---|---|
| <ex.: falha no Apex> | <técnico/negócio> | <texto exato> |

**i18n:** <Custom Labels | hardcoded | segue a convenção da jornada>

### Acessibilidade específica
<requisito específico deste componente, ou "segue o baseline da jornada">

## 9. Dependências e pré-requisitos

| Item | Tipo | Status |
|---|---|---|
| <nome> | <campo custom / objeto / permission set / Custom Label / Static Resource / componente filho / classe Apex> | <existe / precisa criar> |

## 10. Testes e critério de aceite

### Cenários de teste (mocks de Jest)
- <sucesso com N registros>
- <lista vazia>
- <erro de permissão>

\`\`\`javascript
export const MOCK_SUCCESS = { /* dados */ };
export const MOCK_ERROR = { /* dados */ };
\`\`\`

### Critério de aceite
- <critério testável: "ao clicar em X com Y vazio, mostra erro Z e não chama o Apex">

## 11. Questões em aberto e riscos

### 🚧 Pendências (bloqueiam a implementação)
- <o que falta decidir + quem decide>

### Riscos
- <dependência externa, área sensível, dado de produção envolvido>

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1 | <AAAA-MM-DD> | Spec inicial |
```

---

## Notas de preenchimento

- **Cabeçalho em tabela, não em prosa.** O bloco de metadados no topo é o que a Skill 3
  lê primeiro para saber o modo, a jornada e o componente-alvo — mantenha o formato.
- **Contrato de saída sem exemplo do usuário:** liste campo + tipo + obrigatoriedade.
  Nunca "complete" um JSON com campos que ninguém mencionou.
- **Protótipo de imagem:** referencie o caminho, não embuta base64. O arquivo original
  continua sendo a fonte; a spec registra a **interpretação confirmada** pelo usuário.
- **Jornada ausente:** escreva literalmente "nenhuma documentada ainda" — nunca deixe em
  branco. Facilita saber depois que essa spec nasceu sem padrão de base.
- **Tipo "Melhoria pontual":** a spec descreve **a mudança**, não o componente inteiro.
  Seções 4–10 só entram na parte que a mudança realmente toca. A seção 3 (estado atual e
  contrato congelado) é a mais importante e é obrigatória.
- **Atualização de spec existente:** incremente a **Versão**, acrescente uma linha no
  **Histórico**, e mostre o diff ao usuário antes de gravar.
