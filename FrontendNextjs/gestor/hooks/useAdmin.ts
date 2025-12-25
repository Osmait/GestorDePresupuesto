import { useSession } from "next-auth/react";

export const useAdmin = () => {
    const { data: session, status } = useSession();

    const isAdmin = session?.user?.role === "ADMIN";
    const isLoading = status === "loading";

    return { isAdmin, isLoading, user: session?.user };
};
