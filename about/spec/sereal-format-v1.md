# sereal format — version 1

Status: **stable** · Media type (suggested): `application/vnd.sereal+json`

This document specifies the sereal document format independently of any programming language.
The key words MUST, MUST NOT, SHOULD and MAY are to be interpreted as described in RFC 2119.

Conformance vectors live in [`vectors/`](./vectors).

## 1. Goals

- Represent rich in-memory values (special numbers, big integers, dates, collections, binary data,
  errors, temporal values, user-defined types, shared references and cycles) as **plain JSON**.
- Be **readable and diffable**: a document without special values is the JSON value itself, wrapped in an envelope.
- Be **safe to decode** from untrusted input: no code execution, an allowlist of user types, bounded depth.
- Be **evolvable**: user types carry versions and are upgraded by migrations.

## 2. Document

A document is a JSON object with exactly two members:

```json
{ "$sereal": 1, "root": <node> }
```

- `$sereal` MUST be the integer `1` for this version of the format.
- `root` MUST be a node (§3).
- Decoders MUST reject documents with any other member, or a different `$sereal` value (`INVALID_DOCUMENT`).

## 3. Nodes

A **node** is any JSON value, interpreted as follows:

| JSON value                        | Meaning                                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| string, `true`, `false`, `null`   | itself                                                             |
| number                            | itself (JSON numbers are finite)                                   |
| array                             | an array whose elements are nodes                                  |
| object **without** a `"$"` member | a plain object (string-keyed record) whose member values are nodes |
| object **with** a `"$"` member    | a **tagged node** (§4)                                             |

Member order of plain objects is significant for canonical form (§7) but not for equality.

## 4. Tagged nodes

A tagged node is a JSON object with:

| Member | Required       | Meaning                                                           |
| ------ | -------------- | ----------------------------------------------------------------- |
| `"$"`  | yes            | the tag: a string                                                 |
| `"id"` | no             | a positive integer identity (§5); only allowed on _identity tags_ |
| `"v"`  | depends on tag | the payload                                                       |

Decoders MUST reject tagged nodes with any other member.

Encoders MUST emit members in the order `"$"`, `"id"`, `"v"`.

### 4.1 Tag namespaces

- Tags matching `^[a-z0-9-]+$` are **built-in tags**. The whole namespace is reserved for this
  specification and future versions of it. Decoders encountering an unknown built-in tag MUST fail with `UNKNOWN_TYPE`.
- All other tags are **custom tags** (§6).

### 4.2 Built-in tags

**Primitive tags** — no `id`, no `v`:

| Tag         | Value                          |
| ----------- | ------------------------------ |
| `undefined` | the "absent / undefined" value |
| `nan`       | IEEE-754 NaN                   |
| `inf`       | +∞                             |
| `-inf`      | −∞                             |
| `-0`        | negative zero                  |

**Scalar tags** — no `id`:

| Tag      | Payload `v`                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------- |
| `bigint` | string matching `^-?(0\|[1-9][0-9]*)$`                                                                  |
| `symbol` | string: a key in a global symbol registry (implementations without symbols MAY map to a dedicated type) |
| `ref`    | positive integer: the `id` of a previously decoded node (§5)                                            |

**Container tags** — identity tags; `v` contains **nodes**:

| Tag      | Payload `v`                                                                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `object` | JSON object; member names are taken **literally** (including `"$"`), member values are nodes                                                         |
| `array`  | JSON array of nodes                                                                                                                                  |
| `map`    | JSON array of `[keyNode, valueNode]` pairs; keys may be any node                                                                                     |
| `set`    | JSON array of nodes                                                                                                                                  |
| `error`  | JSON object with string `name`, string `message`, optional node `cause`, optional array-of-nodes `errors`, optional string `stack`; no other members |

`object` and `array` are only needed when the value has an identity (`id`) or, for `object`,
when a plain object has its own `"$"` member (escaping). Otherwise plain JSON objects and arrays are used.

`error` with an `errors` member denotes an aggregate error.

**Leaf tags** — identity tags; `v` is raw JSON (**not** nodes):

| Tag                                                                                                           | Payload `v`                                                                                                      |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `date`                                                                                                        | ISO-8601 UTC string `YYYY-MM-DDTHH:mm:ss.sssZ` (extended years `±YYYYYY` allowed), or `null` for an invalid date |
| `regexp`                                                                                                      | `{ "source": string, "flags": string }` (ECMAScript syntax)                                                      |
| `url`                                                                                                         | absolute URL string (WHATWG URL)                                                                                 |
| `arraybuffer`                                                                                                 | base64 string (RFC 4648 §4, with padding)                                                                        |
| `dataview`                                                                                                    | base64 string                                                                                                    |
| `u8` `u8c` `i8` `u16` `i16` `u32` `i32` `f16` `f32` `f64` `i64` `u64`                                         | base64 string of the element bytes in **little-endian** order                                                    |
| `instant` `zoneddatetime` `plaindate` `plaintime` `plaindatetime` `plainyearmonth` `plainmonthday` `duration` | the value's canonical string per TC39 Temporal / RFC 9557                                                        |

