// #region module
export interface SerealableObject<S> {
    toSereal(): S;
    loadSereal(state: S): void;
}

export interface SerealObjectStored<C> {
    class: C;
    current: SerealableObject<C>;
}
// #endregion module
