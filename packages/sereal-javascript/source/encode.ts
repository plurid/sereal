// #region imports
import {
    findSimpleCodec,
    isError,
    isUnsupportedObject,
    type SimpleCodec,
} from './builtins/index.ts';
import { SerealError, type SerealErrorCode } from './errors.ts';
import { formatTag, type Registry } from './registry.ts';
import type { JsonValue, SerealDocument, TypeDefinition } from './types.ts';
// #endregion imports

// #region module
export interface EncoderConfig {
    readonly registry: Registry;
    readonly unknownClasses: 'throw' | 'plain';
    readonly unsupported: 'throw' | 'omit';
    readonly errorStack: boolean;
    readonly maxDepth: number;
}

type Plan =
    | { readonly kind: 'array' | 'object' | 'map' | 'set' | 'error' | 'omit' }
    | { readonly kind: 'simple'; readonly codec: SimpleCodec }
    | { readonly kind: 'custom'; readonly definition: TypeDefinition; readonly payload: unknown };

interface Entry {
    readonly plan: Plan;
    count: number;
}

type MutableNode = Record<string, JsonValue>;

/**
 * Assigns a property without triggering the `__proto__` setter.
 */
export const defineKey = (target: object, key: string, value: unknown): void => {
    if (key === '__proto__') {
        Object.defineProperty(target, key, {
            value,
            enumerable: true,
            writable: true,
            configurable: true,
        });
    } else {
        (target as Record<string, unknown>)[key] = value;
    }
};

const tagged = (tag: string, id: number | undefined, payload?: JsonValue): MutableNode => {
    const node: MutableNode = { $: tag };
    if (id !== undefined) {
        node.id = id;
    }
    if (payload !== undefined) {
        node.v = payload;
    }
    return node;
};

const describe = (value: object): string => {
    const name = (value.constructor as { name?: unknown } | undefined)?.name;
    return typeof name === 'string' && name ? name : Object.prototype.toString.call(value);
};

/**
 * Two-pass encoder.
 *
 * 1. `scan` walks the graph once, classifying every object and counting how often it is reached
 *    (custom type payloads are computed here, exactly once).
 * 2. `emit` writes nodes; objects reached more than once receive an `id` on first emission
 *    (depth-first pre-order, so ids are canonical) and become `ref` nodes afterwards.
 */
class Encoder {
    private readonly config: EncoderConfig;
    private readonly entries = new Map<object, Entry>();
    private readonly active = new Set<object>();
    private readonly ids = new Map<object, number>();
    private readonly path: (string | number)[] = [];
    private nextId = 1;
    private depth = 0;

    constructor(config: EncoderConfig) {
        this.config = config;
    }

    run(value: unknown): SerealDocument {
        this.scan(value);
        return { $sereal: 1, root: this.emit(value) };
    }

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

    // #region scan
    private scan(value: unknown): void {
        if (typeof value !== 'object' || value === null) {
            return;
        }
        const existing = this.entries.get(value);
        if (existing) {
            if (this.active.has(value)) {
                this.fail(
                    'UNSUPPORTED_CYCLE',
                    `A ${describe(value)} instance is reachable from its own payload. ` +
                        'Custom types are rebuilt from their payload and cannot contain themselves.',
                );
            }
            existing.count += 1;
            return;
        }

        const plan = this.classify(value);
        this.entries.set(value, { plan, count: 1 });

        switch (plan.kind) {
            case 'array': {
                const array = value as readonly unknown[];
                for (let index = 0; index < array.length; index += 1) {
                    this.enter(index);
                    this.scan(array[index]);
                    this.leave();
                }
                return;
            }
            case 'object': {
                for (const key of Object.keys(value)) {
                    this.enter(key);
                    this.scan((value as Record<string, unknown>)[key]);
                    this.leave();
                }
                return;
            }
            case 'map':
            case 'set': {
                let index = 0;
                for (const item of value as Iterable<unknown>) {
                    this.enter(index);
                    if (plan.kind === 'map') {
                        const [key, entryValue] = item as [unknown, unknown];
                        this.scan(key);
                        this.scan(entryValue);
                    } else {
                        this.scan(item);
                    }
                    this.leave();
                    index += 1;
                }
                return;
            }
            case 'error': {
                const error = value as Error;
                if (Object.hasOwn(error, 'cause')) {
                    this.enter('cause');
                    this.scan(error.cause);
                    this.leave();
                }
                if (error instanceof AggregateError) {
                    this.enter('errors');
                    for (const inner of error.errors) {
                        this.scan(inner);
                    }
                    this.leave();
                }
                return;
            }
            case 'custom': {
                this.active.add(value);
                this.scan(plan.payload);
                this.active.delete(value);
                return;
            }
            default:
                return;
        }
    }

