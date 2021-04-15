// #region module
export interface SerealableObject<S> {
    toSereal(): S;
    loadSereal(state: S): void;
}

export interface SerealObjectStored<C> {
    class: C;
    current: SerealableObject<C>;
}


export interface SerealSign {
    object: Object;
    fields: string[];
}

export type SerealSignRecord = Record<string, SerealSign>;

export type SerealSignedFields = Record<string, string>;
// #endregion module
