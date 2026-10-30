import { describe, expect, it } from 'vitest';
import { decodeSharedState, encodeSharedState } from '../../stores/share';

describe('share', () => {
  it('round-trips state through the URL hash', () => {
    const s = { v: 1 as const, jd: 2461121.0, mode: 'earth' as const, scale: 'classroom' as const, sel: 'mars', obl: 30 };
    expect(decodeSharedState(encodeSharedState(s))).toEqual(s);
  });
  it('rejects garbage and out-of-range values', () => {
    expect(decodeSharedState('!!!not-base64!!!')).toBeNull();
    expect(decodeSharedState('')).toBeNull();
    expect(decodeSharedState('#s=')).toBeNull();
    expect(decodeSharedState(encodeSharedState({ v: 1 as const, jd: 99_999_999, mode: 'earth' as const, scale: 'classroom' as const, sel: null, obl: 30 }))).toBeNull();
    expect(decodeSharedState(encodeSharedState({ v: 1 as const, jd: 2461121.0, mode: 'earth' as const, scale: 'classroom' as const, sel: null, obl: 999 }))).toBeNull();
    expect(decodeSharedState(encodeSharedState({ v: 1 as const, jd: 2461121.0, mode: 'nope' as unknown as 'earth', scale: 'classroom' as const, sel: null, obl: 23.4 }))).toBeNull();
  });
});
