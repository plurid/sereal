// #region imports
import { ERROR_CONSTRUCTORS, simpleCodecsByTag } from './builtins/index.ts';
import type { Fail } from './builtins/binary.ts';
import { defineKey } from './encode.ts';
import { SerealError, type SerealErrorCode } from './errors.ts';
import { BUILTIN_TAG, parseTag, type Registry } from './registry.ts';
import { validateSchema } from './schema.ts';
import type { JsonValue } from './types.ts';
// #endregion imports

// #region module
export interface DecoderConfig {
    readonly registry: Registry;
    readonly maxDepth: number;
}

type Source = Readonly<Record<string, unknown>>;

const TAGGED_KEYS = new Set(['$', 'id', 'v']);
const ERROR_KEYS = new Set(['name', 'message', 'cause', 'errors', 'stack']);
const BIGINT = /^-?(?:0|[1-9]\d*)$/;

const PRIMITIVE_TAGS: Readonly<Record<string, unknown>> = {
    undefined: undefined,
    nan: Number.NaN,
    inf: Number.POSITIVE_INFINITY,
    '-inf': Number.NEGATIVE_INFINITY,
    '-0': -0,
};

export const isPlainObject = (value: unknown): value is Source => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value) as object | null;
    return prototype === Object.prototype || prototype === null;
};

const hidden = (target: object, key: string, value: unknown): void => {
    Object.defineProperty(target, key, {
        value,
        enumerable: false,
        writable: true,
        configurable: true,
    });
};

class Decoder {
    private readonly config: DecoderConfig;
    private readonly refs = new Map<number, unknown>();
    private readonly pending = new Set<number>();
    private readonly path: (string | number)[] = [];
    private depth = 0;

    constructor(config: DecoderConfig) {
        this.config = config;
    }

    private readonly failFn: Fail = (code, message) => this.fail(code, message);

    private fail(code: SerealErrorCode, message: string): never {
        throw new SerealError(code, message, { path: this.path });
    }

    private enter(segment: string | number): void {
        this.path.push(segment);
        this.depth += 1;
        if (this.depth > this.config.maxDepth) {
            this.fail('MAX_DEPTH', `Nesting exceeds maxDepth (${this.config.maxDepth}).`);
        }
    }

    private leave(): void {
        this.path.pop();
        this.depth -= 1;
    }

    node(node: unknown): unknown {
        switch (typeof node) {
            case 'string':
            case 'boolean':
                return node;
            case 'number':
                if (!Number.isFinite(node)) {
                    return this.fail(
                        'INVALID_DOCUMENT',
                        'Raw numbers must be finite; non-finite values use the nan/inf/-inf tags.',
                    );
                }
                return node;
            case 'object': {
                if (node === null) {
                    return null;
                }
                if (Array.isArray(node)) {
                    return this.fillArray([], node);
                }
                if (!isPlainObject(node)) {
                    return this.fail('INVALID_DOCUMENT', 'Documents may only contain JSON values.');
                }
                if (Object.hasOwn(node, '$')) {
                    return this.tagged(node);
                }
                return this.fillObject({}, node);
            }
            default:
                return this.fail(
                    'INVALID_DOCUMENT',
                    `Unexpected ${typeof node} value; documents may only contain JSON values.`,
                );
        }
    }

    private fillArray(out: unknown[], source: readonly unknown[]): unknown[] {
        for (let index = 0; index < source.length; index += 1) {
            this.enter(index);
            out.push(this.node(source[index]));
            this.leave();
        }
        return out;
    }

    private fillObject(out: object, source: Source): object {
        for (const key of Object.keys(source)) {
            this.enter(key);
            defineKey(out, key, this.node(source[key]));
            this.leave();
        }
        return out;
    }

    private register(id: number | undefined, value: unknown): void {
        if (id !== undefined) {
            this.refs.set(id, value);
        }
    }

