module.exports = {
	// Code Style Rules according to repo rules
	semi: false,
	singleQuote: true,
	useTabs: true,
	tabWidth: 1,
	trailingComma: 'always-multiline',
	printWidth: 80,
	bracketSpacing: true,
	bracketSameLine: false,
	arrowParens: 'always',
	endOfLine: 'lf',
	
	// JSX specific
	jsxSingleQuote: true,
	jsxBracketSameLine: false,
	
	// File overrides
	overrides: [
		{
			files: '*.json',
			options: {
				useTabs: false,
				tabWidth: 2,
			},
		},
		{
			files: '*.md',
			options: {
				useTabs: false,
				tabWidth: 2,
			},
		},
	],
} 