// #region imports
import { createSereal } from './sereal.ts';
import type { Sereal } from './types.ts';
// #endregion imports

// #region module
export { createSereal } from './sereal.ts';
export { defineType } from './registry.ts';
export { fromSereal, serealType, toSereal } from './symbols.ts';
export { formatPath, SerealError } from './errors.ts';

export type { SerealErrorCode, SerealErrorOptions, SerealPath } from './errors.ts';
export type { StandardSchemaV1 } from './standard-schema.ts';
export type {
    Constructor,
    JsonPrimitive,
    JsonValue,
    Migration,
    Migrations,
    NoSchemaOptions,
    SchemaOptions,
    Sereal,
    SerealClass,
    SerealDocument,
    SerealOptions,
    SerealTypeEntry,
    SerealTypeInfo,
    StringifyOptions,
    TypeDefinition,
    TypeDefinitionInput,
} from './types.ts';

const defaultSereal: Sereal = createSereal();

/** Encodes a value with built-in types only. See `createSereal()` for custom types. */
export const encode: Sereal['encode'] = defaultSereal.encode;
/** Decodes a document with built-in types only. */
export const decode: Sereal['decode'] = defaultSereal.decode;
/** Stringifies a value with built-in types only. */
export const stringify: Sereal['stringify'] = defaultSereal.stringify;
/** Parses text with built-in types only. */
export const parse: Sereal['parse'] = defaultSereal.parse;
// #endregion module
