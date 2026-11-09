// #region imports
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { decode, encode } from '../index.ts';
// #endregion imports

// #region module
describe('property-based tests (fast-check)', () => {
    // Generator for JSON-safe primitives and structures
    const primitiveArb = fc.oneof(
        fc.string(),
        fc.double({ noNaN: true }),
        fc.boolean(),
        fc.constant(null),
        fc.bigInt(),
        fc.date(),
    );

    const jsonLikeArb = fc.letrec((tie) => ({
        leaf: primitiveArb,
        array: fc.array(tie('node'), { maxLength: 5 }),
        object: fc.dictionary(fc.string({ maxLength: 10 }), tie('node'), { maxKeys: 5 }),
        node: fc.oneof({ depthSize: 'small' }, tie('leaf'), tie('array'), tie('object')),
    })).node;

    it('round-trips arbitrary complex values with encode/decode', () => {
        fc.assert(
            fc.property(jsonLikeArb, (value) => {
                const encoded = encode(value);
                const decoded = decode(encoded);
                const reEncoded = encode(decoded);

                expect(reEncoded).toEqual(encoded);
            }),
            { numRuns: 100 },
        );
    });

    it('is idempotent on encode(decode(doc))', () => {
        fc.assert(
            fc.property(jsonLikeArb, (value) => {
                const doc1 = encode(value);
                const val1 = decode(doc1);
                const doc2 = encode(val1);
                const val2 = decode(doc2);
                const doc3 = encode(val2);

                expect(doc3).toEqual(doc2);
            }),
            { numRuns: 100 },
        );
    });
});
// #endregion module
