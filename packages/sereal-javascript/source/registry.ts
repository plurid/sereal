// #region imports
import { SerealError } from './errors.ts';
import { fromSereal, serealType, toSereal } from './symbols.ts';
import type {
    Constructor,
    Migration,
    SerealClass,
    SerealTypeEntry,
    TypeDefinition,
    TypeDefinitionInput,
} from './types.ts';
// #endregion imports

// #region module
/**
 * Built-in tags are lowercase ASCII letters, digits and dashes.
 * The spec reserves this whole namespace for current and future built-ins.
 */
export const BUILTIN_TAG: RegExp = /^[a-z0-9-]+$/;

const CUSTOM_NAME = /^[A-Za-z_][\w.:/-]*$/;
const VERSION = /^[1-9]\d*$/;

export const validateTypeName = (name: unknown): string => {
    if (typeof name !== 'string' || !CUSTOM_NAME.test(name)) {
        throw new SerealError(
            'INVALID_TYPE',
            `Invalid type name ${JSON.stringify(name)}. Names must match ${CUSTOM_NAME}.`,
        );
    }
    if (BUILTIN_TAG.test(name)) {
        throw new SerealError(
            'INVALID_TYPE',
            `Type name "${name}" is in the reserved built-in namespace [a-z0-9-]. ` +
                'Use a namespaced or capitalized name such as "app.point" or "Point".',
        );
    }
    return name;
};

const validateVersion = (name: string, version: unknown): number => {
    if (version === undefined) {
        return 1;
    }
    if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) {
        throw new SerealError(
            'INVALID_TYPE',
            `Type "${name}" has invalid version ${String(version)}; expected a positive integer.`,
        );
    }
    return version;
};

/**
 * Defines how instances of `target` are encoded and decoded.
 * Use this for classes you cannot (or prefer not to) modify.
 *
 * @example
 * const DecimalType = defineType(Decimal, {
 *     name: 'decimal.js',
 *     encode: (value) => value.toString(),
 *     decode: (data: string) => new Decimal(data),
 * });
 */
export const defineType = <T, D>(
    target: Constructor<T>,
    input: TypeDefinitionInput<T, D>,
): TypeDefinition<T, D> => {
    if (typeof target !== 'function' || typeof target.prototype !== 'object') {
        throw new SerealError('INVALID_TYPE', 'defineType() target must be a class.');
    }
    const name = validateTypeName(input.name);
    const version = validateVersion(name, input.version);
    if (typeof input.encode !== 'function' || typeof input.decode !== 'function') {
        throw new SerealError(
            'INVALID_TYPE',
            `Type "${name}" must define encode() and decode() functions.`,
        );
    }
    const migrations: Record<number, Migration> = {};
    for (const [from, migration] of Object.entries(input.migrations ?? {})) {
        if (!VERSION.test(from) || typeof migration !== 'function') {
            throw new SerealError(
                'INVALID_TYPE',
                `Type "${name}" has an invalid migration for version "${from}".`,
            );
        }
        migrations[Number(from)] = migration;
    }
    const { encode, decode } = input;
    return Object.freeze({
        kind: 'sereal.type',
        target,
        name,
        version,
        encode: (value: T): D => encode.call(input, value),
        decode: (data: D): T => decode.call(input, data),
        migrations: Object.freeze(migrations),
        schema: input.schema,
    });
};

export const isTypeDefinition = (value: unknown): value is TypeDefinition => {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as { kind?: unknown }).kind === 'sereal.type'
    );
};

const fromClass = (entry: SerealClass): TypeDefinition => {
    const cls = entry as unknown as Constructor & Partial<SerealClass>;
    const label = typeof cls === 'function' && cls.name ? cls.name : String(cls);
    const info = (cls as Partial<SerealClass>)[serealType];
    if (typeof cls !== 'function' || typeof info !== 'object' || info === null) {
        throw new SerealError(
            'INVALID_TYPE',
            `${label} is neither a defineType() result nor a class with static [serealType] info.`,
        );
    }
    const encode = (cls.prototype as Partial<SerealClass['prototype']>)[toSereal];
    const decode = cls[fromSereal];
    if (typeof encode !== 'function') {
        throw new SerealError('INVALID_TYPE', `${label} must implement [toSereal]().`);
    }
    if (typeof decode !== 'function') {
        throw new SerealError('INVALID_TYPE', `${label} must implement static [fromSereal]().`);
    }
    return defineType(cls, {
        name: info.name,
        ...(info.version === undefined ? {} : { version: info.version }),
        ...(info.migrations === undefined ? {} : { migrations: info.migrations }),
        ...(info.schema === undefined ? {} : { schema: info.schema }),
        encode: (value) => encode.call(value),
        decode: (data) => decode.call(cls, data as never) as object,
    });
};

export interface Registry {
    readonly list: readonly TypeDefinition[];
    readonly byName: ReadonlyMap<string, TypeDefinition>;
    readonly byPrototype: ReadonlyMap<object, TypeDefinition>;
}

export const createRegistry = (entries: readonly SerealTypeEntry[]): Registry => {
    const byName = new Map<string, TypeDefinition>();
    const byPrototype = new Map<object, TypeDefinition>();
    const list: TypeDefinition[] = [];

    for (const entry of entries) {
        const definition = isTypeDefinition(entry) ? entry : fromClass(entry as SerealClass);
        if (byName.has(definition.name)) {
            throw new SerealError(
                'DUPLICATE_TYPE',
                `Type name "${definition.name}" is registered more than once.`,
            );
        }
        const prototype = definition.target.prototype as object;
        if (byPrototype.has(prototype)) {
            throw new SerealError(
                'DUPLICATE_TYPE',
                `Class ${definition.target.name} is registered more than once ` +
                    `(as "${byPrototype.get(prototype)?.name}" and "${definition.name}").`,
            );
        }
        byName.set(definition.name, definition);
        byPrototype.set(prototype, definition);
        list.push(definition);
    }

    return { list: Object.freeze(list), byName, byPrototype };
};

export const formatTag = (definition: TypeDefinition): string => {
    return definition.version === 1 ? definition.name : `${definition.name}@${definition.version}`;
};

export const parseTag = (tag: string): { name: string; version: number } | undefined => {
    const at = tag.lastIndexOf('@');
    const name = at === -1 ? tag : tag.slice(0, at);
    const version = at === -1 ? '1' : tag.slice(at + 1);
    if (!CUSTOM_NAME.test(name) || BUILTIN_TAG.test(name) || !VERSION.test(version)) {
        return undefined;
    }
    return { name, version: Number(version) };
};
// #endregion module
