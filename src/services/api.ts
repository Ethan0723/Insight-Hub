import {
  DailyInsight,
  MatrixRow,
  NewsItem,
  NewsQuery,
  PagedResult,
  RevenueImpactResult,
  RevenueScenario
} from '../types/domain';
import { mockNews } from '../data/mock/news';
import { mockAssistant, mockDailyInsight, mockMatrix, mockModelExplainers } from '../data/mock/dashboard';
import { calculateRevenueImpact } from '../data/mock/revenue';

const delay = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));

const riskSortWeight = { 高: 3, 中: 2, 低: 1 };

function filterNews(list: NewsItem[], query: NewsQuery = {}): NewsItem[] {
  let result = [...list];

  if (query.ids && query.ids.length > 0) {
    const set = new Set(query.ids);
    result = result.filter((item) => set.has(item.id));
  }
  if (query.platforms && query.platforms.length > 0) {
    result = result.filter((item) => query.platforms?.includes(item.platform));
  }
  if (query.regions && query.regions.length > 0) {
    result = result.filter((item) => query.regions?.includes(item.region));
  }
  if (query.moduleTags && query.moduleTags.length > 0) {
    result = result.filter((item) => query.moduleTags?.some((tag) => item.moduleTags.includes(tag)));
  }
  if (query.riskLevels && query.riskLevels.length > 0) {
    result = result.filter((item) => query.riskLevels?.includes(item.riskLevel));
  }
  if (query.impactDimensions && query.impactDimensions.length > 0) {
    result = result.filter((item) => query.impactDimensions?.some((dim) => item.impactDimensions.includes(dim)));
  }
  if (query.dateFrom) {
    const from = new Date(query.dateFrom).getTime();
    result = result.filter((item) => new Date(item.publishDate).getTime() >= from);
  }
  if (query.dateTo) {
    const to = new Date(query.dateTo).getTime();
    result = result.filter((item) => new Date(item.publishDate).getTime() <= to);
  }
  if (query.keyword?.trim()) {
    const key = query.keyword.trim().toLowerCase();
    result = result.filter(
      (item) =>
        item.title.toLowerCase().includes(key) ||
        item.summary.toLowerCase().includes(key) ||
        item.entities.join(' ').toLowerCase().includes(key)
    );
  }

  result.sort((a, b) => {
    if (query.sortBy === 'impact') return b.impactScore - a.impactScore;
    if (query.sortBy === 'risk') return riskSortWeight[b.riskLevel] - riskSortWeight[a.riskLevel];
    return new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime();
  });

  return result;
}

function paginate<T>(list: T[], page = 1, pageSize = 9): PagedResult<T> {
  const total = list.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return {
    list: list.slice(start, end),
    total,
    page,
    pageSize
  };
}

export const api = {
  async getNews(query: NewsQuery = {}): Promise<PagedResult<NewsItem>> {
    await delay();
    const list = filterNews(mockNews, query);
    return paginate(list, query.page || 1, query.pageSize || 9);
  },

  async searchNews(query: NewsQuery = {}): Promise<PagedResult<NewsItem>> {
    return api.getNews(query);
  },

  async getNewsById(id: number): Promise<NewsItem | null> {
    await delay(120);
    return mockNews.find((item) => item.id === id) || null;
  },

  async getRelatedNews(newsId: number): Promise<NewsItem[]> {
    await delay(120);
    const current = mockNews.find((item) => item.id === newsId);
    if (!current) return [];

    return mockNews
      .filter((item) => item.id !== newsId)
      .filter(
        (item) =>
          item.platform === current.platform ||
          item.region === current.region ||
          item.moduleTags.some((tag) => current.moduleTags.includes(tag))
      )
      .slice(0, 6);
  },

  async getDailyInsight(): Promise<DailyInsight> {
    await delay(180);
    return mockDailyInsight;
  },

  async getMatrix(): Promise<MatrixRow[]> {
    await delay(150);
    return mockMatrix;
  },

  async getRevenueImpact(scenario: RevenueScenario): Promise<RevenueImpactResult> {
    await delay(160);
    return calculateRevenueImpact(scenario);
  },

  async getAppMeta() {
    await delay(120);
    return {
      assistant: mockAssistant,
      explainers: mockModelExplainers
    };
  }
};
