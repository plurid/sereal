// #region imports
import { SerealError, type SerealPath } from './errors.ts';
import type { StandardSchemaV1 } from './standard-schema.ts';
// #endregion imports

// #region module
/**
 * Synchronously validates `value` with a Standard Schema, returning the (possibly transformed) output.
 */
export const validateSchema = (
    schema: StandardSchemaV1,
    value: unknown,
    path: SerealPath,
    label: string,
): unknown => {
    const result = schema['~standard'].validate(value);
    if (typeof (result as { then?: unknown }).then === 'function') {
        throw new SerealError(
            'SCHEMA_FAILED',
            `${label}: asynchronous schemas are not supported; use a synchronous schema.`,
            { path },
        );
    }
    const { issues } = result as StandardSchemaV1.Result<unknown>;
    if (issues) {
        const summary = issues.map((issue) => issue.message).join('; ');
        throw new SerealError('SCHEMA_FAILED', `${label} failed validation: ${summary}`, {
            path,
            issues,
        });
    }
    return (result as StandardSchemaV1.SuccessResult<unknown>).value;
};
// #endregion module
