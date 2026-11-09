// #region imports
import { decodeDocument } from './decode.ts';
import { encodeDocument } from './encode.ts';
import { SerealError } from './errors.ts';
import { createRegistry } from './registry.ts';
import { validateSchema } from './schema.ts';
import type { StandardSchemaV1 } from './standard-schema.ts';
import type { Sereal, SerealDocument, SerealOptions, StringifyOptions } from './types.ts';
// #endregion imports

// #region module
export const DEFAULT_MAX_DEPTH = 1000;

interface AnyDecodeOptions {
    readonly schema?: StandardSchemaV1 | undefined;
}

/**
 * Creates a configured sereal instance.
 *
 * @example
 * const sereal = createSereal({ types: [Point, DecimalType] });
 * const text = sereal.stringify({ origin: new Point(0, 0), when: new Date() });
 * const value = sereal.parse(text);
 */
export const createSereal = (options: SerealOptions = {}): Sereal => {
    const registry = createRegistry(options.types ?? []);
    const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
    if (!Number.isSafeInteger(maxDepth) || maxDepth < 1) {
        throw new RangeError(`sereal: maxDepth must be a positive integer, got ${maxDepth}.`);
    }

    const encoderConfig = {
        registry,
        maxDepth,
        unknownClasses: options.unknownClasses ?? 'throw',
        unsupported: options.unsupported ?? 'throw',
        errorStack: options.errors?.stack ?? false,
    } as const;
    const decoderConfig = { registry, maxDepth } as const;

    const encode = (value: unknown): SerealDocument => encodeDocument(value, encoderConfig);

    const decode = (document: unknown, decodeOptions?: AnyDecodeOptions): unknown => {
        const value = decodeDocument(document, decoderConfig);
        const schema = decodeOptions?.schema;
        return schema ? validateSchema(schema, value, [], 'Decoded value') : value;
    };

    const stringify = (value: unknown, stringifyOptions?: StringifyOptions): string => {
        return JSON.stringify(encode(value), null, stringifyOptions?.space);
    };

    const parse = (text: string, decodeOptions?: AnyDecodeOptions): unknown => {
        if (typeof text !== 'string') {
            throw new SerealError('INVALID_DOCUMENT', 'parse() expects a string.');
        }
        let document: unknown;
        try {
            document = JSON.parse(text);
        } catch (cause) {
            throw new SerealError('INVALID_DOCUMENT', 'Text is not valid JSON.', { cause });
        }
        return decode(document, decodeOptions);
    };

    const extend = (more: SerealOptions): Sereal => {
        return createSereal({
            ...options,
            ...more,
            types: [...(options.types ?? []), ...(more.types ?? [])],
            errors: { ...options.errors, ...more.errors },
        });
    };

    return Object.freeze({
        types: registry.list,
        encode,
        decode: decode as Sereal['decode'],
        stringify,
        parse: parse as Sereal['parse'],
        extend,
    });
};
// #endregion module
