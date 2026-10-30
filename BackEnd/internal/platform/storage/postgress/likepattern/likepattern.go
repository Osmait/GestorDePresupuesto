// Package likepattern builds LIKE / ILIKE patterns from user input.
package likepattern

import "strings"

var escaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

// Contains returns a pattern matching values that contain s literally. The
// wildcards % and _ (and the escape character itself) in s are escaped with
// a backslash, PostgreSQL's default LIKE escape, so a search for "50%" does
// not match everything starting with "50".
func Contains(s string) string {
	return "%" + escaper.Replace(s) + "%"
}
