// #region imports
    // #region external
    import {
        SerealSignRecord,
        SerealSignedFields,
    } from '../../data/interfaces';
    // #endregion external
// #endregion imports



// #region methods
class Sereal<S = any> {
    private state: S | undefined;
    private history: S[] = [];
    private signature: SerealSignRecord | undefined;
    private signedFields: SerealSignedFields | undefined;


    constructor(
        initialState?: any,
        signature?: SerealSignRecord,
    ) {
        this.state = initialState;

        if (signature) {
            this.signature = signature;
            this.signedFields = this.computeSignedFields(signature);
        }
    }


    public sign(
        signature: SerealSignRecord,
    ) {
        this.signature = signature;
        this.signedFields = this.computeSignedFields(signature);
    }

    public step(
        state: S,
    ) {
        if (this.state) {
            // TODO deep clone / object diff
            this.history.push(this.state);
        }

        this.state = this.assign(state);
    }

    public extract() {
        if (!this.state) {
            return;
        }

        const serialization: any = this.extractLoop(this.state);

        return serialization;
    }

    public load(
        state: any,
    ) {
        const newState: any = this.loadLoop(state);

        this.state = newState;
    }



    private assign(
        obj: any,
    ) {
        // deep assignment / object merge
        return {
            ...obj,
        };
    }

    private extractLoop(
        state: any,
    ) {
        const serialization: any = {};

        for (const item of Object.entries(state)) {
            const [key, value]: [string, any] = item;

            if (
                value.class
                && value.current
            ) {
                serialization[key] = value.current.toSereal();
                continue;
            }

            if (
                typeof value === 'object'
            ) {
                serialization[key] = this.extractLoop(value);
                continue;
            }

            serialization[key] = value;
        }

        return serialization;
    }

    private loadLoop(
        state: any,
    ) {
        const newState: any = {};

        // TODO recursive loop
        for (const item of Object.entries(state)) {
            const [key, value]: [string, any] = item;

            if (
                this.state
                && this.state[key]
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

        return newState;
    }

    private computeSignedFields(
        signature: SerealSignRecord,
    ) {
        const signedFields: SerealSignedFields = {};

        for (const [key, value] of Object.entries(signature)) {
            for (const field of value.fields) {
                signedFields[field] = key;
            }
        }

        return signedFields;
    }
}
// #endregion methods



// #region exports
export default Sereal;
// #endregion exports
