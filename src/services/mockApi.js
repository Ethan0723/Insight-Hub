import { newsData } from '../mock/newsData';
import { indexData } from '../mock/indexData';
import { revenueImpactData } from '../mock/revenueImpactData';

const withDelay = (payload, timeout = 220) =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve(JSON.parse(JSON.stringify(payload)));
    }, timeout);
  });

export async function mockFetch(endpoint) {
  switch (endpoint) {
    case '/api/news':
      return withDelay(newsData);
    case '/api/indexes':
      return withDelay(indexData);
    case '/api/revenue-impact':
      return withDelay(revenueImpactData);
    default:
      throw new Error(`Unknown mock endpoint: ${endpoint}`);
  }
}

export async function fetchDashboardData() {
  const [news, indexes, revenueImpact] = await Promise.all([
    mockFetch('/api/news'),
    mockFetch('/api/indexes'),
    mockFetch('/api/revenue-impact')
  ]);

  return { news, indexes, revenueImpact };
}
