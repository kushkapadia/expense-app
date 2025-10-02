"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { listTransactions, markSettlement, adjustWalletBalance } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { WalletType } from "@/types/db";

export default function SettlementsPage() {
	const { user } = useAuth();
	const { data, refetch } = useQuery({
		queryKey: ["settlements", user?.uid],
		enabled: !!user,
		queryFn: async () => {
			if (!user) return [] as any[];
			const all = await listTransactions(user.uid);
			return all.filter((t: any) => t.isSettlement && !t.settled);
		},
	});

	async function settle(id: string, wallet: WalletType) {
		if (!user) return;
		await markSettlement(user.uid, id);
		// Add the settlement amount to the selected wallet
		const tx = data?.find((t: any) => t.id === id);
		if (tx) {
			await adjustWalletBalance(user.uid, wallet, tx.amount, `Settlement: ${tx.category}`);
		}
		toast.success(`Settled via ${wallet}`);
		refetch();
	}

	return (
		<div className="container mx-auto max-w-3xl py-6 space-y-6 pb-24">
			<Card>
				<CardHeader>
					<CardTitle>Pending Settlements</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					{(data || []).map((t: any) => (
						<div key={t.id} className="flex items-center justify-between text-sm py-2 border-b last:border-b-0">
							<div>
								<div className="font-medium">{t.category}</div>
								<div className="text-muted-foreground">₹{t.amount} • {new Date(t.date).toLocaleDateString()}</div>
								{t.notes && <div className="text-muted-foreground text-xs">{t.notes}</div>}
							</div>
							<Dialog>
								<DialogTrigger asChild>
									<Button size="sm" variant="outline">Mark Settled</Button>
								</DialogTrigger>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>Settle via</DialogTitle>
									</DialogHeader>
									<div className="grid gap-3">
										<Button onClick={() => settle(t.id, "cash")} className="w-full">💵 Cash</Button>
										<Button onClick={() => settle(t.id, "gpay")} className="w-full">📲 GPay</Button>
									</div>
								</DialogContent>
							</Dialog>
						</div>
					))}
					{(data || []).length === 0 && (
						<div className="text-muted-foreground text-sm">
							No pending settlements. Create one from <Link className="underline" href="/transactions">Transactions</Link> by checking &quot;Paid for someone else&quot;.
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
