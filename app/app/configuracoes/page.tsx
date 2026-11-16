import type { Metadata } from "next";
import { exigirAdmin } from "@/lib/sessao";
import { SubmitButton } from "@/components/ui";
import { MODELO_BOAS_VINDAS_PADRAO } from "@/lib/notificacoes";
import { salvarOrganizacao, salvarWhatsapp } from "./actions";
import TesteWhatsapp from "./TesteWhatsapp";

export const metadata: Metadata = { title: "Configurações" };

export default async function Configuracoes() {
  const { supabase, org } = await exigirAdmin();
  const { data: wpp } = await supabase.from("org_whatsapp").select("*").eq("org_id", org.id).maybeSingle();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Configurações</h1>

      <form action={salvarOrganizacao} className="card space-y-4 p-5">
        <h2 className="font-display text-lg font-bold">Empresa</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Nome que aparece pro cliente</label>
            <input name="nome" defaultValue={org.nome} className="field" />
          </div>
          <div>
            <label className="label">WhatsApp de contato da equipe</label>
            <input name="whatsapp_contato" defaultValue={org.whatsapp_contato ?? ""} placeholder="(37) 99999-9999" className="field" />
            <p className="mt-1 text-xs text-ink-soft">Aparece no link do cliente como botão "Falar com a equipe".</p>
          </div>
          <div>
            <label className="label">Aviso de "sem novidade" depois de (dias)</label>
            <input name="dias_sem_novidade" type="number" min={0} defaultValue={org.dias_sem_novidade} className="field" />
            <p className="mt-1 text-xs text-ink-soft">
              Se o cliente ficar esse tempo sem nenhuma mensagem, ele recebe um aviso tranquilo dizendo que o processo segue
              andando. 0 desliga.
            </p>
          </div>
          <div>
            <label className="label">Lembrete de documento a cada (dias)</label>
            <input
              name="dias_lembrete_pendencia"
              type="number"
              min={0}
              defaultValue={org.dias_lembrete_pendencia}
              className="field"
            />
            <p className="mt-1 text-xs text-ink-soft">Cobra de novo o documento pedido que não chegou. 0 desliga.</p>
          </div>
        </div>
        <div>
          <label className="label">Mensagem de boas-vindas</label>
          <textarea name="msg_boas_vindas" rows={4} defaultValue={org.msg_boas_vindas ?? ""} placeholder={MODELO_BOAS_VINDAS_PADRAO} className="field" />
          <p className="mt-1 text-xs text-ink-soft">Pode usar: {"{nome}"} {"{empresa}"} {"{link}"}</p>
        </div>
        <SubmitButton>Salvar</SubmitButton>
      </form>

      <form action={salvarWhatsapp} className="card space-y-4 p-5">
        <div>
          <h2 className="font-display text-lg font-bold">WhatsApp automático (Evolution API)</h2>
          <p className="text-sm text-ink-soft">
            Use um número só para isso, separado do WhatsApp comercial. Enquanto estiver desligado, as mensagens ficam em
            Mensagens para você mandar com um clique.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">URL da Evolution</label>
            <input name="evolution_url" defaultValue={wpp?.evolution_url ?? ""} placeholder="https://evo.seudominio.com" className="field" />
          </div>
          <div>
            <label className="label">Instância</label>
            <input name="instancia" defaultValue={wpp?.instancia ?? ""} className="field" />
          </div>
          <div>
            <label className="label">Chave (apikey)</label>
            <input
              name="evolution_key"
              type="password"
              autoComplete="off"
              placeholder={wpp?.evolution_key ? "Salva. Deixe em branco para manter" : ""}
              className="field"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={wpp?.ativo ?? false} /> Envio automático ligado
        </label>
        <SubmitButton>Salvar WhatsApp</SubmitButton>
      </form>

      <TesteWhatsapp />
    </div>
  );
}
