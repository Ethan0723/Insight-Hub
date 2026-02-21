import { NewsId, SavedView } from '../types/domain';

const KEYS = {
  favorites: 'sse:favorites',
  read: 'sse:read-news',
  views: 'sse:saved-views',
  brief: 'sse:brief-draft'
};

function parse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const storage = {
  getFavorites(): NewsId[] {
    return parse<NewsId[]>(localStorage.getItem(KEYS.favorites), []);
  },
  toggleFavorite(id: NewsId): NewsId[] {
    const list = storage.getFavorites();
    const next = list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
    localStorage.setItem(KEYS.favorites, JSON.stringify(next));
    return next;
  },
  getReadNewsIds(): NewsId[] {
    return parse<NewsId[]>(localStorage.getItem(KEYS.read), []);
  },
  markRead(id: NewsId): NewsId[] {
    const list = storage.getReadNewsIds();
    const next = list.includes(id) ? list : [...list, id];
    localStorage.setItem(KEYS.read, JSON.stringify(next));
    return next;
  },
  getSavedViews(): SavedView[] {
    return parse<SavedView[]>(localStorage.getItem(KEYS.views), []);
  },
  saveView(view: SavedView): SavedView[] {
    const list = storage.getSavedViews();
    const next = [view, ...list].slice(0, 20);
    localStorage.setItem(KEYS.views, JSON.stringify(next));
    return next;
  },
  removeView(id: string): SavedView[] {
    const next = storage.getSavedViews().filter((item) => item.id !== id);
    localStorage.setItem(KEYS.views, JSON.stringify(next));
    return next;
  },
  getBriefDraft(): string {
    return localStorage.getItem(KEYS.brief) || '';
  },
  setBriefDraft(markdown: string) {
    localStorage.setItem(KEYS.brief, markdown);
  }
};
