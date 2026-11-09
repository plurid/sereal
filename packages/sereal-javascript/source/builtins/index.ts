// #region imports
import { arrayBufferCodec, dataViewCodec, type SimpleCodec, typedArrayCodecs } from './binary.ts';
import { temporalCodecs } from './temporal.ts';
// #endregion imports

// #region module
const toStringTag = (value: object): string => {
    return Object.prototype.toString.call(value).slice(8, -1);
};

export const dateCodec: SimpleCodec = {
    tag: 'date',
    encode: (value) => {
        const date = value as Date;
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    },
    decode: (payload, fail) => {
        if (payload === null) {
            return new Date(Number.NaN);
        }
        if (typeof payload !== 'string') {
            return fail('INVALID_DOCUMENT', '"date" payload must be an ISO string or null.');
        }
        const date = new Date(payload);
        if (Number.isNaN(date.getTime())) {
            return fail('INVALID_DOCUMENT', `"date" payload "${payload}" is not a valid date.`);
        }
        return date;
    },
};

export const regexpCodec: SimpleCodec = {
    tag: 'regexp',
    encode: (value) => {
        const regexp = value as RegExp;
        return { source: regexp.source, flags: regexp.flags };
    },
    decode: (payload, fail) => {
        const { source, flags } = (payload ?? {}) as { source?: unknown; flags?: unknown };
        if (typeof source !== 'string' || typeof flags !== 'string') {
            return fail('INVALID_DOCUMENT', '"regexp" payload must be { source, flags } strings.');
        }
        try {
            return new RegExp(source, flags);
        } catch {
            return fail('INVALID_DOCUMENT', '"regexp" payload is not a valid regular expression.');
        }
    },
};

export const urlCodec: SimpleCodec = {
    tag: 'url',
    encode: (value) => (value as URL).href,
    decode: (payload, fail) => {
        if (typeof payload !== 'string' || !URL.canParse(payload)) {
            return fail('INVALID_DOCUMENT', '"url" payload must be an absolute URL string.');
        }
        return new URL(payload);
    },
};

const simpleCodecList: readonly SimpleCodec[] = [
    dateCodec,
    regexpCodec,
    urlCodec,
    arrayBufferCodec,
    dataViewCodec,
    ...typedArrayCodecs.values(),
    ...temporalCodecs.values(),
];

/**
 * All simple (leaf) built-in codecs keyed by their tag.
 */
export const simpleCodecsByTag: ReadonlyMap<string, SimpleCodec> = new Map(
    simpleCodecList.map((codec) => [codec.tag, codec]),
);

/**
 * Finds the leaf codec for a non-plain object, if any.
 */
export const findSimpleCodec = (value: object): SimpleCodec | undefined => {
    if (value instanceof Date) {
        return dateCodec;
    }
    if (value instanceof RegExp) {
        return regexpCodec;
    }
    if (typeof URL === 'function' && value instanceof URL) {
        return urlCodec;
    }
    if (ArrayBuffer.isView(value)) {
        return value instanceof DataView ? dataViewCodec : typedArrayCodecs.get(toStringTag(value));
    }
    if (value instanceof ArrayBuffer) {
        return arrayBufferCodec;
    }
    return temporalCodecs.get(toStringTag(value));
};

const UNSUPPORTED_OBJECTS: readonly string[] = [
    'WeakMap',
    'WeakSet',
    'WeakRef',
    'FinalizationRegistry',
    'Promise',
    'SharedArrayBuffer',
    'Generator',
    'AsyncGenerator',
];

/**
 * Objects that are never representable, regardless of `unknownClasses`.
 */
export const isUnsupportedObject = (value: object): boolean => {
    return UNSUPPORTED_OBJECTS.includes(toStringTag(value));
};

export const isError = (value: object): value is Error => {
    const native = (Error as { isError?: (value: unknown) => boolean }).isError;
    return value instanceof Error || (typeof native === 'function' && native(value));
};

/**
 * Standard error constructors that can be reconstructed by name.
 */
export const ERROR_CONSTRUCTORS: Readonly<Record<string, ErrorConstructor>> = {
    Error,
    EvalError,
    RangeError,
    ReferenceError,
    SyntaxError,
    TypeError,
    URIError,
};

export type { SimpleCodec };
// #endregion module
