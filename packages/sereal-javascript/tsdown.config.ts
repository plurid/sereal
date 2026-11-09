import { defineConfig } from 'tsdown';

const config: ReturnType<typeof defineConfig> = defineConfig({
    entry: {
        index: 'source/index.ts',
        timeline: 'source/timeline/index.ts',
    },
    format: 'esm',
    platform: 'neutral',
    target: 'es2024',
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    publint: true,
    attw: {
        profile: 'esm-only',
    },
});

export default config;
