import { createSereal, defineType, fromSereal, serealType, toSereal } from '../dist/index.js';
import { createTimeline } from '../dist/timeline.js';

class Point {
    static readonly [serealType] = {
        name: 'smoke.Point',
        version: 2,
        migrations: {
            1: ([x, y]: [number, number]) => ({ x, y }),
        },
    };
    readonly x: number;
    readonly y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    [toSereal]() {
        return { x: this.x, y: this.y };
    }
    static [fromSereal](data: { x: number; y: number }) {
        return new Point(data.x, data.y);
    }
}

class Money {
    readonly cents: bigint;
    constructor(cents: bigint) {
        this.cents = cents;
    }
}

const MoneyType = defineType(Money, {
    name: 'smoke.Money',
    encode: (m) => m.cents.toString(),
    decode: (s: string) => new Money(BigInt(s)),
});

const sereal = createSereal({ types: [Point, MoneyType] });

const shared = { hello: 'smoke' };
const payload = {
    num: [1, -0, Number.NaN, Number.POSITIVE_INFINITY, 12345678901234567890n],
    date: new Date('2026-11-09T00:00:00.000Z'),
    regex: /abc/gi,
    url: new URL('https://plurid.com'),
    bytes: new Uint8Array([1, 2, 3]),
    map: new Map([[1, 'one']]),
    set: new Set(['a', 'b']),
    point: new Point(10, 20),
    money: new Money(999n),
    refA: shared,
    refB: shared,
};

const serialized = sereal.stringify(payload);
const restored: any = sereal.parse(serialized);

if (restored.point.x !== 10 || restored.point.y !== 20) {
    throw new Error('Point mismatch');
}
if (restored.money.cents !== 999n) {
    throw new Error('Money mismatch');
}
if (restored.refA !== restored.refB) {
    throw new Error('Shared reference identity mismatch');
}

// Test Timeline
const timeline = createTimeline(sereal, { initial: new Point(0, 0) });
timeline.commit(new Point(1, 1));
timeline.undo();
if (timeline.present?.x !== 0) {
    throw new Error('Timeline undo mismatch');
}

console.log('Smoke test passed successfully.');
