import axios from 'axios';
import robotsParserImport from 'robots-parser';
import { delay } from '../http.js';
import { sourceForUrl, type IngredientSource } from './core.js';

const robotsParser = robotsParserImport as unknown as (url: string, text: string) => { isAllowed(url: string, ua: string): boolean | undefined };
const UA = 'CanRushIngredients/1.0';

export class IngredientClient {
  creditsReserved = 0;
  creditsReported = 0;
  searchRejected: string[] = [];
  private lastRequest = 0;
  private robots = new Map<string, ReturnType<typeof robotsParser>>();
  constructor(private sources: IngredientSource[], private key: string | undefined, private budget: number) {}

  private async pause() {
    await delay(Math.max(0, 3100 - (Date.now() - this.lastRequest)));
    this.lastRequest = Date.now();
  }

  private async get(url: string) {
    await this.pause();
    const response = await axios.get<string>(url, {
      responseType: 'text', timeout: 20000, maxRedirects: 0,
      maxContentLength: 5_000_000, headers: { 'User-Agent': UA, Accept: 'text/html,text/plain' },
      validateStatus: () => true,
    });
    return response;
  }

  async allowed(url: string): Promise<boolean> {
    if (!sourceForUrl(url, this.sources)) return false;
    const origin = new URL(url).origin;
    try {
      let robot = this.robots.get(origin);
      if (!robot) {
        const response = await this.get(`${origin}/robots.txt`);
        // Unlike the price parser, new composition sources fail closed if robots is unavailable.
        if (response.status !== 200 && response.status !== 404) return false;
        if (response.status === 200 && /<html/i.test(response.data)) return false;
        robot = robotsParser(`${origin}/robots.txt`, response.status === 404 ? '' : response.data);
        this.robots.set(origin, robot);
      }
      return robot.isAllowed(url, UA) !== false;
    } catch { return false; }
  }

  async page(url: string): Promise<string> {
    if (!(await this.allowed(url))) throw new Error('robots_or_source_unavailable');
    const response = await this.get(url);
    if (response.status !== 200) throw new Error(`http_${response.status}`);
    return response.data;
  }

  private async tavily(endpoint: 'search' | 'extract', payload: Record<string, unknown>): Promise<Record<string, any>> {
    if (!this.key) throw new Error('tavily_key_missing');
    // Reserve the conservative single-URL cost before sending, even on timeout/error.
    if (this.creditsReserved >= this.budget) throw new Error('tavily_budget_exhausted');
    this.creditsReserved += 1;
    await this.pause();
    try {
      const response = await axios.post(`https://api.tavily.com/${endpoint}`, payload, {
        headers: { Authorization: `Bearer ${this.key}` }, timeout: 45000, maxRedirects: 0,
        maxContentLength: 5_000_000,
      });
      if (!response.data || typeof response.data !== 'object' || !Array.isArray(response.data.results)) throw new Error('invalid_response');
      const credits = response.data.usage?.credits;
      if (typeof credits === 'number' && Number.isFinite(credits) && credits >= 0) this.creditsReported += credits;
      return response.data;
    } catch {
      // Axios errors can contain Authorization: never expose or persist the original exception.
      throw new Error('tavily_request_failed');
    }
  }

  async search(query: string, sources = this.sources): Promise<string[]> {
    const data = await this.tavily('search', {
      query, search_depth: 'basic', max_results: 5, include_answer: false,
      include_raw_content: false, include_usage: true, auto_parameters: false,
      include_domains: sources.map((source) => source.host),
      include_domains_mode: 'restrict', language: 'ru',
    });
    const urls: string[] = data.results.map((r: { url?: unknown }) => r.url).filter((url: unknown): url is string => typeof url === 'string');
    this.searchRejected.push(...urls.filter((url) => !sourceForUrl(url, sources)));
    return [...new Set(urls.filter((url) => sourceForUrl(url, sources)))];
  }

  async extract(url: string): Promise<string> {
    if (!(await this.allowed(url))) throw new Error('robots_or_source_unavailable');
    const data = await this.tavily('extract', { urls: [url], extract_depth: 'basic', format: 'markdown', include_usage: true });
    const result = data.results.find((r: { url?: string; raw_content?: unknown }) => r.url === url && typeof r.raw_content === 'string');
    if (!result) throw new Error('tavily_extract_empty');
    return result.raw_content as string;
  }
}
