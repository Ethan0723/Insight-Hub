export type NewsId = string | number;

export interface NewsItem {
  id: NewsId;
  title: string;
  source: string;
  publishDate: string;
  platform: string;
  region: string;
  moduleTags: string[];
  riskLevel: '低' | '中' | '高';
  impactScore: number;
  impactDimensions: Array<'订阅' | '佣金' | '支付' | '生态'>;
  aiTldr: string;
  summary: string;
  entities: string[];
  originalUrl: string;
  why: {
    subscription?: string;
    commission?: string;
    payment?: string;
    ecosystem?: string;
  };
  actions: Array<{
    priority: 'P0' | 'P1' | 'P2';
    owner: '产品' | '运营' | '合规' | '支付' | '市场';
    text: string;
  }>;
  evidenceContribution?: number;
}

export interface NewsQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  platforms?: string[];
  regions?: string[];
  moduleTags?: string[];
  riskLevels?: Array<'低' | '中' | '高'>;
  impactDimensions?: Array<'订阅' | '佣金' | '支付' | '生态'>;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'time' | 'impact' | 'risk';
  ids?: NewsId[];
}

export interface PagedResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EvidenceLink {
  id: string;
  title: string;
  newsIds: NewsId[];
}

export interface IndexItem {
  id: string;
  name: string;
  value: number;
  delta: string;
  description: string;
  evidence: EvidenceLink;
}

export interface ReasoningNode {
  id: string;
  text: string;
  explain: string;
  trend7d: number[];
  evidence: EvidenceLink;
}

export interface DailyInsight {
  brief: string;
  indexes: IndexItem[];
  reasoningNodes: ReasoningNode[];
  impactScore: number;
  dimensions: Array<{ name: string; score: number; evidence: EvidenceLink }>;
  priorities: string[];
  updatedAt: string;
}

export interface MatrixRow {
  name: string;
  weeklyMove: string;
  earningsHighlight: string;
  productUpdate: string;
  aiUpdate: string;
  evidence: EvidenceLink;
}

export interface RevenueScenario {
  arpuDelta: number;
  commissionDelta: number;
  paymentSuccessDelta: number;
}

export interface RevenueImpactResult {
  endpoint: string;
  baseTrend: number[];
  adjustedTrend: number[];
  labels: string[];
  outputs: {
    gmv: string;
    subscription: string;
    commission: string;
    paymentCost: string;
  };
  explanation: string;
  dimensions: Array<{
    id: string;
    name: string;
    score: number;
    sensitivity: string;
    evidence: EvidenceLink;
  }>;
  evidence: EvidenceLink;
}

export interface SavedView {
  id: string;
  name: string;
  query: NewsQuery;
  createdAt: string;
}
