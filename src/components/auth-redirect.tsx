"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AuthRedirect() {
	const { user, loading } = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (!loading) {
			if (user) {
				// User is logged in, redirect to dashboard
				router.push("/dashboard");
			} else {
				// User is not logged in, redirect to login
				router.push("/login");
			}
		}
	}, [user, loading, router]);

	// Show loading while redirecting
	return (
		<div className="min-h-screen flex items-center justify-center">
			<div className="text-center">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
				<p className="text-muted-foreground">Redirecting...</p>
			</div>
		</div>
	);
}
