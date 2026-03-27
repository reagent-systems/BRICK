import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

const dir = path.dirname(fileURLToPath(import.meta.url));
const rootPkg = JSON.parse(readFileSync(path.join(dir, '..', 'package.json'), 'utf8')) as {
	version: string;
};

export default defineConfig(({ mode }) => {
	const rootEnv = loadEnv(mode, path.join(dir, '..'), '');
	const siteEnv = loadEnv(mode, dir, '');
	const brickReleaseVersion =
		process.env.PUBLIC_BRICK_RELEASE_VERSION ||
		siteEnv.PUBLIC_BRICK_RELEASE_VERSION ||
		rootEnv.PUBLIC_BRICK_RELEASE_VERSION ||
		rootPkg.version;

	return {
		plugins: [sveltekit()],
		define: {
			'import.meta.env.PUBLIC_BRICK_RELEASE_VERSION': JSON.stringify(brickReleaseVersion)
		}
	};
});
