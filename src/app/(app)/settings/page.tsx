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
import { ConfirmationModal } from "@/components/confirmation-modal";
import { LoadingButton } from "@/components/ui/loading-button";
import { useLoading } from "@/hooks/use-loading";
import { LogOut } from "lucide-react";
import Image from "next/image";

export default function SettingsPage() {
	const { user, signOut } = useAuth();
	const { isLoading, withLoading } = useLoading();
	const [openModals, setOpenModals] = useState<Record<string, boolean>>({});
	const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; presetId: string | null; presetLabel: string }>({
		isOpen: false,
		presetId: null,
		presetLabel: "",
	});
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
		await withLoading("add-preset", async () => {
			await createPresetDoc(user.uid, { emoji, label, amount, category, wallet });
			toast.success("Preset created");
			emojiRef.current!.value = "";
			labelRef.current!.value = "";
			amountRef.current!.value = "";
			categoryRef.current!.value = "";
			walletRef.current!.value = "";
			refetch();
		});
	}

	async function previewPreset(presetId: string, wallet: WalletType) {
		if (!user) return;
		await withLoading(`apply-preset-${presetId}`, async () => {
			await applyPreset(user.uid, presetId, wallet);
			toast.success(`Applied preset via ${wallet}`);
			setOpenModals(prev => ({ ...prev, [presetId]: false }));
		});
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
							<LoadingButton 
								onClick={addPreset} 
								className="w-full"
								loading={isLoading("add-preset")}
								loadingText="Adding..."
							>
								Add Preset
							</LoadingButton>
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
                                            <LoadingButton 
                                                variant="outline" 
                                                size="sm" 
                                                loading={isLoading(`edit-preset-${p.id}`)}
                                                loadingText="Updating..."
                                                onClick={async (e: React.MouseEvent) => {
                                                    e.stopPropagation();
                                                    const nextLabel = prompt("Label", p.label) || p.label;
                                                    const nextAmount = Number(prompt("Amount", String(p.amount)) || p.amount);
                                                    await withLoading(`edit-preset-${p.id}`, async () => {
                                                        await updatePreset(p.id, { label: nextLabel, amount: nextAmount });
                                                        toast.success("Preset updated");
                                                        refetch();
                                                    });
                                                }}
                                            >
                                                Edit
                                            </LoadingButton>
                                            <Button variant="destructive" size="sm" onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteModal({
                                                    isOpen: true,
                                                    presetId: p.id,
                                                    presetLabel: p.label,
                                                });
                                            }}>Delete</Button>
                                        </div>
									</div>
								</DialogTrigger>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>Apply preset via</DialogTitle>
									</DialogHeader>
									<div className="grid gap-3">
										<LoadingButton 
											loading={isLoading(`apply-preset-${p.id}`)}
											loadingText="Applying..."
											onClick={() => previewPreset(p.id, "cash")} 
											className="w-full"
										>
											💵 Cash
										</LoadingButton>
										<LoadingButton 
											loading={isLoading(`apply-preset-${p.id}`)}
											loadingText="Applying..."
											onClick={() => previewPreset(p.id, "gpay")} 
											className="w-full"
										>
											📲 GPay
										</LoadingButton>
									</div>
								</DialogContent>
							</Dialog>
						))}
						{(presets || []).length === 0 && <div className="text-muted-foreground text-sm">No presets yet</div>}
					</div>
				</CardContent>
			</Card>

			{/* Account Settings */}
			<Card>
				<CardHeader>
					<CardTitle>Account</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{/* Profile Information */}
						<div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
							{user?.photoURL ? (
								<Image 
									src={user.photoURL} 
									alt="Profile" 
									width={48}
									height={48}
									className="w-12 h-12 rounded-full border-2 border-background object-cover"
									onError={(e) => {
										// Hide the image and show fallback if it fails to load
										e.currentTarget.style.display = 'none';
										const fallback = e.currentTarget.nextElementSibling as HTMLElement;
										if (fallback) fallback.style.display = 'flex';
									}}
								/>
							) : null}
							<div 
								className={`w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border-2 border-background ${user?.photoURL ? 'hidden' : 'flex'}`}
							>
								<span className="text-lg font-semibold text-primary">
									{user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
								</span>
							</div>
							<div className="flex-1">
								<div className="font-semibold text-lg">
									{user?.displayName || 'User'}
								</div>
								<div className="text-sm text-muted-foreground">
									{user?.email}
								</div>
								{user?.emailVerified && (
									<div className="text-xs text-green-600 mt-1 flex items-center gap-1">
										<span className="w-2 h-2 bg-green-500 rounded-full"></span>
										Email verified
									</div>
								)}
							</div>
						</div>

						{/* Sign Out */}
						<div className="flex items-center justify-between pt-2 border-t">
							<div>
								<div className="font-medium">Sign Out</div>
								<div className="text-sm text-muted-foreground">
									Sign out of your account
								</div>
							</div>
							<Button 
								variant="outline" 
								onClick={() => {
									signOut();
									toast.success("Logged out successfully");
								}}
								className="flex items-center gap-2"
							>
								<LogOut size={16} />
								Sign Out
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Delete Confirmation Modal */}
			<ConfirmationModal
				isOpen={deleteModal.isOpen}
				onClose={() => setDeleteModal({ isOpen: false, presetId: null, presetLabel: "" })}
				onConfirm={async () => {
					if (!deleteModal.presetId) return;
					await withLoading(`delete-preset-${deleteModal.presetId || ''}`, async () => {
						await deletePreset(deleteModal.presetId!);
						toast.success("Preset deleted");
						refetch();
					});
				}}
				title="Delete Preset"
				description={`Are you sure you want to delete the preset "${deleteModal.presetLabel}"? This action cannot be undone.`}
				confirmText="Delete"
				cancelText="Cancel"
				isLoading={isLoading(`delete-preset-${deleteModal.presetId || ''}`)}
			/>
		</div>
	);
}
