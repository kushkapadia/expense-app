"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { listTransactions, markSettlement, adjustWalletBalance, deleteTransaction, updateTransaction, getGroupSettlements, markSettlementComplete, getUserExpenseGroups, getUserNames } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { WalletType, GroupSettlement } from "@/types/db";
import { useState } from "react";
import { getUserDisplayNameById, getUserDisplayName } from "@/lib/user-utils";
import { ConfirmationModal } from "@/components/confirmation-modal";

export default function SettlementsPage() {
	const { user } = useAuth();
	const [openEditModals, setOpenEditModals] = useState<Record<string, boolean>>({});
	const [userNames, setUserNames] = useState<Record<string, string>>({});
	const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; settlementId: string | null; settlementItem: string }>({
		isOpen: false,
		settlementId: null,
		settlementItem: "",
	});
	const { data, refetch } = useQuery({
		queryKey: ["settlements", user?.uid],
		enabled: !!user,
		queryFn: async () => {
			if (!user) return { individual: [], group: [] };
			
			// Fetch individual settlements (from transactions)
			const allTransactions = await listTransactions(user.uid);
			const individualSettlements = allTransactions.filter((t: any) => t.isSettlement && !t.settled);
			
			// Fetch group settlements where user is involved
			// We need to get all groups the user is part of first
			const userGroups = await getUserExpenseGroups(user.uid);
			const groupSettlements: GroupSettlement[] = [];
			
			for (const group of userGroups) {
				const settlements = await getGroupSettlements(group.id);
				// Filter settlements where user is either the debtor or creditor
				const userSettlements = settlements.filter(s => 
					s.fromUserId === user.uid || s.toUserId === user.uid
				);
				groupSettlements.push(...userSettlements);
			}
			
			// Collect all unique user IDs from group settlements
			const allUserIds = new Set<string>();
			groupSettlements.forEach(settlement => {
				allUserIds.add(settlement.fromUserId);
				allUserIds.add(settlement.toUserId);
			});
			
			// Fetch user names for all involved users
			if (allUserIds.size > 0) {
				const names = await getUserNames(Array.from(allUserIds));
				setUserNames(names);
			}
			
			return { individual: individualSettlements, group: groupSettlements };
		},
	});

	async function settleIndividual(id: string, wallet: WalletType) {
		if (!user) return;
		await markSettlement(user.uid, id, wallet);
		// Add the settlement amount to the selected wallet
		const tx = data?.individual.find((t: any) => t.id === id);
		if (tx) {
			await adjustWalletBalance(user.uid, wallet, tx.amount, `Settlement: ${tx.category}`);
		}
		toast.success(`Settled via ${wallet}`);
		refetch();
	}

	async function settleGroup(settlementId: string, wallet: WalletType) {
		if (!user) return;
		await markSettlementComplete(settlementId, wallet);
		toast.success(`Group settlement completed via ${wallet}`);
		refetch();
	}

	return (
		<div className="container mx-auto max-w-3xl py-6 space-y-6 pb-24">
			{/* Individual Settlements */}
			<Card>
				<CardHeader>
					<CardTitle>Individual Settlements</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					{(data?.individual || []).map((t: any) => (
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
                                            <Button onClick={() => settleIndividual(t.id, "cash")} className="w-full">💵 Cash</Button>
                                            <Button onClick={() => settleIndividual(t.id, "gpay")} className="w-full">📲 GPay</Button>
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
                                <Button size="sm" variant="destructive" onClick={() => {
									setDeleteModal({
										isOpen: true,
										settlementId: t.id,
										settlementItem: t.item || t.category,
									});
								}}>Delete</Button>
                            </div>
						</div>
					))}
					{(data?.individual || []).length === 0 && (
						<div className="text-muted-foreground text-sm">
							No individual settlements. Create one from <Link className="underline" href="/transactions">Transactions</Link> by checking &quot;Paid for someone else&quot;.
						</div>
					)}
				</CardContent>
			</Card>

			{/* Group Settlements */}
			<Card>
				<CardHeader>
					<CardTitle>Group Settlements</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					{(data?.group || []).map((settlement: GroupSettlement) => (
						<div key={settlement.id} className="flex items-center justify-between text-sm py-2 border-b last:border-b-0">
                            <div>
                                <div className="font-medium">
									{settlement.fromUserId === user?.uid ? "You owe" : `${getUserDisplayNameById(settlement.fromUserId, user, userNames)} owes`} 
									{settlement.toUserId === user?.uid ? " you" : ` ${getUserDisplayNameById(settlement.toUserId, user, userNames)}`}
								</div>
                                <div className="text-muted-foreground">₹{settlement.amount} • Group settlement</div>
							</div>
                            <div className="flex items-center gap-2">
								{settlement.status === "pending" && settlement.fromUserId === user?.uid && (
									<Dialog>
										<DialogTrigger asChild>
											<Button size="sm" variant="outline">Mark Settled</Button>
										</DialogTrigger>
										<DialogContent>
											<DialogHeader>
												<DialogTitle>Settle via</DialogTitle>
											</DialogHeader>
											<div className="grid gap-3">
												<Button onClick={() => settleGroup(settlement.id, "cash")} className="w-full">💵 Cash</Button>
												<Button onClick={() => settleGroup(settlement.id, "gpay")} className="w-full">📲 GPay</Button>
											</div>
										</DialogContent>
									</Dialog>
								)}
								{settlement.status === "completed" && (
									<span className="text-green-600 text-xs font-medium">Completed</span>
								)}
								{settlement.status === "pending" && settlement.toUserId === user?.uid && (
									<span className="text-muted-foreground text-xs">Waiting for payment</span>
								)}
                            </div>
						</div>
					))}
					{(data?.group || []).length === 0 && (
						<div className="text-muted-foreground text-sm">
							No group settlements. Create expenses in <Link className="underline" href="/groups">Groups</Link> to generate settlements.
						</div>
					)}
				</CardContent>
			</Card>

			{/* Delete Confirmation Modal */}
			<ConfirmationModal
				isOpen={deleteModal.isOpen}
				onClose={() => setDeleteModal({ isOpen: false, settlementId: null, settlementItem: "" })}
				onConfirm={async () => {
					if (!user || !deleteModal.settlementId) return;
					await deleteTransaction(user.uid, deleteModal.settlementId);
					toast.success("Settlement deleted");
					refetch();
				}}
				title="Delete Settlement"
				description={`Are you sure you want to delete "${deleteModal.settlementItem}"? This action cannot be undone.`}
				confirmText="Delete"
				cancelText="Cancel"
			/>
		</div>
	);
}
