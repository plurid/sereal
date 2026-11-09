// #region imports
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { Money, sereal } from './fixtures.ts';
// #endregion imports

// #region module
describe('standard schema validation', () => {
    it('validates custom type payload with schema before instantiation', () => {
        // Valid money
        const validDoc = {
            $sereal: 1,
            root: {
                $: 'acme:Money',
                v: { cents: { $: 'bigint', v: '100' }, currency: 'EUR' },
            },
        };
        const money = sereal.decode<Money>(validDoc);
        expect(money).toBeInstanceOf(Money);
        expect(money.currency).toBe('EUR');

        // Invalid currency length (valibot schema specifies length 3)
        const invalidDoc = {
            $sereal: 1,
            root: {
                $: 'acme:Money',
                v: { cents: { $: 'bigint', v: '100' }, currency: 'EUROPE' },
            },
        };
        expect(() => sereal.decode(invalidDoc)).toThrowError(
            expect.objectContaining({ code: 'SCHEMA_FAILED' }),
        );
    });

    it('validates document level payload with decode({ schema })', () => {
        const AppStateSchema = v.object({
            user: v.string(),
            count: v.number(),
        });

        const doc = sereal.encode({ user: 'alice', count: 42 });
        const res = sereal.decode(doc, { schema: AppStateSchema });
        expect(res).toEqual({ user: 'alice', count: 42 });

        const invalidDoc = sereal.encode({ user: 'alice', count: 'not a number' });
        expect(() => sereal.decode(invalidDoc, { schema: AppStateSchema })).toThrowError(
            expect.objectContaining({ code: 'SCHEMA_FAILED' }),
        );
    });

    it('rejects async schemas with SCHEMA_FAILED', () => {
        const asyncSchema = {
            '~standard': {
                version: 1 as const,
                vendor: 'test',
                validate: async (value: unknown) => ({ value }),
            },
        };

        const doc = sereal.encode({ a: 1 });
        expect(() => sereal.decode(doc, { schema: asyncSchema })).toThrowError(
            expect.objectContaining({ code: 'SCHEMA_FAILED' }),
        );
    });
});
// #endregion module
