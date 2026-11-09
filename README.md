<p align="center">
    <img src="https://raw.githubusercontent.com/plurid/sereal/master/about/identity/sereal-logo.png" height="250px">
    <br />
    <br />
    <a target="_blank" href="https://github.com/plurid/sereal/blob/master/LICENSE">
        <img src="https://img.shields.io/badge/license-DEL-blue.svg?colorB=1380C3&style=for-the-badge" alt="License: DEL">
    </a>
    <a target="_blank" href="https://www.npmjs.com/package/@plurid/sereal">
        <img src="https://img.shields.io/npm/v/@plurid/sereal.svg?logo=npm&colorB=1380C3&style=for-the-badge" alt="Version">
    </a>
</p>

<h1 align="center">
    sereal
</h1>

<h3 align="center">
    Real (Values and Objects) Serialization
</h3>

Standard `JSON.stringify` drops data types:

- `BigInt` throws a TypeError
- `Date` turns into an unparsed string
- `Map` and `Set` serialize as `{}`
- `Temporal`, `TypedArray`, and `ArrayBuffer` lose their types
- `undefined`, `NaN`, `Infinity`, and `-0` turn into `null` or vanish
- Circular references throw `TypeError: Converting circular structure to JSON`
- Class instances lose their prototypes, private fields, and methods

`sereal` encodes JavaScript values and class instances into readable JSON documents and reconstructs the exact original runtime instances.

### Contents

