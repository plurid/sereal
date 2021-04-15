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

        return this.extractLoop(this.state);
    }

    public intract(
        state: any,
    ) {
        this.state = this.intractLoop(state);
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
        lineage: string = '',
    ) {
        const serialization: any = {};

        for (const item of Object.entries(state)) {
            const [key, value]: [string, any] = item;
            const currentField = lineage
                ? `${lineage}.${key}`
                : key;

            if (
                this.signature
                && this.signedFields
                && this.signedFields[currentField]
            ) {
                const serealObjectName = this.signedFields[currentField];
                const SerealObject = this.signature[serealObjectName].object;

                if (value instanceof SerealObject) {
                    if (value.toSereal) {
                        serialization[key] = value.toSereal();
                    } else {
                        throw `${currentField} is not a Serealable Object. The 'toSereal()' function is not implemented on ${serealObjectName}.`;
                    }
                } else {
                    throw `${currentField} is not an instance of ${serealObjectName}.`
                }

                continue;
            }

            if (
                typeof value === 'object'
            ) {
                serialization[key] = this.extractLoop(
                    value,
                    `${lineage}.${key}`,
                );

                continue;
            }

            serialization[key] = value;
        }

        return serialization;
    }

    private intractLoop(
        state: any,
        lineage: string = '',
    ) {
        const newState: any = {};

        for (const item of Object.entries(state)) {
            const [key, value]: [string, any] = item;
            const currentField = lineage
                ? `${lineage}.${key}`
                : key;

            if (
                this.state
                && this.state[key]
            ) {
                if (
                    this.signature
                    && this.signedFields
                    && this.signedFields[currentField]
                ) {
                    const serealObjectName = this.signedFields[currentField];
                    const SerealObject = this.signature[serealObjectName].object;
                    const serealObject = new SerealObject();

                    if (serealObject.loadSereal) {
                        serealObject.loadSereal(value);
                        newState[key] = serealObject;
                    } else {
                        throw `${currentField} is not a Serealable Object. The 'loadSereal()' function is not implemented on ${serealObjectName}.`;
                    }

                    continue;
                }

                if (
                    typeof value === 'object'
                ) {
                    newState[key] = this.intractLoop(
                        value,
                        `${lineage}.${key}`,
                    );
                    continue;
                }
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
