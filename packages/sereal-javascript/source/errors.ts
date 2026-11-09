// #region imports
import type { StandardSchemaV1 } from './standard-schema.ts';
// #endregion imports

// #region module
/**
 * Machine-readable error codes. These are part of the format specification
 * (`about/spec/sereal-format-v1.md`) and are stable across implementations.
 */
export type SerealErrorCode =
    /** A value cannot be represented (function, unregistered symbol, WeakMap, …). */
    | 'UNSUPPORTED_VALUE'
    /** A document references a custom type that is not registered. */
    | 'UNKNOWN_TYPE'
    /** A type definition is malformed (bad name, missing protocol method, …). */
    | 'INVALID_TYPE'
    /** Two type definitions share a name or a constructor. */
    | 'DUPLICATE_TYPE'
    /** A document is structurally invalid. */
    | 'INVALID_DOCUMENT'
    /** A document was written by a newer version of a type than the one registered. */
    | 'VERSION_TOO_NEW'
    /** No migration is registered to upgrade an older payload. */
    | 'MISSING_MIGRATION'
    /** A Standard Schema rejected a decoded payload. */
    | 'SCHEMA_FAILED'
    /** A reference cycle passes through a custom type instance. */
    | 'UNSUPPORTED_CYCLE'
    /** Nesting exceeds the configured `maxDepth`. */
    | 'MAX_DEPTH'
    /** The current runtime lacks a feature required to decode a value (e.g. `Temporal`). */
    | 'RUNTIME_UNSUPPORTED';

export type SerealPath = readonly (string | number)[];

export interface SerealErrorOptions {
    readonly path?: SerealPath;
    readonly issues?: readonly StandardSchemaV1.Issue[];
    readonly cause?: unknown;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * Formats a path as a JSONPath-like string, e.g. `$.some.nested[0]["odd key"]`.
 */
export const formatPath = (path: SerealPath): string => {
    let out = '$';
    for (const segment of path) {
        if (typeof segment === 'number') {
            out += `[${segment}]`;
        } else if (IDENTIFIER.test(segment)) {
            out += `.${segment}`;
        } else {
            out += `[${JSON.stringify(segment)}]`;
        }
    }
    return out;
};

export class SerealError extends Error {
    override readonly name: string = 'SerealError';
    readonly code: SerealErrorCode;
    readonly path: SerealPath;
    readonly issues: readonly StandardSchemaV1.Issue[] | undefined;

    constructor(code: SerealErrorCode, message: string, options: SerealErrorOptions = {}) {
        const path = options.path ?? [];
        const where = path.length > 0 ? ` (at ${formatPath(path)})` : '';
        super(
            `[${code}] ${message}${where}`,
            options.cause === undefined ? undefined : { cause: options.cause },
        );
        this.code = code;
        this.path = Object.freeze([...path]);
        this.issues = options.issues;
    }
}
// #endregion module
