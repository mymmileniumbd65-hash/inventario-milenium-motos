import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function pngSize(filePath: string) {
  const buf = readFileSync(filePath);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('PWA icon assets', () => {
  it('has the 192x192 manifest icon at the path manifest.ts declares', () => {
    const p = path.resolve(__dirname, '../../public/icons/icon-192.png');
    expect(existsSync(p)).toBe(true);
    expect(pngSize(p)).toEqual({ width: 192, height: 192 });
  });

  it('has the 512x512 manifest icon at the path manifest.ts declares', () => {
    const p = path.resolve(__dirname, '../../public/icons/icon-512.png');
    expect(existsSync(p)).toBe(true);
    expect(pngSize(p)).toEqual({ width: 512, height: 512 });
  });

  it('has a 180x180 apple-icon.png for the Next.js apple-touch-icon convention', () => {
    const p = path.resolve(__dirname, 'apple-icon.png');
    expect(existsSync(p)).toBe(true);
    expect(pngSize(p)).toEqual({ width: 180, height: 180 });
  });
});
