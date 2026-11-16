# Prisma: guia de manutenção

Sistema de acompanhamento de processos de financiamento habitacional (Caixa) da GCO Negócios Imobiliários.
A equipe move os processos por etapas, e o corretor e o cliente acompanham por links próprios, recebendo
avisos no WhatsApp.

Este arquivo é o ponto de partida pra quem (pessoa ou IA) for manter o sistema. Leia inteiro antes de mexer.

---

## 1. Stack

| Camada | Tecnologia |
|---|---|
| App | Next.js 15 (App Router, Server Actions), React 19, TypeScript 5 |
| Estilo | Tailwind CSS 4 + classes próprias em `app/globals.css` (`@layer components`) |
| Banco, login e arquivos | Supabase (Postgres 17, Auth, Storage). Região us-east-1 (Project Settings > General) |
| Hospedagem | Vercel, região `iad1` (colada no Supabase us-east-1) e cron diário (`vercel.json`) |
| WhatsApp | Evolution API v2 (opcional). Sem ela, as mensagens ficam pra envio manual |

Comandos:

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run build
```

---

## 2. Quem acessa e como

| Quem | Rota | Como entra | O que pode |
|---|---|---|---|
| Equipe (admin e operador) | `/app/*` | E-mail e senha (Supabase Auth) | Tudo da própria organização, pela RLS |
| Corretor | `/c/<token>` | Link com token de 48 caracteres, sem senha | Ver os processos dele, cadastrar processo, enviar documento |
| Cliente | `/p/<token>` | Link com token, sem senha | Ver o próprio processo e enviar documento pedido |

- O cadastro público do Supabase Auth está **desligado**. Membro novo da equipe é criado pela tela **Equipe** (admin).
- As rotas `/c` e `/p` usam a chave secreta no servidor e **sempre filtram pelo token** (`lib/portal.ts`).
- Admin: tudo, inclusive Equipe e Configurações. Operador: não vê essas duas telas.
- `middleware.ts` só roda em `/app` e `/login`.
- A sessão é validada com `supabase.auth.getClaims()` (`lib/sessao.ts`), que confere o token **localmente**
  porque o projeto usa chave de assinatura ES256. Se algum dia voltarem a usar chave HS256, o getClaims cai
  pro modo de rede e funciona do mesmo jeito, só mais lento.

---

## 3. Banco de dados

As migrations estão em `supabase/migrations/` e **já estão aplicadas** no projeto atual. Num banco novo,
rode as três em ordem no SQL Editor:

1. `0001_schema.sql`: tabelas, RLS, funções de acesso e bucket `documentos` (privado, 20 MB por arquivo).
2. `0002_fluxos_padrao.sql`: a função `criar_fluxos_padrao(org_id)` com dois fluxos de exemplo.
3. `0003_operacoes_rapidas.sql`: as RPCs `mover_etapa` e `criar_processo`, que fazem tudo numa ida ao banco.

### Tabelas

| Tabela | Para que serve |
|---|---|
| `organizacoes` | Cada correspondente (o sistema é multiempresa). Guarda o WhatsApp de contato, os dias do aviso "sem novidade", os dias do lembrete de documento e a mensagem de boas-vindas |
| `org_whatsapp` | URL, chave e instância da Evolution. Só admin lê |
| `membros` | Liga o usuário do Auth à organização, com o papel `admin` ou `operador` |
| `fluxos` / `etapas` | Caminhos de financiamento e as etapas de cada um: nome interno, nome pro cliente, explicação, prazo médio, se o cliente vê, se avisa no WhatsApp, mensagem própria e se é etapa final |
| `corretores` | Com o `token` do link |
| `clientes` | Reaproveitado **só pelo CPF**. Telefone não serve, porque pode ser de casal |
| `processos` | Com `numero` sequencial por organização (trigger), `token_cliente`, `etapa_desde` e `status` (`ativo`, `concluido` ou `cancelado`) |
| `eventos` | Linha do tempo. `publico = true` aparece pro cliente |
| `pendencias` | Documento pedido ao cliente: `aberta`, `enviada` (cliente subiu) ou `resolvida` |
| `documentos` | Arquivos no Storage, caminho `org/processo/arquivo` |
| `notificacoes` | Fila do WhatsApp: `pendente`, `enviada`, `falhou` ou `manual` |

### Segurança (RLS)

- Toda tabela tem `org_id` e política "membro da organização" via `minhas_orgs()`. `org_whatsapp` e a escrita
  em `membros` exigem `sou_admin()`.
- `anon` não lê nada. O navegador só usa a chave pública pra subir arquivo por **link assinado** gerado no servidor.
- **Nunca** use a chave secreta em componente `"use client"`. Ela só aparece em `lib/supabase/admin.ts`
  (que importa `server-only`).

### Organização nova (se for usar pra outro correspondente)

```sql
insert into organizacoes (nome) values ('Nome do correspondente') returning id;
-- crie o usuário admin no Auth (painel ou tela Equipe) e depois:
insert into membros (org_id, user_id, nome, email, papel) values ('<org_id>', '<user_id>', 'Nome', 'email', 'admin');
insert into org_whatsapp (org_id) values ('<org_id>');
select criar_fluxos_padrao('<org_id>');
```

---

## 4. WhatsApp

Tudo passa por `lib/notificacoes.ts`:

1. A ação grava a mensagem em `notificacoes` e chama `dispararPendentes()`.
2. Com a Evolution configurada e ligada (tela **Configurações**), envia por
   `POST {url}/message/sendText/{instancia}` com o header `apikey`.
3. Sem Evolution, a mensagem vira `manual` e aparece na tela **Mensagens** com o botão "Abrir no WhatsApp"
   (link wa.me com o texto pronto).

Mensagens que o sistema manda: boas-vindas, mudança de etapa (cliente e corretor), recado, pedido de documento,
lembrete de documento, "sem novidade" e acesso do corretor.

Os envios que vêm de um clique da equipe rodam com `after()` do `next/server`, **depois** da resposta, pra
não travar a tela. Não troque por `await` direto.

**Rotina diária** (`app/api/cron/diario/route.ts`, 12h UTC = 9h em Brasília): reenvia o que falhou, manda
"sem novidade" pra quem está há X dias sem mensagem e cobra documento atrasado. Os itens 2 e 3 só rodam com a
Evolution ligada e fora do fim de semana.

Use um número de WhatsApp **só pro Prisma**. Evolution é API não oficial, e disparo automático pode
derrubar o número.

---

## 5. Publicar (Vercel + GitHub)

1. Na Vercel: **Add New > Project** e importe este repositório (Framework: Next.js, sem mudar nada).
2. Em **Environment Variables**, cadastre as 5 do `.env.example`. Os valores do Supabase estão em
   Project Settings > API Keys. Gere um `CRON_SECRET` novo.
3. Faça o deploy. Depois ajuste `NEXT_PUBLIC_SITE_URL` pro endereço final (ou domínio próprio) e publique de
   novo. **Os links de cliente e corretor usam essa variável.**
4. A partir daí, todo push na branch principal publica sozinho.

Se o endereço mudar depois de ter clientes usando, os links antigos param. Nesse caso, mantenha o endereço
antigo apontando pro projeto novo, ou reenvie os links pela ficha do processo.

---

## 6. Mapa do código

```
app/
  login/                 login da equipe
  app/                   painel da equipe (protegido)
    page.tsx             visão geral
    processos/           kanban, novo, ficha ([id]) e actions.ts (o coração)
    fluxos/              editor de fluxos e etapas
    corretores/ clientes/ whatsapp/ equipe/ configuracoes/
    documentos/[id]/     abre um documento com link assinado de 5 min
  c/[token]/             portal do corretor
  p/[token]/             página do cliente
  api/cron/diario/       rotina diária
lib/
  processos.ts           criarProcesso / moverEtapa (chamam as RPCs)
  notificacoes.ts        mensagens, fila e envio
  portal.ts              busca por token (cliente e corretor)
  sessao.ts              getSessao / exigirAdmin
  whatsapp.ts            normalizar telefone, Evolution e wa.me
  supabase/              clientes server, browser, admin e middleware
components/              Kanban, Timeline, Upload, FormProcesso, Icon...
supabase/migrations/     SQL do banco
```

---

## 7. Armadilhas já conhecidas

- **Constante usada no servidor não pode morar em arquivo `"use client"`.** Ela chega no servidor como
  referência e quebra (`MODALIDADES.map is not a function`). Por isso a lista está em `lib/modalidades.ts`.
- **Classes próprias do CSS ficam em `@layer components`.** Fora da camada, elas passam por cima das
  utilidades do Tailwind (`w-auto`, `pl-9`...).
- O kanban e a ficha do processo mudam a etapa na tela **antes** do servidor confirmar (`useOptimistic`).
  Se a RPC falhar, voltam e mostram o erro.
- Arrastar card não funciona no toque do celular (é drag and drop do HTML). No celular a equipe usa o botão
  **Avançar** da ficha.
- O cliente não vê etapa interna (`visivel_cliente = false`). Pra ele, a etapa atual é a última visível já
  alcançada (`etapasDoCliente` em `lib/portal.ts`).

---

## 8. Mudança no banco daqui pra frente

Crie um arquivo novo em `supabase/migrations/` (`0004_...sql`), escrito pra poder rodar de novo sem erro
(`if not exists`, `create or replace`), e rode no SQL Editor do Supabase. Não edite migration que já foi aplicada.
