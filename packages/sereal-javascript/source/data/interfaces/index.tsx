// #region module
export interface SerealableObject<S = any> {
    toSereal(): S;
    loadSereal(state: S): void;
}


export interface SerealSign {
    object: any;
    fields: string[];
}

export type SerealSignRecord = Record<string, SerealSign>;

export type SerealSignedFields = Record<string, string>;
// #endregion module
