'use client'

import { format } from 'date-fns'
import { ChevronDown, ChevronsUpDown, ChevronUp, Save, Search, Trash2, Users, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
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
	const tCommon = useTranslations('common')
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

	function sortState(field: SortField): 'ascending' | 'descending' | 'none' {
		if (sortField !== field || !sortOrder) return 'none'
		return sortOrder === 'asc' ? 'ascending' : 'descending'
	}

	function renderSortableHead(field: SortField, label: string, className: string) {
		const state = sortState(field)
		const Icon = state === 'ascending' ? ChevronUp : state === 'descending' ? ChevronDown : ChevronsUpDown
		return (
			<TableHead key={field} className={className} aria-sort={state}>
				<button
					type='button'
					onClick={() => handleSort(field)}
					className='-mx-2 inline-flex h-10 items-center gap-1 rounded-md px-2 font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
				>
					{label}
					<Icon className={state === 'none' ? 'h-3 w-3' : 'h-3 w-3 text-foreground'} aria-hidden='true' />
				</button>
			</TableHead>
		)
	}

	const cellInputClass = (isEdited: boolean) =>
		`h-10 border-transparent hover:border-border focus-visible:border-ring ${isEdited ? 'border-primary/40 bg-primary/5' : ''}`

	return (
		<div className='space-y-4 w-full overflow-hidden'>
			{/* Search and Filters */}
			<div className='flex flex-col sm:flex-row items-center gap-4'>
				<div className='relative w-full sm:max-w-xs'>
					<Search
						className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground'
						aria-hidden='true'
					/>
					<Input
						type='search'
						placeholder={t('searchPlaceholder')}
						aria-label={t('searchLabel')}
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className='pl-9'
					/>
				</div>
				<div className='w-full sm:w-auto'>
					<Select value={roleFilter} onValueChange={setRoleFilter}>
						<SelectTrigger className='w-full sm:w-[180px]' aria-label={t('filterByRole')}>
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
					<div className='flex flex-wrap items-center gap-2 sm:ml-auto'>
						<Button variant='outline' onClick={handleCancel}>
							<X className='mr-2 h-4 w-4' aria-hidden='true' />
							{t('cancel')}
						</Button>
						<Button onClick={() => setIsConfirmOpen(true)}>
							<Save className='mr-2 h-4 w-4' aria-hidden='true' />
							{t('saveChanges', { count: Object.keys(editedUsers).length })}
						</Button>
					</div>
				)}
			</div>

			<div className='max-w-full overflow-hidden rounded-md border'>
				<div className='overflow-x-auto w-full'>
					<Table className='min-w-[800px] w-max'>
						<TableHeader className='bg-muted/50'>
							<TableRow>
								{renderSortableHead('name', t('columns.name'), 'min-w-[150px]')}
								{renderSortableHead('last_name', t('columns.lastName'), 'min-w-[150px]')}
								{renderSortableHead('email', t('columns.email'), 'min-w-[200px]')}
								{renderSortableHead('role', t('columns.role'), 'min-w-[120px]')}
								{renderSortableHead('created_at', t('columns.created'), 'min-w-[150px]')}
								<TableHead className='text-right min-w-[100px]'>{t('columns.id')}</TableHead>
								<TableHead className='min-w-[64px]'>
									<span className='sr-only'>{t('columns.actions')}</span>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{isLoading ? (
								<TableRow>
									<TableCell colSpan={7} className='h-24 text-center'>
										<div className='flex items-center justify-center gap-2' role='status'>
											<span className='text-muted-foreground'>{t('loading')}</span>
										</div>
									</TableCell>
								</TableRow>
							) : filteredAndSortedUsers.length === 0 ? (
								<TableRow>
									<TableCell colSpan={7}>
										<EmptyState
											compact
											icon={Users}
											title={t('empty')}
											description={tCommon('empty.noResultsDescription')}
										/>
									</TableCell>
								</TableRow>
							) : (
								filteredAndSortedUsers.map((user) => {
									const edit = editedUsers[user.id]
									const isEdited = !!edit
									const currentUser = edit || user
									const fullName = `${user.name} ${user.last_name}`
									const cellLabel = (column: string) => t('cellLabel', { field: column, user: fullName })

									return (
										<TableRow
											key={user.id}
											className={`group transition-colors ${isEdited ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
										>
											<TableCell className='p-2'>
												<Input
													value={currentUser.name}
													aria-label={cellLabel(t('columns.name'))}
													onChange={(e) => handleEdit(user.id, 'name', e.target.value)}
													className={cellInputClass(isEdited)}
												/>
											</TableCell>
											<TableCell className='p-2'>
												<Input
													value={currentUser.last_name}
													aria-label={cellLabel(t('columns.lastName'))}
													onChange={(e) => handleEdit(user.id, 'last_name', e.target.value)}
													className={cellInputClass(isEdited)}
												/>
											</TableCell>
											<TableCell className='p-2'>
												<Input
													value={currentUser.email}
													aria-label={cellLabel(t('columns.email'))}
													onChange={(e) => handleEdit(user.id, 'email', e.target.value)}
													className={cellInputClass(isEdited)}
												/>
											</TableCell>
											<TableCell className='p-2'>
												<Select value={currentUser.role} onValueChange={(value) => handleEdit(user.id, 'role', value)}>
													<SelectTrigger aria-label={cellLabel(t('columns.role'))} className={cellInputClass(isEdited)}>
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
											<TableCell className='px-4 py-2 text-right font-mono text-xs text-muted-foreground'>
												{user.id.slice(0, 8)}...
											</TableCell>
											<TableCell className='px-2 py-2'>
												<Button
													variant='ghost'
													size='icon'
													className='text-muted-foreground hover:text-destructive'
													aria-label={t('disableUser', { name: fullName })}
													onClick={() => setDeleteTargetId(user.id)}
												>
													<Trash2 className='h-4 w-4' aria-hidden='true' />
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

			<ConfirmDialog
				open={!!deleteTargetId}
				onOpenChange={(open) => {
					if (!open) setDeleteTargetId(null)
				}}
				title={t('deleteTitle')}
				description={t.rich('deleteDescription', {
					name: deleteTarget ? `${deleteTarget.name} ${deleteTarget.last_name}` : '',
					strong: (chunks) => <span className='font-semibold text-foreground'>{chunks}</span>,
				})}
				confirmLabel={t('deleteConfirm')}
				cancelLabel={t('cancel')}
				destructive
				onConfirm={handleConfirmDelete}
			/>

			<ConfirmDialog
				open={isConfirmOpen}
				onOpenChange={setIsConfirmOpen}
				title={t('confirmTitle')}
				description={t('confirmDescription', { count: Object.keys(editedUsers).length })}
				confirmLabel={t('confirmSave')}
				cancelLabel={t('back')}
				onConfirm={handleConfirmSave}
			>
				<ScrollArea className='max-h-[300px] rounded-md border bg-muted/30 p-4'>
					<div className='space-y-4'>
						{Object.entries(editedUsers).map(([id, editedUser]) => {
							const original = users.find((u) => u.id === id)
							if (!original) return null

							const changedFields = (['name', 'last_name', 'email', 'role'] as const).filter(
								(f) => editedUser[f] !== original[f],
							)

							return (
								<div key={id} className='border-b pb-2 text-sm last:border-0 last:pb-0'>
									<p className='font-semibold'>
										{original.name} {original.last_name}
									</p>
									<dl className='mt-1 space-y-1'>
										{changedFields.map((f) => (
											<div key={f} className='flex items-center gap-2 text-xs'>
												<dt className='w-20 shrink-0 text-muted-foreground'>{t(CHANGE_FIELD_LABELS[f])}:</dt>
												<dd className='flex min-w-0 flex-wrap items-center gap-2'>
													<del className='break-all text-muted-foreground'>
														{f === 'role' ? roleLabel(original[f]) : original[f]}
													</del>
													<span className='text-muted-foreground' aria-hidden='true'>
														→
													</span>
													<ins className='break-all font-medium no-underline'>
														{f === 'role' ? roleLabel(editedUser[f]) : editedUser[f]}
													</ins>
												</dd>
											</div>
										))}
									</dl>
								</div>
							)
						})}
					</div>
				</ScrollArea>
			</ConfirmDialog>
		</div>
	)
}
