"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { createPresetDoc, listPresets, applyPreset, updatePreset, deletePreset } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { WalletType } from "@/types/db";

export default function SettingsPage() {
	const { user } = useAuth();
	const [openModals, setOpenModals] = useState<Record<string, boolean>>({});
	const emojiRef = useRef<HTMLInputElement>(null);
	const labelRef = useRef<HTMLInputElement>(null);
	const amountRef = useRef<HTMLInputElement>(null);
	const categoryRef = useRef<HTMLInputElement>(null);
	const walletRef = useRef<HTMLInputElement>(null);

	const { data: presets, refetch } = useQuery({
		queryKey: ["presets", user?.uid],
		enabled: !!user,
		queryFn: async () => {
			if (!user) return [] as any[];
			return await listPresets(user.uid);
		},
	});


	async function addPreset() {
		if (!user) return;
		const emoji = emojiRef.current?.value || "";
		const label = labelRef.current?.value || "";
		const amount = Number(amountRef.current?.value || 0);
		const category = categoryRef.current?.value || "";
		const wallet = (walletRef.current?.value || "cash") as any;
		if (!label || !amount || !category) return;
		await createPresetDoc(user.uid, { emoji, label, amount, category, wallet });
		toast.success("Preset created");
		emojiRef.current!.value = "";
		labelRef.current!.value = "";
		amountRef.current!.value = "";
		categoryRef.current!.value = "";
		walletRef.current!.value = "";
		refetch();
	}

	async function previewPreset(presetId: string, wallet: WalletType) {
		if (!user) return;
		await applyPreset(user.uid, presetId, wallet);
		toast.success(`Applied preset via ${wallet}`);
		setOpenModals(prev => ({ ...prev, [presetId]: false }));
	}

	return (
		<div className="container mx-auto max-w-3xl py-6 space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Quick Presets</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="grid sm:grid-cols-5 gap-2">
						<div>
							<Label>Emoji</Label>
							<Input ref={emojiRef} placeholder="🚇" />
						</div>
						<div>
							<Label>Label</Label>
							<Input ref={labelRef} placeholder="Metro" />
						</div>
						<div>
							<Label>Amount</Label>
							<Input ref={amountRef} type="number" placeholder="60" />
						</div>
						<div>
							<Label>Category</Label>
							<Input ref={categoryRef} placeholder="Travel" />
						</div>
						<div>
							<Label>Wallet</Label>
							<Input ref={walletRef} placeholder="cash | gpay | investment" />
						</div>
						<div className="sm:col-span-5">
							<Button onClick={addPreset} className="w-full">Add Preset</Button>
						</div>
					</div>
					<div className="space-y-2">
						{/* Debug info */}
						<div className="text-xs text-muted-foreground mb-2">
							Debug: {presets?.length || 0} presets found
						</div>
                        {(presets || []).map((p: any) => (
							<Dialog key={p.id} open={openModals[p.id] || false} onOpenChange={(open) => setOpenModals(prev => ({ ...prev, [p.id]: open }))}>
								<DialogTrigger asChild>
									<div className="flex items-center justify-between text-sm py-2 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 rounded p-2">
										<div className="text-muted-foreground">
											{p.emoji} {p.label} • ₹{p.amount} • {p.category} • {p.wallet}
										</div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={async (e) => {
                                                e.stopPropagation();
                                                const nextLabel = prompt("Label", p.label) || p.label;
                                                const nextAmount = Number(prompt("Amount", String(p.amount)) || p.amount);
                                                await updatePreset(p.id, { label: nextLabel, amount: nextAmount });
                                                toast.success("Preset updated");
                                                refetch();
                                            }}>Edit</Button>
                                            <Button variant="destructive" size="sm" onClick={async (e) => {
                                                e.stopPropagation();
                                                await deletePreset(p.id);
                                                toast.success("Preset deleted");
                                                refetch();
                                            }}>Delete</Button>
                                        </div>
									</div>
								</DialogTrigger>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>Apply preset via</DialogTitle>
									</DialogHeader>
									<div className="grid gap-3">
										<Button onClick={() => previewPreset(p.id, "cash")} className="w-full">💵 Cash</Button>
										<Button onClick={() => previewPreset(p.id, "gpay")} className="w-full">📲 GPay</Button>
									</div>
								</DialogContent>
							</Dialog>
						))}
						{(presets || []).length === 0 && <div className="text-muted-foreground text-sm">No presets yet</div>}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