    private tagged(node: Source): unknown {
        const tag = node.$;
        if (typeof tag !== 'string') {
            return this.fail('INVALID_DOCUMENT', 'Tag "$" must be a string.');
        }
        for (const key of Object.keys(node)) {
            if (!TAGGED_KEYS.has(key)) {
                this.fail('INVALID_DOCUMENT', `Tagged node "${tag}" has unexpected key "${key}".`);
            }
        }
        const hasPayload = Object.hasOwn(node, 'v');
        const payload = node.v;
        let id: number | undefined;
        if (Object.hasOwn(node, 'id')) {
            const candidate = node.id;
            if (
                typeof candidate !== 'number' ||
                !Number.isSafeInteger(candidate) ||
                candidate < 1
            ) {
                return this.fail('INVALID_DOCUMENT', 'Node "id" must be a positive integer.');
            }
            if (this.refs.has(candidate) || this.pending.has(candidate)) {
                return this.fail('INVALID_DOCUMENT', `Duplicate node id ${candidate}.`);
            }
            id = candidate;
        }

        if (Object.hasOwn(PRIMITIVE_TAGS, tag)) {
            this.expect(id === undefined && !hasPayload, `"${tag}" takes no "id" and no "v".`);
            return PRIMITIVE_TAGS[tag];
        }

        switch (tag) {
            case 'ref':
                return this.ref(id, payload);
            case 'bigint':
                this.expect(
                    id === undefined && typeof payload === 'string' && BIGINT.test(payload),
                    '"bigint" takes a decimal integer string and no "id".',
                );
                return BigInt(payload as string);
            case 'symbol':
                this.expect(
                    id === undefined && typeof payload === 'string',
                    '"symbol" takes a string key and no "id".',
                );
                return Symbol.for(payload as string);
            case 'object': {
                this.expect(isPlainObject(payload), '"object" payload must be an object.');
                const out = {};
                this.register(id, out);
                return this.fillObject(out, payload as Source);
            }
            case 'array': {
                this.expect(Array.isArray(payload), '"array" payload must be an array.');
                const out: unknown[] = [];
                this.register(id, out);
                return this.fillArray(out, payload as unknown[]);
            }
            case 'map':
                return this.map(id, payload);
            case 'set': {
                this.expect(Array.isArray(payload), '"set" payload must be an array.');
                const out = new Set<unknown>();
                this.register(id, out);
                (payload as unknown[]).forEach((item, index) => {
                    this.enter(index);
                    out.add(this.node(item));
                    this.leave();
                });
                return out;
            }
            case 'error':
                return this.error(id, payload);
            default:
                break;
        }

        const codec = simpleCodecsByTag.get(tag);
        if (codec) {
            const value = codec.decode(
                hasPayload ? (payload as JsonValue) : undefined,
                this.failFn,
            );
            this.register(id, value);
            return value;
        }
        return this.custom(tag, id, hasPayload, payload);
    }

    private expect(condition: boolean, message: string): void {
        if (!condition) {
            this.fail('INVALID_DOCUMENT', message);
        }
    }

    private ref(id: number | undefined, target: unknown): unknown {
        this.expect(id === undefined, '"ref" takes no "id".');
        if (typeof target !== 'number' || !Number.isSafeInteger(target)) {
            return this.fail('INVALID_DOCUMENT', '"ref" payload must be an integer id.');
        }
        if (this.pending.has(target)) {
            return this.fail(
                'UNSUPPORTED_CYCLE',
                `Reference to node ${target} while it is being constructed (cycle through a custom type).`,
            );
        }
        if (!this.refs.has(target)) {
            return this.fail('INVALID_DOCUMENT', `Reference to unknown node id ${target}.`);
        }
        return this.refs.get(target);
    }

    private map(id: number | undefined, payload: unknown): Map<unknown, unknown> {
        this.expect(
            Array.isArray(payload),
            '"map" payload must be an array of [key, value] pairs.',
        );
        const out = new Map<unknown, unknown>();
        this.register(id, out);
        (payload as unknown[]).forEach((pair, index) => {
            this.enter(index);
            this.expect(
                Array.isArray(pair) && pair.length === 2,
                'Map entries must be [key, value] pairs.',
            );
            const [key, value] = pair as [unknown, unknown];
            const decodedKey = this.node(key);
            out.set(decodedKey, this.node(value));
            this.leave();
        });
        return out;
    }

