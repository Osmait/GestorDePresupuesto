"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield, Save, X } from "lucide-react";
import { format } from "date-fns";
import { UserResponse } from "@/types/user";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface EditableUserTableProps {
    users: UserResponse[];
    onSave: (updatedUsers: UserResponse[]) => Promise<void>;
    isLoading: boolean;
}

export function EditableUserTable({ users, onSave, isLoading }: EditableUserTableProps) {
    const [editedUsers, setEditedUsers] = useState<Record<string, UserResponse>>({});

    const handleEdit = (userId: string, field: keyof UserResponse, value: string) => {
        const originalUser = users.find((u) => u.id === userId);
        if (!originalUser) return;

        const currentEdit = editedUsers[userId] || { ...originalUser };
        const updatedUser = { ...currentEdit, [field]: value };

        // If the updated user is identical to the original, remove from editedUsers
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
    };

    const handleCancel = () => {
        setEditedUsers({});
    };

    return (
        <div className="space-y-4">
            {hasChanges && (
                <div className="flex items-center justify-end gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <Button variant="outline" size="sm" onClick={handleCancel} className="gap-2">
                        <X className="h-4 w-4" />
                        Cancel
                    </Button>
                    <Button size="sm" onClick={handleConfirmSave} className="gap-2">
                        <Save className="h-4 w-4" />
                        Save {Object.keys(editedUsers).length} Changes
                    </Button>
                </div>
            )}

            <div className="rounded-md border border-border/50 overflow-hidden">
                <ScrollArea className="w-full whitespace-nowrap">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="min-w-[150px]">Name</TableHead>
                                <TableHead className="min-w-[150px]">Last Name</TableHead>
                                <TableHead className="min-w-[200px]">Email</TableHead>
                                <TableHead className="min-w-[120px]">Role</TableHead>
                                <TableHead className="min-w-[150px]">Created</TableHead>
                                <TableHead className="text-right min-w-[100px]">ID</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        Loading users...
                                    </TableCell>
                                </TableRow>
                            ) : users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        No users found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((user) => {
                                    const edit = editedUsers[user.id];
                                    const isEdited = !!edit;
                                    const currentUser = edit || user;

                                    return (
                                        <TableRow key={user.id} className={`group transition-colors ${isEdited ? 'bg-primary/5' : 'hover:bg-muted/50'}`}>
                                            <TableCell className="p-2">
                                                <Input
                                                    value={currentUser.name}
                                                    onChange={(e) => handleEdit(user.id, "name", e.target.value)}
                                                    className={`h-8 border-transparent hover:border-border transition-all focus:border-primary ${isEdited && 'border-primary/50 bg-primary/5'}`}
                                                />
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <Input
                                                    value={currentUser.last_name}
                                                    onChange={(e) => handleEdit(user.id, "last_name", e.target.value)}
                                                    className={`h-8 border-transparent hover:border-border transition-all focus:border-primary ${isEdited && 'border-primary/50 bg-primary/5'}`}
                                                />
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <Input
                                                    value={currentUser.email}
                                                    onChange={(e) => handleEdit(user.id, "email", e.target.value)}
                                                    className={`h-8 border-transparent hover:border-border transition-all focus:border-primary ${isEdited && 'border-primary/50 bg-primary/5'}`}
                                                />
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <Select
                                                    value={currentUser.role}
                                                    onValueChange={(value) => handleEdit(user.id, "role", value)}
                                                >
                                                    <SelectTrigger className={`h-8 border-transparent hover:border-border transition-all focus:ring-0 ${isEdited && 'border-primary/50 bg-primary/5'}`}>
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
                                            <TableCell className="text-right font-mono text-xs text-muted-foreground px-4 py-2">
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
        </div>
    );
}
