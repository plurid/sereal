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
            if (
                value.class && value.current
            ) {
                serialization[key] = value.current.toSereal();
                continue;
            }

            serialization[key] = value;
        }

        return serialization;
    }

    public load(
        state: any,
    ) {
        const newState: any = {};

        for (const [key, v] of Object.entries(state)) {
            const value: any = v;

            if (
                this.state && this.state[key]
            ) {
                if (
                    this.state[key].class && this.state[key].current
                ) {
                    newState[key] = new this.state[key].class();
                    newState[key].loadSereal(value);
                }

                continue;
            }

            newState[key] = value;
        }

        this.state = newState;
    }
}
// #endregion methods



// #region exports
export default Sereal;
// #endregion exports