Typed array tags: `u`/`i`/`f` = unsigned/signed/float, number = bits per element, `u8c` = clamped bytes.

## 5. Identity, references and cycles

- An encoder MUST assign an `id` to every object-like value that is reached more than once in the value graph,
  and MUST NOT assign ids to values reached once.
- Ids are assigned `1, 2, 3, …` in **depth-first pre-order of first encounter**, where children are visited in
  document order (object members in order, array/set elements in order, map entries as key then value, error
  `cause` then `errors`, custom payloads as their node).
- Every later occurrence of the value is encoded as `{ "$": "ref", "v": id }`.
- A decoder MUST register a container (`object`, `array`, `map`, `set`, `error`) under its id **before**
  decoding its children, so references inside the container to the container itself (cycles) resolve.
- A leaf value is registered after it is decoded.
- A custom value is registered after its factory returns. A `ref` to a custom node that is still being decoded
  MUST fail with `UNSUPPORTED_CYCLE`. Encoders SHOULD detect such cycles and fail with the same code.
- A `ref` to an id not yet registered MUST fail with `INVALID_DOCUMENT`. Duplicate ids MUST fail with `INVALID_DOCUMENT`.

## 6. Custom types

A custom tag has the form `name` or `name@version`:

- `name` matches `^[A-Za-z_][A-Za-z0-9_.:/-]*$` and MUST NOT match the built-in namespace `^[a-z0-9-]+$`.
  Recommended: a namespaced or capitalized name such as `geo.Point`, `acme:Invoice` or `Point`.
- `version` is a positive decimal integer without leading zeros. An absent version means `1`.
  Encoders MUST omit `@1`.
- `v` is REQUIRED and is a **node** (it may contain any node, including other custom types).
- Custom tags are identity tags.

Decoding a custom node:

1. Look up `name` in the decoder's registry; if absent fail with `UNKNOWN_TYPE`.
2. If the document version is greater than the registered version, fail with `VERSION_TOO_NEW`.
3. Decode the payload node.
4. For each version `n` from the document version up to (registered version − 1), apply the migration
   registered for `n`; if one is missing fail with `MISSING_MIGRATION`.
5. If a schema is registered, validate the payload; on failure fail with `SCHEMA_FAILED`.
6. Construct the value from the payload.

Only registered types are ever constructed; decoders MUST NOT instantiate types by name from arbitrary
code paths (e.g. reflection over the tag).

## 7. Canonical form

The canonical encoding of a value is the encoding produced by the rules above with:
member order `"$"`, `"id"`, `"v"` for tagged nodes; plain object members in the source order; ids per §5;
primitive tags without `v`; custom tags without `@1`.

Conformance: for every vector in `vectors/valid`, `encode(decode(document))` MUST be **JSON-equal** to `canonical`
(or to `document` when `canonical` is absent). JSON-equal means equal as JSON values where object member order
is ignored.

## 8. Safety requirements for decoders

- MUST NOT execute code derived from the document.
- MUST treat member names such as `__proto__`, `constructor` and `prototype` as plain data.
- MUST enforce a maximum nesting depth (RECOMMENDED default: 1000) and fail with `MAX_DEPTH`.
- MUST reject raw JSON values that are not finite numbers, strings, booleans, null, arrays or objects.

## 9. Error codes

| Code                             | Meaning                                                         |
| -------------------------------- | --------------------------------------------------------------- |
| `INVALID_DOCUMENT`               | structural violation of this specification                      |
| `UNKNOWN_TYPE`                   | unknown built-in tag or unregistered custom type                |
| `VERSION_TOO_NEW`                | custom payload newer than the registered type                   |
| `MISSING_MIGRATION`              | no migration from an older version                              |
| `SCHEMA_FAILED`                  | schema validation failed                                        |
| `UNSUPPORTED_CYCLE`              | cycle through a custom type                                     |
| `MAX_DEPTH`                      | nesting depth exceeded                                          |
| `RUNTIME_UNSUPPORTED`            | the runtime cannot represent a decoded value (e.g. no Temporal) |
| `UNSUPPORTED_VALUE`              | (encoding) the value cannot be represented                      |
| `INVALID_TYPE`, `DUPLICATE_TYPE` | (registry) malformed or duplicate type definition               |

## 10. Conformance vectors

```
vectors/
  valid/*.json     { "description", "document", "canonical"? }
  invalid/*.json   { "description", "document", "error": "<CODE>" }
```

Vectors use one custom type, which conformance runners MUST register:

| Name         | Version | Payload                        | Migration 1 → 2                 |
| ------------ | ------- | ------------------------------ | ------------------------------- |
| `test.Point` | 2       | `{ "x": number, "y": number }` | `[x, y]` → `{ "x": x, "y": y }` |

## 11. Versioning of this specification

Additive changes that do not alter the meaning of existing documents (for example new built-in tags)
MAY be made within format version 1; older decoders reject them with `UNKNOWN_TYPE`.
Any change to the meaning of existing documents requires a new `$sereal` version.
