// #region imports
import type { SimpleCodec } from './binary.ts';
// #endregion imports

// #region module
interface TemporalClass {
    from(text: string): unknown;
}

/**
 * `[Temporal class name, sereal tag]`
 */
const TEMPORAL_TYPES: readonly (readonly [string, string])[] = [
    ['Instant', 'instant'],
    ['ZonedDateTime', 'zoneddatetime'],
    ['PlainDate', 'plaindate'],
    ['PlainTime', 'plaintime'],
    ['PlainDateTime', 'plaindatetime'],
    ['PlainYearMonth', 'plainyearmonth'],
    ['PlainMonthDay', 'plainmonthday'],
    ['Duration', 'duration'],
];

const temporalCodec = (className: string, tag: string): SimpleCodec => ({
    tag,
    encode: (value) => String(value),
    decode: (payload, fail) => {
        if (typeof payload !== 'string') {
            return fail('INVALID_DOCUMENT', `"${tag}" payload must be a string.`);
        }
        const Temporal = (globalThis as unknown as { Temporal?: Record<string, TemporalClass> })
            .Temporal;
        const Class = Temporal?.[className];
        if (!Class) {
            return fail(
                'RUNTIME_UNSUPPORTED',
                `Temporal.${className} is not available in this runtime (needs Temporal support or a polyfill).`,
            );
        }
        try {
            return Class.from(payload);
        } catch {
            return fail('INVALID_DOCUMENT', `"${tag}" payload is not a valid ${className}.`);
        }
    },
});

/**
 * Temporal codecs keyed by `Object.prototype.toString` tag (e.g. `"Temporal.Instant"`).
 * Detection uses the tag, so encoding works with native Temporal and spec-compliant polyfills.
 */
export const temporalCodecs: ReadonlyMap<string, SimpleCodec> = new Map(
    TEMPORAL_TYPES.map(([className, tag]) => [
        `Temporal.${className}`,
        temporalCodec(className, tag),
    ]),
);
// #endregion module
