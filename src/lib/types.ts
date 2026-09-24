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
}

export interface CategoriaDTO {
  id: string;
  nome: string;
  ordem: number;
  produtos: number;
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