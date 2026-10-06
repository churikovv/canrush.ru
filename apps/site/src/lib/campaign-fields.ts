export interface CampaignInput { name: string; path: string; source: string; medium: string; campaign: string; content: string; term: string }
export function campaignInput(input: Record<string, unknown>): CampaignInput {
  const text = (key: string, required = true) => {
    const value = typeof input[key] === 'string' ? input[key].trim() : '';
    if ((required && !value) || value.length > 120 || /[\x00-\x1f]/.test(value)) throw new Error('Заполните обязательные поля: до 120 символов каждое.');
    return value;
  };
  const path = typeof input.path === 'string' ? input.path.trim() : '';
  if (!/^\/(?!\/)/.test(path) || path.length > 500 || /[\\?#\x00-\x20]/.test(path) || /^\/(?:api|auth|admin|sign-in)(?:\/|$)/.test(path)) throw new Error('Укажите путь публичной страницы, например /catalog, без параметров и якоря.');
  const url = new URL(path, 'https://canrush.ru');
  if (url.origin !== 'https://canrush.ru' || url.pathname !== path) throw new Error('Некорректный путь страницы.');
  return { name: text('name'), path, source: text('source'), medium: text('medium'), campaign: text('campaign'), content: text('content', false), term: text('term', false) };
}
export function campaignUrl(c: CampaignInput & { id: string }): string {
  const params = new URLSearchParams({ utm_source: c.source, utm_medium: c.medium, utm_campaign: c.campaign, cr_campaign: c.id });
  if (c.content) params.set('utm_content', c.content);
  if (c.term) params.set('utm_term', c.term);
  return `https://canrush.ru${c.path}?${params}`;
}
export const CAMPAIGN_COOKIE = 'canrush_campaign_visitor';
