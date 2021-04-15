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


        const sereal = new Sereal({
            one: '1',
        });
        expect(sereal.extract().one).toEqual('1');

        sereal.step({
            one: '2',
        });
        expect(sereal.extract().one).toEqual('2');

        const someSereal = new SomeSereal();
        const someNestedSereal = new SomeSereal();

        sereal.sign({
            SomeSereal: {
                object: SomeSereal,
                fields: [
                    'someSereal',
                    'some.nested.sereal',
                ],
            },
        });
        sereal.step({
            someSereal: someSereal,
            some: {
                nested: {
                    sereal: someNestedSereal,
                },
            },
        });

        someSereal.increase();
        someSereal.increase();

        const extract = sereal.extract();
        expect(extract.someSereal.value).toEqual(25);


        const someOtherSereal = new SomeSereal();
        const someOtherNestedSereal = new SomeSereal();
        const anotherSereal = new Sereal();
        anotherSereal.sign({
            SomeSereal: {
                object: SomeSereal,
                fields: [
                    'someSereal',
                    'some.nested.sereal',
                ],
            },
        });
        anotherSereal.step({
            someSereal: someOtherSereal,
            some: {
                nested: {
                    sereal: someOtherNestedSereal,
                },
            },
        });
        expect(anotherSereal.extract().someSereal.value).toEqual(23);
        anotherSereal.intract(extract);
        expect(anotherSereal.extract().someSereal.value).toEqual(25);

        expect(true).toBeTruthy();
    });
});
// #endregion module
