export type NewsId = string | number;

export interface NewsItem {
  id: NewsId;
  title: string;
  source: string;
  createdAt?: string;
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

export interface StrategySignal {
  dimension: string;
  score: number;
  high_risk_count: number;
  summary: string;
}

export interface StrategyNews {
  id: NewsId;
  title: string;
  url: string;
  source: string;
  impact_score: number;
  risk_level: '低' | '中' | '高';
  why_used: string;
}

export interface StrategyAction {
  priority: 'P0' | 'P1' | 'P2';
  owner: '战略' | '产品' | '商业化';
  action: string;
}

export interface StrategyBrief {
  headline: string;
  time_window: string;
  top_signals: StrategySignal[];
  top_news: StrategyNews[];
  actions: StrategyAction[];
  meta: {
    news_count_scanned: number;
    news_count_used: number;
    generated_at: string;
  };
}

export interface DailyInsight {
  brief: string;
  indexes: IndexItem[];
  reasoningNodes: ReasoningNode[];
  impactScore: number;
  dimensions: Array<{ name: string; score: number; evidence: EvidenceLink }>;
  priorities: string[];
  updatedAt: string;
  strategyBrief: StrategyBrief;
}

export interface MatrixRow {
  name: string;
  weeklyMove: string;
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
    delta: number;
    sensitivity: string;
    evidence: EvidenceLink;
  }>;
  evidence: EvidenceLink;
}

export interface ScoreVector {
  subscription: number;
  commission: number;
  payment: number;
  ecosystem: number;
  overall: number;
}

export interface ScoreBreakdown {
  baseline: ScoreVector;
  delta: ScoreVector;
  final: ScoreVector;
  explain: {
    baselineMethod: string;
    deltaMethod: string;
    notes: string[];
  };
  evidence: {
    subscription: NewsId[];
    commission: NewsId[];
    payment: NewsId[];
    ecosystem: NewsId[];
  };
}

export interface SavedView {
  id: string;
  name: string;
  query: NewsQuery;
  createdAt: string;
}
