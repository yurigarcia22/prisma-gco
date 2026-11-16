-- Fluxos de exemplo para uma organização nova.
-- São só ponto de partida: o correspondente edita tudo pelo painel.
create or replace function public.criar_fluxos_padrao(o uuid) returns void
language plpgsql security definer set search_path = public as $$
declare f uuid;
begin
  -- Fluxo 1: imóvel pronto (usado ou novo)
  insert into fluxos (org_id, nome, descricao)
  values (o, 'Imóvel pronto (SBPE / MCMV)', 'Compra de imóvel usado ou novo já construído')
  returning id into f;

  insert into etapas (org_id, fluxo_id, ordem, nome, nome_cliente, descricao_cliente, prazo_dias, mensagem, final) values
  (o, f, 1, 'Cadastro e documentação', 'Documentação',
     'Estamos reunindo e conferindo os seus documentos e os do imóvel para montar a proposta.', 5, null, false),
  (o, f, 2, 'Análise de crédito', 'Análise de crédito na Caixa',
     'Sua proposta foi enviada para a Caixa, que analisa renda, cadastro e capacidade de pagamento.', 7, null, false),
  (o, f, 3, 'Crédito aprovado', 'Crédito aprovado',
     'A Caixa aprovou o seu crédito. Agora seguimos com a parte do imóvel.', 2,
     'Oi, {nome}! Boa notícia: o seu crédito foi *aprovado* pela Caixa. Agora seguimos com a parte do imóvel. Acompanhe por aqui: {link}', false),
  (o, f, 4, 'Avaliação de engenharia', 'Vistoria do imóvel',
     'Um engenheiro credenciado pela Caixa visita o imóvel para conferir o estado e o valor.', 7, null, false),
  (o, f, 5, 'Conformidade', 'Conferência final da Caixa',
     'A Caixa confere toda a documentação antes de preparar o contrato.', 5, null, false),
  (o, f, 6, 'Emissão do contrato', 'Preparando o seu contrato',
     'A Caixa está emitindo o contrato de financiamento.', 5, null, false),
  (o, f, 7, 'Assinatura', 'Assinatura do contrato',
     'O contrato está pronto. Vamos combinar com você a data da assinatura.', 3, null, false),
  (o, f, 8, 'Registro em cartório', 'Registro no cartório',
     'O contrato assinado vai para o cartório de imóveis, que registra a compra no seu nome.', 20, null, false),
  (o, f, 9, 'Liberação do recurso', 'Pagamento ao vendedor',
     'Com o registro pronto, a Caixa libera o pagamento para o vendedor.', 5, null, false),
  (o, f, 10, 'Concluído', 'Processo concluído',
     'Tudo certo! O seu financiamento foi concluído.', null,
     'Oi, {nome}! O seu financiamento foi *concluído*. Parabéns pela conquista, e obrigado pela confiança!', true);

  -- Fluxo 2: imóvel na planta
  insert into fluxos (org_id, nome, descricao)
  values (o, 'Imóvel na planta (MCMV)', 'Compra de imóvel em construção, direto com a construtora')
  returning id into f;

  insert into etapas (org_id, fluxo_id, ordem, nome, nome_cliente, descricao_cliente, prazo_dias, mensagem, final) values
  (o, f, 1, 'Cadastro e documentação', 'Documentação',
     'Estamos reunindo e conferindo os seus documentos para montar a proposta.', 5, null, false),
  (o, f, 2, 'Análise de crédito', 'Análise de crédito na Caixa',
     'Sua proposta foi enviada para a Caixa, que analisa renda, cadastro e capacidade de pagamento.', 7, null, false),
  (o, f, 3, 'Crédito aprovado', 'Crédito aprovado',
     'A Caixa aprovou o seu crédito.', 2,
     'Oi, {nome}! Boa notícia: o seu crédito foi *aprovado* pela Caixa. Acompanhe os próximos passos por aqui: {link}', false),
  (o, f, 4, 'Assinatura', 'Assinatura do contrato',
     'O contrato está pronto. Vamos combinar com você a data da assinatura.', 5, null, false),
  (o, f, 5, 'Registro em cartório', 'Registro no cartório',
     'O contrato assinado vai para o cartório de imóveis.', 20, null, false),
  (o, f, 6, 'Obra em andamento', 'Obra em andamento',
     'O seu imóvel está sendo construído. Avisamos aqui quando houver novidade da entrega.', null, null, false),
  (o, f, 7, 'Entrega das chaves', 'Entrega das chaves',
     'O seu imóvel ficou pronto. Parabéns!', null,
     'Oi, {nome}! Chegou o dia: o seu imóvel está pronto para a *entrega das chaves*. Parabéns pela conquista!', true);
end $$;

revoke all on function public.criar_fluxos_padrao(uuid) from public, anon, authenticated;