    private error(id: number | undefined, payload: unknown): Error {
        this.expect(isPlainObject(payload), '"error" payload must be an object.');
        const source = payload as Source;
        for (const key of Object.keys(source)) {
            this.expect(ERROR_KEYS.has(key), `"error" payload has unexpected key "${key}".`);
        }
        const { name, message, stack } = source;
        this.expect(
            typeof name === 'string' && typeof message === 'string',
            '"error" payload needs string "name" and "message".',
        );
        this.expect(
            stack === undefined || typeof stack === 'string',
            '"error" stack must be a string.',
        );
        const hasErrors = Object.hasOwn(source, 'errors');
        this.expect(!hasErrors || Array.isArray(source.errors), '"error" errors must be an array.');

        const Constructor = Object.hasOwn(ERROR_CONSTRUCTORS, name as string)
            ? (ERROR_CONSTRUCTORS[name as string] as ErrorConstructor)
            : Error;
        const error: Error = hasErrors
            ? new AggregateError([], message as string)
            : new Constructor(message as string);
        if (error.name !== name) {
            hidden(error, 'name', name);
        }
        // Without an encoded stack, avoid exposing misleading decoder frames.
        hidden(error, 'stack', stack ?? `${name as string}: ${message as string}`);
        this.register(id, error);

        if (Object.hasOwn(source, 'cause')) {
            this.enter('cause');
            hidden(error, 'cause', this.node(source.cause));
            this.leave();
        }
        if (hasErrors) {
            this.enter('errors');
            hidden(error, 'errors', this.fillArray([], source.errors as unknown[]));
            this.leave();
        }
        return error;
    }

    private custom(
        tag: string,
        id: number | undefined,
        hasPayload: boolean,
        payload: unknown,
    ): unknown {
        const parsed = parseTag(tag);
        if (!parsed) {
            if (BUILTIN_TAG.test(tag)) {
                return this.fail(
                    'UNKNOWN_TYPE',
                    `Unknown built-in tag "${tag}" (written by a newer sereal format?).`,
                );
            }
            return this.fail('INVALID_DOCUMENT', `Malformed tag "${tag}".`);
        }
        const { name, version } = parsed;
        const definition = this.config.registry.byName.get(name);
        if (!definition) {
            return this.fail('UNKNOWN_TYPE', `Type "${name}" is not registered.`);
        }
        this.expect(hasPayload, `Custom type "${name}" node requires a "v" payload.`);
        if (version > definition.version) {
            return this.fail(
                'VERSION_TOO_NEW',
                `Payload is "${name}" version ${version}, but the registered type is version ${definition.version}.`,
            );
        }

        if (id !== undefined) {
            this.pending.add(id);
        }
        let data = this.node(payload);
        for (let from = version; from < definition.version; from += 1) {
            const migration = definition.migrations[from] as
                | ((data: unknown) => unknown)
                | undefined;
            if (!migration) {
                return this.fail(
                    'MISSING_MIGRATION',
                    `No migration for "${name}" from version ${from} to ${from + 1}.`,
                );
            }
            data = migration(data);
        }
        if (definition.schema) {
            data = validateSchema(definition.schema, data, this.path, `Payload of "${name}"`);
        }
        const value = definition.decode(data);
        if (id !== undefined) {
            this.pending.delete(id);
            this.refs.set(id, value);
        }
        return value;
    }
}

const ENVELOPE_KEYS = new Set(['$sereal', 'root']);

export const decodeDocument = (document: unknown, config: DecoderConfig): unknown => {
    if (!isPlainObject(document)) {
        throw new SerealError(
            'INVALID_DOCUMENT',
            'A document must be an object { $sereal, root }.',
        );
    }
    const format = document.$sereal;
    if (format !== 1) {
        throw new SerealError(
            'INVALID_DOCUMENT',
            typeof format === 'number' && Number.isInteger(format) && format > 1
                ? `Format version ${format} is newer than this implementation supports (1).`
                : 'Missing or invalid "$sereal" format version.',
        );
    }
    if (!Object.hasOwn(document, 'root')) {
        throw new SerealError('INVALID_DOCUMENT', 'Document is missing "root".');
    }
    for (const key of Object.keys(document)) {
        if (!ENVELOPE_KEYS.has(key)) {
            throw new SerealError('INVALID_DOCUMENT', `Unexpected document key "${key}".`);
        }
    }
    return new Decoder(config).node(document.root);
};
// #endregion module
