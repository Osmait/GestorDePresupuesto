'use client'

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Tag, Coffee, Home, Car, Smartphone, Plane, ShoppingBag, Heart, MoreHorizontal, Briefcase, GraduationCap, DollarSign, Wallet } from 'lucide-react'
import { useCategoryContext } from '@/components/categories/CategoryContext'
import { useTranslations } from 'next-intl'

interface CategoryFormModalProps {
    open: boolean
    setOpen: (open: boolean) => void
    onCreateCategory: (name: string, icon: string, color: string) => Promise<void>
}

// Predefined Emojis
const EMOJIS = [
    { icon: '🏷️', labelKey: 'tag' },
    { icon: '🍔', labelKey: 'food' },
    { icon: '☕', labelKey: 'coffee' },
    { icon: '🏠', labelKey: 'home' },
    { icon: '🚗', labelKey: 'transport' },
    { icon: '📱', labelKey: 'tech' },
    { icon: '✈️', labelKey: 'travel' },
    { icon: '🛍️', labelKey: 'shopping' },
    { icon: '💊', labelKey: 'health' },
    { icon: '💼', labelKey: 'work' },
    { icon: '🎓', labelKey: 'education' },
    { icon: '🎮', labelKey: 'entertainment' },
    { icon: '🏀', labelKey: 'sports' },
    { icon: '💰', labelKey: 'money' },
    { icon: '💳', labelKey: 'cards' },
    { icon: '🎉', labelKey: 'other' },
    { icon: '💡', labelKey: 'services' },
    { icon: '🔧', labelKey: 'maintenance' },
    { icon: '🐾', labelKey: 'pets' },
    { icon: '🎁', labelKey: 'gifts' },
]

// Predefined colors
const COLORS = [
    { name: 'red', value: '#EF4444' },
    { name: 'orange', value: '#F97316' },
    { name: 'amber', value: '#F59E0B' },
    { name: 'yellow', value: '#EAB308' },
    { name: 'lime', value: '#84CC16' },
    { name: 'green', value: '#22C55E' },
    { name: 'emerald', value: '#10B981' },
    { name: 'teal', value: '#14B8A6' },
    { name: 'cyan', value: '#06B6D4' },
    { name: 'sky', value: '#0EA5E9' },
    { name: 'blue', value: '#3B82F6' },
    { name: 'indigo', value: '#6366F1' },
    { name: 'violet', value: '#8B5CF6' },
    { name: 'purple', value: '#A855F7' },
    { name: 'fuchsia', value: '#D946EF' },
    { name: 'pink', value: '#EC4899' },
    { name: 'rose', value: '#F43F5E' },
    { name: 'slate', value: '#64748B' },
    { name: 'gray', value: '#6B7280' },
    { name: 'zinc', value: '#71717A' },
]

export function CategoryFormModal({ open, setOpen, onCreateCategory }: CategoryFormModalProps) {
    const t = useTranslations('forms')
    const tCat = useTranslations('categories')
    const { editingCategory, updateCategory } = useCategoryContext()
    const [name, setName] = useState('')
    const [icon, setIcon] = useState('🏷️')
    const [color, setColor] = useState('#3B82F6')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const isEditing = !!editingCategory

    useEffect(() => {
        if (editingCategory) {
            setName(editingCategory.name)
            setIcon(editingCategory.icon)
            setColor(editingCategory.color)
        } else {
            setName('')
            setIcon('🏷️')
            setColor('#3B82F6')
        }
    }, [editingCategory])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name) return

        setIsSubmitting(true)
        try {
            if (isEditing && editingCategory) {
                await updateCategory(editingCategory.id, name, icon, color)
            } else {
                await onCreateCategory(name, icon, color)
            }
            setOpen(false)
        } catch (error) {
            console.error('Error saving category:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{isEditing ? t('editCategory') : t('newCategory')}</DialogTitle>
                    <DialogDescription>
                        {isEditing ? tCat('editDescription') : tCat('addDescription')}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">{t('name')}</Label>
                        <Input
                            id="name"
                            placeholder={t('namePlaceholder')}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{t('icon')}</Label>
                        <div className="grid grid-cols-5 gap-2 p-2 border rounded-md max-h-[150px] overflow-y-auto">
                            {EMOJIS.map((item) => (
                                <button
                                    key={item.labelKey}
                                    type="button"
                                    className={`text-2xl h-10 w-10 flex items-center justify-center rounded-md hover:bg-muted transition-colors ${icon === item.icon ? 'bg-muted ring-2 ring-primary' : ''}`}
                                    onClick={() => setIcon(item.icon)}
                                >
                                    {item.icon}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>{t('color')}</Label>
                        <div className="flex flex-wrap gap-2 p-2 border rounded-md">
                            {COLORS.map((c) => (
                                <button
                                    key={c.name}
                                    type="button"
                                    className={`w-6 h-6 rounded-full border border-gray-200 transition-transform hover:scale-110 ${color === c.value ? 'ring-2 ring-offset-2 ring-black dark:ring-white scale-110' : ''}`}
                                    style={{ backgroundColor: c.value }}
                                    onClick={() => setColor(c.value)}
                                />
                            ))}
                            <div
                                className="relative w-6 h-6 rounded-full overflow-hidden border border-gray-200 transition-transform hover:scale-110"
                                style={{ background: 'conic-gradient(from 0deg, red, orange, yellow, green, blue, indigo, violet, red)' }}
                            >
                                <Input
                                    type="color"
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 border-0 cursor-pointer opacity-0"
                                />
                            </div>
                        </div>
                    </div>
                </form>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                        {t('cancel')}
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !name}>
                        {isSubmitting ? t('saving') : (isEditing ? t('saveChanges') : t('createCategory'))}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

