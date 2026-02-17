'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pencil, Trash2, Check, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Transaction, TypeTransaction } from '@/types/transaction'
import { Category } from '@/types/category'
import { cn } from '@/lib/utils'

interface TransactionPreviewProps {
  transactions: Transaction[]
  categories: Category[]
  onEdit: (index: number, transaction: Transaction) => void
  onRemove: (index: number) => void
  onSelect: (index: number, selected: boolean) => void
  selectedIndices: Set<number>
}

export function TransactionPreview({
  transactions,
  categories,
  onEdit,
  onRemove,
  onSelect,
  selectedIndices,
}: TransactionPreviewProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Transaction | null>(null)

  const startEdit = (index: number, transaction: Transaction) => {
    setEditingIndex(index)
    setEditForm({ ...transaction })
  }

  const saveEdit = () => {
    if (editingIndex !== null && editForm) {
      onEdit(editingIndex, editForm)
      setEditingIndex(null)
      setEditForm(null)
    }
  }

  const cancelEdit = () => {
    setEditingIndex(null)
    setEditForm(null)
  }

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId)
    return category?.name || 'Uncategorized'
  }

  const getCategoryIcon = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId)
    return category?.icon || '📦'
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No transactions detected in the document
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">
          {selectedIndices.size} of {transactions.length} selected
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              transactions.forEach((_, i) => onSelect(i, true))
            }}
          >
            Select all
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              transactions.forEach((_, i) => onSelect(i, false))
            }}
          >
            Deselect all
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {transactions.map((transaction, index) => {
          const isEditing = editingIndex === index
          const isSelected = selectedIndices.has(index)
          const isIncome = transaction.type_transation === TypeTransaction.INCOME
          const hasCategory = !!transaction.category_id

          return (
            <motion.div
              key={`transaction-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className={cn(
                'p-4 rounded-lg border transition-colors',
                isSelected ? 'border-primary bg-primary/5' : 'border-border',
                !hasCategory && 'border-yellow-500/50'
              )}
            >
              {isEditing && editForm ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="Name"
                    />
                    <Input
                      type="number"
                      value={editForm.amount}
                      onChange={(e) =>
                        setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="Amount"
                    />
                  </div>
                  <Input
                    value={editForm.description || ''}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Description"
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={cancelEdit}>
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={saveEdit}>
                      <Check className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => onSelect(index, e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{transaction.name}</span>
                        {!hasCategory && (
                          <span className="text-yellow-500" title="No category matched">
                            <AlertTriangle className="h-4 w-4" />
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{transaction.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-lg">
                          {isIncome ? '💰' : getCategoryIcon(transaction.category_id)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getCategoryName(transaction.category_id)}
                        </span>
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded',
                            isIncome
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          )}
                        >
                          {isIncome ? 'Income' : 'Expense'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-lg font-semibold',
                        isIncome ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {isIncome ? '+' : '-'}${transaction.amount.toFixed(2)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEdit(index, transaction)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onRemove(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
