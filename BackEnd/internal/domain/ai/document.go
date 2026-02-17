package ai

import (
	"mime/multipart"
	"net/http"
)

type DocumentFile struct {
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	Data        []byte `json:"-"`
	Size        int64  `json:"size"`
}

var ValidContentTypes = map[string]bool{
	"application/pdf": true,
	"image/jpeg":      true,
	"image/jpg":       true,
	"image/png":       true,
	"image/webp":      true,
	"image/gif":       true,
}

func IsValidContentType(contentType string) bool {
	return ValidContentTypes[contentType]
}

func DocumentFromMultipartFile(header *multipart.FileHeader) (*DocumentFile, error) {
	file, err := header.Open()
	if err != nil {
		return nil, err
	}
	defer file.Close()

	data := make([]byte, header.Size)
	if _, err := file.Read(data); err != nil {
		return nil, err
	}

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = http.DetectContentType(data[:512])
	}

	return &DocumentFile{
		Filename:    header.Filename,
		ContentType: contentType,
		Data:        data,
		Size:        header.Size,
	}, nil
}
