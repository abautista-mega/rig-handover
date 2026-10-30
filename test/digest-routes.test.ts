import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';

const dirs: string[] = [];

function rig(files: Record<string, string>) {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  dirs.push(runsDir);
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(runsDir, name), body);
  }
  const config: RigConfig = {
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  };
  return createApp(config);
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const night = [
  '{"at":"2026-10-28T23:00:02+01:00","job":"rig/rotate-logs","status":"ok","owner":"lane-07"}',
  '{"at":"2026-10-29T01:30:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-10-29T01:31:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-10-29T01:32:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-10-29T04:00:01+01:00","job":"notes/backup","status":"fail","owner":"lane-07","error":"quota exceeded"}',
  '{"at":"2026-10-29T05:41:09+01:00","job":"digest/render","status":"ok","owner":null}',
].join('\n');

describe('digest routes', () => {
  it('returns 200 for the page and the same jobs in the same order as JSON', async () => {
    const app = rig({ '2026-10-28.jsonl': `${night}\n{"job":"lane/sy` });
    const page = await app.request('/digest/2026-10-28');
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain('digest/render');
    expect(html).toContain('—');
    expect(html).toContain('quota exceeded');

    const jsonRes = await app.request('/api/digest/2026-10-28');
    expect(jsonRes.status).toBe(200);
    const body = (await jsonRes.json()) as { rows: { job: string }[] };
    const jobs = [...html.matchAll(/<td>([^<]+)<\/td>/g)].map((match) => match[1]);
    const jobCells = jobs.filter((cell) => body.rows.some((row) => row.job === cell));
    expect(body.rows.map((row) => row.job)).toEqual(jobCells);
    expect(body.rows.map((row) => row.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('returns 404 when the night file is missing', async () => {
    const app = rig({});
    expect((await app.request('/digest/2026-10-28')).status).toBe(404);
    expect((await app.request('/api/digest/2026-10-28')).status).toBe(404);
  });

  it('renders nothing ran for an empty file and an empty JSON row list', async () => {
    const app = rig({ '2026-10-28.jsonl': '' });
    const page = await app.request('/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    const body = (await (await app.request('/api/digest/2026-10-28')).json()) as { rows: unknown[] };
    expect(body.rows).toEqual([]);
  });

  it('still returns 200 when a line does not parse', async () => {
    const app = rig({
      '2026-10-28.jsonl':
        '{"at":"2026-10-28T23:00:02+01:00","job":"rig/rotate-logs","status":"ok","owner":"lane-07"}\n{"job":"lane/sy',
    });
    expect((await app.request('/digest/2026-10-28')).status).toBe(200);
    const body = (await (await app.request('/api/digest/2026-10-28')).json()) as {
      badLines: number;
      rows: unknown[];
    };
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(1);
  });
});
