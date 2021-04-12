// #region imports
    // #region external
    import {
        SerealableObject,
    } from '../../../data/interfaces';

    import Sereal from '../';
    // #endregion external
// #endregion imports



// #region module
describe('Sereal', () => {
    it('works', () => {
        class SomeSereal implements SerealableObject<any> {
            private value = 23;

            public increase() {
                this.value += 1;
            }

            public toSereal() {
                return {
                    value: this.value,
                };
            }

            public loadSereal(
                state: any,
            ) {
                this.value = state.value;
            }
        }

        const someSereal = new SomeSereal();

        const sereal = new Sereal({
            one: '1',
        });

        sereal.step({
            one: '2',
        });
        console.log(sereal.extract());

        sereal.step({
            someSereal: {
                class: SomeSereal,
                current: someSereal,
            },
        });

        console.log(sereal.extract());

        someSereal.increase();
        someSereal.increase();

        console.log(sereal.extract());

        expect(true).toBeTruthy();
    });
});
// #endregion module
