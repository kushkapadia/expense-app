import { AuthGate, AuthProvider } from "@/lib/auth";
import NavBar from "./navbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
	return (
		<AuthProvider>
			<AuthGate fallback={<div className="min-h-screen grid place-items-center">Please login</div>}>
				<NavBar />
				<main>{children}</main>
			</AuthGate>
		</AuthProvider>
	);
}
