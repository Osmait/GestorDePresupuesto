module.exports = {
	extends: [
		'next/core-web-vitals',
		'@typescript-eslint/recommended',
	],
	parser: '@typescript-eslint/parser',
	plugins: ['@typescript-eslint'],
	rules: {
		// Code Style Rules according to repo rules
		'quotes': ['error', 'single'],
		'semi': ['error', 'never'],
		'comma-dangle': ['error', 'always-multiline'],
		'indent': ['error', 'tab'],
		
		// Naming Conventions
		'@typescript-eslint/naming-convention': [
			'error',
			{
				'selector': 'interface',
				'format': ['PascalCase'],
			},
			{
				'selector': 'typeAlias',
				'format': ['PascalCase'],
			},
			{
				'selector': 'variable',
				'format': ['camelCase', 'PascalCase', 'UPPER_CASE'],
			},
			{
				'selector': 'function',
				'format': ['camelCase', 'PascalCase'],
			},
			{
				'selector': 'parameter',
				'format': ['camelCase'],
			},
			{
				'selector': 'property',
				'format': ['camelCase', 'snake_case'], // Allow snake_case for API compatibility
			},
		],
		
		// React Rules
		'react/function-component-definition': [
			'error',
			{
				'namedComponents': 'function-declaration',
				'unnamedComponents': 'arrow-function',
			},
		],
		
		// TypeScript Rules
		'@typescript-eslint/no-unused-vars': 'error',
		'@typescript-eslint/explicit-function-return-type': 'off',
		'@typescript-eslint/explicit-module-boundary-types': 'off',
		'@typescript-eslint/no-explicit-any': 'warn',
		
		// Best Practices
		'eqeqeq': ['error', 'always'],
		'prefer-const': 'error',
		'no-var': 'error',
		'object-shorthand': 'error',
		'prefer-template': 'error',
		
		// Next.js specific
		'@next/next/no-html-link-for-pages': 'error',
		'@next/next/no-img-element': 'error',
	},
	env: {
		browser: true,
		node: true,
		es6: true,
	},
	parserOptions: {
		ecmaVersion: 2022,
		sourceType: 'module',
		ecmaFeatures: {
			jsx: true,
		},
	},
} 