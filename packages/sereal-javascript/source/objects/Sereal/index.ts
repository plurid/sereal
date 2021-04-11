// #region methods
class Sereal<S = any> {
    private state: S | undefined;


    public extract() {
        if (!this.state) {
            return;
        }

        const serialization = {};

        for (const [key, value] of Object.entries(this.state)) {
            serialization[key] = value;
        }
    }

    public load(
        state: any,
    ) {

    }
}
// #endregion methods



// #region exports
export default Sereal;
// #endregion exports
