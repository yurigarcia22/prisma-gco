import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSessao } from "@/lib/sessao";
import Icon from "@/components/Icon";
import EtapaControle from "./EtapaControle";
import Timeline from "@/components/Timeline";
import Upload from "@/components/Upload";
import { ConfirmarBotao, CopiarBotao, SubmitButton } from "@/components/ui";
import { MODALIDADES } from "@/lib/modalidades";
import { cpfBonito, data, dataHora, moeda, primeiroNome, telefoneBonito } from "@/lib/format";
import { linkCliente } from "@/lib/links";
import { linkWaMe } from "@/lib/whatsapp";
import { MODELO_BOAS_VINDAS_PADRAO, renderMensagem } from "@/lib/notificacoes";
import type { Cliente, Documento, Etapa, Evento, Notificacao, Pendencia, Processo } from "@/lib/types";
import {
  adicionarAtualizacao,
  atualizarProcesso,
  criarPendencia,
  excluirDocumento,
  excluirEvento,
  excluirPendencia,
  excluirProcesso,
  marcarEnviadaManual,
  mudarStatus,
  novoLinkCliente,
  prepararUploadEquipe,
  reenviarBoasVindas,
  reenviarNotificacao,
  registrarDocumentoEquipe,
  resolverPendencia,
} from "../actions";

export const metadata: Metadata = { title: "Processo" };

type ProcessoCompleto = Processo & {
  clientes: Cliente;
  corretores: { id: string; nome: string; telefone: string | null } | null;
  fluxos: { nome: string };
};

const STATUS_NOTIF: Record<string, string> = {
  enviada: "bg-emerald-50 text-ok",
  pendente: "bg-sky text-brand",
  falhou: "bg-red-50 text-bad",
  manual: "bg-amber-50 text-warn",
};
const ROTULO_NOTIF: Record<string, string> = {
  enviada: "enviada",
  pendente: "na fila",
  falhou: "falhou",
  manual: "enviar à mão",
};