    private classify(value: object): Plan {
        const prototype = Object.getPrototypeOf(value) as object | null;
        const definition = prototype ? this.config.registry.byPrototype.get(prototype) : undefined;
        if (definition) {
            return { kind: 'custom', definition, payload: definition.encode(value) };
        }
        if (Array.isArray(value)) {
            return { kind: 'array' };
        }
        if (prototype === Object.prototype || prototype === null) {
            return { kind: 'object' };
        }
        if (value instanceof Map) {
            return { kind: 'map' };
        }
        if (value instanceof Set) {
            return { kind: 'set' };
        }
        if (isError(value)) {
            return { kind: 'error' };
        }
        const codec = findSimpleCodec(value);
        if (codec) {
            return { kind: 'simple', codec };
        }
        if (isUnsupportedObject(value)) {
            if (this.config.unsupported === 'omit') {
                return { kind: 'omit' };
            }
            return this.fail('UNSUPPORTED_VALUE', `${describe(value)} cannot be serialized.`);
        }
        if (this.config.unknownClasses === 'plain') {
            return { kind: 'object' };
        }
        return this.fail(
            'UNSUPPORTED_VALUE',
            `Instance of unregistered class ${describe(value)}. Register it in \`types\` ` +
                "(symbol protocol or defineType()) or set unknownClasses: 'plain'.",
        );
    }
    // #endregion scan

    // #region emit
    private emit(value: unknown): JsonValue {
        switch (typeof value) {
            case 'string':
            case 'boolean':
                return value;
            case 'number':
                return this.emitNumber(value);
            case 'bigint':
                return tagged('bigint', undefined, value.toString());
            case 'undefined':
                return tagged('undefined', undefined);
            case 'symbol': {
                const key = Symbol.keyFor(value);
                if (key !== undefined) {
                    return tagged('symbol', undefined, key);
                }
                return this.unsupported('Only registered symbols (Symbol.for) can be serialized.');
            }
            case 'function':
                return this.unsupported('Functions cannot be serialized.');
            default:
                return value === null ? null : this.emitObject(value as object);
        }
    }

    private emitNumber(value: number): JsonValue {
        if (Number.isFinite(value)) {
            return Object.is(value, -0) ? tagged('-0', undefined) : value;
        }
        if (Number.isNaN(value)) {
            return tagged('nan', undefined);
        }
        return tagged(value > 0 ? 'inf' : '-inf', undefined);
    }

    private unsupported(message: string): JsonValue {
        if (this.config.unsupported === 'omit') {
            return tagged('undefined', undefined);
        }
        return this.fail('UNSUPPORTED_VALUE', message);
    }

    private isOmitted(value: unknown): boolean {
        if (this.config.unsupported !== 'omit') {
            return false;
        }
        switch (typeof value) {
            case 'function':
                return true;
            case 'symbol':
                return Symbol.keyFor(value) === undefined;
            case 'object':
                return value !== null && this.entries.get(value)?.plan.kind === 'omit';
            default:
                return false;
        }
    }

    private emitObject(value: object): JsonValue {
        const entry = this.entries.get(value) as Entry;
        const existing = this.ids.get(value);
        if (existing !== undefined) {
            return tagged('ref', undefined, existing);
        }
        const { plan } = entry;
        if (plan.kind === 'omit') {
            return tagged('undefined', undefined);
        }
        let id: number | undefined;
        if (entry.count > 1) {
            id = this.nextId;
            this.nextId += 1;
            this.ids.set(value, id);
        }

        switch (plan.kind) {
            case 'array': {
                const items = this.emitItems(value as readonly unknown[]);
                return id === undefined ? items : tagged('array', id, items);
            }
            case 'object': {
                const out: MutableNode = {};
                for (const key of Object.keys(value)) {
                    const child = (value as Record<string, unknown>)[key];
                    if (this.isOmitted(child)) {
                        continue;
                    }
                    this.enter(key);
                    defineKey(out, key, this.emit(child));
                    this.leave();
                }
                if (id !== undefined || Object.hasOwn(out, '$')) {
                    return tagged('object', id, out);
                }
                return out;
            }
            case 'map': {
                const pairs: JsonValue[] = [];
                for (const [key, entryValue] of value as Map<unknown, unknown>) {
                    this.enter(pairs.length);
                    pairs.push([this.emit(key), this.emit(entryValue)]);
                    this.leave();
                }
                return tagged('map', id, pairs);
            }
            case 'set': {
                return tagged('set', id, this.emitItems([...(value as Set<unknown>)]));
            }
            case 'error':
                return tagged('error', id, this.emitError(value as Error));
            case 'custom':
                return tagged(formatTag(plan.definition), id, this.emit(plan.payload));
            case 'simple':
                return tagged(plan.codec.tag, id, plan.codec.encode(value));
        }
    }

    private emitItems(items: readonly unknown[]): JsonValue[] {
        const out: JsonValue[] = [];
        for (let index = 0; index < items.length; index += 1) {
            this.enter(index);
            out.push(this.emit(items[index]));
            this.leave();
        }
        return out;
    }

    private emitError(error: Error): MutableNode {
        const payload: MutableNode = {
            name: String(error.name),
            message: String(error.message),
        };
        if (Object.hasOwn(error, 'cause')) {
            this.enter('cause');
            payload.cause = this.emit(error.cause);
            this.leave();
        }
        if (error instanceof AggregateError) {
            this.enter('errors');
            payload.errors = this.emitItems([...error.errors]);
            this.leave();
        }
        if (this.config.errorStack && typeof error.stack === 'string') {
            payload.stack = error.stack;
        }
        return payload;
    }
    // #endregion emit
}

export const encodeDocument = (value: unknown, config: EncoderConfig): SerealDocument => {
    return new Encoder(config).run(value);
};
// #endregion module
