type AnalyticsParams = Record<string, any>;

const measurementId = String(import.meta.env.VITE_GA_ID || '').trim();
const enabled = Boolean(measurementId) && typeof window !== 'undefined';

let initialized = false;
let lastPagePath = '';
const viewedSections = new Set<string>();

function safeParams(params?: AnalyticsParams): AnalyticsParams {
  if (!params || typeof params !== 'object') return {};
  const out: AnalyticsParams = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value == null) return;
    if (typeof value === 'string') {
      const text = value.trim();
      if (!text) return;
      out[key] = text.slice(0, 120);
      return;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
      return;
    }
    if (Array.isArray(value)) {
      out[key] = value.slice(0, 10).map((v) => (typeof v === 'string' ? v.slice(0, 120) : v));
    }
  });
  return out;
}

function getGtag() {
  if (!enabled) return null;
  return typeof window.gtag === 'function' ? window.gtag : null;
}

export function initAnalytics() {
  if (!enabled || initialized) return;
  initialized = true;

  if (!document.querySelector('script[data-ga-loader="true"]')) {
    const gaScript = document.createElement('script');
    gaScript.async = true;
    gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    gaScript.setAttribute('data-ga-loader', 'true');
    document.head.appendChild(gaScript);
  }

  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
  }
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { send_page_view: false });
}

export function track(eventName: string, params?: AnalyticsParams) {
  const gtag = getGtag();
  if (!gtag || !eventName) return;
  gtag('event', eventName, safeParams(params));
}

export function trackPageView(path: string) {
  const gtag = getGtag();
  const pagePath = String(path || '').trim();
  if (!gtag || !pagePath || pagePath === lastPagePath) return;
  lastPagePath = pagePath;
  gtag('event', 'page_view', {
    page_path: pagePath,
    page_title: document.title
  });
}

export function trackSectionView(section: string) {
  const key = String(section || '').trim();
  if (!key || viewedSections.has(key)) return;
  viewedSections.add(key);
  track('section_view', { section: key });
}

export function resetSectionViewCache() {
  viewedSections.clear();
}
