-- =====================================================================
-- PRISMA · acompanhamento de processos de financiamento
-- Multi-correspondente: tudo pendurado em organizacoes.id (org_id)
-- Equipe interna entra pelo Supabase Auth (tabela membros).
-- Corretor e cliente entram por link com token (rotas do servidor,
-- usando a chave secreta e filtrando pelo token).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Organizações (cada correspondente)
-- ---------------------------------------------------------------------
create table if not exists public.organizacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  whatsapp_contato text,              -- número que aparece pro cliente falar com a equipe
  dias_sem_novidade int not null default 5,
  dias_lembrete_pendencia int not null default 2,
  msg_boas_vindas text,
  criado_em timestamptz not null default now()
);

-- Configuração do WhatsApp (só admin lê: tem a chave do Evolution)
create table if not exists public.org_whatsapp (
  org_id uuid primary key references public.organizacoes(id) on delete cascade,
  evolution_url text,
  evolution_key text,
  instancia text,
  ativo boolean not null default false,
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Equipe interna
-- ---------------------------------------------------------------------
create table if not exists public.membros (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  email text,
  papel text not null default 'operador' check (papel in ('admin','operador')),
  criado_em timestamptz not null default now(),
  unique (org_id, user_id)
);

-- ---------------------------------------------------------------------
-- Fluxos e etapas (personalizáveis)
-- ---------------------------------------------------------------------
create table if not exists public.fluxos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  nome text not null,
  descricao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.etapas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  fluxo_id uuid not null references public.fluxos(id) on delete cascade,
  ordem int not null default 0,
  nome text not null,                  -- nome interno
  nome_cliente text,                   -- como o cliente vê (se vazio, usa o nome)
  descricao_cliente text,              -- explicação simples
  prazo_dias int,                      -- prazo médio da etapa
  visivel_cliente boolean not null default true,
  notificar boolean not null default true,
  mensagem text,                       -- modelo do WhatsApp ao entrar na etapa
  final boolean not null default false,-- entrar aqui conclui o processo
  criado_em timestamptz not null default now()
);
create index if not exists etapas_fluxo_idx on public.etapas(fluxo_id, ordem);

-- ---------------------------------------------------------------------
-- Corretores e clientes
-- ---------------------------------------------------------------------
create table if not exists public.corretores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  imobiliaria text,
  token text not null unique default encode(gen_random_bytes(24),'hex'),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  nome text not null,
  cpf text,
  telefone text,
  email text,
  criado_em timestamptz not null default now()
);
create index if not exists clientes_org_idx on public.clientes(org_id);

-- ---------------------------------------------------------------------
-- Processos
-- ---------------------------------------------------------------------
create table if not exists public.processos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  numero int not null default 0,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  corretor_id uuid references public.corretores(id) on delete set null,
  fluxo_id uuid not null references public.fluxos(id) on delete restrict,
  etapa_id uuid references public.etapas(id) on delete set null,
  modalidade text,
  imovel text,
  valor_imovel numeric(14,2),
  valor_financiado numeric(14,2),
  observacoes text,
  status text not null default 'ativo' check (status in ('ativo','concluido','cancelado')),
  token_cliente text not null unique default encode(gen_random_bytes(24),'hex'),
  etapa_desde timestamptz not null default now(),
  ultimo_aviso_cliente timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists processos_org_idx on public.processos(org_id, status);
create index if not exists processos_corretor_idx on public.processos(corretor_id);

-- número sequencial por organização
create or replace function public.processo_numero() returns trigger
language plpgsql as $$
begin
  if new.numero is null or new.numero = 0 then
    select coalesce(max(numero),0) + 1 into new.numero
      from public.processos where org_id = new.org_id;
  end if;
  return new;
end $$;
drop trigger if exists processo_numero_trg on public.processos;
create trigger processo_numero_trg before insert on public.processos
  for each row execute function public.processo_numero();

