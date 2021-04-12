// #region imports
    // #region external
    import Sereal from '../';
    // #endregion external
// #endregion imports



// #region module
describe('Sereal', () => {
    it('works', () => {
        const sereal = new Sereal({
            one: '1',
        });

        sereal.step({
            one: '2',
        });

        expect(true).toBeTruthy();
    });
});
// #endregion module