- [Install](#install)
- [Quick Start](#quick-start)
- [Wire Format](#wire-format)
- [Custom Classes](#custom-classes)
  - [Symbol Protocol](#symbol-protocol)
  - [External Classes with `defineType`](#external-classes-with-definetype)
- [Data Migrations](#data-migrations)
- [Schema Validation](#schema-validation)
- [References and Cycles](#references-and-cycles)
- [Timeline (Undo / Redo)](#timeline-undo--redo)
- [Supported Types](#supported-types)
- [Specification](#specification)
- [Packages](#packages)
- [Codeophon](#codeophon)

## Install

```bash
npm install @plurid/sereal
# or: pnpm add @plurid/sereal
# or: bun add @plurid/sereal
# or: deno add jsr:@plurid/sereal
```

## Quick Start

```typescript
import { encode, decode, stringify, parse } from '@plurid/sereal';

const state = {
    amount: 100000000000000000n,
    timestamp: new Date('2026-11-09T08:00:00Z'),
    regex: /^[a-z]+$/gi,
    coords: new Float32Array([1.5, 2.5]),
    lookup: new Map([[1, new Set(['read', 'write'])]]),
    special: [-0, Number.NaN, Number.POSITIVE_INFINITY, undefined],
};

const json = stringify(state, { space: 2 });
const restored = parse(json);

restored.amount === 100000000000000000n; // true
restored.lookup.get(1).has('write'); // true
Object.is(restored.special[0], -0); // true
```

## Wire Format

Documents use standard JSON with a `$sereal: 1` envelope. Primitives and normal objects remain plain JSON. Typed values use `{"$": tag, "v": payload}`:

```json
{
    "$sereal": 1,
    "root": {
        "amount": { "$": "bigint", "v": "100000000000000000" },
        "timestamp": { "$": "date", "v": "2026-11-09T08:00:00.000Z" },
        "regex": { "$": "regexp", "v": { "source": "^[a-z]+$", "flags": "gi" } },
        "coords": { "$": "f32", "v": "AADAPwAAIEA=" },
        "lookup": {
            "$": "map",
            "v": [[1, { "$": "set", "v": ["read", "write"] }]]
        },
        "special": [{ "$": "-0" }, { "$": "nan" }, { "$": "inf" }, { "$": "undefined" }]
    }
}
```

Plain objects that have their own literal `"$"` key are escaped automatically as `{"$": "object", "v": { "$" : ... }}`.

## Custom Classes

`sereal` supports two ways to serialize classes:

### Symbol Protocol

For classes you control. Works with `#private` fields and immutable instances (no parameterless constructor needed):

```typescript
import { createSereal, toSereal, fromSereal, serealType } from '@plurid/sereal';

class Point {
    static readonly [serealType] = { name: 'geo.Point' };
    #x: number;
    #y: number;

    constructor(x: number, y: number) {
        this.#x = x;
        this.#y = y;
    }

    get x() {
        return this.#x;
    }
    get y() {
        return this.#y;
    }

    [toSereal]() {
        return { x: this.#x, y: this.#y };
    }

    static [fromSereal](data: { x: number; y: number }) {
        return new Point(data.x, data.y);
    }
}

const sereal = createSereal({ types: [Point] });
const json = sereal.stringify(new Point(10, 20));
const point = sereal.parse<Point>(json);

point instanceof Point; // true
point.x === 10; // true
```

### External Classes with `defineType`

For third-party classes you cannot modify directly:

```typescript
import Decimal from 'decimal.js';
import { createSereal, defineType } from '@plurid/sereal';

const DecimalType = defineType(Decimal, {
    name: 'decimal.js',
    encode: (d) => d.toString(),
    decode: (str: string) => new Decimal(str),
});

const sereal = createSereal({ types: [DecimalType] });
```

## Data Migrations

Stored data often outlives code. When you change a class schema, increment `version` and add forward migration steps:

```typescript
class User {
    static readonly [serealType] = {
        name: 'app.User',
        version: 2,
        migrations: {
            // Migrates stored v1 payloads ([first, last]) to v2 ({ name })
            1: ([first, last]: [string, string]) => ({
                name: `${first} ${last}`,
            }),
        },
    };

    constructor(readonly name: string) {}

    [toSereal]() {
        return { name: this.name };
    }

    static [fromSereal](data: { name: string }) {
        return new User(data.name);
    }
}
```

When older data is parsed, migrations run sequentially (`1 -> 2 -> 3`) before the class constructor runs.

## Schema Validation

Validate payloads with any Standard Schema v1 library (Valibot, Zod, ArkType) before classes are instantiated:

```typescript
import * as v from 'valibot';
import { defineType } from '@plurid/sereal';

const MoneySchema = v.object({
    cents: v.bigint(),
    currency: v.pipe(v.string(), v.length(3)),
});

const MoneyType = defineType(Money, {
    name: 'app.Money',
    schema: MoneySchema,
    encode: (m) => ({ cents: m.cents, currency: m.currency }),
    decode: (data) => new Money(data.cents, data.currency),
});
```

You can also pass a schema to `decode` or `parse` to validate the root document:

```typescript
const appState = sereal.parse(json, { schema: AppStateSchema });
```

## References and Cycles

Shared references and circular topologies are preserved automatically using depth-first `id` and `ref` pointers:

```typescript
const shared = { label: 'shared node' };
const root = {
    first: shared,
    second: shared,
    self: null as any,
};
root.self = root; // circular reference

const restored = parse(stringify(root));
restored.first === restored.second; // true (exact same object reference)
restored.self === restored; // true
```

## Timeline (Undo / Redo)

The `@plurid/sereal/timeline` module provides an undo/redo state container using immutable encoded snapshots:

```typescript
import { createSereal } from '@plurid/sereal';
import { createTimeline } from '@plurid/sereal/timeline';

const sereal = createSereal();
const timeline = createTimeline(sereal, { initial: { count: 0 }, limit: 50 });

timeline.commit({ count: 1 });
timeline.commit({ count: 2 });

timeline.undo(); // present is { count: 1 }
timeline.redo(); // present is { count: 2 }

// Export to persistable JSON:
const snapshot = timeline.toJSON();

// Restore:
const restored = createTimeline(sereal, { from: snapshot });
```

Because snapshots are stored in encoded format, mutating an object in memory after `commit()` cannot alter past history states.

## Supported Types

| Category        | Types                                                                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primitives      | `string`, `boolean`, `number`, `null`                                                                                                                                                                                  |
| Special Numbers | `-0`, `NaN`, `+Infinity`, `-Infinity`, `undefined`                                                                                                                                                                     |
| Scalars         | `bigint`, `Date` (including invalid dates), `RegExp`, `URL`, registered symbols (`Symbol.for`)                                                                                                                         |
| Collections     | `Map` (any key types), `Set`, plain objects, arrays                                                                                                                                                                    |
| Binary          | `ArrayBuffer`, `DataView`, `Uint8Array`, `Uint8ClampedArray`, `Int8Array`, `Uint16Array`, `Int16Array`, `Uint32Array`, `Int32Array`, `Float16Array`, `Float32Array`, `Float64Array`, `BigInt64Array`, `BigUint64Array` |
| Temporal        | `Instant`, `ZonedDateTime`, `PlainDate`, `PlainTime`, `PlainDateTime`, `PlainYearMonth`, `PlainMonthDay`, `Duration`                                                                                                   |
| Errors          | `Error`, `TypeError`, `RangeError`, `ReferenceError`, `SyntaxError`, `URIError`, `EvalError`, `AggregateError`, `.cause` chains                                                                                        |
| Custom          | Any class registered through symbol protocol or `defineType`                                                                                                                                                           |

## Specification

The format specification is language-independent:

- [Format Specification v1](./about/spec/sereal-format-v1.md)
- [Conformance Test Vectors](./about/spec/vectors/) (59 test vectors for cross-language validation)

## Packages

<a target="_blank" href="https://www.npmjs.com/package/@plurid/sereal">
    <img src="https://img.shields.io/npm/v/@plurid/sereal.svg?logo=npm&colorB=1380C3&style=for-the-badge" alt="Version">
</a>

[@plurid/sereal](https://github.com/plurid/sereal/tree/master/packages/sereal-javascript) (TypeScript implementation)

## [Codeophon](https://github.com/ly3xqhl8g9/codeophon)

- licensing: [delicense](https://github.com/ly3xqhl8g9/delicense)
- versioning: [αver](https://github.com/ly3xqhl8g9/alpha-versioning)
