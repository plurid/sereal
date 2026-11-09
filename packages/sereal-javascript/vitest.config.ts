import { defineConfig } from 'vitest/config';

const config: ReturnType<typeof defineConfig> = defineConfig({
    test: {
        include: ['source/**/__tests__/**/*.test.ts'],
        environment: 'node',
        coverage: {
            provider: 'v8',
            include: ['source/**/*.ts'],
            exclude: ['source/**/__tests__/**', 'source/types.ts', 'source/standard-schema.ts'],
            reporter: ['text', 'html', 'lcov'],
            thresholds: {
                lines: 95,
                functions: 95,
                statements: 95,
                branches: 90,
            },
        },
    },
});

export default config;
