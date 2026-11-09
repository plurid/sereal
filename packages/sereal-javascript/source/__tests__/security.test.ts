// #region imports
import { describe, expect, it } from 'vitest';
import { createSereal, decode, parse } from '../index.ts';
// #endregion imports

// #region module
describe('security and robustness', () => {
    it('does not cause prototype pollution on object decoding', () => {
        const payload = JSON.parse(
            '{"$sereal":1,"root":{"__proto__":{"polluted":true},"normal":1}}',
        );
        const result: any = decode(payload);

        expect(result.normal).toBe(1);
        expect(({} as any).polluted).toBeUndefined();
        expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
    });

    it('enforces maxDepth on encode', () => {
        const deepSereal = createSereal({ maxDepth: 10 });
        let current: any = { next: null };
        const root = current;
        for (let i = 0; i < 20; i++) {
            current.next = { next: null };
            current = current.next;
        }

        expect(() => deepSereal.encode(root)).toThrowError(
            expect.objectContaining({ code: 'MAX_DEPTH' }),
        );
    });

    it('enforces maxDepth on decode', () => {
        const deepSereal = createSereal({ maxDepth: 5 });
        const doc = {
            $sereal: 1,
            root: {
                a: { b: { c: { d: { e: { f: 1 } } } } },
            },
        };

        expect(() => deepSereal.decode(doc)).toThrowError(
            expect.objectContaining({ code: 'MAX_DEPTH' }),
        );
    });

    it('fails with INVALID_DOCUMENT on invalid document envelope', () => {
        expect(() => decode(null)).toThrowError(
            expect.objectContaining({ code: 'INVALID_DOCUMENT' }),
        );
        expect(() => decode({})).toThrowError(
            expect.objectContaining({ code: 'INVALID_DOCUMENT' }),
        );
        expect(() => decode({ $sereal: 1 })).toThrowError(
            expect.objectContaining({ code: 'INVALID_DOCUMENT' }),
        );
        expect(() => decode({ $sereal: 2, root: 1 })).toThrowError(
            expect.objectContaining({ code: 'INVALID_DOCUMENT' }),
        );
        expect(() => decode({ $sereal: 1, root: 1, extra: 2 })).toThrowError(
            expect.objectContaining({ code: 'INVALID_DOCUMENT' }),
        );
    });

    it('fails with INVALID_DOCUMENT on invalid JSON string in parse', () => {
        expect(() => parse('{')).toThrowError(
            expect.objectContaining({ code: 'INVALID_DOCUMENT' }),
        );
        // @ts-expect-error test non-string
        expect(() => parse(123)).toThrowError(
            expect.objectContaining({ code: 'INVALID_DOCUMENT' }),
        );
    });

    it('fails on unexpected keys in tagged nodes', () => {
        const doc = {
            $sereal: 1,
            root: {
                $: 'bigint',
                v: '10',
                unexpected: 'key',
            },
        };
        expect(() => decode(doc)).toThrowError(
            expect.objectContaining({ code: 'INVALID_DOCUMENT' }),
        );
    });
});
// #endregion module
