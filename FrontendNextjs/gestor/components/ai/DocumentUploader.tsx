'use client'

import { AlertCircle, FileText, Upload, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'
import { FileRejection, useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { useAppLocale } from '@/lib/i18n/date-locale'
import { cn, formatFileSize } from '@/lib/utils'

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
	const locale = useAppLocale()
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
		[files, maxFiles, maxSize, onFilesSelected, t],
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
		<div className='space-y-4'>
			<div
				{...getRootProps({ role: 'button', 'aria-label': t('dragOrClick'), 'aria-disabled': disabled || undefined })}
				className={cn(
					'cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-8',
					isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50',
					disabled && 'cursor-not-allowed opacity-50',
					error && 'border-destructive',
				)}
			>
				<input {...getInputProps()} />
				<Upload className='mx-auto mb-3 h-10 w-10 text-muted-foreground' aria-hidden='true' />
				{isDragActive ? (
					<p className='text-sm text-muted-foreground'>{t('dropFiles')}</p>
				) : (
					<div className='space-y-2'>
						<p className='text-sm text-muted-foreground'>{t('dragOrClick')}</p>
						<p className='text-xs text-muted-foreground'>
							{t('supportedFormats', { maxSize: maxSize / 1024 / 1024, maxFiles })}
						</p>
					</div>
				)}
			</div>

			{error && (
				<div role='alert' className='flex items-center gap-2 text-sm text-destructive'>
					<AlertCircle className='h-4 w-4 shrink-0' aria-hidden='true' />
					{error}
				</div>
			)}

			{files.length > 0 && (
				<div className='space-y-2'>
					<div className='flex items-center justify-between'>
						<span className='text-sm text-muted-foreground'>{t('filesSelected', { count: files.length })}</span>
						<Button type='button' variant='ghost' size='sm' onClick={clearFiles}>
							{t('clearAll')}
						</Button>
					</div>
					<div className='space-y-2'>
						{files.map((file, index) => (
							<div
								key={`${file.name}-${file.size}`}
								className='flex items-center justify-between gap-2 rounded-lg bg-muted p-3 pr-1'
							>
								<div className='flex min-w-0 items-center gap-2'>
									<FileText className='h-4 w-4 shrink-0 text-muted-foreground' aria-hidden='true' />
									<div className='min-w-0'>
										<p className='truncate text-sm font-medium'>{file.name}</p>
										<p className='text-xs text-muted-foreground tabular-nums'>{formatFileSize(file.size, locale)}</p>
									</div>
								</div>
								<Button
									type='button'
									variant='ghost'
									size='icon'
									className='shrink-0'
									onClick={() => removeFile(index)}
									disabled={disabled}
									aria-label={t('removeFile', { name: file.name })}
								>
									<X className='h-4 w-4' aria-hidden='true' />
								</Button>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	)
}
