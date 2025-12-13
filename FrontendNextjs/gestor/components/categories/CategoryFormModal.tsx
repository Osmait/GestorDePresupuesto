'use client'

import { useState } from 'react'
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

interface CategoryFormModalProps {
    open: boolean
    setOpen: (open: boolean) => void
    onCreateCategory: (name: string, icon: string, color: string) => Promise<void>
}

// Predefined Emojis
const EMOJIS = [
    { icon: '🏷️', label: 'Etiqueta' },
    { icon: '🍔', label: 'Comida' },
    { icon: '☕', label: 'Café' },
    { icon: '🏠', label: 'Hogar' },
    { icon: '🚗', label: 'Transporte' },
    { icon: '📱', label: 'Tecnología' },
    { icon: '✈️', label: 'Viajes' },
    { icon: '🛍️', label: 'Compras' },
    { icon: '💊', label: 'Salud' },
    { icon: '💼', label: 'Trabajo' },
    { icon: '🎓', label: 'Educación' },
    { icon: '🎮', label: 'Entretenimiento' },
    { icon: '🏀', label: 'Deporte' },
    { icon: '💰', label: 'Dinero' },
    { icon: '💳', label: 'Tarjetas' },
    { icon: '🎉', label: 'Otros' },
    { icon: '💡', label: 'Servicios' },
    { icon: '🔧', label: 'Mantenimiento' },
    { icon: '🐾', label: 'Mascotas' },
    { icon: '🎁', label: 'Regalos' },
]

// Predefined colors
const COLORS = [
    { name: 'red', value: '#EF4444', label: 'Rojo' },
    { name: 'orange', value: '#F97316', label: 'Naranja' },
    { name: 'amber', value: '#F59E0B', label: 'Ámbar' },
    { name: 'yellow', value: '#EAB308', label: 'Amarillo' },
    { name: 'lime', value: '#84CC16', label: 'Lima' },
    { name: 'green', value: '#22C55E', label: 'Verde' },
    { name: 'emerald', value: '#10B981', label: 'Esmeralda' },
    { name: 'teal', value: '#14B8A6', label: 'Cian' },
    { name: 'cyan', value: '#06B6D4', label: 'Celeste' },
    { name: 'sky', value: '#0EA5E9', label: 'Cielo' },
    { name: 'blue', value: '#3B82F6', label: 'Azul' },
    { name: 'indigo', value: '#6366F1', label: 'Índigo' },
    { name: 'violet', value: '#8B5CF6', label: 'Violeta' },
    { name: 'purple', value: '#A855F7', label: 'Púrpura' },
    { name: 'fuchsia', value: '#D946EF', label: 'Fucsia' },
    { name: 'pink', value: '#EC4899', label: 'Rosa' },
    { name: 'rose', value: '#F43F5E', label: 'Rosa fuerte' },
    { name: 'slate', value: '#64748B', label: 'Gris' },
    { name: 'gray', value: '#6B7280', label: 'Gris medio' },
    { name: 'zinc', value: '#71717A', label: 'Zinc' },
]

export function CategoryFormModal({ open, setOpen, onCreateCategory }: CategoryFormModalProps) {
    const [name, setName] = useState('')
    const [icon, setIcon] = useState('🏷️')
    const [color, setColor] = useState('#3B82F6')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name) return

        setIsSubmitting(true)
        try {
            await onCreateCategory(name, icon, color)
            setOpen(false)
            setName('')
            setIcon('🏷️')
            setColor('#3B82F6')
        } catch (error) {
            console.error('Error creating category:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Nueva Categoría</DialogTitle>
                    <DialogDescription>
                        Crea una nueva categoría para organizar tus transacciones.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nombre</Label>
                        <Input
                            id="name"
                            placeholder="Ej. Alimentación"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Ícono (Emoji)</Label>
                        <div className="grid grid-cols-5 gap-2 p-2 border rounded-md max-h-[150px] overflow-y-auto">
                            {EMOJIS.map((item) => (
                                <button
                                    key={item.label}
                                    type="button"
                                    className={`text-2xl h-10 w-10 flex items-center justify-center rounded-md hover:bg-muted transition-colors ${icon === item.icon ? 'bg-muted ring-2 ring-primary' : ''}`}
                                    onClick={() => setIcon(item.icon)}
                                    title={item.label}
                                >
                                    {item.icon}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Color</Label>
                        <div className="flex flex-wrap gap-2 p-2 border rounded-md">
                            {COLORS.map((c) => (
                                <button
                                    key={c.name}
                                    type="button"
                                    className={`w-6 h-6 rounded-full border border-gray-200 transition-transform hover:scale-110 ${color === c.value ? 'ring-2 ring-offset-2 ring-black dark:ring-white scale-110' : ''}`}
                                    style={{ backgroundColor: c.value }}
                                    onClick={() => setColor(c.value)}
                                    title={c.label}
                                />
                            ))}
                            <div className="relative w-6 h-6 rounded-full overflow-hidden border border-gray-200 transition-transform hover:scale-110" title="Personalizado">
                                <Input
                                    type="color"
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 border-0 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                </form>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !name}>
                        {isSubmitting ? 'Creando...' : 'Crear Categoría'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
