"use client";

import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function AdminDashboard() {
    const { isAdmin, isLoading } = useAdmin();
    const { data: session } = useSession();
    const router = useRouter();
    const [isCleaning, setIsCleaning] = useState(false);

    useEffect(() => {
        if (!isLoading && !isAdmin) {
            router.push("/dashboard");
        }
    }, [isAdmin, isLoading, router]);

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
        } catch (error: any) {
            toast.error(`Error: ${error.message}`);
            console.error("Cleanup failed:", error);
        } finally {
            setIsCleaning(false);
        }
    };

    if (isLoading || !isAdmin) {
        return <div className="p-8">Loading admin access...</div>;
    }

    return (
        <div className="container mx-auto py-10">
            <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Demo User Cleanup</CardTitle>
                        <CardDescription>
                            Delete all demo users and their associated data.
                            This action cannot be undone.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            variant="destructive"
                            onClick={handleCleanup}
                            disabled={isCleaning}
                            className="w-full"
                        >
                            {isCleaning ? "Cleaning..." : "Clean All Demo Users"}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
