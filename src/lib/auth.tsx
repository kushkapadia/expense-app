"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

interface AuthContextValue {
	user: User | null;
	loading: boolean;
	signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const router = useRouter();

	useEffect(() => {
		const auth = getFirebaseAuth();
		const unsub = onAuthStateChanged(auth, (u) => {
			setUser(u);
			setLoading(false);
		});
		return () => unsub();
	}, []);

	const value = useMemo<AuthContextValue>(() => ({
		user,
		loading,
		signOut: async () => {
			await signOut(getFirebaseAuth());
			router.push("/login");
		},
	}), [user, loading, router]);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within AuthProvider");
	return ctx;
}

export function AuthGate({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
	const { user, loading } = useAuth();
	if (loading) return fallback ?? null;
	if (!user) return fallback ?? null;
	return <>{children}</>;
}
