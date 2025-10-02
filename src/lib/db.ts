import { getFirestoreDb } from "@/lib/firebase";
import { addDoc, collection, doc, getDoc, getDocs, increment, limit, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";
import type { Transaction, Wallet, WalletType } from "@/types/db";

const db = () => getFirestoreDb();

export async function getOrCreateWallet(userId: string, type: WalletType): Promise<Wallet> {
	const ref = doc(db(), "wallets", `${userId}_${type}`);
	const snap = await getDoc(ref);
	if (snap.exists()) return snap.data() as Wallet;
	const wallet: Wallet = {
		id: ref.id,
		userId,
		type,
		name: type === "cash" ? "Cash" : type === "gpay" ? "GPay" : "Investment",
		balance: 0,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};
	await setDoc(ref, wallet);
	return wallet;
}

export async function getWallets(userId: string): Promise<Record<WalletType, Wallet>> {
	const result: Partial<Record<WalletType, Wallet>> = {};
	for (const t of ["cash", "gpay", "investment"] as const) {
		result[t] = await getOrCreateWallet(userId, t);
	}
	return result as Record<WalletType, Wallet>;
}

export async function listTransactions(userId: string, month?: string) {
	let q = query(collection(db(), "transactions"), where("userId", "==", userId), orderBy("date", "desc"));
	const results = await getDocs(q);
	return results.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Transaction[] as any;
}

export async function listRecentTransactions(userId: string, take = 10) {
	const q = query(collection(db(), "transactions"), where("userId", "==", userId), orderBy("date", "desc"), limit(take));
	const results = await getDocs(q);
	return results.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function createTransaction(userId: string, tx: Omit<Transaction, "id" | "userId" | "createdAt" | "updatedAt">) {
	// Remove undefined fields – Firestore rejects undefined
	const cleaned: Record<string, any> = {};
	for (const [k, v] of Object.entries(tx)) {
		if (v !== undefined) cleaned[k] = v;
	}
	const ref = await addDoc(collection(db(), "transactions"), {
		...cleaned,
		userId,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	});
	
	// Update wallet balance based on transaction type
	if (tx.type === "expense") {
		await adjustWalletBalance(userId, tx.wallet, -tx.amount);
	} else if (tx.type === "income") {
		await adjustWalletBalance(userId, tx.wallet, tx.amount);
	}
	
	return ref.id;
}

export async function adjustWalletBalance(userId: string, wallet: WalletType, delta: number, reason?: string) {
	await getOrCreateWallet(userId, wallet);
	const wref = doc(db(), "wallets", `${userId}_${wallet}`);
	await updateDoc(wref, { balance: increment(delta), updatedAt: Date.now() });
	
	// Record wallet history for positive adjustments (additions)
	if (delta > 0) {
		await addDoc(collection(db(), "walletHistory"), {
			userId,
			wallet,
			amount: delta,
			type: "add",
			reason: reason || "Manual addition",
			createdAt: Date.now(),
			updatedAt: Date.now()
		});
	}
}

export async function applyPreset(userId: string, presetId: string, wallet: WalletType) {
	// Get the preset details
	const presetRef = doc(db(), "presets", presetId);
	const presetSnap = await getDoc(presetRef);
	if (!presetSnap.exists()) {
		throw new Error("Preset not found");
	}
	const preset = presetSnap.data();
	
	// Create transaction with preset details but override wallet
	await createTransaction(userId, {
		date: Date.now(),
		amount: preset.amount,
		category: preset.category,
		wallet,
		type: "expense",
		notes: preset.label,
		isSettlement: false,
		settled: false,
	});
}

export async function transferBetweenWallets(userId: string, fromWallet: WalletType, toWallet: WalletType, amount: number) {
	await createTransaction(userId, {
		date: Date.now(),
		amount,
		category: "Transfer",
		wallet: fromWallet,
		type: "transfer",
		notes: `Transfer to ${toWallet}`,
		fromWallet,
		toWallet,
		settled: true,
	});
	await adjustWalletBalance(userId, fromWallet, -amount);
	await adjustWalletBalance(userId, toWallet, amount);
}

// Budgets
export interface BudgetInput { month: string; category: string; limit: number }
export async function upsertBudget(userId: string, input: BudgetInput) {
	const id = `${userId}_${input.month}_${input.category}`;
	const ref = doc(db(), "budgets", id);
	await setDoc(ref, { id, userId, ...input, spent: 0, createdAt: Date.now(), updatedAt: Date.now() }, { merge: true });
}

export async function listBudgets(userId: string, month: string) {
	const q = query(collection(db(), "budgets"), where("userId", "==", userId), where("month", "==", month));
	const res = await getDocs(q);
	return res.docs.map((d) => d.data()) as any[];
}

// Auto-create budgets for new month based on previous month's budgets
export async function ensureBudgetsForMonth(userId: string, month: string) {
	// Get previous month
	const prevMonth = new Date(`${month}-01`);
	prevMonth.setMonth(prevMonth.getMonth() - 1);
	const prevMonthStr = prevMonth.toISOString().slice(0, 7);
	
	// Check if budgets already exist for current month
	const currentBudgets = await listBudgets(userId, month);
	if (currentBudgets.length > 0) {
		return currentBudgets; // Budgets already exist
	}
	
	// Get previous month's budgets
	const prevBudgets = await listBudgets(userId, prevMonthStr);
	
	// Create new budgets for current month with same limits but reset spent
	for (const budget of prevBudgets) {
		await upsertBudget(userId, {
			month,
			category: budget.category,
			limit: budget.limit
		});
	}
	
	// Return the newly created budgets
	return await listBudgets(userId, month);
}

// Presets
export interface PresetInput { emoji: string; label: string; amount: number; category: string; wallet: WalletType }
export async function createPresetDoc(userId: string, p: PresetInput) {
	await addDoc(collection(db(), "presets"), { userId, ...p, createdAt: Date.now(), updatedAt: Date.now() });
}
export async function listPresets(userId: string) {
	const q = query(collection(db(), "presets"), where("userId", "==", userId));
	const res = await getDocs(q);
	return res.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

// Settlements
export async function markPaidForSomeone(userId: string, tx: Omit<Transaction, "id" | "userId" | "createdAt" | "updatedAt">) {
	await createTransaction(userId, { ...tx, isSettlement: true, settled: false });
}
export async function markSettlement(userId: string, txId: string) {
	const ref = doc(db(), "transactions", txId);
	await updateDoc(ref, { settled: true, updatedAt: Date.now() });
}

// Income & Investment
export async function recordIncome(userId: string, month: string, amount: number) {
	await addDoc(collection(db(), "incomes"), { userId, month, amount, createdAt: Date.now(), updatedAt: Date.now() });
}
export async function lockInvestment(userId: string, amount: number, fromWallet: WalletType) {
	await adjustWalletBalance(userId, fromWallet, -amount);
	await adjustWalletBalance(userId, "investment", amount);
	await createTransaction(userId, {
		date: Date.now(), amount, category: "Investment", wallet: fromWallet, type: "expense", notes: "Lock to Investment", isSettlement: false, settled: true, toWallet: "investment", fromWallet,
	});
}

export async function aggregateMonthlySpend(userId: string, month: string) {
	const all = await listTransactions(userId);
	const start = new Date(`${month}-01T00:00:00`).getTime();
	const end = new Date(new Date(`${month}-01T00:00:00`).setMonth(new Date(`${month}-01T00:00:00`).getMonth() + 1)).getTime();
	const totals: Record<string, number> = {};
	all.forEach((t: any) => {
		if (t.type !== "expense") return;
		if (t.date < start || t.date >= end) return;
		totals[t.category] = (totals[t.category] || 0) + t.amount;
	});
	return totals;
}

export async function syncBudgetsSpent(userId: string, month: string) {
	const totals = await aggregateMonthlySpend(userId, month);
	const budgets = await listBudgets(userId, month);
	for (const b of budgets) {
		const ref = doc(db(), "budgets", `${userId}_${month}_${b.category}`);
		await updateDoc(ref, { spent: totals[b.category] || 0, updatedAt: Date.now() });
	}
}

// Wallet History
export async function listWalletHistory(userId: string, wallet?: WalletType) {
	let q = query(collection(db(), "walletHistory"), where("userId", "==", userId));
	if (wallet) {
		q = query(collection(db(), "walletHistory"), where("userId", "==", userId), where("wallet", "==", wallet));
	}
	const results = await getDocs(q);
	const data = results.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
	// Sort by createdAt descending on client side
	return data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
