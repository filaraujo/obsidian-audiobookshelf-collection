import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						"eslint.config.mts",
						"eslint.config.js",
						"manifest.json",
						"vitest.config.ts",
						"vitest.obsidian.stub.ts",
					],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		files: ["vitest.config.ts"],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
		rules: {
			"import/no-nodejs-modules": "off",
			"obsidianmd/hardcoded-config-path": "off",
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"main.js",
		"esbuild.config.mjs",
		"eslint.config.js",
		"version-bump.mjs",
		"versions.json",
	]),
);
