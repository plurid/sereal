// #region imports
import { describe, expect, it } from 'vitest';
import { fromBase64, toBase64 } from '../builtins/binary.ts';
import { createSereal, decode, defineType, formatPath } from '../index.ts';
import { createTimeline } from '../timeline/index.ts';
// #endregion imports

// #region module
describe('coverage edge cases', () => {
    it('exercises manual JS base64 fallback in binary.ts', () => {
        const bytes = new Uint8Array([1, 2, 3, 4, 5]);
        const encoded = toBase64(bytes, false);
        expect(typeof encoded).toBe('string');
        const decoded = fromBase64(
            encoded,
            () => {
                throw new Error('fail');
            },
            false,
        );
        expect(decoded).toEqual(bytes);
    });

    it('exercises formatPath formatting', () => {
        expect(formatPath([])).toBe('$');
        expect(formatPath(['a', 0, 'b-c', 'valid_id'])).toBe('$.a[0]["b-c"].valid_id');
    });

    it('validates sereal createSereal maxDepth options', () => {
        expect(() => createSereal({ maxDepth: 0 })).toThrow(RangeError);
        expect(() => createSereal({ maxDepth: -5 })).toThrow(RangeError);
    });

    it('validates timeline options and boundaries', () => {
        const s = createSereal();
        expect(() => createTimeline(s, { limit: -1 })).toThrow(RangeError);

        expect(() => createTimeline(s, { from: {} as any })).toThrowError(
            expect.objectContaining({ code: 'INVALID_DOCUMENT' }),
        );

        const tl = createTimeline(s, { initial: 1 });
        const unsub = tl.subscribe(() => {});
        unsub();
    });

    it('validates defineType version and migration errors', () => {
        class Dummy {}
        expect(() =>
            defineType(Dummy, {
                name: 'app.Dummy',
                version: 0,
                encode: () => ({}),
                decode: () => new Dummy(),
            }),
        ).toThrowError(expect.objectContaining({ code: 'INVALID_TYPE' }));

        expect(() =>
            defineType(Dummy, {
                name: 'app.Dummy',
                migrations: {
                    bad: 'not-a-fn',
                } as any,
                encode: () => ({}),
                decode: () => new Dummy(),
            }),
        ).toThrowError(expect.objectContaining({ code: 'INVALID_TYPE' }));

        expect(() =>
            defineType({} as any, {
                name: 'app.Dummy',
                encode: () => ({}),
                decode: () => ({}),
            }),
        ).toThrowError(expect.objectContaining({ code: 'INVALID_TYPE' }));

        expect(() =>
            defineType(Dummy, {
                name: 'app.Dummy',
                encode: null as any,
                decode: () => new Dummy(),
            }),
        ).toThrowError(expect.objectContaining({ code: 'INVALID_TYPE' }));
    });

    it('handles error stack inclusion when errors.stack: true', () => {
        const s = createSereal({ errors: { stack: true } });
        const err = new Error('with stack');
        const encoded = s.encode(err);
        expect((encoded.root as any).v.stack).toBeDefined();
        const decoded = s.decode<Error>(encoded);
        expect(decoded.stack).toBeDefined();
    });

    it('handles unsupported objects (e.g. WeakMap, Promise)', () => {
        const s = createSereal();
        expect(() => s.encode(new WeakMap())).toThrowError(
            expect.objectContaining({ code: 'UNSUPPORTED_VALUE' }),
        );
        expect(() => s.encode(Promise.resolve(1))).toThrowError(
            expect.objectContaining({ code: 'UNSUPPORTED_VALUE' }),
        );

        const omitSereal = createSereal({ unsupported: 'omit' });
        expect(omitSereal.encode(new WeakMap()).root).toEqual({ $: 'undefined' });
    });

    it('handles decode errors on raw numbers or missing root', () => {
        expect(() => decode({ $sereal: 1, root: Number.POSITIVE_INFINITY })).toThrowError(
            expect.objectContaining({ code: 'INVALID_DOCUMENT' }),
        );
        expect(() => decode({ $sereal: 1 })).toThrowError(
            expect.objectContaining({ code: 'INVALID_DOCUMENT' }),
        );
    });

    it('decodes malformed temporal values', () => {
        const expectedCode =
            typeof Temporal !== 'undefined' ? 'INVALID_DOCUMENT' : 'RUNTIME_UNSUPPORTED';
        expect(() =>
            decode({
                $sereal: 1,
                root: { $: 'instant', v: 'not-an-instant' },
            }),
        ).toThrowError(expect.objectContaining({ code: expectedCode }));
    });
});
// #endregion module
