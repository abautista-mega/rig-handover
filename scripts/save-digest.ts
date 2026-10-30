import { mkdirSync, writeFileSync } from 'node:fs';
import { createApp } from '../src/app.js';

const night = '2026-10-28';
const res = await createApp().request(`/digest/${night}`);
if (res.status !== 200) {
  throw new Error(`GET /digest/${night} returned ${res.status}`);
}
const html = await res.text();
if (!html.includes('<!doctype html>') && !html.includes('<!DOCTYPE html>')) {
  throw new Error('digest response is not a full HTML document');
}
mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html);
console.log(`wrote dist/index.html (${html.length} bytes)`);
