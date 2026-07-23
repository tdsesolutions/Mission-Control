/**
 * Owner execute-code extraction tests. The invariants that matter:
 * the digits NEVER survive into the cleaned content, matching requires the
 * configured code, and ordinary sentences with numbers are left alone.
 */

import { describe, it, expect } from 'vitest';
import { extractExecCode } from './execCode.js';

const CODE = '4721';

describe('extractExecCode', () => {
  it('authorizes and strips a matching "execute code" phrase', () => {
    const r = extractExecCode('tell claw to audit the testing project, execute code 4721', CODE);
    expect(r.authorized).toBe(true);
    expect(r.codePresent).toBe(true);
    expect(r.cleaned).toBe('tell claw to audit the testing project');
    expect(r.cleaned).not.toMatch(/4721/);
  });

  it.each([
    'update the readme, exec code 4721',
    'update the readme authorization code 4721.',
    'update the readme, auth code 4721',
    'update the readme pin 4721',
    'update the readme execute 4721',
  ])('accepts the variant: %s', (input) => {
    const r = extractExecCode(input, CODE);
    expect(r.authorized).toBe(true);
    expect(r.cleaned).not.toMatch(/4721/);
  });

  it('handles STT-spaced digits ("execute code 4 7 2 1")', () => {
    const r = extractExecCode('fix the login bug execute code 4 7 2 1', CODE);
    expect(r.authorized).toBe(true);
    expect(r.cleaned).toBe('fix the login bug');
  });

  it('strips but does NOT authorize a wrong code', () => {
    const r = extractExecCode('delete the temp folder, execute code 9999', CODE);
    expect(r.codePresent).toBe(true);
    expect(r.authorized).toBe(false);
    expect(r.cleaned).not.toMatch(/9999/);
  });

  it('never authorizes when the feature is disabled (no configured code)', () => {
    for (const configured of ['', null, undefined]) {
      const r = extractExecCode('audit the repo execute code 4721', configured);
      expect(r.authorized).toBe(false);
      expect(r.codePresent).toBe(true);
      expect(r.cleaned).not.toMatch(/4721/); // digits stripped regardless
    }
  });

  it('leaves ordinary sentences with numbers untouched', () => {
    for (const s of [
      'create 5 files in the docs folder',
      'the port is 3002 and the gateway is 18789',
      'execute the migration plan',
      'set a timer for 10 minutes',
    ]) {
      const r = extractExecCode(s, CODE);
      expect(r.codePresent).toBe(false);
      expect(r.cleaned).toBe(s);
    }
  });

  it('requires 4-8 digits attached to a keyword', () => {
    expect(extractExecCode('execute code 123', CODE).codePresent).toBe(false); // too short
    expect(extractExecCode('pin 123456789', CODE).codePresent).toBe(false); // too long
  });
});
