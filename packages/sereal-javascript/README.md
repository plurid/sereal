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
    @plurid/sereal
</h1>

<h3 align="center">
    Real (Values and Objects) Serialization
</h3>

TypeScript implementation of the `sereal` specification. Encodes JavaScript values and class instances into readable JSON documents and reconstructs the exact original runtime instances.

### Contents

- [Install](#install)
- [Usage](#usage)
- [Specification](#specification)
- [Codeophon](#codeophon)

## Install

```bash
npm install @plurid/sereal
# or: pnpm add @plurid/sereal
# or: bun add @plurid/sereal
# or: deno add jsr:@plurid/sereal
```

## Usage

```typescript
import { createSereal, defineType, toSereal, fromSereal, serealType } from '@plurid/sereal';

// 1. Symbol Protocol for classes you own
class Point {
    static readonly [serealType] = { name: 'geo.Point' };

    constructor(
        readonly x: number,
        readonly y: number,
    ) {}

    [toSereal]() {
        return { x: this.x, y: this.y };
    }

    static [fromSereal](data: { x: number; y: number }) {
        return new Point(data.x, data.y);
    }
}

// 2. defineType for third-party classes
class Money {
    constructor(readonly cents: bigint) {}
}

const MoneyType = defineType(Money, {
    name: 'app.Money',
    encode: (m) => m.cents.toString(),
    decode: (str: string) => new Money(BigInt(str)),
});

const sereal = createSereal({ types: [Point, MoneyType] });

const document = sereal.encode({
    origin: new Point(0, 0),
    balance: new Money(5000n),
    created: Temporal.Now.instant(),
});

const restored = sereal.decode(document);
```

For full documentation and wire format details, see the [repository root README](../../README.md).

## Specification

Language-independent format specification and test vectors are documented in [`about/spec/sereal-format-v1.md`](../../about/spec/sereal-format-v1.md).

## [Codeophon](https://github.com/ly3xqhl8g9/codeophon)

- licensing: [delicense](https://github.com/ly3xqhl8g9/delicense)
- versioning: [αver](https://github.com/ly3xqhl8g9/alpha-versioning)
