// #region imports
import type { StandardSchemaV1 } from './standard-schema.ts';
import type { fromSereal, serealType, toSereal } from './symbols.ts';
// #endregion imports

// #region module
export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
    | JsonPrimitive
    | readonly JsonValue[]
    | { readonly [key: string]: JsonValue };

/**
 * A sereal document: plain JSON, safe to `JSON.stringify`, store, or send.
 */
export interface SerealDocument {
    readonly $sereal: 1;
    readonly root: JsonValue;
}

/**
 * Upgrades a payload from version `n` to version `n + 1`.
 */
export type Migration = (data: never) => unknown;

/**
 * Migrations keyed by the version they upgrade *from*.
 */
export type Migrations = Readonly<Record<number, Migration>>;

/**
 * Static type information attached to a class with `static [serealType] = { … }`.
 */
export interface SerealTypeInfo {
    /** Unique type name. Must contain a character outside `[a-z0-9-]`, e.g. `geo.Point` or `Point`. */
    readonly name: string;
    /** Current payload version, a positive integer. Defaults to `1`. */
    readonly version?: number;
    /** Migrations keyed by the version they upgrade from. */
    readonly migrations?: Migrations;
    /** Optional Standard Schema validating the (migrated) payload before construction. */
    readonly schema?: StandardSchemaV1;
}

// biome-ignore lint/suspicious/noExplicitAny: constructor parameters are irrelevant for matching.
export type Constructor<T = object> = abstract new (...args: any[]) => T;

/**
 * A class implementing the sereal symbol protocol.
 */
export interface SerealClass {
    readonly prototype: { [toSereal](): unknown };
    readonly [serealType]: SerealTypeInfo;
    [fromSereal](data: never): unknown;
}

/**
 * Input for `defineType()`.
 */
export interface TypeDefinitionInput<T, D> {
    readonly name: string;
    readonly version?: number;
    encode(value: T): D;
    decode(data: D): T;
    readonly migrations?: Migrations;
    readonly schema?: StandardSchemaV1<unknown, D>;
}

/**
 * A normalized, frozen type definition.
 */
export interface TypeDefinition<T = unknown, D = unknown> {
    readonly kind: 'sereal.type';
    readonly target: Constructor<T>;
    readonly name: string;
    readonly version: number;
    encode(value: T): D;
    decode(data: D): T;
    readonly migrations: Migrations;
    readonly schema: StandardSchemaV1 | undefined;
}

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous registry entries.
export type SerealTypeEntry = TypeDefinition<any, any> | SerealClass;

export interface SerealOptions {
    /** Custom types: classes implementing the symbol protocol and/or `defineType()` results. */
    readonly types?: readonly SerealTypeEntry[];
    /**
     * What to do with instances of unregistered classes.
     * - `'throw'` (default): throw `UNSUPPORTED_VALUE`.
     * - `'plain'`: encode own enumerable properties as a plain object (lossy).
     */
    readonly unknownClasses?: 'throw' | 'plain';
    /**
     * What to do with unrepresentable values (functions, unregistered symbols, WeakMaps, …).
     * - `'throw'` (default): throw `UNSUPPORTED_VALUE`.
     * - `'omit'`: drop object properties holding them; encode as `undefined` elsewhere.
     */
    readonly unsupported?: 'throw' | 'omit';
    readonly errors?: {
        /** Include `Error#stack` in encoded errors. Defaults to `false`. */
        readonly stack?: boolean;
    };
    /** Maximum nesting depth when encoding and decoding. Defaults to `1000`. */
    readonly maxDepth?: number;
}

export interface StringifyOptions {
    readonly space?: string | number;
}

export interface SchemaOptions<S extends StandardSchemaV1> {
    readonly schema: S;
}

export interface NoSchemaOptions {
    readonly schema?: undefined;
}

export interface Sereal {
    /** Registered custom types. */
    readonly types: readonly TypeDefinition[];
    /** Encodes a value into a JSON-safe document. */
    encode(value: unknown): SerealDocument;
    /** Decodes a document, optionally validating the result with a Standard Schema. */
    decode<S extends StandardSchemaV1>(
        document: unknown,
        options: SchemaOptions<S>,
    ): StandardSchemaV1.InferOutput<S>;
    decode<T = unknown>(document: unknown, options?: NoSchemaOptions): T;
    /** `JSON.stringify(encode(value))`. */
    stringify(value: unknown, options?: StringifyOptions): string;
    /** `decode(JSON.parse(text))`. */
    parse<S extends StandardSchemaV1>(
        text: string,
        options: SchemaOptions<S>,
    ): StandardSchemaV1.InferOutput<S>;
    parse<T = unknown>(text: string, options?: NoSchemaOptions): T;
    /** Creates a new instance with additional types / overridden options. */
    extend(options: SerealOptions): Sereal;
}
// #endregion module
