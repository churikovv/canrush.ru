#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { config } from 'dotenv';
import { IngredientClient } from './client.js';
import { extractIngredients, htmlDocument, sourceForUrl, type IngredientSource } from './core.js';

const parserRoot = path.resolve(import.meta.dirname, '../..');
const output = path.resolve(parserRoot, '../../data/ingredients');
config({ path: path.join(parserRoot, '.env.local'), quiet: true });
config({ path: path.join(parserRoot, '.env'), quiet: true });
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 24);

function parseArgs(args: string[]) {
  const flags: Record<string, string> = {};
  for (const arg of args) {
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (!match?.[1] || !['query', 'url', 'source', 'limit', 'budget', 'refresh', 'list', 'help'].includes(match[1])) throw new Error('Неизвестный аргумент. Используйте --help.');
    flags[match[1]] = match[2] ?? 'true';
  }
  return flags;
}

async function cached<T>(file: string, days: number): Promise<T | undefined> {
  try {
    const saved = JSON.parse(await readFile(file, 'utf8')) as { at: number; value: T };
    if (Number.isFinite(saved.at) && Date.now() - saved.at < days * 86400000) return saved.value;
  } catch { /* Missing/invalid cache is a miss. */ }
  return undefined;
}

interface Candidate {
  url: string;
  sourceId: string;
  market: 'RU' | 'BY';
  title: string;
  fetchedAt: string;
  method: 'http' | 'tavily';
  status: 'needs_review' | 'missing';
  ingredients: string | null;
  warnings: string[];
  evidenceFile: string;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const sources = JSON.parse(await readFile(path.join(parserRoot, 'config/ingredient-sources.json'), 'utf8')) as IngredientSource[];
  if (flags.help) {
    console.log('Составы: --list | --query="Burn Guava 449 мл состав" [--url=https://…] [--source=okolo,edostavka] [--limit=3] [--budget=6] [--refresh]\n--budget=0 отключает Tavily. Все записи требуют проверки; публикации на сайте нет.');
    return;
  }
  if (flags.list) {
    console.table(sources.map(({ id, name, market, strategy, evidence }) => ({ id, name, market, strategy, evidence })));
    return;
  }
  if (!flags.query && !flags.url) throw new Error('Укажите --query или --url. Список источников: --list.');
  if (flags.query && (flags.query === 'true' || flags.query.length > 300)) throw new Error('Запрос должен содержать от 1 до 300 символов.');
  const limit = Number(flags.limit ?? 3);
  const budget = Number(flags.budget ?? 6);
  if (!Number.isInteger(limit) || limit < 1 || limit > 10 || !Number.isInteger(budget) || budget < 0 || budget > 20) throw new Error('limit: 1–10, budget: 0–20.');
  const selected = flags.source ? sources.filter((s) => flags.source?.split(',').includes(s.id)) : sources;
  if (!selected.length || flags.source?.split(',').some((id) => !sources.some((s) => s.id === id))) throw new Error('Неизвестный источник. Используйте --list.');
  if (flags.url && !sourceForUrl(flags.url, selected)) throw new Error('URL должен быть HTTPS-карточкой из выбранного реестра источников.');
  const client = new IngredientClient(selected, process.env.TAVILY_API_KEY, budget);
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(output, 'runs', runId);
  const cacheDir = path.join(output, 'cache');
  await mkdir(runDir, { recursive: true });
  await mkdir(cacheDir, { recursive: true });
  const candidates: Candidate[] = [];
  const attempts: { url: string; state: string; cached?: boolean }[] = [];
  const visited = new Set<string>();

