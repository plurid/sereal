// #region imports
import * as v from 'valibot';
import { describe, expectTypeOf, it } from 'vitest';
import { createSereal, defineType } from '../index.ts';
// #endregion imports

// #region module
describe('Type-level checks', () => {
    it('infers schema output in parse and decode', () => {
        const sereal = createSereal();
        const Schema = v.object({
            id: v.string(),
            count: v.number(),
        });

        const doc = sereal.encode({ id: '123', count: 42 });
        const decoded = sereal.decode(doc, { schema: Schema });
        expectTypeOf(decoded).toEqualTypeOf<{ id: string; count: number }>();

        const parsed = sereal.parse('{}', { schema: Schema });
        expectTypeOf(parsed).toEqualTypeOf<{ id: string; count: number }>();
    });

    it('types defineType correctly', () => {
        class Custom {
            value: string;
            constructor(value: string) {
                this.value = value;
            }
        }

        const typeDef = defineType(Custom, {
            name: 'app.Custom',
            encode: (c) => c.value,
            decode: (d: string) => new Custom(d),
        });

        expectTypeOf(typeDef.name).toEqualTypeOf<string>();
        expectTypeOf(typeDef.kind).toEqualTypeOf<'sereal.type'>();
    });
});
// #endregion module
