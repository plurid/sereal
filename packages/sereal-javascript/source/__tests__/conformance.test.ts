// #region imports
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sereal } from './fixtures.ts';
// #endregion imports

// #region module
const vectorsDir = join(__dirname, '../../../../about/spec/vectors');
const validDir = join(vectorsDir, 'valid');
const invalidDir = join(vectorsDir, 'invalid');

describe('conformance vectors', () => {
    describe('valid vectors', () => {
        const files = readdirSync(validDir).filter((file) => file.endsWith('.json'));

        for (const file of files) {
            it(`vector: valid/${file}`, () => {
                const content = JSON.parse(readFileSync(join(validDir, file), 'utf-8'));
                const { document, canonical } = content;

                const decoded = sereal.decode(document);
                const reEncoded = sereal.encode(decoded);

                const expected = canonical ?? document;
                expect(reEncoded).toEqual(expected);
            });
        }
    });

    describe('invalid vectors', () => {
        const files = readdirSync(invalidDir).filter((file) => file.endsWith('.json'));

        for (const file of files) {
            it(`vector: invalid/${file}`, () => {
                const content = JSON.parse(readFileSync(join(invalidDir, file), 'utf-8'));
                const { document, error } = content;

                expect(() => sereal.decode(document)).toThrowError(
                    expect.objectContaining({
                        name: 'SerealError',
                        code: error,
                    }),
                );
            });
        }
    });
});
// #endregion module
