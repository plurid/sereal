// #region imports
import { describe, expect, it } from 'vitest';
import { createSereal, defineType, fromSereal, serealType, toSereal } from '../index.ts';
import { Money, Point, sereal } from './fixtures.ts';
// #endregion imports

// #region module
describe('custom types', () => {
    it('serializes and deserializes class using symbol protocol', () => {
        const point = new Point(10, 20);
        const encoded = sereal.encode(point);
        expect(encoded.root).toEqual({
            $: 'test.Point@2',
            v: { x: 10, y: 20 },
        });

        const decoded = sereal.decode<Point>(encoded);
        expect(decoded).toBeInstanceOf(Point);
        expect(decoded.x).toBe(10);
        expect(decoded.y).toBe(20);
    });

    it('serializes and deserializes class using defineType()', () => {
        const money = new Money(5000n, 'USD');
        const encoded = sereal.encode(money);
        expect(encoded.root).toEqual({
            $: 'acme:Money',
            v: { cents: { $: 'bigint', v: '5000' }, currency: 'USD' },
        });

        const decoded = sereal.decode<Money>(encoded);
        expect(decoded).toBeInstanceOf(Money);
        expect(decoded.cents).toBe(5000n);
        expect(decoded.currency).toBe('USD');
    });

    it('throws UNSUPPORTED_VALUE on unregistered classes by default', () => {
        class Unregistered {
            public value = 42;
        }

        expect(() => sereal.encode(new Unregistered())).toThrowError(
            expect.objectContaining({
                name: 'SerealError',
                code: 'UNSUPPORTED_VALUE',
            }),
        );
    });

    it('encodes unregistered classes as plain object when unknownClasses: "plain"', () => {
        class CustomClass {
            public foo = 'bar';
            public num = 123;
        }

        const plainSereal = createSereal({ unknownClasses: 'plain' });
        const doc = plainSereal.encode(new CustomClass());
        expect(doc.root).toEqual({ foo: 'bar', num: 123 });
    });

    it('supports unsupported: "omit" vs "throw"', () => {
        const withFn = {
            a: 1,
            fn: () => {},
            sym: Symbol('unregistered'),
        };

        expect(() => sereal.encode(withFn)).toThrowError(
            expect.objectContaining({ code: 'UNSUPPORTED_VALUE' }),
        );

        const omitSereal = createSereal({ unsupported: 'omit' });
        const encoded = omitSereal.encode(withFn);
        expect(encoded.root).toEqual({ a: 1 });
    });

    it('rejects invalid type names', () => {
        expect(() =>
            defineType(class Bad {}, {
                name: 'invalid name with spaces',
                encode: () => ({}),
                decode: () => new (class Bad {})(),
            }),
        ).toThrowError(expect.objectContaining({ code: 'INVALID_TYPE' }));

        // Reserved built-in namespace [a-z0-9-]
        expect(() =>
            defineType(class Bad {}, {
                name: 'custom-tag',
                encode: () => ({}),
                decode: () => new (class Bad {})(),
            }),
        ).toThrowError(expect.objectContaining({ code: 'INVALID_TYPE' }));
    });

    it('rejects duplicate type registrations', () => {
        class A {}
        const def1 = defineType(A, {
            name: 'test.Dup',
            encode: () => ({}),
            decode: () => new A(),
        });
        const def2 = defineType(A, {
            name: 'test.Dup2',
            encode: () => ({}),
            decode: () => new A(),
        });

        expect(() => createSereal({ types: [def1, def2] })).toThrowError(
            expect.objectContaining({ code: 'DUPLICATE_TYPE' }),
        );

        class B {}
        const def3 = defineType(B, {
            name: 'test.Dup',
            encode: () => ({}),
            decode: () => new B(),
        });
        expect(() => createSereal({ types: [def1, def3] })).toThrowError(
            expect.objectContaining({ code: 'DUPLICATE_TYPE' }),
        );
    });

    it('rejects classes missing protocol methods or static info', () => {
        class NoInfo {}
        // @ts-expect-error test invalid protocol class
        expect(() => createSereal({ types: [NoInfo] })).toThrowError(
            expect.objectContaining({ code: 'INVALID_TYPE' }),
        );

        class MissingEncode {
            static [serealType] = { name: 'test.Missing' };
            dummy = 1;
            static [fromSereal]() {
                return new MissingEncode();
            }
        }
        // @ts-expect-error test invalid protocol class
        expect(() => createSereal({ types: [MissingEncode] })).toThrowError(
            expect.objectContaining({ code: 'INVALID_TYPE' }),
        );

        class MissingDecode {
            static [serealType] = { name: 'test.MissingDecode' };
            [toSereal]() {
                return {};
            }
        }
        // @ts-expect-error test invalid protocol class
        expect(() => createSereal({ types: [MissingDecode] })).toThrowError(
            expect.objectContaining({ code: 'INVALID_TYPE' }),
        );
    });

    it('allows extending an existing Sereal instance', () => {
        class Extra {
            static readonly [serealType] = { name: 'test.Extra' };
            [toSereal]() {
                return 'extra';
            }
            static [fromSereal](_d: string) {
                return new Extra();
            }
        }

        const extended = sereal.extend({ types: [Extra] });
        expect(extended.types.length).toBe(sereal.types.length + 1);
        const encoded = extended.encode(new Extra());
        expect(encoded.root).toEqual({ $: 'test.Extra', v: 'extra' });
    });
});
// #endregion module
