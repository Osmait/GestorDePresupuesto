'use client'

import { format } from 'date-fns'
import { ChevronDown, ChevronsUpDown, ChevronUp, Filter, Save, Search, Trash2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDateFnsLocale } from '@/lib/i18n/date-locale'
import { UserResponse } from '@/types/user'

interface EditableUserTableProps {
	users: UserResponse[]
	onSave: (_updatedUsers: UserResponse[]) => Promise<void>
	onDelete: (_userId: string) => Promise<void>
	isLoading: boolean
}

type SortField = keyof UserResponse
type SortOrder = 'asc' | 'desc' | null

const CHANGE_FIELD_LABELS = {
	name: 'columns.name',
	last_name: 'columns.lastName',
	email: 'columns.email',
	role: 'columns.role',
} as const

export function EditableUserTable({ users, onSave, onDelete, isLoading }: EditableUserTableProps) {
	const t = useTranslations('admin.users')
	const tRoles = useTranslations('admin.roles')
	const dateLocale = useDateFnsLocale()
	const roleLabel = (role: string) => (role === 'ADMIN' || role === 'USER' ? tRoles(role) : role)
	const [editedUsers, setEditedUsers] = useState<Record<string, UserResponse>>({})
	const [searchTerm, setSearchTerm] = useState('')
	const [roleFilter, setRoleFilter] = useState<string>('ALL')
	const [sortField, setSortField] = useState<SortField | null>(null)
	const [sortOrder, setSortOrder] = useState<SortOrder>(null)
	const [isConfirmOpen, setIsConfirmOpen] = useState(false)
	const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

	// Sorting and Filtering Logic
	const filteredAndSortedUsers = useMemo(() => {
		let result = [...users]

		// Search filter
		if (searchTerm) {
			const lowerSearch = searchTerm.toLowerCase()
			result = result.filter(
				(u) =>
					u.name.toLowerCase().includes(lowerSearch) ||
					u.last_name.toLowerCase().includes(lowerSearch) ||
					u.email.toLowerCase().includes(lowerSearch),
			)
		}

		// Role filter
		if (roleFilter !== 'ALL') {
			result = result.filter((u) => u.role === roleFilter)
		}

		// Sort
		if (sortField && sortOrder) {
			result.sort((a, b) => {
				const valA = a[sortField]
				const valB = b[sortField]

				if (valA < valB) return sortOrder === 'asc' ? -1 : 1
				if (valA > valB) return sortOrder === 'asc' ? 1 : -1
				return 0
			})
		}

		return result
	}, [users, searchTerm, roleFilter, sortField, sortOrder])

	const handleSort = (field: SortField) => {
		if (sortField === field) {
			if (sortOrder === 'asc') setSortOrder('desc')
			else if (sortOrder === 'desc') {
				setSortField(null)
				setSortOrder(null)
			}
		} else {
			setSortField(field)
			setSortOrder('asc')
		}
	}

	const handleEdit = (userId: string, field: keyof UserResponse, value: string) => {
		const originalUser = users.find((u) => u.id === userId)
		if (!originalUser) return

		const currentEdit = editedUsers[userId] || { ...originalUser }
		const updatedUser = { ...currentEdit, [field]: value }

		const isIdentical = Object.keys(originalUser).every(
			(key) => (originalUser as any)[key] === (updatedUser as any)[key],
		)

		if (isIdentical) {
			const newEdits = { ...editedUsers }
			delete newEdits[userId]
			setEditedUsers(newEdits)
		} else {
			setEditedUsers({ ...editedUsers, [userId]: updatedUser })
		}
	}

	const deleteTarget = deleteTargetId ? users.find((u) => u.id === deleteTargetId) : null

	const handleConfirmDelete = async () => {
		if (!deleteTargetId) return
		await onDelete(deleteTargetId)
		setDeleteTargetId(null)
	}

	const hasChanges = Object.keys(editedUsers).length > 0

	const handleConfirmSave = async () => {
		await onSave(Object.values(editedUsers))
		setEditedUsers({})
		setIsConfirmOpen(false)
	}

	const handleCancel = () => {
		setEditedUsers({})
	}

	const SortIcon = ({ field }: { field: SortField }) => {
		if (sortField !== field) return <ChevronsUpDown className='ml-1 h-3 w-3' />
		return sortOrder === 'asc' ? (
			<ChevronUp className='ml-1 h-3 w-3 text-primary' />
		) : (
			<ChevronDown className='ml-1 h-3 w-3 text-primary' />
		)
	}

	return (
		<div className='space-y-4 w-full overflow-hidden'>
			{/* Search and Filters */}
			<div className='flex flex-col sm:flex-row items-center gap-4'>
				<div className='relative w-full sm:max-w-xs'>
					<Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
					<Input
						placeholder={t('searchPlaceholder')}
						aria-label={t('searchPlaceholder')}
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className='pl-9 h-9'
					/>
				</div>
				<div className='flex items-center gap-2 w-full sm:w-auto'>
					<Filter className='h-4 w-4 text-muted-foreground' />
					<Select value={roleFilter} onValueChange={setRoleFilter}>
						<SelectTrigger className='h-9 w-[160px]' aria-label={t('filterByRole')}>
							<SelectValue placeholder={t('filterByRole')} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='ALL'>{t('allRoles')}</SelectItem>
							<SelectItem value='USER'>{t('roleUsers')}</SelectItem>
							<SelectItem value='ADMIN'>{t('roleAdmins')}</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{hasChanges && (
					<div className='flex flex-wrap items-center gap-2 sm:ml-auto animate-in fade-in slide-in-from-right-2 duration-300'>
						<Button variant='outline' size='sm' onClick={handleCancel} className='gap-2 h-9'>
							<X className='h-4 w-4' />
							{t('cancel')}
						</Button>
						<Button size='sm' onClick={() => setIsConfirmOpen(true)} className='gap-2 h-9'>
							<Save className='h-4 w-4' />
							{t('saveChanges', { count: Object.keys(editedUsers).length })}
						</Button>
					</div>
				)}
			</div>

			<div className='rounded-md border border-border/50 bg-card/50 max-w-full overflow-hidden'>
				<div className='overflow-x-auto w-full'>
					<Table className='min-w-[800px] w-max'>
						<TableHeader className='bg-muted/50'>
							<TableRow>
								<TableHead
									className='min-w-[150px] cursor-pointer hover:text-primary transition-colors'
									onClick={() => handleSort('name')}
								>
									<div className='flex items-center'>
										{t('columns.name')} <SortIcon field='name' />
									</div>
								</TableHead>
								<TableHead
									className='min-w-[150px] cursor-pointer hover:text-primary transition-colors'
									onClick={() => handleSort('last_name')}
								>
									<div className='flex items-center'>
										{t('columns.lastName')} <SortIcon field='last_name' />
									</div>
								</TableHead>
								<TableHead
									className='min-w-[200px] cursor-pointer hover:text-primary transition-colors'
									onClick={() => handleSort('email')}
								>
									<div className='flex items-center'>
										{t('columns.email')} <SortIcon field='email' />
									</div>
								</TableHead>
								<TableHead
									className='min-w-[120px] cursor-pointer hover:text-primary transition-colors'
									onClick={() => handleSort('role')}
								>
									<div className='flex items-center'>
										{t('columns.role')} <SortIcon field='role' />
									</div>
								</TableHead>
								<TableHead
									className='min-w-[150px] cursor-pointer hover:text-primary transition-colors'
									onClick={() => handleSort('created_at')}
								>
									<div className='flex items-center'>
										{t('columns.created')} <SortIcon field='created_at' />
									</div>
								</TableHead>
								<TableHead className='text-right min-w-[100px]'>{t('columns.id')}</TableHead>
								<TableHead className='min-w-[80px]'>{t('columns.actions')}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{isLoading ? (
								<TableRow>
									<TableCell colSpan={7} className='h-24 text-center'>
										<div className='flex items-center justify-center gap-2'>
											<span className='animate-pulse'>{t('loading')}</span>
										</div>
									</TableCell>
								</TableRow>
							) : filteredAndSortedUsers.length === 0 ? (
								<TableRow>
									<TableCell colSpan={7} className='h-24 text-center text-muted-foreground'>
										{t('empty')}
									</TableCell>
								</TableRow>
							) : (
								filteredAndSortedUsers.map((user) => {
									const edit = editedUsers[user.id]
									const isEdited = !!edit
									const currentUser = edit || user

									return (
										<TableRow
											key={user.id}
											className={`group transition-colors ${isEdited ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
										>
											<TableCell className='p-2'>
												<Input
													value={currentUser.name}
													onChange={(e) => handleEdit(user.id, 'name', e.target.value)}
													className={`h-8 border-transparent hover:border-border transition-all focus:border-primary focus-visible:ring-0 ${isEdited && 'border-primary/50 bg-primary/5'}`}
												/>
											</TableCell>
											<TableCell className='p-2'>
												<Input
													value={currentUser.last_name}
													onChange={(e) => handleEdit(user.id, 'last_name', e.target.value)}
													className={`h-8 border-transparent hover:border-border transition-all focus:border-primary focus-visible:ring-0 ${isEdited && 'border-primary/50 bg-primary/5'}`}
												/>
											</TableCell>
											<TableCell className='p-2'>
												<Input
													value={currentUser.email}
													onChange={(e) => handleEdit(user.id, 'email', e.target.value)}
													className={`h-8 border-transparent hover:border-border transition-all focus:border-primary focus-visible:ring-0 ${isEdited && 'border-primary/50 bg-primary/5'}`}
												/>
											</TableCell>
											<TableCell className='p-2'>
												<Select value={currentUser.role} onValueChange={(value) => handleEdit(user.id, 'role', value)}>
													<SelectTrigger
														className={`h-8 border-transparent hover:border-border transition-all focus:ring-0 focus:border-primary ${isEdited && 'border-primary/50 bg-primary/5'}`}
													>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value='USER'>{tRoles('USER')}</SelectItem>
														<SelectItem value='ADMIN'>{tRoles('ADMIN')}</SelectItem>
													</SelectContent>
												</Select>
											</TableCell>
											<TableCell className='text-muted-foreground whitespace-nowrap px-4 py-2'>
												{format(new Date(user.created_at), 'PP', { locale: dateLocale })}
											</TableCell>
											<TableCell className='text-right font-mono text-xs text-muted-foreground px-4 py-2 opacity-50 group-hover:opacity-100 transition-opacity'>
												{user.id.slice(0, 8)}...
											</TableCell>
											<TableCell className='px-2 py-2'>
												<Button
													variant='ghost'
													size='sm'
													className='h-8 w-8 p-0 text-muted-foreground hover:text-destructive'
													aria-label={t('disableUser', { name: `${user.name} ${user.last_name}` })}
													onClick={() => setDeleteTargetId(user.id)}
												>
													<Trash2 className='h-4 w-4' />
												</Button>
											</TableCell>
										</TableRow>
									)
								})
							)}
						</TableBody>
					</Table>
				</div>
			</div>

			{/* Delete Confirmation Dialog */}
			<Dialog
				open={!!deleteTargetId}
				onOpenChange={(open) => {
					if (!open) setDeleteTargetId(null)
				}}
			>
				<DialogContent className='max-w-md'>
					<DialogHeader>
						<DialogTitle>{t('deleteTitle')}</DialogTitle>
						<DialogDescription>
							{t.rich('deleteDescription', {
								name: deleteTarget ? `${deleteTarget.name} ${deleteTarget.last_name}` : '',
								strong: (chunks) => <span className='font-semibold text-foreground'>{chunks}</span>,
							})}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className='mt-6'>
						<Button variant='outline' onClick={() => setDeleteTargetId(null)}>
							{t('cancel')}
						</Button>
						<Button variant='destructive' onClick={handleConfirmDelete} className='gap-2'>
							<Trash2 className='h-4 w-4' />
							{t('deleteConfirm')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Save Confirmation Modal */}
			<Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
				<DialogContent className='max-w-md'>
					<DialogHeader>
						<DialogTitle>{t('confirmTitle')}</DialogTitle>
						<DialogDescription>{t('confirmDescription', { count: Object.keys(editedUsers).length })}</DialogDescription>
					</DialogHeader>

					<ScrollArea className='max-h-[300px] mt-4 rounded-md border p-4 bg-muted/30'>
						<div className='space-y-4'>
							{Object.entries(editedUsers).map(([id, editedUser]) => {
								const original = users.find((u) => u.id === id)
								if (!original) return null

								const changedFields = (['name', 'last_name', 'email', 'role'] as const).filter(
									(f) => editedUser[f] !== original[f],
								)

								return (
									<div key={id} className='text-sm border-b pb-2 last:border-0 last:pb-0'>
										<p className='font-semibold text-primary'>
											{original.name} {original.last_name}
										</p>
										<div className='mt-1 space-y-1'>
											{changedFields.map((f) => (
												<div key={f} className='flex items-center gap-2 text-xs'>
													<span className='text-muted-foreground w-20 shrink-0'>{t(CHANGE_FIELD_LABELS[f])}:</span>
													<span className='line-through text-destructive/70 break-all'>
														{f === 'role' ? roleLabel(original[f]) : original[f]}
													</span>
													<span className='text-muted-foreground'>→</span>
													<span className='text-green-500 font-medium break-all'>
														{f === 'role' ? roleLabel(editedUser[f]) : editedUser[f]}
													</span>
												</div>
											))}
										</div>
									</div>
								)
							})}
						</div>
					</ScrollArea>

					<DialogFooter className='mt-6'>
						<Button variant='outline' onClick={() => setIsConfirmOpen(false)}>
							{t('back')}
						</Button>
						<Button onClick={handleConfirmSave} className='gap-2'>
							<Save className='h-4 w-4' />
							{t('confirmSave')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
