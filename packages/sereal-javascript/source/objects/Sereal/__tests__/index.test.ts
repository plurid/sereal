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
        expect(sereal.extract().one).toEqual('2');

        sereal.step({
            someSereal: {
                class: SomeSereal,
                current: someSereal,
            },
        });

        someSereal.increase();
        someSereal.increase();

        const extract = sereal.extract();
        expect(extract.someSereal.value).toEqual(25);


        const someOtherSereal = new SomeSereal();
        const anotherSereal = new Sereal();
        anotherSereal.step({
            someSereal: {
                class: SomeSereal,
                current: someOtherSereal,
            },
        });
        expect(anotherSereal.extract().someSereal.value).toEqual(23);
        anotherSereal.load(extract);
        expect(anotherSereal.extract().someSereal.value).toEqual(25);

        expect(true).toBeTruthy();
    });
});
// #endregion module
