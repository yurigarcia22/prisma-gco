"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";

type Preparar = (nome: string) => Promise<{ path?: string; token?: string; erro?: string }>;
type Registrar = (path: string, nome: string, tamanho: number) => Promise<{ ok?: boolean; erro?: string } | void>;

const LIMITE = 20 * 1024 * 1024;

/** Sobe o arquivo direto do navegador pro Storage, com link assinado gerado no servidor. */
export default function Upload({
  preparar,
  registrar,
  rotulo = "Enviar documento",
  className = "btn btn-ghost btn-sm",
}: {
  preparar: Preparar;
  registrar: Registrar;
  rotulo?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [estado, setEstado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setErro(null);
    const supabase = createClient();
    for (const [i, f] of Array.from(arquivos).entries()) {
      if (f.size > LIMITE) {
        setErro(`${f.name} passa de 20 MB.`);
        continue;
      }
      setEstado(arquivos.length > 1 ? `Enviando ${i + 1} de ${arquivos.length}...` : "Enviando...");
      const p = await preparar(f.name);
      if (!p.path || !p.token) {
        setErro(p.erro ?? "Não deu para enviar.");
        continue;
      }
      const { error } = await supabase.storage.from("documentos").uploadToSignedUrl(p.path, p.token, f, {
        contentType: f.type || "application/octet-stream",
      });
      if (error) {
        setErro(`Falha ao enviar ${f.name}.`);
        continue;
      }
      await registrar(p.path, f.name, f.size);
    }
    setEstado(null);
    if (ref.current) ref.current.value = "";
    router.refresh();
  }

  return (
    <div>
      <input
        ref={ref}
        type="file"
        multiple
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
        className="hidden"
        onChange={(e) => enviar(e.target.files)}
      />
      <button type="button" className={className} disabled={!!estado} onClick={() => ref.current?.click()}>
        <Icon name="upload" size={15} />
        {estado ?? rotulo}
      </button>
      {erro ? <p className="mt-2 text-xs text-bad">{erro}</p> : null}
    </div>
  );
}
