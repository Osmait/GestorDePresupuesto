package telemetry

import (
	"fmt"

	_ "github.com/lib/pq"
)

func typeName(v any) string { return fmt.Sprintf("%T", v) }
