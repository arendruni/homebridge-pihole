module.exports = {
	env: {
		node: true,
		es6: true,
	},
	globals: {
		Atomics: "readonly",
		SharedArrayBuffer: "readonly",
	},
	plugins: ["@typescript-eslint"],
	extends: ["eslint:recommended"],
	parserOptions: {
		sourceType: "module",
		ecmaVersion: 2018,
	},
	overrides: [
		{
			files: ["**/*.ts", "**/*.tsx"],
			parser: "@typescript-eslint/parser",
			extends: [
				"eslint:recommended",
				"plugin:@typescript-eslint/eslint-recommended",
				"plugin:@typescript-eslint/recommended",
			],
		},
	],
};
