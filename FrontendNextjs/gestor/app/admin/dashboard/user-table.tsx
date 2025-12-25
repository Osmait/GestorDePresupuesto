"use client";

import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield, Save, X, Search, ChevronUp, ChevronDown, ChevronsUpDown, Filter } from "lucide-react";
import { format } from "date-fns";
import { UserResponse } from "@/types/user";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface EditableUserTableProps {
    users: UserResponse[];
    onSave: (updatedUsers: UserResponse[]) => Promise<void>;
    isLoading: boolean;
}

type SortField = keyof UserResponse;
type SortOrder = "asc" | "desc" | null;

export function EditableUserTable({ users, onSave, isLoading }: EditableUserTableProps) {
    const [editedUsers, setEditedUsers] = useState<Record<string, UserResponse>>({});
    const [searchTerm, setSearchTerm] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("ALL");
    const [sortField, setSortField] = useState<SortField | null>(null);
    const [sortOrder, setSortOrder] = useState<SortOrder>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    // Sorting and Filtering Logic
    const filteredAndSortedUsers = useMemo(() => {
        let result = [...users];

        // Search filter
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            result = result.filter(
                (u) =>
                    u.name.toLowerCase().includes(lowerSearch) ||
                    u.last_name.toLowerCase().includes(lowerSearch) ||
                    u.email.toLowerCase().includes(lowerSearch)
            );
        }

        // Role filter
        if (roleFilter !== "ALL") {
            result = result.filter((u) => u.role === roleFilter);
        }

        // Sort
        if (sortField && sortOrder) {
            result.sort((a, b) => {
                const valA = a[sortField];
                const valB = b[sortField];

                if (valA < valB) return sortOrder === "asc" ? -1 : 1;
                if (valA > valB) return sortOrder === "asc" ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [users, searchTerm, roleFilter, sortField, sortOrder]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            if (sortOrder === "asc") setSortOrder("desc");
            else if (sortOrder === "desc") {
                setSortField(null);
                setSortOrder(null);
            }
        } else {
            setSortField(field);
            setSortOrder("asc");
        }
    };

    const handleEdit = (userId: string, field: keyof UserResponse, value: string) => {
        const originalUser = users.find((u) => u.id === userId);
        if (!originalUser) return;

        const currentEdit = editedUsers[userId] || { ...originalUser };
        const updatedUser = { ...currentEdit, [field]: value };

        const isIdentical = Object.keys(originalUser).every(
            (key) => (originalUser as any)[key] === (updatedUser as any)[key]
        );

        if (isIdentical) {
            const newEdits = { ...editedUsers };
            delete newEdits[userId];
            setEditedUsers(newEdits);
        } else {
            setEditedUsers({ ...editedUsers, [userId]: updatedUser });
        }
    };

    const hasChanges = Object.keys(editedUsers).length > 0;

    const handleConfirmSave = async () => {
        await onSave(Object.values(editedUsers));
        setEditedUsers({});
        setIsConfirmOpen(false);
    };

    const handleCancel = () => {
        setEditedUsers({});
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ChevronsUpDown className="ml-1 h-3 w-3" />;
        return sortOrder === "asc" ? (
            <ChevronUp className="ml-1 h-3 w-3 text-primary" />
        ) : (
            <ChevronDown className="ml-1 h-3 w-3 text-primary" />
        );
    };

    return (
        <div className="space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-9"
                    />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="h-9 w-[130px]">
                            <SelectValue placeholder="Filter by Role" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Roles</SelectItem>
                            <SelectItem value="USER">Users</SelectItem>
                            <SelectItem value="ADMIN">Admins</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {hasChanges && (
                    <div className="flex items-center gap-2 ml-auto animate-in fade-in slide-in-from-right-2 duration-300">
                        <Button variant="outline" size="sm" onClick={handleCancel} className="gap-2 h-9">
                            <X className="h-4 w-4" />
                            Cancel
                        </Button>
                        <Button size="sm" onClick={() => setIsConfirmOpen(true)} className="gap-2 h-9">
                            <Save className="h-4 w-4" />
                            Save {Object.keys(editedUsers).length} Changes
                        </Button>
                    </div>
                )}
            </div>

            <div className="rounded-md border border-border/50 overflow-hidden bg-card/50">
                <ScrollArea className="w-full whitespace-nowrap">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead
                                    className="min-w-[150px] cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort("name")}
                                >
                                    <div className="flex items-center">Name <SortIcon field="name" /></div>
                                </TableHead>
                                <TableHead
                                    className="min-w-[150px] cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort("last_name")}
                                >
                                    <div className="flex items-center">Last Name <SortIcon field="last_name" /></div>
                                </TableHead>
                                <TableHead
                                    className="min-w-[200px] cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort("email")}
                                >
                                    <div className="flex items-center">Email <SortIcon field="email" /></div>
                                </TableHead>
                                <TableHead
                                    className="min-w-[120px] cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort("role")}
                                >
                                    <div className="flex items-center">Role <SortIcon field="role" /></div>
                                </TableHead>
                                <TableHead
                                    className="min-w-[150px] cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort("created_at")}
                                >
                                    <div className="flex items-center">Created <SortIcon field="created_at" /></div>
                                </TableHead>
                                <TableHead className="text-right min-w-[100px]">ID</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="animate-pulse">Loading users...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredAndSortedUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No users found matching your criteria.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredAndSortedUsers.map((user) => {
                                    const edit = editedUsers[user.id];
                                    const isEdited = !!edit;
                                    const currentUser = edit || user;

                                    return (
                                        <TableRow
                                            key={user.id}
                                            className={`group transition-colors ${isEdited ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
                                        >
                                            <TableCell className="p-2">
                                                <Input
                                                    value={currentUser.name}
                                                    onChange={(e) => handleEdit(user.id, "name", e.target.value)}
                                                    className={`h-8 border-transparent hover:border-border transition-all focus:border-primary focus-visible:ring-0 ${isEdited && 'border-primary/50 bg-primary/5'}`}
                                                />
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <Input
                                                    value={currentUser.last_name}
                                                    onChange={(e) => handleEdit(user.id, "last_name", e.target.value)}
                                                    className={`h-8 border-transparent hover:border-border transition-all focus:border-primary focus-visible:ring-0 ${isEdited && 'border-primary/50 bg-primary/5'}`}
                                                />
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <Input
                                                    value={currentUser.email}
                                                    onChange={(e) => handleEdit(user.id, "email", e.target.value)}
                                                    className={`h-8 border-transparent hover:border-border transition-all focus:border-primary focus-visible:ring-0 ${isEdited && 'border-primary/50 bg-primary/5'}`}
                                                />
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <Select
                                                    value={currentUser.role}
                                                    onValueChange={(value) => handleEdit(user.id, "role", value)}
                                                >
                                                    <SelectTrigger className={`h-8 border-transparent hover:border-border transition-all focus:ring-0 focus:border-primary ${isEdited && 'border-primary/50 bg-primary/5'}`}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="USER">User</SelectItem>
                                                        <SelectItem value="ADMIN">Admin</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground whitespace-nowrap px-4 py-2">
                                                {format(new Date(user.created_at), "MMM d, yyyy")}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs text-muted-foreground px-4 py-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                                {user.id.slice(0, 8)}...
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </div>

            {/* Confirmation Modal */}
            <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Confirm Changes</DialogTitle>
                        <DialogDescription>
                            You are about to modify {Object.keys(editedUsers).length} users.
                            Review the summary below before proceeding.
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="max-h-[300px] mt-4 rounded-md border p-4 bg-muted/30">
                        <div className="space-y-4">
                            {Object.entries(editedUsers).map(([id, editedUser]) => {
                                const original = users.find(u => u.id === id);
                                if (!original) return null;

                                const changedFields = (["name", "last_name", "email", "role"] as const).filter(
                                    f => editedUser[f] !== original[f]
                                );

                                return (
                                    <div key={id} className="text-sm border-b pb-2 last:border-0 last:pb-0">
                                        <p className="font-semibold text-primary">{original.name} {original.last_name}</p>
                                        <div className="mt-1 space-y-1">
                                            {changedFields.map(f => (
                                                <div key={f} className="flex items-center gap-2 text-xs">
                                                    <span className="capitalize text-muted-foreground w-16">{f}:</span>
                                                    <span className="line-through text-destructive/70">{original[f]}</span>
                                                    <span className="text-muted-foreground">→</span>
                                                    <span className="text-green-500 font-medium">{editedUser[f]}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>

                    <DialogFooter className="mt-6">
                        <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
                            Back
                        </Button>
                        <Button onClick={handleConfirmSave} className="gap-2">
                            <Save className="h-4 w-4" />
                            Confirm and Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
