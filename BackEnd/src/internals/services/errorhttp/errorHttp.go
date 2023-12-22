package errorhttp

import "errors"

var (
	NotFound     = errors.New("not found")
	NotDuplicate = errors.New("not duplicate")
	BadRequest   = errors.New("bad request")
)
