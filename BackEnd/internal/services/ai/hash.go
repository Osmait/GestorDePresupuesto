package ai

import (
	"crypto/sha256"
	"encoding/hex"
	"sort"

	domain "github.com/osmait/gestorDePresupuesto/internal/domain/ai"
)

func ComputeFileHash(files []domain.DocumentFile) (string, error) {
	if len(files) == 0 {
		return "", nil
	}

	if len(files) == 1 {
		return computeSingleFileHash(files[0])
	}

	sortedFiles := make([]domain.DocumentFile, len(files))
	copy(sortedFiles, files)
	sort.Slice(sortedFiles, func(i, j int) bool {
		return sortedFiles[i].Filename < sortedFiles[j].Filename
	})

	hasher := sha256.New()
	for _, file := range sortedFiles {
		singleHash, err := computeSingleFileHash(file)
		if err != nil {
			return "", err
		}
		hasher.Write([]byte(singleHash))
	}

	return hex.EncodeToString(hasher.Sum(nil)), nil
}

func computeSingleFileHash(file domain.DocumentFile) (string, error) {
	hash := sha256.Sum256(file.Data)
	return hex.EncodeToString(hash[:]), nil
}
