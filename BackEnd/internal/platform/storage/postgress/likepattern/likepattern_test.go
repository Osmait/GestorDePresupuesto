package likepattern

import "testing"

func TestContains(t *testing.T) {
	t.Parallel()
	for in, want := range map[string]string{
		"colmado": "%colmado%",
		"50%":     `%50\%%`,
		"a_b":     `%a\_b%`,
		`c:\x`:    `%c:\\x%`,
		"":        "%%",
	} {
		if got := Contains(in); got != want {
			t.Errorf("Contains(%q) = %q, want %q", in, got, want)
		}
	}
}
