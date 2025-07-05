package errorhttp

import (
	"errors"
	"time"
)

var (
	ErrNotFound     = errors.New("not found")
	ErrNotDuplicate = errors.New("not duplicate email")
	ErrBadRequest   = errors.New("bad request")
)

func IsErrNotDuplicate(err error) bool {
	return errors.Is(err, ErrNotDuplicate)
}

func IsErrNotBadRequest(err error) bool {
	return errors.Is(err, ErrBadRequest)
}

func IsErrNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}

type ErrorApp struct {
	Path   string    `json:"path"`
	Err    string    `json:"err"`
	Status int       `json:"status"`
	Time   time.Time `json:"time"`
}

func NewErroApp(staus int, path string, msg string, time time.Time) *ErrorApp {
	return &ErrorApp{
		Path:   path,
		Status: staus,
		Err:    msg,
		Time:   time,
	}
}
