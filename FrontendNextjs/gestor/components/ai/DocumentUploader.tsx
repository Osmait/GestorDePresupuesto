'use client'

import { useCallback, useState } from 'react'
import { useDropzone, FileRejection } from 'react-dropzone'
import { Upload, FileText, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface DocumentUploaderProps {
  onFilesSelected: (files: File[]) => void
  maxFiles?: number
  maxSize?: number
  disabled?: boolean
}

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
}

export function DocumentUploader({
  onFilesSelected,
  maxFiles = 5,
  maxSize = 10 * 1024 * 1024,
  disabled = false,
}: DocumentUploaderProps) {
  const t = useTranslations('ai.uploader')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      setError(null)

      if (fileRejections.length > 0) {
        const rejection = fileRejections[0]
        if (rejection.errors[0]?.code === 'file-too-large') {
          setError(t('fileTooLarge', { maxSize: maxSize / 1024 / 1024 }))
        } else if (rejection.errors[0]?.code === 'file-invalid-type') {
          setError(t('invalidFileType'))
        } else {
          setError(rejection.errors[0]?.message || t('invalidFile'))
        }
        return
      }

      const totalFiles = files.length + acceptedFiles.length
      if (totalFiles > maxFiles) {
        setError(t('maxFilesExceeded', { maxFiles }))
        return
      }

      const newFiles = [...files, ...acceptedFiles]
      setFiles(newFiles)
      onFilesSelected(newFiles)
    },
    [files, maxFiles, maxSize, onFilesSelected, t]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles,
    maxSize,
    disabled,
  })

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index)
    setFiles(newFiles)
    onFilesSelected(newFiles)
    setError(null)
  }

  const clearFiles = () => {
    setFiles([])
    onFilesSelected([])
    setError(null)
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
          disabled && 'opacity-50 cursor-not-allowed',
          error && 'border-destructive'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        {isDragActive ? (
          <p className="text-sm text-muted-foreground">{t('dropFiles')}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('dragOrClick')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('supportedFormats', { maxSize: maxSize / 1024 / 1024, maxFiles })}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('filesSelected', { count: files.length })}</span>
            <Button variant="ghost" size="sm" onClick={clearFiles}>
              {t('clearAll')}
            </Button>
          </div>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  disabled={disabled}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
