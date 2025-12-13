'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2, PlusCircle } from 'lucide-react'

const categorySchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    icon: z.string().min(1, 'Elige un emoji'),
    color: z.string().min(4, 'Elige un color'),
})

type CategoryFormValues = z.infer<typeof categorySchema>

interface CategoryFormModalProps {
    open: boolean
    setOpen: (v: boolean) => void
    onCreateCategory: (name: string, icon: string, color: string) => Promise<void>
}

export function CategoryFormModal({ open, setOpen, onCreateCategory }: CategoryFormModalProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [iconMode, setIconMode] = useState<'list' | 'custom'>('list')
    const [customIcon, setCustomIcon] = useState('')
    const emojiOptions = [
        '🍽️', '🚗', '🏠', '💡', '🛒', '🎬', '🏥', '📚', '👕', '💻', '🏦', '🏖️', '🐶', '🎁', '🧾', '💼', '💸'
    ]
    const form = useForm<CategoryFormValues>({
        resolver: zodResolver(categorySchema),
        defaultValues: { name: '', icon: '', color: '#4ECDC4' },
    })

    async function onSubmit(values: CategoryFormValues) {
        const icon = iconMode === 'custom' ? customIcon : values.icon
        try {
            setIsLoading(true)
            setError(null)
            await onCreateCategory(values.name, icon, values.color)
            setSuccess(true)
            form.reset({ name: '', icon: '', color: '#4ECDC4' })
            setCustomIcon('')
            setIconMode('list')
            setTimeout(() => {
                setSuccess(false)
                setOpen(false)
            }, 1200)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al crear la categoría')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Nueva Categoría</DialogTitle>
                </DialogHeader>
                {success ? (
                    <div className="flex flex-col items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                        <p className="text-green-600 font-semibold">¡Categoría creada!</p>
                    </div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre</FormLabel>
                                    <FormControl><Input {...field} placeholder="Ej: Mascotas" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <div>
                                <FormLabel>Icono (emoji)</FormLabel>
                                {iconMode === 'list' ? (
                                    <div className="flex gap-2 items-center">
                                        <FormField control={form.control} name="icon" render={({ field }) => (
                                            <FormItem className="flex-1">
                                                <FormControl>
                                                    <Select value={field.value} onValueChange={v => field.onChange(v)}>
                                                        <SelectTrigger><SelectValue placeholder="Selecciona un emoji" /></SelectTrigger>
                                                        <SelectContent>
                                                            {emojiOptions.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                                                            <SelectItem value="custom">Personalizado...</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <Button type="button" variant="outline" size="sm" onClick={() => setIconMode('custom')}>Personalizado</Button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2 items-center">
                                        <Input value={customIcon} onChange={e => setCustomIcon(e.target.value)} placeholder="Ej: 🐶" maxLength={2} className="w-20" />
                                        <Button type="button" variant="outline" size="sm" onClick={() => setIconMode('list')}>Volver</Button>
                                    </div>
                                )}
                            </div>
                            <FormField control={form.control} name="color" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Color</FormLabel>
                                    <FormControl><Input {...field} type="color" className="w-12 h-8 p-0 border-none bg-transparent" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <DialogFooter>
                                <Button type="submit" disabled={isLoading} className="w-full">
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                                    Crear Categoría
                                </Button>
                                <DialogClose asChild>
                                    <Button type="button" variant="ghost" className="w-full">Cancelar</Button>
                                </DialogClose>
                            </DialogFooter>
                        </form>
                    </Form>
                )}
                {error && (
                    <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
            </DialogContent>
        </Dialog>
    )
}