export default async function ProcessoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, membro, org } = await getSessao();

  const { data: p } = await supabase
    .from("processos")
    .select("*, clientes(*), corretores(id, nome, telefone), fluxos(nome)")
    .eq("id", id)
    .maybeSingle<ProcessoCompleto>();
  if (!p) notFound();

  const [{ data: etapas }, { data: eventos }, { data: pendencias }, { data: documentos }, { data: notifs }, { data: corretores }] =
    await Promise.all([
      supabase.from("etapas").select("*").eq("fluxo_id", p.fluxo_id).order("ordem").returns<Etapa[]>(),
      supabase.from("eventos").select("*").eq("processo_id", id).order("criado_em", { ascending: false }).returns<Evento[]>(),
      supabase.from("pendencias").select("*").eq("processo_id", id).order("criado_em").returns<Pendencia[]>(),
      supabase.from("documentos").select("*").eq("processo_id", id).order("criado_em", { ascending: false }).returns<Documento[]>(),
      supabase
        .from("notificacoes")
        .select("*")
        .eq("processo_id", id)
        .order("criado_em", { ascending: false })
        .limit(15)
        .returns<Notificacao[]>(),
      supabase.from("corretores").select("id, nome").order("nome"),
    ]);

  const listaEtapas = etapas ?? [];
  const nomes = new Map(listaEtapas.map((e) => [e.id, e.nome]));
  const link = linkCliente(p.token_cliente);
  const abertas = (pendencias ?? []).filter((x) => x.status !== "resolvida");
  const resolvidas = (pendencias ?? []).filter((x) => x.status === "resolvida");
  const msgBoasVindas = renderMensagem(org.msg_boas_vindas || MODELO_BOAS_VINDAS_PADRAO, {
    nome: primeiroNome(p.clientes.nome),
    empresa: org.nome,
    link,
  });
  const voltar = `/app/processos/${id}`;

  return (
    <div className="mx-auto max-w-6xl">
      <Link href={`/app/processos?fluxo=${p.fluxo_id}`} className="flex items-center gap-1 text-sm text-ink-soft hover:text-brand">
        <Icon name="arrowLeft" size={15} /> {p.fluxos.nome}
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{p.clientes.nome}</h1>
            <span className="chip bg-[#e9eff3] text-ink-soft">#{p.numero}</span>
            {p.status !== "ativo" ? (
              <span className={`chip ${p.status === "concluido" ? "bg-emerald-50 text-ok" : "bg-red-50 text-bad"}`}>
                {p.status === "concluido" ? "Concluído" : "Cancelado"}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {[p.modalidade, p.corretores?.nome ? `Corretor: ${p.corretores.nome}` : "Sem corretor", `Aberto em ${data(p.criado_em)}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <EtapaControle
        key={`${p.etapa_id}-${p.etapa_desde}`}
        processoId={p.id}
        etapas={listaEtapas.map((e) => ({ id: e.id, nome: e.nome, ordem: e.ordem, prazo_dias: e.prazo_dias }))}
        etapaAtual={p.etapa_id}
        etapaDesde={p.etapa_desde}
        ativo={p.status === "ativo"}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Coluna principal */}
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <h2 className="font-display text-lg font-bold">Atualizações</h2>
            <form action={adicionarAtualizacao} className="mt-3 space-y-3">
              <input type="hidden" name="processo_id" value={p.id} />
              <textarea name="texto" required placeholder="Escreva um recado para o cliente ou uma nota interna" className="field" />
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="tipo" value="recado" defaultChecked /> Recado para o cliente
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="tipo" value="nota" /> Nota interna
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="whatsapp" defaultChecked /> Mandar o recado no WhatsApp
                </label>
                <SubmitButton className="btn btn-primary btn-sm ml-auto">Publicar</SubmitButton>
              </div>
            </form>
            <div className="mt-6">
              <Timeline
                eventos={eventos ?? []}
                nomesEtapa={nomes}
                acaoExcluir={(eid) => (
                  <form action={excluirEvento} className="inline">
                    <input type="hidden" name="processo_id" value={p.id} />
                    <input type="hidden" name="evento_id" value={eid} />
                    <ConfirmarBotao mensagem="Apagar esta atualização?" className="text-xs text-ink-soft underline hover:text-bad">
                      apagar
                    </ConfirmarBotao>
                  </form>
                )}
              />
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-display text-lg font-bold">Mensagens de WhatsApp deste processo</h2>
            {!notifs?.length ? (
              <p className="mt-2 text-sm text-ink-soft">Nenhuma mensagem ainda.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {notifs.map((n) => (
                  <li key={n.id} className="py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`chip ${STATUS_NOTIF[n.status]}`}>{ROTULO_NOTIF[n.status]}</span>
                      <span className="font-medium">{n.destino === "cliente" ? "Cliente" : "Corretor"}</span>
                      <span className="text-ink-soft">{telefoneBonito(n.telefone)}</span>
                      <span className="ml-auto text-xs text-ink-soft">{dataHora(n.criado_em)}</span>
                    </div>
                    <p className="mt-1 line-clamp-3 whitespace-pre-line text-ink-soft">{n.mensagem}</p>
                    {n.status === "falhou" && n.erro ? <p className="mt-1 text-xs text-bad">{n.erro}</p> : null}
                    {n.status === "manual" || n.status === "falhou" ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <a href={linkWaMe(n.telefone, n.mensagem)} target="_blank" rel="noreferrer" className="btn btn-wpp btn-sm">
                          <Icon name="chat" size={14} /> Abrir no WhatsApp
                        </a>
                        <form action={marcarEnviadaManual}>
                          <input type="hidden" name="notificacao_id" value={n.id} />
                          <input type="hidden" name="voltar" value={voltar} />
                          <button className="btn btn-ghost btn-sm">
                            <Icon name="check" size={14} /> Já enviei
                          </button>
                        </form>
                        <form action={reenviarNotificacao}>
                          <input type="hidden" name="notificacao_id" value={n.id} />
                          <input type="hidden" name="voltar" value={voltar} />
                          <button className="btn btn-ghost btn-sm">Tentar automático</button>
                        </form>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Coluna lateral */}
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="font-display flex items-center gap-2 text-lg font-bold">
              <Icon name="link" size={17} /> Acesso do cliente
            </h2>
            <p className="mt-1 text-sm text-ink-soft">O cliente acompanha tudo por este link, sem senha.</p>
            <div className="mt-3 break-all rounded-lg bg-canvas px-3 py-2 text-xs text-ink-soft">{link}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopiarBotao texto={link} />
              <a href={link} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                <Icon name="eye" size={15} /> Ver como cliente
              </a>
              {p.clientes.telefone ? (
                <a href={linkWaMe(p.clientes.telefone, msgBoasVindas)} target="_blank" rel="noreferrer" className="btn btn-wpp btn-sm">
                  <Icon name="chat" size={15} /> Mandar pelo meu WhatsApp
                </a>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 border-t border-line pt-3 text-xs">
              <form action={reenviarBoasVindas}>
                <input type="hidden" name="processo_id" value={p.id} />
                <button className="text-brand underline">Reenviar boas-vindas automática</button>
              </form>
              <form action={novoLinkCliente}>
                <input type="hidden" name="processo_id" value={p.id} />
                <ConfirmarBotao
                  mensagem="Gerar um link novo? O link antigo para de funcionar."
                  className="text-ink-soft underline hover:text-bad"
                >
                  Gerar link novo
                </ConfirmarBotao>
              </form>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-display text-lg font-bold">Pendências do cliente</h2>
            {abertas.length ? (
              <ul className="mt-3 space-y-2">
                {abertas.map((x) => (
                  <li key={x.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                    <div className="font-medium">{x.descricao}</div>
                    <div className="mt-0.5 text-xs text-warn">
                      {x.status === "enviada" ? "Cliente enviou arquivo, confira" : `Pedido em ${data(x.criado_em)}`}
                    </div>
                    <div className="mt-2 flex gap-3 text-xs">
                      <form action={resolverPendencia}>
                        <input type="hidden" name="processo_id" value={p.id} />
                        <input type="hidden" name="pendencia_id" value={x.id} />
                        <button className="font-semibold text-ok underline">Marcar como recebido</button>
                      </form>
                      <form action={excluirPendencia}>
                        <input type="hidden" name="processo_id" value={p.id} />
                        <input type="hidden" name="pendencia_id" value={x.id} />
                        <button className="text-ink-soft underline">Remover</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">Nenhuma pendência aberta.</p>
            )}
            <form action={criarPendencia} className="mt-4 space-y-2">
              <input type="hidden" name="processo_id" value={p.id} />
              <input name="descricao" required placeholder="Ex.: holerite de outubro" className="field" />
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" name="whatsapp" defaultChecked /> Pedir no WhatsApp do cliente
              </label>
              <SubmitButton className="btn btn-ghost btn-sm w-full">
                <Icon name="plus" size={14} /> Pedir documento
              </SubmitButton>
            </form>
            {resolvidas.length ? (
              <details className="mt-3 text-xs text-ink-soft">
                <summary className="cursor-pointer">{resolvidas.length} resolvida(s)</summary>
                <ul className="mt-2 space-y-1">
                  {resolvidas.map((x) => (
                    <li key={x.id} className="flex items-center gap-1">
                      <Icon name="check" size={12} className="text-ok" /> {x.descricao}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold">Documentos</h2>
              <Upload
                preparar={prepararUploadEquipe.bind(null, p.id)}
                registrar={registrarDocumentoEquipe.bind(null, p.id)}
                rotulo="Enviar"
              />
            </div>
            {!documentos?.length ? (
              <p className="mt-2 text-sm text-ink-soft">Nenhum documento.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {documentos.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 py-2 text-sm">
                    <Icon name="file" size={16} className="shrink-0 text-brand" />
                    <a href={`/app/documentos/${d.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:text-brand">
                      {d.nome}
                    </a>
                    <span className="shrink-0 text-[11px] text-ink-soft">{d.enviado_por}</span>
                    <form action={excluirDocumento}>
                      <input type="hidden" name="processo_id" value={p.id} />
                      <input type="hidden" name="documento_id" value={d.id} />
                      <ConfirmarBotao mensagem={`Apagar ${d.nome}?`} className="p-1 text-ink-soft hover:text-bad">
                        <Icon name="trash" size={14} />
                      </ConfirmarBotao>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-display text-lg font-bold">Dados</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">WhatsApp</dt>
                <dd>{telefoneBonito(p.clientes.telefone)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">CPF</dt>
                <dd>{cpfBonito(p.clientes.cpf)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Valor do imóvel</dt>
                <dd className="tnum">{moeda(p.valor_imovel)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Financiado</dt>
                <dd className="tnum">{moeda(p.valor_financiado)}</dd>
              </div>
              {p.imovel ? (
                <div>
                  <dt className="text-ink-soft">Imóvel</dt>
                  <dd>{p.imovel}</dd>
                </div>
              ) : null}
              {p.observacoes ? (
                <div>
                  <dt className="text-ink-soft">Observações</dt>
                  <dd className="whitespace-pre-line">{p.observacoes}</dd>
                </div>
              ) : null}
            </dl>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-brand">Editar dados</summary>
              <form action={atualizarProcesso} className="mt-3 space-y-3">
                <input type="hidden" name="processo_id" value={p.id} />
                <input type="hidden" name="cliente_id" value={p.cliente_id} />
                <div>
                  <label className="label">Nome</label>
                  <input name="cliente_nome" defaultValue={p.clientes.nome} className="field" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">WhatsApp</label>
                    <input name="cliente_telefone" defaultValue={p.clientes.telefone ?? ""} className="field" />
                  </div>
                  <div>
                    <label className="label">CPF</label>
                    <input name="cliente_cpf" defaultValue={p.clientes.cpf ?? ""} className="field" />
                  </div>
                </div>
                <div>
                  <label className="label">E-mail</label>
                  <input name="cliente_email" defaultValue={p.clientes.email ?? ""} className="field" />
                </div>
                <div>
                  <label className="label">Corretor</label>
                  <select name="corretor_id" defaultValue={p.corretor_id ?? ""} className="field">
                    <option value="">Sem corretor</option>
                    {(corretores ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Modalidade</label>
                  <select name="modalidade" defaultValue={p.modalidade ?? ""} className="field">
                    <option value="">-</option>
                    {MODALIDADES.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                    {p.modalidade && !MODALIDADES.includes(p.modalidade) ? <option>{p.modalidade}</option> : null}
                  </select>
                </div>
                <div>
                  <label className="label">Imóvel</label>
                  <input name="imovel" defaultValue={p.imovel ?? ""} className="field" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Valor do imóvel</label>
                    <input
                      name="valor_imovel"
                      defaultValue={p.valor_imovel != null ? String(p.valor_imovel).replace(".", ",") : ""}
                      className="field"
                    />
                  </div>
                  <div>
                    <label className="label">Financiado</label>
                    <input
                      name="valor_financiado"
                      defaultValue={p.valor_financiado != null ? String(p.valor_financiado).replace(".", ",") : ""}
                      className="field"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Observações</label>
                  <textarea name="observacoes" defaultValue={p.observacoes ?? ""} className="field" />
                </div>
                <SubmitButton className="btn btn-primary btn-sm w-full">Salvar</SubmitButton>
              </form>
            </details>
          </section>

          <section className="card p-5">
            <h2 className="font-display text-lg font-bold">Situação</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {p.status === "ativo" ? (
                <form action={mudarStatus}>
                  <input type="hidden" name="processo_id" value={p.id} />
                  <input type="hidden" name="status" value="cancelado" />
                  <ConfirmarBotao mensagem="Cancelar este processo? Ele sai do kanban." className="btn btn-ghost btn-sm">
                    Cancelar processo
                  </ConfirmarBotao>
                </form>
              ) : (
                <form action={mudarStatus}>
                  <input type="hidden" name="processo_id" value={p.id} />
                  <input type="hidden" name="status" value="ativo" />
                  <button className="btn btn-ghost btn-sm">Reabrir processo</button>
                </form>
              )}
              {membro.papel === "admin" ? (
                <form action={excluirProcesso}>
                  <input type="hidden" name="processo_id" value={p.id} />
                  <ConfirmarBotao
                    mensagem="Excluir de vez este processo, com histórico e documentos? Não tem volta."
                    className="btn btn-ghost btn-sm text-bad"
                  >
                    <Icon name="trash" size={14} /> Excluir
                  </ConfirmarBotao>
                </form>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
