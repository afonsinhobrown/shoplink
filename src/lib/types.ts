export interface UtilizadorDTO {
  id: string;
  nome: string;
  email: string;
  papel: string;
}

export interface ProdutoDTO {
  id: string;
  nome: string;
  codigo_barras?: string | null;
  sku_interno?: string | null;
  categoria_id?: string | null;
  categoria?: string | null;
  fornecedor_id?: string | null;
  tipo_venda: "unidade" | "peso" | "volume";
  unidade_medida: string;
  preco_custo: number;
  preco_venda: number;
  controla_stock: boolean;
  stock_minimo: number;
  stock_atual: number;
  ativo: boolean;
  disponivel_online: boolean;
  descricao_publica?: string | null;
  isento_imposto?: boolean;
  imagem?: string | null;
  link_externo?: string | null;
  sob_encomenda?: boolean;
  mostrar_botao_pagamento?: boolean;
  mostrar_botao_whatsapp?: boolean;
  whatsapp_numero?: string | null;
}

export interface ImagemProdutoDTO {
  id: string;
  cloudinary_public_id: string;
  url: string;
  url_thumbnail?: string | null;
  principal: boolean;
  ordem: number;
}

export interface CategoriaDTO {
  id: string;
  nome: string;
  ordem: number;
  produtos: number;
}

export interface LojaDTO {
  id: string;
  nome: string;
  tipo_loja: string;
  cidade?: string | null;
  provincia?: string | null;
  endereco?: string | null;
  moeda: string;
  permite_venda_online: boolean;
  permite_reserva: boolean;
  slug_publico?: string | null;
  telefone?: string | null;
  whatsapp_numero?: string | null;
  logotipo_url?: string | null;
  imposto_padrao?: number;
  moeda_simbolo?: string;
}

export interface FornecedorDTO {
  id: string;
  nome: string;
  contacto?: string | null;
  email?: string | null;
  endereco?: string | null;
  ativo: boolean;
}

export interface ClienteDTO {
  id: string;
  nome: string;
  telefone?: string | null;
  limite_fiado: number;
  saldo_fiado: number;
  ativo: boolean;
}

export interface MovimentoDTO {
  id: string;
  tipo: string;
  quantidade: number;
  observacao?: string | null;
  nome_produto: string;
  data_movimento: string;
}

export interface VendaDTO {
  id: string;
  numero_recibo: string;
  subtotal: number;
  desconto_total: number;
  total: number;
  status: string;
  origem: string;
  data_venda: string;
  utilizador_nome: string;
  cliente_nome?: string | null;
  pagamento_metodo?: string | null;
}

export interface SessaoCaixaDTO {
  id: string;
  valor_abertura: number;
  data_abertura: string;
  status: string;
  utilizador_nome: string;
  total_vendas: number;
  sangrias: number;
  suprimentos: number;
}