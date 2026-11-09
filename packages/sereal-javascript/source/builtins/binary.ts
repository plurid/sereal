// #region imports
import type { SerealErrorCode } from '../errors.ts';
import type { JsonValue } from '../types.ts';
// #endregion imports

// #region module
export type Fail = (code: SerealErrorCode, message: string) => never;

export interface SimpleCodec {
    /** Built-in tag written to `"$"`. */
    readonly tag: string;
    /** Returns the raw JSON payload (not recursively encoded). */
    encode(value: object): JsonValue;
    /** Rebuilds the value from the raw JSON payload. */
    decode(payload: JsonValue | undefined, fail: Fail): unknown;
}

const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

interface NativeBase64 {
    toBase64?: (this: Uint8Array) => string;
}

interface NativeBase64Constructor {
    fromBase64?: (text: string) => Uint8Array;
}

const nativeToBase64 = (Uint8Array.prototype as NativeBase64).toBase64;
const nativeFromBase64 = (Uint8Array as NativeBase64Constructor).fromBase64;

export const hasNativeBase64: boolean =
    typeof nativeToBase64 === 'function' && typeof nativeFromBase64 === 'function';

export const toBase64 = (bytes: Uint8Array, native: boolean = hasNativeBase64): string => {
    if (native && nativeToBase64) {
        return nativeToBase64.call(bytes);
    }
    let binary = '';
    const CHUNK = 0x8000;
    for (let index = 0; index < bytes.length; index += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
    }
    return btoa(binary);
};

export const fromBase64 = (
    text: string,
    fail: Fail,
    native: boolean = hasNativeBase64,
): Uint8Array<ArrayBuffer> => {
    if (!BASE64.test(text)) {
        return fail('INVALID_DOCUMENT', 'Invalid base64 payload.');
    }
    if (native && nativeFromBase64) {
        return nativeFromBase64(text) as Uint8Array<ArrayBuffer>;
    }
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
};

/* v8 ignore next -- big-endian hosts are not available in CI. */
const LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

interface TypedArrayConstructorLike {
    readonly BYTES_PER_ELEMENT: number;
    new (buffer: ArrayBuffer, byteOffset: number, length: number): ArrayBufferView;
}

/**
 * `[Object.prototype.toString tag, sereal tag, global constructor name]`
 */
const TYPED_ARRAYS: readonly (readonly [string, string])[] = [
    ['Uint8Array', 'u8'],
    ['Uint8ClampedArray', 'u8c'],
    ['Int8Array', 'i8'],
    ['Uint16Array', 'u16'],
    ['Int16Array', 'i16'],
    ['Uint32Array', 'u32'],
    ['Int32Array', 'i32'],
    ['Float16Array', 'f16'],
    ['Float32Array', 'f32'],
    ['Float64Array', 'f64'],
    ['BigInt64Array', 'i64'],
    ['BigUint64Array', 'u64'],
];

const viewBytes = (view: ArrayBufferView): Uint8Array => {
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
};

const expectString = (payload: JsonValue | undefined, tag: string, fail: Fail): string => {
    if (typeof payload !== 'string') {
        return fail('INVALID_DOCUMENT', `"${tag}" payload must be a string.`);
    }
    return payload;
};

const typedArrayCodec = (globalName: string, tag: string): SimpleCodec => ({
    tag,
    encode: (value) => {
        /* v8 ignore next 3 -- big-endian hosts are not available in CI. */
        if (!LITTLE_ENDIAN && (value as Uint8Array).BYTES_PER_ELEMENT > 1) {
            throw new Error('sereal: multi-byte typed arrays require a little-endian host.');
        }
        return toBase64(viewBytes(value as ArrayBufferView));
    },
    decode: (payload, fail) => {
        const Ctor = (globalThis as Record<string, unknown>)[globalName] as
            | TypedArrayConstructorLike
            | undefined;
        if (!Ctor) {
            return fail('RUNTIME_UNSUPPORTED', `${globalName} is not available in this runtime.`);
        }
        const bytes = fromBase64(expectString(payload, tag, fail), fail);
        if (bytes.byteLength % Ctor.BYTES_PER_ELEMENT !== 0) {
            return fail(
                'INVALID_DOCUMENT',
                `"${tag}" payload length is not a multiple of ${Ctor.BYTES_PER_ELEMENT}.`,
            );
        }
        return new Ctor(bytes.buffer, 0, bytes.byteLength / Ctor.BYTES_PER_ELEMENT);
    },
});

/**
 * Typed array codecs keyed by `Object.prototype.toString` tag (e.g. `"Float32Array"`).
 */
export const typedArrayCodecs: ReadonlyMap<string, SimpleCodec> = new Map(
    TYPED_ARRAYS.map(([globalName, tag]) => [globalName, typedArrayCodec(globalName, tag)]),
);

export const arrayBufferCodec: SimpleCodec = {
    tag: 'arraybuffer',
    encode: (value) => toBase64(new Uint8Array(value as ArrayBuffer)),
    decode: (payload, fail) => fromBase64(expectString(payload, 'arraybuffer', fail), fail).buffer,
};

export const dataViewCodec: SimpleCodec = {
    tag: 'dataview',
    encode: (value) => toBase64(viewBytes(value as DataView)),
    decode: (payload, fail) => {
        return new DataView(fromBase64(expectString(payload, 'dataview', fail), fail).buffer);
    },
};
// #endregion module
