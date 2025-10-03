"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { listTransactions, markSettlement, adjustWalletBalance, deleteTransaction, updateTransaction } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { WalletType } from "@/types/db";
import { useState } from "react";

export default function SettlementsPage() {
	const { user } = useAuth();
	const [openEditModals, setOpenEditModals] = useState<Record<string, boolean>>({});
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
		await markSettlement(user.uid, id, wallet);
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
                                <div className="font-medium">{t.category} {t.item ? `• ${t.item}` : ""}</div>
                                <div className="text-muted-foreground">₹{t.amount} • {new Date(t.date).toLocaleDateString()}</div>
								{t.notes && <div className="text-muted-foreground text-xs">{t.notes}</div>}
							</div>
                            <div className="flex items-center gap-2">
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
                                <Dialog open={openEditModals[t.id] || false} onOpenChange={(open) => setOpenEditModals(prev => ({ ...prev, [t.id]: open }))}>
                                    <DialogTrigger asChild>
                                        <Button size="sm" variant="outline">Edit</Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Edit settlement</DialogTitle>
                                        </DialogHeader>
                                        <div className="grid gap-3">
                                            <input id={`s-amt-${t.id}`} defaultValue={t.amount} type="number" className="border rounded p-2" />
                                            <input id={`s-cat-${t.id}`} defaultValue={t.category} className="border rounded p-2" />
                                            <input id={`s-note-${t.id}`} defaultValue={t.notes || ""} className="border rounded p-2" />
                                            <Button onClick={async () => {
                                                if (!user) return;
                                                const amt = Number((document.getElementById(`s-amt-${t.id}`) as HTMLInputElement)?.value || t.amount);
                                                const cat = (document.getElementById(`s-cat-${t.id}`) as HTMLInputElement)?.value || t.category;
                                                const note = (document.getElementById(`s-note-${t.id}`) as HTMLInputElement)?.value || t.notes;
                                                await updateTransaction(user.uid, t.id, { amount: amt, category: cat, notes: note });
                                                toast.success("Settlement updated");
                                                setOpenEditModals(prev => ({ ...prev, [t.id]: false }));
                                                refetch();
                                            }}>Save</Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                                <Button size="sm" variant="destructive" onClick={async () => { if (!user) return; await deleteTransaction(user.uid, t.id); toast.success("Settlement deleted"); refetch(); }}>Delete</Button>
                            </div>
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
