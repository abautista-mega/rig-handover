import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type DigestStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: DigestStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type DigestCounts = {
  ok: number;
  retry: number;
  fail: number;
};

export type NightDigest = {
  night: string;
  rows: DigestRow[];
  badLines: number;
  counts: DigestCounts;
};

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

function parseLine(line: string): {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error: string | null;
} | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec.at !== 'string' || typeof rec.job !== 'string') return null;
  if (rec.status !== 'ok' && rec.status !== 'retry' && rec.status !== 'fail') return null;
  if (rec.owner !== undefined && rec.owner !== null && typeof rec.owner !== 'string') return null;
  if (rec.error !== undefined && rec.error !== null && typeof rec.error !== 'string') return null;
  return {
    at: rec.at,
    job: rec.job,
    status: rec.status,
    owner: typeof rec.owner === 'string' ? rec.owner : null,
    error: typeof rec.error === 'string' ? rec.error : null,
  };
}

export function readNight(runsDir: string, night: string): NightDigest | null {
  if (!NIGHT.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }

  type Group = DigestRow & { firstMs: number; lastMs: number };
  const groups = new Map<string, Group>();
  const counts: DigestCounts = { ok: 0, retry: 0, fail: 0 };
  let badLines = 0;

  for (const line of text.split('\n')) {
    if (line === '') continue;
    const parsed = parseLine(line);
    if (!parsed) {
      badLines += 1;
      continue;
    }
    const ms = Date.parse(parsed.at);
    if (Number.isNaN(ms)) {
      badLines += 1;
      continue;
    }
    counts[parsed.status] += 1;
    const existing = groups.get(parsed.job);
    if (!existing) {
      groups.set(parsed.job, {
        job: parsed.job,
        owner: parsed.owner,
        runs: 1,
        retries: parsed.status === 'retry' ? 1 : 0,
        lastStatus: parsed.status,
        lastError: parsed.error,
        firstAt: parsed.at,
        lastAt: parsed.at,
        firstMs: ms,
        lastMs: ms,
      });
      continue;
    }
    existing.runs += 1;
    if (parsed.status === 'retry') existing.retries += 1;
    if (ms <= existing.firstMs) {
      existing.firstMs = ms;
      existing.firstAt = parsed.at;
    }
    if (ms >= existing.lastMs) {
      existing.lastMs = ms;
      existing.lastAt = parsed.at;
      existing.lastStatus = parsed.status;
      existing.lastError = parsed.error;
      existing.owner = parsed.owner;
    }
  }

  const rows = [...groups.values()]
    .map(({ firstMs: _firstMs, lastMs: _lastMs, ...row }) => row)
    .sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));

  return { night, rows, badLines, counts };
}
