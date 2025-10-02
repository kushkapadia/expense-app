"use client";

import { Button } from "@/components/ui/button";
import { getFirebaseAuth, getGoogleProvider } from "@/lib/firebase";
import { signInWithPopup, signInWithRedirect } from "firebase/auth";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function LoginPage() {
	const [loading, setLoading] = useState(false);
	const router = useRouter();
	async function handleGoogle() {
		try {
			setLoading(true);
			await signInWithPopup(getFirebaseAuth(), getGoogleProvider());
			toast.success("Signed in");
			router.push("/dashboard");
		} catch (err: any) {
			const code = err?.code || "unknown";
			const message = err?.message || "Sign-in failed";
			// Common: auth/popup-blocked, auth/unauthorized-domain, auth/invalid-api-key
			if (code === "auth/popup-blocked") {
				toast("Popup blocked by the browser. Redirecting to Google sign-in...");
				try {
					await signInWithRedirect(getFirebaseAuth(), getGoogleProvider());
					return;
				} catch {
					// Fall through to error toast
				}
			}
			toast.error(`${code}: ${message}`);
		} finally {
			setLoading(false);
		}
	}
	return (
		<div className="min-h-screen grid place-items-center p-6">
			<div className="w-full max-w-sm space-y-4 text-center">
				<h1 className="text-2xl font-semibold">Welcome</h1>
				<p className="text-sm text-muted-foreground">Sign in to continue</p>
				<Button onClick={handleGoogle} disabled={loading} className="w-full">
					{loading ? "Signing in..." : "Continue with Google"}
				</Button>
			</div>
		</div>
	);
}

