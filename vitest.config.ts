import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		// the real "obsidian" package has types only; tests run against a small mock
		alias: { obsidian: fileURLToPath(new URL('./test/obsidian-mock.ts', import.meta.url)) },
	},
	test: {
		include: ['test/**/*.test.ts'],
	},
});
