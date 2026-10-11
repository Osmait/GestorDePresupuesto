// `atropos/css` is a package export pointing at a stylesheet: the specifier has no
// `.css` extension, so Next's `*.css` declaration does not cover it and TS 6
// (`noUncheckedSideEffectImports`) needs it declared.
declare module 'atropos/css'
