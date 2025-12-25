"use client";

import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { UserResponse } from "@/types/user";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, Trash2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { EditableUserTable } from "./user-table";

export default function AdminDashboard() {
    const { isAdmin, isLoading: isAdminLoading } = useAdmin();
    const { data: session } = useSession();
    const router = useRouter();
    const [users, setUsers] = useState<UserResponse[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [isCleaning, setIsCleaning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const fetchUsers = useCallback(async () => {
        setIsLoadingUsers(true);
        try {
            const token = (session as any)?.accessToken;
            const response = await fetch("http://localhost:8080/users", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch users: ${response.status}`);
            }

            const data = await response.json();
            setUsers(data);
        } catch (error: any) {
            toast.error(`Error loading users: ${error.message}`);
        } finally {
            setIsLoadingUsers(false);
        }
    }, [session]);

    useEffect(() => {
        if (!isAdminLoading && !isAdmin) {
            router.push("/app");
        } else if (isAdmin) {
            fetchUsers();
        }
    }, [isAdmin, isAdminLoading, router, fetchUsers]);

    const handleSave = async (updatedUsers: UserResponse[]) => {
        setIsSaving(true);
        try {
            const token = (session as any)?.accessToken;
            const response = await fetch("http://localhost:8080/users", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(updatedUsers),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to save changes: ${response.status} - ${errorText}`);
            }

            toast.success(`${updatedUsers.length} users updated successfully`);
            fetchUsers();
        } catch (error: any) {
            toast.error(`Error saving changes: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCleanup = async () => {
        if (!confirm("Are you sure? This will delete ALL demo users immediately.")) return;

        setIsCleaning(true);
        try {
            const token = (session as any)?.accessToken;
            const response = await fetch("http://localhost:8080/users/demos", {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed: ${response.status} - ${errorText}`);
            }

            toast.success("Success: All demo users have been deleted.");
            fetchUsers(); // Refresh the list
        } catch (error: any) {
            toast.error(`Error: ${error.message}`);
        } finally {
            setIsCleaning(false);
        }
    };

    if (isAdminLoading || !isAdmin) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-muted-foreground">Checking admin access...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-6 p-8 pt-6 bg-background/50">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        Admin Backoffice
                    </h2>
                    <p className="text-muted-foreground">
                        Manage users and system state.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={fetchUsers}
                        disabled={isLoadingUsers || isSaving}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${(isLoadingUsers || isSaving) ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleCleanup}
                        disabled={isCleaning || isSaving}
                        className="gap-2"
                    >
                        <Trash2 className="h-4 w-4" />
                        {isCleaning ? "Cleaning..." : "Clean Demos"}
                    </Button>
                </div>
            </div>

            <div className="grid gap-6">
                <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary" />
                                Registered Users
                            </CardTitle>
                            <CardDescription>
                                Edit user details directly in the table. Changes are saved once confirmed.
                            </CardDescription>
                        </div>
                        <Badge variant="secondary" className="font-mono">
                            {users.length} Total
                        </Badge>
                    </CardHeader>
                    <CardContent>
                        <EditableUserTable
                            users={users}
                            onSave={handleSave}
                            isLoading={isLoadingUsers}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
