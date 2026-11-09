// #region imports
import { describe, expect, it } from 'vitest';
import { decode, encode, parse, stringify } from '../index.ts';
import { roundTrip } from './fixtures.ts';
// #endregion imports

// #region module
describe('built-in types', () => {
    it('passes JSON values through unchanged', () => {
        const value = { s: 'x', n: 1.5, b: true, z: null, list: [1, 'two', [3]], deep: { a: {} } };
        expect(encode(value)).toEqual({ $sereal: 1, root: value });
        expect(roundTrip(value)).toEqual(value);
    });

    it('round-trips special numbers', () => {
        const value = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0, 0];
        const back = roundTrip(value);
        expect(back).toEqual(value);
        expect(Object.is(back[3], -0)).toBe(true);
        expect(Object.is(back[4], 0)).toBe(true);
    });

    it('round-trips undefined in objects and arrays', () => {
        const back = roundTrip({ missing: undefined, list: [undefined, 1] });
        expect(Object.hasOwn(back, 'missing')).toBe(true);
        expect(back.missing).toBeUndefined();
        expect(back.list).toEqual([undefined, 1]);
        expect(roundTrip(undefined)).toBeUndefined();
    });

    it('encodes array holes as undefined', () => {
        // biome-ignore lint/suspicious/noSparseArray: testing holes
        expect(roundTrip([1, , 3])).toEqual([1, undefined, 3]);
    });

    it('round-trips bigint', () => {
        const value = [0n, -1n, 2n ** 128n, -(2n ** 70n)];
        expect(roundTrip(value)).toEqual(value);
        expect(encode(10n).root).toEqual({ $: 'bigint', v: '10' });
    });

    it('round-trips registered symbols', () => {
        expect(roundTrip(Symbol.for('app.key'))).toBe(Symbol.for('app.key'));
    });

    it('round-trips dates, including invalid dates', () => {
        const date = new Date('2026-11-09T06:00:00.000Z');
        expect(roundTrip(date)).toEqual(date);
        expect(encode(date).root).toEqual({ $: 'date', v: '2026-11-09T06:00:00.000Z' });
        const invalid = roundTrip(new Date(Number.NaN));
        expect(invalid).toBeInstanceOf(Date);
        expect(Number.isNaN(invalid.getTime())).toBe(true);
    });

    it('round-trips regular expressions', () => {
        const back = roundTrip(/^a+\/b$/gimsuy);
        expect(back.source).toBe('^a+\\/b$');
        expect(back.flags).toBe('gimsuy');
    });

    it('round-trips URLs', () => {
        const back = roundTrip(new URL('https://plurid.com/a?b=1#c'));
        expect(back).toBeInstanceOf(URL);
        expect(back.href).toBe('https://plurid.com/a?b=1#c');
    });

    it('round-trips maps with arbitrary keys', () => {
        const key = { k: 1 };
        const map = new Map<unknown, unknown>([
            [key, 'object key'],
            [1n, new Set([1])],
            [undefined, null],
        ]);
        const back = roundTrip(map);
        expect(back).toBeInstanceOf(Map);
        expect([...back.keys()]).toEqual([{ k: 1 }, 1n, undefined]);
        expect([...back.values()]).toEqual(['object key', new Set([1]), null]);
    });

    it('round-trips sets', () => {
        const set = new Set(['a', 1, null, new Date(0)]);
        expect(roundTrip(set)).toEqual(set);
    });

    it('round-trips errors with name, message, cause and no misleading stack', () => {
        const error = new TypeError('boom', { cause: new RangeError('inner') });
        const back = roundTrip(error);
        expect(back).toBeInstanceOf(TypeError);
        expect(back.message).toBe('boom');
        expect(back.cause).toBeInstanceOf(RangeError);
        expect((back.cause as Error).message).toBe('inner');
        expect(back.stack).toBe('TypeError: boom');
        expect(Object.keys(back)).toEqual([]);
    });

    it('round-trips errors with custom names as Error', () => {
        class ValidationError extends Error {
            override name = 'ValidationError';
        }
        const back = roundTrip(new ValidationError('bad'));
        expect(back).toBeInstanceOf(Error);
        expect(back.name).toBe('ValidationError');
        expect(back.message).toBe('bad');
    });

    it('does not resolve error names through the prototype chain', () => {
        const back = decode({
            $sereal: 1,
            root: { $: 'error', v: { name: 'constructor', message: 'x' } },
        }) as Error;
        expect(back).toBeInstanceOf(Error);
        expect(back.name).toBe('constructor');
    });

    it('round-trips aggregate errors', () => {
        const back = roundTrip(new AggregateError([new Error('a'), 'b'], 'many'));
        expect(back).toBeInstanceOf(AggregateError);
        expect(back.errors).toEqual([new Error('a'), 'b']);
    });

    it('round-trips array buffers and data views', () => {
        const buffer = new Uint8Array([1, 2, 3]).buffer;
        expect(new Uint8Array(roundTrip(buffer))).toEqual(new Uint8Array([1, 2, 3]));
        const view = roundTrip(new DataView(new Uint8Array([9, 8, 7, 6]).buffer, 1, 2));
        expect(view).toBeInstanceOf(DataView);
        expect([view.getUint8(0), view.getUint8(1)]).toEqual([8, 7]);
    });

    it.each([
        ['Uint8Array', new Uint8Array([0, 1, 255])],
        ['Uint8ClampedArray', new Uint8ClampedArray([0, 128, 255])],
        ['Int8Array', new Int8Array([-128, 0, 127])],
        ['Uint16Array', new Uint16Array([0, 65535])],
        ['Int16Array', new Int16Array([-32768, 32767])],
        ['Uint32Array', new Uint32Array([0, 2 ** 32 - 1])],
        ['Int32Array', new Int32Array([-(2 ** 31), 2 ** 31 - 1])],
        ['Float16Array', new Float16Array([1.5, -2, Number.POSITIVE_INFINITY])],
        ['Float32Array', new Float32Array([1.5, Number.NaN, -0])],
        ['Float64Array', new Float64Array([Math.PI, Number.MIN_VALUE])],
        ['BigInt64Array', new BigInt64Array([-(2n ** 63n), 2n ** 63n - 1n])],
        ['BigUint64Array', new BigUint64Array([0n, 2n ** 64n - 1n])],
    ])('round-trips %s', (_name, array) => {
        const back = roundTrip(array);
        expect(back.constructor).toBe(array.constructor);
        expect(back).toEqual(array);
    });

    it('encodes only the viewed bytes of a typed array', () => {
        const buffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
        const view = new Uint16Array(buffer, 2, 2);
        expect(roundTrip(view)).toEqual(new Uint16Array([0x0403, 0x0605]));
    });

    it('round-trips Node.js Buffers as Uint8Array', () => {
        const back = roundTrip(Buffer.from('hello'));
        expect(back.constructor).toBe(Uint8Array);
        expect(new TextDecoder().decode(back)).toBe('hello');
    });

    it('round-trips Temporal values', () => {
        const values = {
            instant: Temporal.Instant.from('2026-11-09T06:00:00Z'),
            zoned: Temporal.ZonedDateTime.from('2026-11-09T08:00:00+02:00[Europe/Bucharest]'),
            date: Temporal.PlainDate.from('2026-11-09'),
            time: Temporal.PlainTime.from('08:30:15.123'),
            dateTime: Temporal.PlainDateTime.from('2026-11-09T08:30'),
            yearMonth: Temporal.PlainYearMonth.from('2026-11'),
            monthDay: Temporal.PlainMonthDay.from('11-09'),
            duration: Temporal.Duration.from({ hours: 1, minutes: 30 }),
        };
        const back = roundTrip(values);
        for (const [key, value] of Object.entries(values)) {
            const decoded = back[key as keyof typeof values];
            expect(Object.prototype.toString.call(decoded)).toBe(
                Object.prototype.toString.call(value),
            );
            expect(String(decoded)).toBe(String(value));
        }
        expect(encode(values.zoned).root).toEqual({
            $: 'zoneddatetime',
            v: '2026-11-09T08:00:00+02:00[Europe/Bucharest]',
        });
    });

    it('escapes plain objects that own a "$" key', () => {
        const value = { $: 'not a tag', nested: { $: { $: 1 } } };
        expect(encode(value).root).toEqual({
            $: 'object',
            v: { $: 'not a tag', nested: { $: 'object', v: { $: { $: 'object', v: { $: 1 } } } } },
        });
        expect(roundTrip(value)).toEqual(value);
    });

    it('decodes null-prototype objects as plain objects', () => {
        const value = Object.assign(Object.create(null) as object, { a: 1 });
        expect(roundTrip(value)).toEqual({ a: 1 });
    });

    it('stringify/parse support indentation', () => {
        expect(stringify({ a: 1 }, { space: 2 })).toBe(
            '{\n  "$sereal": 1,\n  "root": {\n    "a": 1\n  }\n}',
        );
        expect(parse('{"$sereal":1,"root":{"$":"inf"}}')).toBe(Number.POSITIVE_INFINITY);
    });
});
// #endregion module
