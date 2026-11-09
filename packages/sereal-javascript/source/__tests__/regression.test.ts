// #region imports
import { describe, expect, it } from 'vitest';
import { createSereal, fromSereal, serealType, toSereal } from '../index.ts';
// #endregion imports

// #region module
describe('regression tests', () => {
    it('handles nested objects that failed in 0.x due to path signatures', () => {
        class SomeSereal {
            static readonly [serealType] = { name: 'app.SomeSereal' };
            private value = 23;

            public increase() {
                this.value += 1;
            }

            public get current() {
                return this.value;
            }

            public [toSereal]() {
                return { value: this.value };
            }

            public static [fromSereal](state: { value: number }) {
                const inst = new SomeSereal();
                inst.value = state.value;
                return inst;
            }
        }

        const sereal = createSereal({ types: [SomeSereal] });

        const someSereal = new SomeSereal();
        const someNestedSereal = new SomeSereal();

        const state = {
            someSereal: someSereal,
            some: {
                nested: {
                    sereal: someNestedSereal,
                },
            },
        };

        someSereal.increase();
        someSereal.increase();

        const serialized = sereal.stringify(state);
        const restored: any = sereal.parse(serialized);

        expect(restored.someSereal).toBeInstanceOf(SomeSereal);
        expect(restored.some.nested.sereal).toBeInstanceOf(SomeSereal);
        expect(restored.someSereal.current).toBe(25);
        expect(restored.some.nested.sereal.current).toBe(23);
    });
});
// #endregion module
