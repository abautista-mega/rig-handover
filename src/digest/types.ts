// Signature first (plan.md § 1). The reader issue fills this body in.

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

export function readNight(runsDir: string, night: string): NightDigest | null {
  void runsDir;
  void night;
  throw new Error('not implemented');
}
