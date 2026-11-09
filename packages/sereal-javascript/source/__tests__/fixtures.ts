// #region imports
import * as v from 'valibot';
import {
    createSereal,
    defineType,
    fromSereal,
    type Sereal,
    serealType,
    toSereal,
} from '../index.ts';
// #endregion imports

// #region module
/**
 * The spec's conformance type: `test.Point@2`, payload `{ x, y }`, v1 payload `[x, y]`.
 */
export class Point {
    static readonly [serealType] = {
        name: 'test.Point',
        version: 2,
        migrations: {
            1: ([x, y]: [number, number]) => ({ x, y }),
        },
    };

    readonly #x: number;
    readonly #y: number;

    constructor(x: number, y: number) {
        this.#x = x;
        this.#y = y;
    }

    get x(): number {
        return this.#x;
    }

    get y(): number {
        return this.#y;
    }

    [toSereal](): { x: number; y: number } {
        return { x: this.#x, y: this.#y };
    }

    static [fromSereal](data: { x: number; y: number }): Point {
        return new Point(data.x, data.y);
    }
}

/**
 * A third-party-style class without the protocol, registered with defineType().
 */
export class Money {
    readonly cents: bigint;
    readonly currency: string;

    constructor(cents: bigint, currency: string) {
        this.cents = cents;
        this.currency = currency;
    }
}

export const MoneySchema = v.object({
    cents: v.bigint(),
    currency: v.pipe(v.string(), v.length(3)),
});

export const MoneyType = defineType(Money, {
    name: 'acme:Money',
    encode: (money) => ({ cents: money.cents, currency: money.currency }),
    decode: (data: { cents: bigint; currency: string }) => new Money(data.cents, data.currency),
    schema: MoneySchema,
});

export const sereal: Sereal = createSereal({ types: [Point, MoneyType] });

export const roundTrip = <T>(value: T, instance: Sereal = sereal): T => {
    return instance.parse<T>(instance.stringify(value));
};
// #endregion module
