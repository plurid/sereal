// #region imports
import { describe, expect, it } from 'vitest';
import { createSereal, fromSereal, serealType, toSereal } from '../index.ts';
import { sereal } from './fixtures.ts';
// #endregion imports

// #region module
describe('versioning and migrations', () => {
    it('applies migrations in sequence across multiple versions', () => {
        // Version 3 type migrating from v1 -> v2 -> v3
        class MultiVersion {
            static readonly [serealType] = {
                name: 'test.Multi',
                version: 3,
                migrations: {
                    1: (data: { num: number }) => ({ num: data.num, str: String(data.num) }),
                    2: (data: { num: number; str: string }) => ({
                        value: data.num,
                        label: data.str,
                        v3: true,
                    }),
                },
            };

            readonly value: number;
            readonly label: string;

            constructor(value: number, label: string) {
                this.value = value;
                this.label = label;
            }

            [toSereal]() {
                return { value: this.value, label: this.label, v3: true };
            }

            static [fromSereal](data: { value: number; label: string; v3: boolean }) {
                return new MultiVersion(data.value, data.label);
            }
        }

        const s = createSereal({ types: [MultiVersion] });

        // Decode v1
        const docV1 = {
            $sereal: 1,
            root: {
                $: 'test.Multi@1',
                v: { num: 42 },
            },
        };
        const decodedV1 = s.decode<MultiVersion>(docV1);
        expect(decodedV1).toBeInstanceOf(MultiVersion);
        expect(decodedV1.value).toBe(42);
        expect(decodedV1.label).toBe('42');

        // Decode v2
        const docV2 = {
            $sereal: 1,
            root: {
                $: 'test.Multi@2',
                v: { num: 100, str: 'hundred' },
            },
        };
        const decodedV2 = s.decode<MultiVersion>(docV2);
        expect(decodedV2.value).toBe(100);
        expect(decodedV2.label).toBe('hundred');
    });

    it('fails with MISSING_MIGRATION when an intermediate step is absent', () => {
        class BrokenMigration {
            static readonly [serealType] = {
                name: 'test.Broken',
                version: 3,
                migrations: {
                    // missing 1 -> 2
                    2: (data: any) => data,
                },
            };
            [toSereal]() {
                return {};
            }
            static [fromSereal]() {
                return new BrokenMigration();
            }
        }

        const s = createSereal({ types: [BrokenMigration] });
        const doc = {
            $sereal: 1,
            root: {
                $: 'test.Broken@1',
                v: {},
            },
        };

        expect(() => s.decode(doc)).toThrowError(
            expect.objectContaining({ code: 'MISSING_MIGRATION' }),
        );
    });

    it('fails with VERSION_TOO_NEW when incoming payload version > registered version', () => {
        const doc = {
            $sereal: 1,
            root: {
                $: 'test.Point@99',
                v: { x: 1, y: 2 },
            },
        };

        expect(() => sereal.decode(doc)).toThrowError(
            expect.objectContaining({ code: 'VERSION_TOO_NEW' }),
        );
    });

    it('fails with UNKNOWN_TYPE when type is not registered', () => {
        const doc = {
            $sereal: 1,
            root: {
                $: 'test.NonExistent',
                v: {},
            },
        };

        expect(() => sereal.decode(doc)).toThrowError(
            expect.objectContaining({ code: 'UNKNOWN_TYPE' }),
        );
    });
});
// #endregion module
