import { defineConfig } from "vitest/config";
import swc from "unplugin-swc";

export default defineConfig({
    plugins: [
        // SWC is needed to correctly handle TypeORM decorators (emitDecoratorMetadata)
        // because vitest's default esbuild transform strips decorator metadata.
        swc.vite({
            module: { type: "es6" },
            jsc: {
                parser: { syntax: "typescript", decorators: true },
                transform: { decoratorMetadata: true },
            },
        }),
    ],
    test: {
        globals: true,
        environment: "node",
        setupFiles: ["tests/setup.ts"],
        include: ["tests/**/*.test.ts"],
        coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            exclude: ["src/server.ts", "src/entities/**", "src/openapi.ts"],
        },
    },
});
