export type Papel = "admin" | "operador";

export interface Organizacao {
  id: string;
  nome: string;
  whatsapp_contato: string | null;
  dias_sem_novidade: number;
  dias_lembrete_pendencia: number;
  msg_boas_vindas: string | null;
}

export interface Membro {
  id: string;
  org_id: string;
  user_id: string;
  nome: string;
  email: string | null;
  papel: Papel;
}

export interface Fluxo {
  id: string;
  org_id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

export interface Etapa {
  id: string;
  org_id: string;
  fluxo_id: string;
  ordem: number;
  nome: string;
  nome_cliente: string | null;
  descricao_cliente: string | null;
  prazo_dias: number | null;
  visivel_cliente: boolean;
  notificar: boolean;
  mensagem: string | null;
  final: boolean;
}

export interface Corretor {
  id: string;
  org_id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  imobiliaria: string | null;
  token: string;
  ativo: boolean;
}

export interface Cliente {
  id: string;
  org_id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  criado_em: string;
}

export type StatusProcesso = "ativo" | "concluido" | "cancelado";

export interface Processo {
  id: string;
  org_id: string;
  numero: number;
  cliente_id: string;
  corretor_id: string | null;
  fluxo_id: string;
  etapa_id: string | null;
  modalidade: string | null;
  imovel: string | null;
  valor_imovel: number | null;
  valor_financiado: number | null;
  observacoes: string | null;
  status: StatusProcesso;
  token_cliente: string;
  etapa_desde: string;
  ultimo_aviso_cliente: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type TipoEvento =
  | "criado"
  | "etapa"
  | "recado"
  | "nota"
  | "pendencia"
  | "pendencia_resolvida"
  | "documento"
  | "status";

export interface Evento {
  id: string;
  processo_id: string;
  tipo: TipoEvento;
  etapa_id: string | null;
  texto: string | null;
  publico: boolean;
  autor: string | null;
  criado_em: string;
}

export interface Pendencia {
  id: string;
  processo_id: string;
  descricao: string;
  status: "aberta" | "enviada" | "resolvida";
  criado_em: string;
  resolvido_em: string | null;
}

export interface Documento {
  id: string;
  processo_id: string;
  pendencia_id: string | null;
  nome: string;
  path: string;
  tamanho: number | null;
  enviado_por: "equipe" | "corretor" | "cliente";
  criado_em: string;
}

export interface Notificacao {
  id: string;
  processo_id: string | null;
  destino: "cliente" | "corretor" | "equipe";
  motivo: string | null;
  telefone: string;
  mensagem: string;
  status: "pendente" | "enviada" | "falhou" | "manual";
  tentativas: number;
  erro: string | null;
  enviada_em: string | null;
  criado_em: string;
}
