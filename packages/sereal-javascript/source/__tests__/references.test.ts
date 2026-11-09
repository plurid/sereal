// #region imports
import { describe, expect, it } from 'vitest';
import { createSereal, fromSereal, serealType, toSereal } from '../index.ts';
import { sereal } from './fixtures.ts';
// #endregion imports

// #region module
describe('references and cycles', () => {
    it('preserves shared object reference identity', () => {
        const shared = { hello: 'world' };
        const data = { first: shared, second: shared, list: [shared] };

        const encoded = sereal.encode(data);
        expect((encoded.root as any).first).toHaveProperty('id', 1);
        expect((encoded.root as any).second).toEqual({ $: 'ref', v: 1 });
        expect((encoded.root as any).list[0]).toEqual({ $: 'ref', v: 1 });

        const decoded = sereal.decode<typeof data>(encoded);
        expect(decoded.first).toBe(decoded.second);
        expect(decoded.list[0]).toBe(decoded.first);
    });

    it('preserves shared array reference identity', () => {
        const shared = [1, 2, 3];
        const data = [shared, shared];

        const encoded = sereal.encode(data);
        expect((encoded.root as any)[0]).toEqual({ $: 'array', id: 1, v: [1, 2, 3] });
        expect((encoded.root as any)[1]).toEqual({ $: 'ref', v: 1 });

        const decoded = sereal.decode<typeof data>(encoded);
        expect(decoded[0]).toBe(decoded[1]);
    });

    it('handles direct and indirect object cycles', () => {
        const a: any = { name: 'A' };
        const b: any = { name: 'B', a };
        a.b = b;

        const decoded = sereal.decode<any>(sereal.encode(a));
        expect(decoded.b.a).toBe(decoded);
    });

    it('handles cycles in Map and Set', () => {
        const map = new Map<any, any>();
        map.set('self', map);

        const decodedMap = sereal.decode<Map<any, any>>(sereal.encode(map));
        expect(decodedMap.get('self')).toBe(decodedMap);

        const set = new Set<any>();
        set.add(set);

        const decodedSet = sereal.decode<Set<any>>(sereal.encode(set));
        expect(decodedSet.has(decodedSet)).toBe(true);
    });

    it('fails with UNSUPPORTED_CYCLE when a custom type instance is in its own payload', () => {
        class RecursiveType {
            static readonly [serealType] = { name: 'test.Recursive' };
            child: any = null;

            [toSereal]() {
                return { child: this.child };
            }
            static [fromSereal](data: any) {
                const inst = new RecursiveType();
                inst.child = data.child;
                return inst;
            }
        }

        const s = createSereal({ types: [RecursiveType] });
        const inst = new RecursiveType();
        inst.child = inst;

        expect(() => s.encode(inst)).toThrowError(
            expect.objectContaining({ code: 'UNSUPPORTED_CYCLE' }),
        );
    });

    it('fails with UNSUPPORTED_CYCLE on decode when a ref points to a custom node being constructed', () => {
        const doc = {
            $sereal: 1,
            root: {
                $: 'test.Point@2',
                id: 1,
                v: {
                    x: { $: 'ref', v: 1 },
                    y: 2,
                },
            },
        };

        expect(() => sereal.decode(doc)).toThrowError(
            expect.objectContaining({ code: 'UNSUPPORTED_CYCLE' }),
        );
    });
});
// #endregion module
