// #region methods
class Sereal<S = any> {
    private state: S | undefined;
    private history: S[] = [];


    constructor(
        initial?: any,
    ) {
        if (initial) {
            this.state = initial;
        }
    }


    public step(
        state: S,
    ) {
        if (this.state) {
            // TODO deep clone / object diff
            this.history.push(this.state);
        }

        // deep assignment / object merge
        this.state = {
            ...state,
        };
    }

    public extract() {
        if (!this.state) {
            return;
        }

        const serialization: any = {};

        for (const [key, value] of Object.entries(this.state)) {
            serialization[key] = value;
        }

        return serialization;
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