-- ---------------------------------------------------------------------
-- Linha do tempo, pendências, documentos, notificações
-- ---------------------------------------------------------------------
create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  processo_id uuid not null references public.processos(id) on delete cascade,
  tipo text not null check (tipo in ('criado','etapa','recado','nota','pendencia','pendencia_resolvida','documento','status')),
  etapa_id uuid references public.etapas(id) on delete set null,
  texto text,
  publico boolean not null default false,
  autor text,
  criado_em timestamptz not null default now()
);
create index if not exists eventos_processo_idx on public.eventos(processo_id, criado_em desc);

create table if not exists public.pendencias (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  processo_id uuid not null references public.processos(id) on delete cascade,
  descricao text not null,
  status text not null default 'aberta' check (status in ('aberta','enviada','resolvida')),
  ultimo_lembrete timestamptz,
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz
);
create index if not exists pendencias_processo_idx on public.pendencias(processo_id);

create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  processo_id uuid not null references public.processos(id) on delete cascade,
  pendencia_id uuid references public.pendencias(id) on delete set null,
  nome text not null,
  path text not null,
  tamanho bigint,
  enviado_por text not null default 'equipe' check (enviado_por in ('equipe','corretor','cliente')),
  criado_em timestamptz not null default now()
);
create index if not exists documentos_processo_idx on public.documentos(processo_id);

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  processo_id uuid references public.processos(id) on delete cascade,
  destino text not null check (destino in ('cliente','corretor','equipe')),
  motivo text,
  telefone text not null,
  mensagem text not null,
  status text not null default 'pendente' check (status in ('pendente','enviada','falhou','manual')),
  tentativas int not null default 0,
  erro text,
  enviada_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists notificacoes_status_idx on public.notificacoes(org_id, status);

-- ---------------------------------------------------------------------
-- Funções de acesso (RLS)
-- ---------------------------------------------------------------------
create or replace function public.minhas_orgs() returns setof uuid
language sql stable security definer set search_path = public as $$
  select org_id from public.membros where user_id = auth.uid()
$$;

create or replace function public.sou_admin(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.membros
    where org_id = o and user_id = auth.uid() and papel = 'admin')
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.organizacoes enable row level security;
alter table public.org_whatsapp enable row level security;
alter table public.membros enable row level security;
alter table public.fluxos enable row level security;
alter table public.etapas enable row level security;
alter table public.corretores enable row level security;
alter table public.clientes enable row level security;
alter table public.processos enable row level security;
alter table public.eventos enable row level security;
alter table public.pendencias enable row level security;
alter table public.documentos enable row level security;
alter table public.notificacoes enable row level security;

drop policy if exists org_ler on public.organizacoes;
create policy org_ler on public.organizacoes for select to authenticated
  using (id in (select public.minhas_orgs()));
drop policy if exists org_editar on public.organizacoes;
create policy org_editar on public.organizacoes for update to authenticated
  using (public.sou_admin(id)) with check (public.sou_admin(id));

drop policy if exists wpp_admin on public.org_whatsapp;
create policy wpp_admin on public.org_whatsapp for all to authenticated
  using (public.sou_admin(org_id)) with check (public.sou_admin(org_id));

drop policy if exists membros_ler on public.membros;
create policy membros_ler on public.membros for select to authenticated
  using (org_id in (select public.minhas_orgs()));
drop policy if exists membros_admin on public.membros;
create policy membros_admin on public.membros for all to authenticated
  using (public.sou_admin(org_id)) with check (public.sou_admin(org_id));

-- Tabelas operacionais: qualquer membro da organização
do $$
declare t text;
begin
  foreach t in array array['fluxos','etapas','corretores','clientes','processos','eventos','pendencias','documentos','notificacoes']
  loop
    execute format('drop policy if exists %I_membro on public.%I', t, t);
    execute format(
      'create policy %I_membro on public.%I for all to authenticated
         using (org_id in (select public.minhas_orgs()))
         with check (org_id in (select public.minhas_orgs()))', t, t);
  end loop;
end $$;

-- Permissões: anon não lê nada; authenticated passa pela RLS
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant execute on function public.minhas_orgs() to authenticated;
grant execute on function public.sou_admin(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Storage: bucket privado de documentos (acesso só pelo servidor)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 20971520)
on conflict (id) do nothing;
