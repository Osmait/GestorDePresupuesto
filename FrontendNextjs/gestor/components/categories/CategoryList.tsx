'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGetAllTransactions } from '@/hooks/queries/useTransactionsQuery'
import { useGetCategories, useDeleteCategoryMutation } from '@/hooks/queries/useCategoriesQuery'
import { useCategoryContext } from '@/components/categories/CategoryContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AnimatedTabs } from '@/components/common/animated-tabs'
import { Tag, Activity, Palette, MoreHorizontal, Edit, Trash2 } from 'lucide-react'
import { Category } from '@/types/category'
import { Transaction } from '@/types/transaction'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog'
import { CategoriesSkeleton } from '@/components/skeletons/categories-skeleton'

import { useRouter } from 'next/navigation'

// Helper component extracted from original page
interface CategoryCardProps {
    category: Category
    transactions: Transaction[]
    onDelete: () => Promise<void>
    onEdit: () => void
}

function CategoryCard({ category, transactions, onDelete, onEdit }: CategoryCardProps) {
    const router = useRouter()
    const categoryTransactions = transactions.filter(t => t.category_id === category.id)
    const totalAmount = categoryTransactions.reduce((sum, transaction) => sum + transaction.amount, 0)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            await onDelete()
            setShowDeleteDialog(false)
        } catch (error) {
            console.error('Error deleting category:', error)
        } finally {
            setIsDeleting(false)
        }
    }

    const handleCardClick = (e: React.MouseEvent) => {
        // Prevent navigation if clicking on dropdown or interactive elements
        if ((e.target as HTMLElement).closest('[role="menuitem"], button')) {
            return
        }
        router.push(`/app/transactions?category=${category.id}`)
    }

    return (
        <Card
            className="hover:bg-accent/40 dark:hover:bg-accent/40 transition-all duration-300 border-border/50 dark:border-border/20 relative group cursor-pointer"
            onClick={handleCardClick}
        >
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Abrir menú</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem className="flex items-center gap-2 cursor-pointer" onClick={onEdit}>
                            <Edit className="h-4 w-4" />
                            Editar categoría
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                            onClick={() => setShowDeleteDialog(true)}
                        >
                            <Trash2 className="h-4 w-4" />
                            Eliminar categoría
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                        <div
                            className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-semibold"
                            style={{ backgroundColor: category.color, color: '#fff' }}
                        >
                            {category.icon}
                        </div>
                        <div>
                            <p className="font-semibold text-foreground text-lg">{category.name}</p>
                            <p className="text-sm text-muted-foreground">
                                {categoryTransactions.length} transacciones
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-xl text-foreground">
                            ${totalAmount.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: category.color }}
                        ></div>
                        <span className="text-xs text-muted-foreground">Color</span>
                    </div>
                    <Badge variant="outline" className="bg-muted/30 dark:bg-muted/20">
                        {categoryTransactions.length > 5 ? 'Activa' : categoryTransactions.length > 0 ? 'Moderada' : 'Inactiva'}
                    </Badge>
                </div>
            </CardContent>

            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Eliminar Categoría</DialogTitle>
                        <DialogDescription>
                            ¿Estás seguro de que quieres eliminar la categoría "{category.name}"?
                            Esta acción no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowDeleteDialog(false)}
                            disabled={isDeleting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Eliminando...' : 'Eliminar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}

function CategorySummaryCard({ categories, transactions }: { categories: Category[], transactions: Transaction[] }) {
    const activeCategories = categories.filter(cat =>
        transactions.some(t => t.category_id === cat.id)
    )
    const totalTransactions = transactions.length
    const averagePerCategory = activeCategories.length > 0 ? Math.round(totalTransactions / activeCategories.length) : 0

    return (
        <Card className="border-border/50 dark:border-border/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                    <Tag className="h-5 w-5" />
                    Resumen de Categorías
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5">
                        <Tag className="h-6 w-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                        <p className="text-sm font-medium text-muted-foreground">Total Categorías</p>
                        <p className="text-2xl font-bold text-foreground">{categories.length}</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5">
                        <Activity className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
                        <p className="text-sm font-medium text-muted-foreground">Categorías Activas</p>
                        <p className="text-2xl font-bold text-foreground">{activeCategories.length}</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-violet-500/10 dark:from-purple-500/5 dark:to-violet-500/5">
                        <Palette className="h-6 w-6 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
                        <p className="text-sm font-medium text-muted-foreground">Promedio por Categoría</p>
                        <p className="text-2xl font-bold text-foreground">{averagePerCategory}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export function CategoryList() {
    const { data: categories = [], isLoading: isLoadingCategories, error } = useGetCategories()
    const { data: transactions = [], isLoading: isLoadingTransactions } = useGetAllTransactions()
    const { setEditingCategory, setModalOpen } = useCategoryContext()

    const deleteCategoryMutation = useDeleteCategoryMutation()

    const isLoading = isLoadingCategories || isLoadingTransactions

    const handleDeleteCategory = async (categoryId: string) => {
        await deleteCategoryMutation.mutateAsync(categoryId)
    }

    const handleEditCategory = (category: Category) => {
        setEditingCategory(category)
        setModalOpen(true)
    }

    if (isLoading) {
        return <CategoriesSkeleton />
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
        >
            {/* Resumen de categorías */}
            <div className="mb-8">
                <CategorySummaryCard categories={categories} transactions={transactions} />
            </div>

            {/* Contenido principal con tabs */}
            <AnimatedTabs
                defaultValue="all"
                tabs={[
                    {
                        value: 'all',
                        label: 'Todas',
                        icon: <Tag className="h-4 w-4" />,
                        content: (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <AnimatePresence mode="popLayout" initial={false}>
                                    {categories.map((category) => (
                                        <motion.div
                                            key={category.id}
                                            initial={{ opacity: 0, y: 15 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                                        >
                                            <CategoryCard
                                                category={category}
                                                transactions={transactions}
                                                onDelete={() => handleDeleteCategory(category.id!)}
                                                onEdit={() => handleEditCategory(category)}
                                            />
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )
                    },
                ]}
            />
        </motion.div>
    )
}
