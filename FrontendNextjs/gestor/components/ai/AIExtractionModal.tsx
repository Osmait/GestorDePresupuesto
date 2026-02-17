'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DocumentUploader } from './DocumentUploader'
import { TransactionPreview } from './TransactionPreview'
import { useExtractFromFile } from '@/hooks/queries/useAIQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useCreateTransactionMutation } from '@/hooks/queries/useTransactionsQuery'
import { Transaction, TypeTransaction } from '@/types/transaction'
import { DocumentType, AIExtractResponse } from '@/types/ai'
import { toast } from 'sonner'

interface AIExtractionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultAccountId?: string
}

export function AIExtractionModal({ open, onOpenChange, defaultAccountId }: AIExtractionModalProps) {
  const [files, setFiles] = useState<File[]>([])
  const [documentType, setDocumentType] = useState<DocumentType>('receipt')
  const [accountId, setAccountId] = useState<string>(defaultAccountId || '')
  const [extractedTransactions, setExtractedTransactions] = useState<Transaction[]>([])
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [step, setStep] = useState<'upload' | 'preview' | 'saving'>('upload')

  const { extract, isExtracting, extractData, reset } = useExtractFromFile()
  const { data: categories = [] } = useGetCategories()
  const { data: accounts = [] } = useGetAccounts()
  const createTransaction = useCreateTransactionMutation()

  const handleFilesSelected = useCallback((selectedFiles: File[]) => {
    setFiles(selectedFiles)
  }, [])

  const handleExtract = async () => {
    if (files.length === 0 || !accountId) {
      toast.error('Please select files and an account')
      return
    }

    const result = await extract(files, accountId, documentType)

    if ('success' in result && result.success) {
      const response = result as AIExtractResponse
      setExtractedTransactions(response.data.transactions)
      setSelectedIndices(new Set(response.data.transactions.map((_, i) => i)))
      setStep('preview')
      toast.success(`Extracted ${response.data.count} transactions`)
    } else {
      toast.error('Failed to extract transactions')
    }
  }

  const handleEdit = (index: number, transaction: Transaction) => {
    const updated = [...extractedTransactions]
    updated[index] = transaction
    setExtractedTransactions(updated)
  }

  const handleRemove = (index: number) => {
    const updated = extractedTransactions.filter((_, i) => i !== index)
    setExtractedTransactions(updated)
    const newSelected = new Set(selectedIndices)
    newSelected.delete(index)
    setSelectedIndices(newSelected)
  }

  const handleSelect = (index: number, selected: boolean) => {
    const newSelected = new Set(selectedIndices)
    if (selected) {
      newSelected.add(index)
    } else {
      newSelected.delete(index)
    }
    setSelectedIndices(newSelected)
  }

  const handleSaveTransactions = async () => {
    setStep('saving')
    const selectedTransactions = extractedTransactions.filter((_, i) => selectedIndices.has(i))

    let saved = 0
    let failed = 0

    for (const txn of selectedTransactions) {
      try {
        await createTransaction.mutateAsync({
          name: txn.name,
          description: txn.description || '',
          amount: txn.amount,
          type: txn.type_transation as TypeTransaction,
          accountId: txn.account_id,
          categoryId: txn.category_id || '',
          budgetId: txn.budget_id,
          createdAt: txn.created_at ? new Date(txn.created_at) : undefined,
        })
        saved++
      } catch {
        failed++
      }
    }

    if (saved > 0) {
      toast.success(`Saved ${saved} transaction${saved > 1 ? 's' : ''}`)
    }
    if (failed > 0) {
      toast.error(`Failed to save ${failed} transaction${failed > 1 ? 's' : ''}`)
    }

    handleClose()
  }

  const handleClose = () => {
    setFiles([])
    setExtractedTransactions([])
    setSelectedIndices(new Set())
    setStep('upload')
    reset()
    onOpenChange(false)
  }

  const handleBack = () => {
    setStep('upload')
    setExtractedTransactions([])
    setSelectedIndices(new Set())
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Extract Transactions with AI
          </DialogTitle>
          <DialogDescription>
            Upload receipts, invoices, or bank statements to automatically extract transactions
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Account</label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} ({account.bank})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Document Type</label>
                <Select value={documentType} onValueChange={(v) => setDocumentType(v as DocumentType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receipt">Receipt</SelectItem>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="statement">Bank Statement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DocumentUploader
              onFilesSelected={handleFilesSelected}
              disabled={isExtracting}
            />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleExtract}
                disabled={files.length === 0 || !accountId || isExtracting}
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Extract Transactions
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-6">
            {extractData && 'data' in extractData && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>{extractData.data.count} transactions found</span>
                </div>
                <div className="flex items-center gap-1">
                  {extractData.data.unmatched_categories > 0 && (
                    <>
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                      <span>{extractData.data.unmatched_categories} need category</span>
                    </>
                  )}
                </div>
                <div className="ml-auto">
                  <span>{extractData.processing_time_ms}ms</span>
                </div>
              </div>
            )}

            <TransactionPreview
              transactions={extractedTransactions}
              categories={categories}
              onEdit={handleEdit}
              onRemove={handleRemove}
              onSelect={handleSelect}
              selectedIndices={selectedIndices}
            />

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button
                onClick={handleSaveTransactions}
                disabled={selectedIndices.size === 0}
              >
                Save {selectedIndices.size} Transaction{selectedIndices.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {step === 'saving' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Saving transactions...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
