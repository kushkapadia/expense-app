"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import { transferBetweenWallets } from "@/lib/db";

export default function TransferModal({ userId, after }: { userId: string; after?: () => void }) {
	const [open, setOpen] = useState(false);
	const [from, setFrom] = useState<"cash" | "gpay">("cash");
	const [to, setTo] = useState<"cash" | "gpay">("gpay");
	const [amount, setAmount] = useState<number>(0);

	async function submit() {
		if (!userId) return;
		if (from === to) return toast.error("Choose different wallets");
		if (!amount || amount <= 0) return toast.error("Enter amount");
		await transferBetweenWallets(userId, from, to, amount);
		toast.success(`Transferred ₹${amount} ${from} → ${to}`);
		setOpen(false);
		after?.();
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">Transfer</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Transfer between wallets</DialogTitle>
				</DialogHeader>
				<div className="grid gap-3">
					<div>
						<Label>From</Label>
						<Select defaultValue={from} onValueChange={(v) => setFrom(v as any)}>
							<SelectTrigger><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectItem value="cash">Cash</SelectItem>
								<SelectItem value="gpay">GPay</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div>
						<Label>To</Label>
						<Select defaultValue={to} onValueChange={(v) => setTo(v as any)}>
							<SelectTrigger><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectItem value="cash">Cash</SelectItem>
								<SelectItem value="gpay">GPay</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div>
						<Label>Amount</Label>
						<Input type="number" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value || 0))} placeholder="100" />
					</div>
					<div>
						<Button className="w-full" onClick={submit}>Transfer</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
