<p align="center">
    <img src="https://raw.githubusercontent.com/plurid/sereal/master/about/identity/sereal-logo.png" height="250px">
    <br />
    <br />
    <a target="_blank" href="https://github.com/plurid/sereal/blob/master/LICENSE">
        <img src="https://img.shields.io/badge/license-DEL-blue.svg?colorB=1380C3&style=for-the-badge" alt="License: DEL">
    </a>
</p>



<h1 align="center">
    sereal
</h1>


<h3 align="center">
    Real Serialization
</h3>



### Contents

+ [About](#about)
+ [Install](#install)
+ [Usage](#usage)
+ [Packages](#packages)
+ [Codeophon](#codeophon)



## About

`sereal` provides utility for the serialization of regular primitives (such as boolean, number, string), and also for the serialization of objects.

In order for an object to be serialized with `sereal` it must be a `serealable object`, that is, it must implement the interface

``` typescript
interface SerealableObject<S = any> {
    toSereal(): S;
    loadSereal(state: S): void;
}
```

The `toSereal()` and `loadSereal()` methods will be used by `Sereal` to serialize and instantiate the serealable object.



## Install

To install run

``` bash
npm install @plurid/sereal
```

or

``` bash
yarn add @plurid/sereal
```



## Usage


``` typescript
import Sereal, {
    SerealableObject,
} from '@plurid/sereal';


class SomeSereal implements SerealableObject<any> {
    private value = 23;

    public increase() {
        this.value += 1;
    }

    public toSereal() {
        return {
            value: this.value,
        };
    }

    public loadSereal(
        state: any,
    ) {
        this.value = state.value;
    }
}

const main = () => {
    const sereal = new Sereal();

    sereal.sign({
        SomeSereal: {
            object: SomeSereal,
            fields: [
                'someSereal',
                'some.nested.sereal',
            ],
        },
    });

    const someSereal = new SomeSereal();
    const someNestedSereal = new SomeSereal();

    sereal.step({
        someSereal: someSereal,
        some: {
            nested: {
                sereal: someNestedSereal,
            },
        },
    });

    someSereal.increase();
    someSereal.increase();

    // `extract` contains the serealized value
    // {
    //     someSereal: {
    //         value: 25,
    //     },
    //     some: {
    //         nested: {
    //             sereal: {
    //                 value: 23,
    //             },
    //         },
    //     },
    // }
    const extract = sereal.extract();

    const anotherSereal = new Sereal();
    anotherSereal.sign({
        SomeSereal: {
            object: SomeSereal,
            fields: [
                'someSereal',
                'some.nested.sereal',
            ],
        },
    });

    // `intract` injects the `sereal` `extract` into the `anotherSereal`
    anotherSereal.intract(extract);

    // `anotherSereal` has the same state as `sereal`
    const extractAnotherSereal = anotherSereal.extract();
}

main();
```



## Packages

<a target="_blank" href="https://www.npmjs.com/package/@plurid/sereal">
    <img src="https://img.shields.io/npm/v/@plurid/sereal.svg?logo=npm&colorB=1380C3&style=for-the-badge" alt="Version">
</a>

[@plurid/sereal][sereal] • sereal

[sereal]: https://github.com/plurid/plurid/tree/master/packages/sereal



## [Codeophon](https://github.com/ly3xqhl8g9/codeophon)

+ licensing: [delicense](https://github.com/ly3xqhl8g9/delicense)
+ versioning: [αver](https://github.com/ly3xqhl8g9/alpha-versioning)