  async function collect(url: string) {
    if (visited.has(url) || visited.size >= limit) return;
    visited.add(url);
    const source = sourceForUrl(url, selected);
    if (!source) return;
    const cacheFile = path.join(cacheDir, `${hash(url)}.json`);
    const saved = !flags.refresh ? await cached<Candidate>(cacheFile, 30) : undefined;
    if (saved?.status === 'needs_review' && saved.sourceId === source.id) {
      candidates.push(saved);
      attempts.push({ url, state: saved.status, cached: true });
      return;
    }
    try {
      if (!(await client.allowed(url))) throw new Error('robots_or_source_unavailable');
      let method: 'http' | 'tavily' = 'http';
      let text = '';
      let title = '';
      if (source.strategy === 'http') {
        try { ({ text, title } = htmlDocument(await client.page(url))); }
        catch { attempts.push({ url, state: 'direct_fetch_failed' }); }
      }
      let extracted = extractIngredients(text, title);
      if (!extracted.ingredients && budget > 0) {
        try {
          const remote = await client.extract(url);
          method = 'tavily';
          text = remote;
          title = /^#\s+(.+)$/m.exec(text)?.[1] ?? title;
          extracted = extractIngredients(text, title);
        } catch (error) {
          attempts.push({ url, state: error instanceof Error ? error.message : 'extract_failed' });
        }
      }
      const evidenceFile = path.relative(output, path.join(runDir, `${hash(url)}.txt`));
      await writeFile(path.join(output, evidenceFile), text);
      const candidate: Candidate = {
        url, sourceId: source.id, market: source.market, title,
        fetchedAt: new Date().toISOString(), method,
        status: extracted.ingredients ? 'needs_review' : 'missing', ...extracted,
        evidenceFile,
      };
      if (source.market !== 'RU') candidate.warnings.push('foreign_market_verify_recipe');
      candidates.push(candidate);
      attempts.push({ url, state: candidate.status });
      // Preserve successful cached evidence if a refresh failed.
      if (candidate.ingredients) await writeFile(cacheFile, JSON.stringify({ at: Date.now(), value: candidate }, null, 2));
      console.log(`${source.name}: ${candidate.status}`);
    } catch (error) {
      const state = error instanceof Error && /^[a-z_0-9]+$/.test(error.message) ? error.message : 'request_failed';
      attempts.push({ url, state });
      console.log(`${source.name}: ${state}`);
    }
  }

  if (flags.url) await collect(flags.url);
  if (flags.query && budget > 0 && !candidates.some((c) => c.ingredients)) {
    const searchFile = path.join(cacheDir, `search-${hash(JSON.stringify(['restrict-v1', flags.query, selected.map((s) => s.id)]))}.json`);
    try {
      let urls = !flags.refresh ? await cached<string[]>(searchFile, 7) : undefined;
      if (!urls) {
        urls = await client.search(flags.query, selected);
        await writeFile(searchFile, JSON.stringify({ at: Date.now(), value: urls }, null, 2));
      }
      urls = urls.filter((url) => sourceForUrl(url, selected));
      urls.sort((a, b) => (sourceForUrl(a, selected)?.priority ?? 99) - (sourceForUrl(b, selected)?.priority ?? 99));
      for (const url of urls) await collect(url);
    } catch (error) {
      attempts.push({ url: 'tavily:search', state: error instanceof Error ? error.message : 'search_failed' });
    }
  }
  const report = {
    runId, query: flags.query ?? null, targetMatch: 'not_verified', candidates, attempts,
    rejectedSearchUrls: client.searchRejected,
    usage: { budget, reservedUpperBound: client.creditsReserved, reportedCredits: client.creditsReported },
  };
  const reportFile = path.join(runDir, 'report.json');
  await writeFile(reportFile, JSON.stringify(report, null, 2));
  console.log(`Кандидатов с составом: ${candidates.filter((c) => c.ingredients).length}. Кредиты: ${client.creditsReported}, зарезервировано: ${client.creditsReserved}/${budget}.\nОтчёт: ${reportFile}`);
  if (!candidates.some((c) => c.ingredients)) process.exitCode = 2;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error && !/tvly-|Bearer/i.test(error.message) ? error.message : 'Ошибка сбора составов');
  process.exitCode = 1;
});
