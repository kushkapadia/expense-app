import { AuthGate, AuthProvider } from "@/lib/auth";
import NavBar from "./navbar";
import { OfflineProvider } from "@/components/offline-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
	return (
		<AuthProvider>
			<AuthGate fallback={<div className="min-h-screen grid place-items-center">Please login</div>}>
				<OfflineProvider>
					<NavBar />
					<main>{children}</main>
				</OfflineProvider>
			</AuthGate>
		</AuthProvider>
	);
}
