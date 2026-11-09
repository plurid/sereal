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

`sereal` serializes rich runtime values (primitives, built-ins, custom classes, shared references, and cycles) into human-readable, diffable JSON documents and reconstructs them safely.

---

### Contents

- [Features](#features)
- [Install](#install)
- [Usage](#usage)
  - [Built-in Types](#built-in-types)
  - [Custom Types with Symbol Protocol](#custom-types-with-symbol-protocol)
  - [Custom Types with `defineType()`](#custom-types-with-definetype)
  - [Versioning & Migrations](#versioning--migrations)
  - [Standard Schema Validation](#standard-schema-validation)
  - [References & Cycles](#references--cycles)
  - [Timeline (Undo / Redo)](#timeline-undo--redo)
- [Specification & Conformance](#specification--conformance)
- [Migration from 0.x](#migration-from-0x)
- [Packages](#packages)
- [Codeophon](#codeophon)

---

## Features

- **Format v1**: Human-readable, diffable JSON envelope (`$sereal: 1`).
- **Comprehensive Built-ins**: `BigInt`, `Date`, `RegExp`, `URL`, `Map`, `Set`, `Error` (with `cause` chains and `AggregateError`), `ArrayBuffer`, `DataView`, all TypedArrays (`Float16Array` through `BigUint64Array`), and full TC39 `Temporal` support.
- **Special Values**: `undefined`, `NaN`, `+Infinity`, `-Infinity`, `-0`, registered symbols (`Symbol.for`).
- **No Path Coupling**: Objects carry type tags; instances are recognized at any arbitrary depth or container.
- **Reference Preservation**: Shared object identities and cycles in objects, arrays, maps, and sets are retained via deterministic depth-first `id`/`ref` tagging.
- **Class Support**:
  - Class-owned via `toSereal`, `fromSereal`, `serealType` symbols.
  - External / 3rd-party via `defineType()`.
- **Evolvable Data**: Per-type versions with automatic forward migrations (`1 -> 2 -> 3`).
- **Standard Schema Integration**: Optional payload validation using any Standard Schema v1 library ([Valibot](https://valibot.dev), [Zod](https://zod.dev), [ArkType](https://arktype.io), etc.).
- **Timeline Engine**: Opt-in undo/redo history (`@plurid/sereal/timeline`) using immutable encoded snapshots.
- **Secure by Default**: Prototype pollution guarded, depth-bounded (`maxDepth`), strict constructor allowlist.

---

## Install

```bash
# npm
npm install @plurid/sereal

# pnpm
pnpm add @plurid/sereal

# bun
bun add @plurid/sereal

# deno
deno add jsr:@plurid/sereal
```

---

## Usage

### Built-in Types

Use the top-level functions directly when serializing standard JavaScript and TypeScript built-ins:

```typescript
import { encode, decode, stringify, parse } from '@plurid/sereal';

const data = {
    big: 9007199254740993n,
    timestamp: new Date(),
    pattern: /^[a-z]+$/gi,
    coords: new Float32Array([1.5, 2.5]),
    lookup: new Map([['key', new Set([1, 2, 3])]]),
    instant: Temporal.Now.instant(),
};

// JSON string with $sereal envelope:
const json = stringify(data, { space: 2 });

// Decoded back to runtime instances:
const restored = parse(json);
```

---

### Custom Types with Symbol Protocol

For classes you control, implement the symbol protocol:

```typescript
import { createSereal, toSereal, fromSereal, serealType } from '@plurid/sereal';

class Point {
    static readonly [serealType] = {
        name: 'geo.Point',
    };

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

const document = sereal.encode(new Point(10, 20));
const point = sereal.decode<Point>(document);
```

---

### Custom Types with `defineType()`

For external or 3rd-party classes:

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

---

### Versioning & Migrations

Upgrade saved models forward automatically:

```typescript
class UserProfile {
    static readonly [serealType] = {
        name: 'app.UserProfile',
        version: 2,
        migrations: {
            // v1 payload was [firstName, lastName]
            1: ([firstName, lastName]: [string, string]) => ({
                fullName: `${firstName} ${lastName}`,
            }),
        },
    };

    constructor(public fullName: string) {}

    [toSereal]() {
        return { fullName: this.fullName };
    }

    static [fromSereal](data: { fullName: string }) {
        return new UserProfile(data.fullName);
    }
}
```

---

### Standard Schema Validation

Validate payloads prior to class construction:

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

---

### References & Cycles

Shared references and circular topologies are preserved automatically:

```typescript
const shared = { title: 'Shared node' };
const root = {
    first: shared,
    second: shared,
    self: null as any,
};
root.self = root; // circular reference

const restored = parse(stringify(root));
restored.first === restored.second; // true
restored.self === restored; // true
```

---

### Timeline (Undo / Redo)

The `@plurid/sereal/timeline` module provides an immutable timeline state machine:

```typescript
import { createSereal } from '@plurid/sereal';
import { createTimeline } from '@plurid/sereal/timeline';

const sereal = createSereal();
const timeline = createTimeline(sereal, { initial: { count: 0 }, limit: 50 });

timeline.commit({ count: 1 });
timeline.commit({ count: 2 });

timeline.undo(); // present is { count: 1 }
timeline.redo(); // present is { count: 2 }

// Export to persistable JSON snapshot:
const saved = timeline.toJSON();

// Restore from snapshot:
const restored = createTimeline(sereal, { from: saved });
```

---

## Specification & Conformance

The format specification is language-neutral and documented in:

- [`about/spec/sereal-format-v1.md`](./about/spec/sereal-format-v1.md)
- Conformance test vectors are located in [`about/spec/vectors/`](./about/spec/vectors/).

---

## Migration from 0.x

| 0.x                                      | 1.0+                                            |
| ---------------------------------------- | ----------------------------------------------- |
| `class Sereal` (stateful)                | `createSereal({ types })` (pure codec instance) |
| `sereal.sign({ ... })` with path strings | `types: [Class, defineType(...)]`               |
| `sereal.step(state)` / `history`         | `createTimeline(sereal, ...)`                   |
| `sereal.extract()` / `sereal.intract()`  | `sereal.encode()` / `sereal.decode()`           |
| `toSereal()`, `loadSereal(state)`        | `[toSereal]()`, static `[fromSereal](data)`     |

---

## Packages

<a target="_blank" href="https://www.npmjs.com/package/@plurid/sereal">
    <img src="https://img.shields.io/npm/v/@plurid/sereal.svg?logo=npm&colorB=1380C3&style=for-the-badge" alt="Version">
</a>

[@plurid/sereal](https://github.com/plurid/sereal/tree/master/packages/sereal-javascript) • TypeScript implementation

---

## [Codeophon](https://github.com/ly3xqhl8g9/codeophon)

- licensing: [delicense](https://github.com/ly3xqhl8g9/delicense)
- versioning: [αver](https://github.com/ly3xqhl8g9/alpha-versioning)
