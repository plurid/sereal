// #region module
/**
 * Instance method returning the payload that represents the instance.
 * The payload may contain any value sereal can encode (including other custom types).
 */
export const toSereal: unique symbol = Symbol.for('@plurid/sereal/toSereal');

/**
 * Static factory receiving the (decoded, migrated, validated) payload and returning an instance.
 */
export const fromSereal: unique symbol = Symbol.for('@plurid/sereal/fromSereal');

/**
 * Static type information: `{ name, version?, migrations?, schema? }`.
 */
export const serealType: unique symbol = Symbol.for('@plurid/sereal/type');
// #endregion module
