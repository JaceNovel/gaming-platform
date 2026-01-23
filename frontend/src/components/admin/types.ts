export type Summary = {
  brut: number;
  net: number;
  funds: number;
  sales_today: number;
  premium: {
    bronze: number;
    or: number;
    platine: number;
    conversion_rate: number;
  };
};

export type ChartPoint = {
  label: string;
  brut: number;
  net?: number;
  funds?: number;
};

export type Charts = {
  daily: ChartPoint[];
  monthly: ChartPoint[];
  by_type: ChartPoint[];
  by_game: ChartPoint[];
  by_country: ChartPoint[];
};

export type Paginated<T> = {
  data: T[];
};

export type OrderRow = {
  id: number;
  status?: string;
  total_price?: number;
  created_at?: string;
  user?: { email?: string };
  payment?: { status?: string };
};

export type PaymentRow = {
  id: number;
  amount: number;
  status: string;
  created_at?: string;
  order?: { id: number; user?: { email?: string } };
};

export type UserRow = {
  id: number;
  name?: string;
  email?: string;
  is_premium?: boolean;
  premium_level?: string | null;
  created_at?: string;
};

export type PremiumRow = {
  id: number;
  level: string;
  user?: { email?: string };
  game?: { name?: string };
  expiration_date?: string;
  is_active?: boolean;
};

export type ProductRow = {
  id: number;
  name?: string;
  type?: string;
  price?: number;
  stock?: number;
  likes_count?: number;
  is_active?: boolean;
};

export type LikeRow = {
  id: number;
  user?: { email?: string };
  product?: { name?: string };
  created_at?: string;
};

export type TournamentRow = {
  id: number;
  name?: string;
  game?: { name?: string };
  participants_count?: number;
  is_active?: boolean;
};

export type ChatRow = {
  id: number;
  room?: { name?: string };
  user?: { email?: string };
  message?: string;
  is_deleted?: boolean;
  created_at?: string;
};

export type Tables = {
  orders: Paginated<OrderRow>;
  payments: Paginated<PaymentRow>;
  users: Paginated<UserRow>;
  premium_memberships: Paginated<PremiumRow>;
  products: Paginated<ProductRow>;
  likes: Paginated<LikeRow>;
  tournaments: Paginated<TournamentRow>;
  chat_messages: Paginated<ChatRow>;
};

export type Settings = {
  logo_url?: string;
  whatsapp_number?: string;
  terms?: string;
};
