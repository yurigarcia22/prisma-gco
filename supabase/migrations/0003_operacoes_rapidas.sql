-- Operações em uma ida ao banco só (antes eram 6 a 12 chamadas em sequência).
-- security invoker: quem chama com a sessão da equipe passa pela RLS;
-- o servidor com a chave secreta (portal do corretor) ignora a RLS e valida antes.

create or replace function public.mover_etapa(p_processo uuid, p_etapa uuid, p_autor text)
returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  pr public.processos;
  e public.etapas;
begin
  select * into pr from public.processos where id = p_processo for update;
  if not found then raise exception 'Processo não encontrado'; end if;

  select * into e from public.etapas where id = p_etapa and fluxo_id = pr.fluxo_id;
  if not found then raise exception 'Etapa não pertence ao fluxo deste processo'; end if;

  if pr.etapa_id = e.id then
    return jsonb_build_object('mudou', false);
  end if;

  update public.processos
     set etapa_id = e.id,
         etapa_desde = now(),
         status = case when e.final then 'concluido' else 'ativo' end,
         atualizado_em = now()
   where id = pr.id;

  insert into public.eventos (org_id, processo_id, tipo, etapa_id, texto, publico, autor)
  values (pr.org_id, pr.id, 'etapa', e.id, e.nome, e.visivel_cliente, p_autor);

  return jsonb_build_object('mudou', true, 'etapa', to_jsonb(e));
end $$;

create or replace function public.criar_processo(
  p_org uuid, p_fluxo uuid, p_corretor uuid,
  p_nome text, p_cpf text, p_telefone text, p_email text,
  p_modalidade text, p_imovel text, p_valor_imovel numeric, p_valor_financiado numeric,
  p_observacoes text, p_autor text
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  primeira public.etapas;
  cli uuid;
  pid uuid;
  pnum int;
begin
  if not exists (select 1 from public.fluxos where id = p_fluxo and org_id = p_org) then
    raise exception 'Fluxo não encontrado';
  end if;

  select * into primeira from public.etapas where fluxo_id = p_fluxo order by ordem limit 1;
  if not found then raise exception 'Esse fluxo ainda não tem etapas'; end if;

  if p_corretor is not null and not exists (select 1 from public.corretores where id = p_corretor and org_id = p_org) then
    raise exception 'Corretor não encontrado';
  end if;

  -- Só reaproveita cliente pelo CPF (telefone pode ser de casal ou família)
  if p_cpf is not null and p_cpf <> '' then
    select id into cli from public.clientes where org_id = p_org and cpf = p_cpf limit 1;
  end if;

  if cli is not null then
    update public.clientes
       set nome = p_nome,
           telefone = coalesce(p_telefone, telefone),
           email = coalesce(p_email, email)
     where id = cli;
  else
    insert into public.clientes (org_id, nome, cpf, telefone, email)
    values (p_org, p_nome, nullif(p_cpf, ''), p_telefone, p_email)
    returning id into cli;
  end if;

  insert into public.processos (org_id, cliente_id, corretor_id, fluxo_id, etapa_id, modalidade, imovel,
                                valor_imovel, valor_financiado, observacoes)
  values (p_org, cli, p_corretor, p_fluxo, primeira.id, p_modalidade, p_imovel,
          p_valor_imovel, p_valor_financiado, p_observacoes)
  returning id, numero into pid, pnum;

  insert into public.eventos (org_id, processo_id, tipo, etapa_id, texto, publico, autor, criado_em) values
    (p_org, pid, 'criado', null, 'Processo aberto', true, p_autor, now()),
    (p_org, pid, 'etapa', primeira.id, primeira.nome, primeira.visivel_cliente, p_autor, now() + interval '1 millisecond');

  return jsonb_build_object('id', pid, 'numero', pnum);
end $$;

revoke all on function public.mover_etapa(uuid, uuid, text) from public, anon;
revoke all on function public.criar_processo(uuid, uuid, uuid, text, text, text, text, text, text, numeric, numeric, text, text) from public, anon;
grant execute on function public.mover_etapa(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.criar_processo(uuid, uuid, uuid, text, text, text, text, text, text, numeric, numeric, text, text) to authenticated, service_role;
