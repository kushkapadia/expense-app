import { getFirestoreDb } from "@/lib/firebase";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, limit, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";
import type { Transaction, Wallet, WalletType, Budget, Preset, WalletHistory, ExpenseGroup, GroupExpense, GroupExpenseSplit, GroupSettlement, UserName } from "@/types/db";

const db = () => getFirestoreDb();

export async function getOrCreateWallet(userId: string, type: WalletType): Promise<Wallet> {
	try {
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
		console.log(`Created wallet for user ${userId}, type ${type}`);
		return wallet;
	} catch (error) {
		console.error(`Error creating wallet for user ${userId}, type ${type}:`, error);
		throw error;
	}
}

export async function getWallets(userId: string): Promise<Record<WalletType, Wallet>> {
	const result: Partial<Record<WalletType, Wallet>> = {};
	for (const t of ["cash", "gpay", "investment"] as const) {
		result[t] = await getOrCreateWallet(userId, t);
	}
	return result as Record<WalletType, Wallet>;
}

export async function listTransactions(userId: string) {
	const q = query(collection(db(), "transactions"), where("userId", "==", userId), orderBy("date", "desc"));
	const results = await getDocs(q);
	return results.docs.map((d) => ({ id: d.id, ...d.data() })) as Transaction[];
}

export async function listRecentTransactions(userId: string, take = 10) {
	const q = query(collection(db(), "transactions"), where("userId", "==", userId), orderBy("date", "desc"), limit(take));
	const results = await getDocs(q);
	return results.docs.map((d) => ({ id: d.id, ...d.data() })) as Transaction[];
}

export async function createTransaction(userId: string, tx: Omit<Transaction, "id" | "userId" | "createdAt" | "updatedAt">) {
	try {
		console.log(`Creating transaction for user ${userId}:`, tx);
		
		// Remove undefined fields – Firestore rejects undefined
		const cleaned: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(tx)) {
			if (v !== undefined) cleaned[k] = v;
		}
		
		console.log(`Adding transaction document for user ${userId}`);
		const ref = await addDoc(collection(db(), "transactions"), {
			...cleaned,
			userId,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});
		console.log(`Transaction created with ID: ${ref.id}`);
		
		// Update wallet balance based on transaction type
		if (tx.type === "expense") {
			console.log(`Adjusting wallet balance for expense: -${tx.amount} to ${tx.wallet}`);
			await adjustWalletBalance(userId, tx.wallet, -tx.amount);
		} else if (tx.type === "income") {
			console.log(`Adjusting wallet balance for income: +${tx.amount} to ${tx.wallet}`);
			await adjustWalletBalance(userId, tx.wallet, tx.amount);
		}
		
		return ref.id;
	} catch (error) {
		console.error(`Error creating transaction for user ${userId}:`, error);
		throw error;
	}
}

// Updates a transaction and safely adjusts wallet balances based on the delta
export async function updateTransaction(userId: string, txId: string, updates: Partial<Transaction>) {
    const ref = doc(db(), "transactions", txId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Transaction not found");
    const prev = snap.data() as Transaction;

    // Reverse previous balance effects
    if (prev.type === "expense") {
        await adjustWalletBalance(userId, prev.wallet, prev.amount); // add back
    } else if (prev.type === "income") {
        await adjustWalletBalance(userId, prev.wallet, -prev.amount); // remove income
    } else if (prev.type === "transfer" && prev.fromWallet && prev.toWallet) {
        await adjustWalletBalance(userId, prev.fromWallet, prev.amount); // add back to from
        await adjustWalletBalance(userId, prev.toWallet, -prev.amount); // remove from to
    }

    // Apply updates
    const next: Transaction = { ...prev, ...updates, updatedAt: Date.now() } as Transaction;
    await updateDoc(ref, { ...updates, updatedAt: Date.now() });

    // Apply new balance effects
    if (next.type === "expense") {
        await adjustWalletBalance(userId, next.wallet, -next.amount);
    } else if (next.type === "income") {
        await adjustWalletBalance(userId, next.wallet, next.amount);
    } else if (next.type === "transfer" && next.fromWallet && next.toWallet) {
        await adjustWalletBalance(userId, next.fromWallet, -next.amount);
        await adjustWalletBalance(userId, next.toWallet, next.amount);
    }
}

// Deletes a transaction and reverts wallet impacts
export async function deleteTransaction(userId: string, txId: string) {
    const ref = doc(db(), "transactions", txId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const t = snap.data() as Transaction;

    // Revert impacts
    if (t.type === "expense") {
        await adjustWalletBalance(userId, t.wallet, t.amount);
    } else if (t.type === "income") {
        await adjustWalletBalance(userId, t.wallet, -t.amount);
    } else if (t.type === "transfer" && t.fromWallet && t.toWallet) {
        await adjustWalletBalance(userId, t.fromWallet, t.amount);
        await adjustWalletBalance(userId, t.toWallet, -t.amount);
    }
    // If settlement was marked and credited to a wallet, attempt to reverse using settledWallet if present
    if (t.isSettlement && t.settled && (t as any).settledWallet) {
        await adjustWalletBalance(userId, (t as any).settledWallet as WalletType, -t.amount);
    }

    await deleteDoc(ref);
}

export async function adjustWalletBalance(userId: string, wallet: WalletType, delta: number, reason?: string) {
	try {
		await getOrCreateWallet(userId, wallet);
		const wref = doc(db(), "wallets", `${userId}_${wallet}`);
		await updateDoc(wref, { balance: increment(delta), updatedAt: Date.now() });
		console.log(`Adjusted wallet balance for user ${userId}, wallet ${wallet}, delta ${delta}`);
		
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
	} catch (error) {
		console.error(`Error adjusting wallet balance for user ${userId}, wallet ${wallet}, delta ${delta}:`, error);
		throw error;
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
	return res.docs.map((d) => d.data()) as Budget[];
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

export async function updateBudget(userId: string, month: string, category: string, updates: Partial<Budget>) {
    const id = `${userId}_${month}_${category}`;
    const ref = doc(db(), "budgets", id);
    await updateDoc(ref, { ...updates, updatedAt: Date.now() });
}

export async function deleteBudget(userId: string, month: string, category: string) {
    const id = `${userId}_${month}_${category}`;
    await deleteDoc(doc(db(), "budgets", id));
}

// Presets
export interface PresetInput { emoji: string; label: string; amount: number; category: string; wallet: WalletType }
export async function createPresetDoc(userId: string, p: PresetInput) {
	await addDoc(collection(db(), "presets"), { userId, ...p, createdAt: Date.now(), updatedAt: Date.now() });
}
export async function listPresets(userId: string) {
	const q = query(collection(db(), "presets"), where("userId", "==", userId));
	const res = await getDocs(q);
	return res.docs.map((d) => ({ id: d.id, ...d.data() })) as Preset[];
}

export async function updatePreset(presetId: string, updates: Partial<Preset>) {
    const ref = doc(db(), "presets", presetId);
    await updateDoc(ref, { ...updates, updatedAt: Date.now() });
}

export async function deletePreset(presetId: string) {
    await deleteDoc(doc(db(), "presets", presetId));
}

// Settlements
export async function markPaidForSomeone(userId: string, tx: Omit<Transaction, "id" | "userId" | "createdAt" | "updatedAt">) {
	await createTransaction(userId, { ...tx, isSettlement: true, settled: false });
}
export async function markSettlement(userId: string, txId: string, wallet?: WalletType) {
    const ref = doc(db(), "transactions", txId);
    await updateDoc(ref, { settled: true, updatedAt: Date.now(), ...(wallet ? { settledWallet: wallet } : {}) });
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
	all.forEach((t: Transaction) => {
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
	const data = results.docs.map((d) => ({ id: d.id, ...d.data() })) as WalletHistory[];
	// Sort by createdAt descending on client side
	return data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

// Group Expense Sharing Functions

// Generate a unique invitation code
function generateInvitationCode(): string {
	return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Expense Groups
export async function createExpenseGroup(userId: string, name: string, description?: string): Promise<string> {
	const invitationCode = generateInvitationCode();
	const groupData: Omit<ExpenseGroup, "id"> = {
		name,
		description,
		ownerId: userId,
		memberIds: [userId], // Owner is automatically a member
		invitationCode,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};
	
	const ref = await addDoc(collection(db(), "expenseGroups"), groupData);
	return ref.id;
}

export async function getExpenseGroup(groupId: string): Promise<ExpenseGroup | null> {
	const ref = doc(db(), "expenseGroups", groupId);
	const snap = await getDoc(ref);
	if (!snap.exists()) return null;
	return { id: snap.id, ...snap.data() } as ExpenseGroup;
}

export async function getUserExpenseGroups(userId: string): Promise<ExpenseGroup[]> {
	const q = query(collection(db(), "expenseGroups"), where("memberIds", "array-contains", userId));
	const results = await getDocs(q);
	return results.docs.map((d) => ({ id: d.id, ...d.data() })) as ExpenseGroup[];
}

export async function joinExpenseGroup(userId: string, invitationCode: string, userDisplayName?: string): Promise<string | null> {
	// Find group by invitation code
	const q = query(collection(db(), "expenseGroups"), where("invitationCode", "==", invitationCode));
	const results = await getDocs(q);
	
	if (results.empty) return null;
	
	const groupDoc = results.docs[0];
	const group = { id: groupDoc.id, ...groupDoc.data() } as ExpenseGroup;
	
	// Check if user is already a member
	if (group.memberIds.includes(userId)) {
		return group.id; // Already a member
	}
	
	// Add user to group
	const updatedMemberIds = [...group.memberIds, userId];
	await updateDoc(doc(db(), "expenseGroups", group.id), {
		memberIds: updatedMemberIds,
		updatedAt: Date.now(),
	});
	
	// Store user's display name if provided
	if (userDisplayName) {
		await setUserName(userId, userDisplayName);
	}
	
	return group.id;
}

export async function leaveExpenseGroup(userId: string, groupId: string): Promise<void> {
	const group = await getExpenseGroup(groupId);
	if (!group) throw new Error("Group not found");
	
	// Owner cannot leave the group
	if (group.ownerId === userId) {
		throw new Error("Group owner cannot leave the group");
	}
	
	// Remove user from member list
	const updatedMemberIds = group.memberIds.filter(id => id !== userId);
	await updateDoc(doc(db(), "expenseGroups", groupId), {
		memberIds: updatedMemberIds,
		updatedAt: Date.now(),
	});
}

// Group Expenses
export async function createGroupExpense(
	groupId: string,
	paidBy: string,
	amount: number,
	description: string,
	category: string,
	splitType: "equal" | "custom",
	splitDetails: GroupExpenseSplit[],
	walletType: "cash" | "gpay" = "cash"
): Promise<string> {
	// First, deduct the amount from the user's wallet
	const wallet = await getOrCreateWallet(paidBy, walletType);
	if (wallet.balance < amount) {
		throw new Error(`Insufficient balance in ${walletType} wallet. Available: ₹${wallet.balance}`);
	}
	
	// Deduct from wallet
	await updateDoc(doc(db(), "wallets", `${paidBy}_${walletType}`), {
		balance: increment(-amount),
		updatedAt: Date.now(),
	});
	
	// Create a transaction record for the user's personal history
	const transactionData: Omit<Transaction, "id"> = {
		userId: paidBy,
		amount: amount, // Positive amount, type will indicate it's an expense
		category,
		wallet: walletType,
		type: "expense",
		item: `Group expense: ${description}`,
		notes: `Paid for group expense`,
		date: Date.now(),
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};
	await addDoc(collection(db(), "transactions"), transactionData);
	
	// Add wallet history record
	const historyData: Omit<WalletHistory, "id"> = {
		userId: paidBy,
		wallet: walletType,
		amount: -amount,
		reason: `Group expense: ${description}`,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};
	await addDoc(collection(db(), "walletHistory"), historyData);
	
	// Create the group expense
	const expenseData: Omit<GroupExpense, "id"> = {
		groupId,
		paidBy,
		amount,
		description,
		category,
		splitType,
		splitDetails,
		date: Date.now(),
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};
	
	const ref = await addDoc(collection(db(), "groupExpenses"), expenseData);
	return ref.id;
}

export async function getGroupExpenses(groupId: string): Promise<GroupExpense[]> {
	const q = query(
		collection(db(), "groupExpenses"),
		where("groupId", "==", groupId)
	);
	const results = await getDocs(q);
	const expenses = results.docs.map((d) => ({ id: d.id, ...d.data() })) as GroupExpense[];
	// Sort by date descending on the client side
	return expenses.sort((a, b) => b.date - a.date);
}

export async function updateGroupExpenseSplit(
	expenseId: string,
	userId: string,
	settled: boolean,
	settledBy?: string
): Promise<void> {
	const expenseRef = doc(db(), "groupExpenses", expenseId);
	const expenseSnap = await getDoc(expenseRef);
	
	if (!expenseSnap.exists()) throw new Error("Expense not found");
	
	const expense = expenseSnap.data() as GroupExpense;
	const updatedSplitDetails = expense.splitDetails.map(split => {
		if (split.userId === userId) {
			return {
				...split,
				settled,
				settledAt: settled ? Date.now() : undefined,
				settledBy: settled ? settledBy : undefined,
			};
		}
		return split;
	});
	
	await updateDoc(expenseRef, {
		splitDetails: updatedSplitDetails,
		updatedAt: Date.now(),
	});
}

// Settlement Calculations
export async function calculateGroupSettlements(groupId: string): Promise<GroupSettlement[]> {
	console.log("Calculating settlements for group:", groupId);
	const expenses = await getGroupExpenses(groupId);
	console.log("Found expenses:", expenses);
	
	// Get completed settlements to exclude already settled amounts
	console.log("Querying for completed settlements in group:", groupId);
	const completedSettlementsQuery = query(
		collection(db(), "groupSettlements"),
		where("groupId", "==", groupId),
		where("status", "==", "completed")
	);
	
	console.log("Executing completed settlements query...");
	const completedSettlementsSnapshot = await getDocs(completedSettlementsQuery);
	console.log("Completed settlements query result:", completedSettlementsSnapshot.docs.length, "documents");
	
	const completedSettlements = completedSettlementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GroupSettlement[];
	
	console.log("Found completed settlements:", completedSettlements.length);
	console.log("Completed settlements details:", completedSettlements);
	completedSettlements.forEach(settlement => {
		console.log(`Completed: ${settlement.fromUserId} paid ${settlement.toUserId} ${settlement.amount}`);
	});
	
	// Also check all settlements to see what's in the database
	console.log("Checking ALL settlements in database...");
	const allSettlementsQuery = query(
		collection(db(), "groupSettlements"),
		where("groupId", "==", groupId)
	);
	const allSettlementsSnapshot = await getDocs(allSettlementsQuery);
	console.log("All settlements in database:", allSettlementsSnapshot.docs.length);
	allSettlementsSnapshot.docs.forEach(doc => {
		const data = doc.data();
		console.log(`Settlement ${doc.id}: ${data.fromUserId} -> ${data.toUserId} ${data.amount} (${data.status})`);
	});
	
	const balances: Record<string, number> = {}; // userId -> net balance (positive = owes money, negative = should receive money)
	
	// Calculate net balances for each user from expenses
	expenses.forEach(expense => {
		console.log("Processing expense:", expense);
		console.log(`Expense: ${expense.description} - ${expense.amount} paid by ${expense.paidBy}`);
		
		// Person who paid gets credited
		balances[expense.paidBy] = (balances[expense.paidBy] || 0) - expense.amount;
		console.log(`${expense.paidBy} paid ${expense.amount}, new balance: ${balances[expense.paidBy]}`);
		
		// People who owe money get debited
		expense.splitDetails.forEach(split => {
			balances[split.userId] = (balances[split.userId] || 0) + split.amount;
			console.log(`${split.userId} owes ${split.amount}, new balance: ${balances[split.userId]}`);
		});
	});
	
	// Adjust balances for completed settlements
	console.log("Adjusting balances for completed settlements...");
	completedSettlements.forEach(settlement => {
		console.log(`Before adjustment - ${settlement.fromUserId}: ${balances[settlement.fromUserId] || 0}, ${settlement.toUserId}: ${balances[settlement.toUserId] || 0}`);
		console.log(`Adjusting for completed settlement: ${settlement.fromUserId} paid ${settlement.toUserId} ${settlement.amount}`);
		
		// The debtor (fromUserId) has already paid, so reduce their debt
		balances[settlement.fromUserId] = (balances[settlement.fromUserId] || 0) - settlement.amount;
		// The creditor (toUserId) has already received, so reduce their credit
		balances[settlement.toUserId] = (balances[settlement.toUserId] || 0) + settlement.amount;
		
		console.log(`After adjustment - ${settlement.fromUserId}: ${balances[settlement.fromUserId]}, ${settlement.toUserId}: ${balances[settlement.toUserId]}`);
	});
	
	console.log("Final calculated balances after completed settlements:", balances);
	
	// Show what each user's final balance means
	Object.entries(balances).forEach(([userId, balance]) => {
		if (balance < 0) {
			console.log(`💰 ${userId} should RECEIVE ₹${Math.abs(balance)} (they are owed money)`);
		} else if (balance > 0) {
			console.log(`💸 ${userId} should PAY ₹${balance} (they owe money)`);
		} else {
			console.log(`✅ ${userId} is settled (balance: 0)`);
		}
	});
	
	// Generate optimal settlements (minimize number of transactions)
	const settlements: GroupSettlement[] = [];
	const creditors: Array<{ userId: string; amount: number }> = [];
	const debtors: Array<{ userId: string; amount: number }> = [];
	
	// Separate creditors and debtors
	Object.entries(balances).forEach(([userId, balance]) => {
		console.log(`User ${userId} balance: ${balance}`);
		if (balance < 0) {
			creditors.push({ userId, amount: Math.abs(balance) });
			console.log(`Added creditor: ${userId} should receive ${Math.abs(balance)}`);
		} else if (balance > 0) {
			debtors.push({ userId, amount: balance });
			console.log(`Added debtor: ${userId} owes ${balance}`);
		}
	});
	
	console.log("Creditors:", creditors);
	console.log("Debtors:", debtors);
	
	// Create settlements
	let creditorIndex = 0;
	let debtorIndex = 0;
	
	console.log("Starting settlement creation loop...");
	console.log("Creditors to process:", creditors);
	console.log("Debtors to process:", debtors);
	
	while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
		const creditor = creditors[creditorIndex];
		const debtor = debtors[debtorIndex];
		
		const settlementAmount = Math.min(creditor.amount, debtor.amount);
		
		console.log(`Creating settlement: ${debtor.userId} owes ${creditor.userId} ${settlementAmount}`);
		
		const settlementId = `${groupId}_${debtor.userId}_${creditor.userId}`;
		console.log(`Settlement ID: ${settlementId}`);
		
		settlements.push({
			id: settlementId,
			groupId,
			fromUserId: debtor.userId,
			toUserId: creditor.userId,
			amount: settlementAmount,
			status: "pending",
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});
		
		creditor.amount -= settlementAmount;
		debtor.amount -= settlementAmount;
		
		console.log(`After settlement: creditor ${creditor.userId} remaining: ${creditor.amount}, debtor ${debtor.userId} remaining: ${debtor.amount}`);
		
		if (creditor.amount === 0) creditorIndex++;
		if (debtor.amount === 0) debtorIndex++;
	}
	
	console.log("Final settlements created:", settlements);
	
	return settlements;
}

export async function createGroupSettlements(groupId: string): Promise<GroupSettlement[]> {
	console.log("Creating settlements for group:", groupId);
	
	// Get existing settlements to preserve completed ones
	const existingSettlementsQuery = query(
		collection(db(), "groupSettlements"),
		where("groupId", "==", groupId)
	);
	const existingSettlements = await getDocs(existingSettlementsQuery);
	
	console.log("Found existing settlements:", existingSettlements.docs.length);
	
	// Separate completed and pending settlements
	const completedSettlements: GroupSettlement[] = [];
	const pendingSettlements: GroupSettlement[] = [];
	
	existingSettlements.docs.forEach(doc => {
		const settlement = { id: doc.id, ...doc.data() } as GroupSettlement;
		console.log(`Processing existing settlement: ${settlement.id} - status: ${settlement.status}`);
		console.log(`Settlement data:`, settlement);
		if (settlement.status === "completed") {
			completedSettlements.push(settlement);
			console.log(`Added to completed settlements: ${settlement.id}`);
		} else {
			pendingSettlements.push(settlement);
			console.log(`Added to pending settlements: ${settlement.id}`);
		}
	});
	
	console.log("Completed settlements to preserve:", completedSettlements.length);
	console.log("Pending settlements to delete:", pendingSettlements.length);
	
	// Don't delete pending settlements yet - we'll check them later to avoid duplicates
	console.log("Keeping pending settlements for duplicate check");
	
	// Calculate new settlements (this will exclude completed settlements from calculation)
	const newSettlements = await calculateGroupSettlements(groupId);
	console.log("Calculated new settlements:", newSettlements);
	
	// Save new settlements to database
	const savedSettlements: GroupSettlement[] = [...completedSettlements]; // Start with completed ones
	
	for (const settlement of newSettlements) {
		try {
			// Check if this settlement already exists as completed
			const existingCompleted = completedSettlements.find(cs => cs.id === settlement.id);
			if (existingCompleted) {
				// If the amount has changed, create a new settlement for the current balance
				if (existingCompleted.amount !== settlement.amount) {
					console.log(`Settlement amount changed from ${existingCompleted.amount} to ${settlement.amount} for ${settlement.id}`);
					console.log("Creating new pending settlement for current balance");
					
					// Check if a pending settlement already exists for this amount and users
					const existingPending = pendingSettlements.find(ps => 
						ps.fromUserId === settlement.fromUserId && 
						ps.toUserId === settlement.toUserId && 
						ps.amount === settlement.amount &&
						ps.status === "pending"
					);
					
					if (existingPending) {
						console.log("Pending settlement already exists for this amount, preserving it:", existingPending.id);
						savedSettlements.push(existingPending);
					} else {
						// Create a new settlement with a unique ID for the current balance
						const newSettlementId = `${settlement.id}_${Date.now()}`;
						const newSettlement = {
							...settlement,
							id: newSettlementId,
							status: "pending" as const,
							createdAt: Date.now(),
							updatedAt: Date.now(),
						};
						
						console.log("Creating new settlement for current balance:", newSettlement);
						const newSettlementRef = doc(db(), "groupSettlements", newSettlementId);
						await setDoc(newSettlementRef, newSettlement);
						savedSettlements.push(newSettlement);
					}
				} else {
					console.log("Settlement amount unchanged, preserving existing completed settlement:", settlement.id);
					savedSettlements.push(existingCompleted);
				}
			} else {
				// Check if a pending settlement already exists for this exact settlement
				const existingPending = pendingSettlements.find(ps => 
					ps.fromUserId === settlement.fromUserId && 
					ps.toUserId === settlement.toUserId && 
					ps.amount === settlement.amount &&
					ps.status === "pending"
				);
				
				if (existingPending) {
					console.log("Pending settlement already exists, preserving it:", existingPending.id);
					savedSettlements.push(existingPending);
				} else {
					console.log("Creating new settlement:", settlement.id);
					const settlementRef = doc(db(), "groupSettlements", settlement.id);
					await setDoc(settlementRef, settlement);
					savedSettlements.push(settlement);
				}
			}
		} catch (error) {
			console.error("Error creating settlement:", error);
		}
	}
	
	// Clean up any pending settlements that are no longer needed
	const finalSettlementIds = savedSettlements.map(s => s.id);
	for (const pendingSettlement of pendingSettlements) {
		if (!finalSettlementIds.includes(pendingSettlement.id)) {
			console.log("Deleting obsolete pending settlement:", pendingSettlement.id);
			const settlementRef = doc(db(), "groupSettlements", pendingSettlement.id);
			await deleteDoc(settlementRef);
		}
	}
	
	console.log("Final saved settlements (completed + new):", savedSettlements.length);
	return savedSettlements;
}

export async function getGroupSettlements(groupId: string): Promise<GroupSettlement[]> {
	console.log("Loading settlements for group:", groupId);
	
	const q = query(
		collection(db(), "groupSettlements"),
		where("groupId", "==", groupId)
	);
	
	const results = await getDocs(q);
	const settlements = results.docs.map((d) => ({ id: d.id, ...d.data() })) as GroupSettlement[];
	
	console.log("Loaded settlements from database:", settlements);
	settlements.forEach(settlement => {
		console.log(`Settlement: ${settlement.id} - ${settlement.fromUserId} -> ${settlement.toUserId} ${settlement.amount} (${settlement.status})`);
	});
	return settlements;
}

export async function markSettlementComplete(
	settlementId: string, 
	walletType: "cash" | "gpay" = "cash",
	notes?: string
): Promise<void> {
	console.log("Starting settlement completion for ID:", settlementId);
	
	try {
		// Get the settlement details
		console.log("Getting settlement document...");
		const settlementRef = doc(db(), "groupSettlements", settlementId);
		console.log("Settlement ref:", settlementRef.path);
		
		const settlementSnap = await getDoc(settlementRef);
		console.log("Settlement snap exists:", settlementSnap.exists());
		
		if (!settlementSnap.exists()) {
			throw new Error("Settlement not found");
		}
		
		const settlement = settlementSnap.data() as GroupSettlement;
		console.log("Settlement data:", settlement);
		console.log("Settlement groupId:", settlement.groupId);
		console.log("Settlement fromUserId:", settlement.fromUserId);
		console.log("Settlement toUserId:", settlement.toUserId);
		
		// Mark settlement as complete (minimal approach - just update status)
		console.log("Updating settlement status...");
		await updateDoc(settlementRef, {
			status: "completed",
			completedAt: Date.now(),
			updatedAt: Date.now(),
		});
		
		console.log("Settlement completed successfully!");
		
		// Create transaction record for the debtor (this should always work)
		try {
			console.log("Creating transaction record...");
			
			// Fetch user names for better transaction descriptions
			const userNames = await getUserNames([settlement.toUserId]);
			const toUserName = userNames[settlement.toUserId] || `User ${settlement.toUserId.slice(-4)}`;
			
			const debtorTransaction: Omit<Transaction, "id"> = {
				userId: settlement.fromUserId,
				amount: settlement.amount,
				category: "settlement",
				wallet: walletType,
				type: "expense",
				item: `Settlement payment to ${toUserName}`,
				notes: notes || "Group settlement payment",
				date: Date.now(),
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};
			
			await addDoc(collection(db(), "transactions"), debtorTransaction);
			console.log("Transaction record created successfully!");
			
			// Add wallet history record
			const debtorHistory: Omit<WalletHistory, "id"> = {
				userId: settlement.fromUserId,
				wallet: walletType,
				amount: -settlement.amount,
				reason: `Settlement payment to ${toUserName}: ${notes || "Group settlement"}`,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};
			
			await addDoc(collection(db(), "walletHistory"), debtorHistory);
			console.log("Wallet history record created successfully!");
		} catch (transactionError) {
			console.warn("Transaction creation failed:", transactionError);
		}
		
		// Try wallet operations as a separate step (optional)
		try {
			console.log("Attempting wallet operations...");
			const debtorWallet = await getOrCreateWallet(settlement.fromUserId, walletType);
			console.log("Debtor wallet:", debtorWallet);
			
			// Always update the wallet balance, even if it goes negative
			await updateDoc(doc(db(), "wallets", `${settlement.fromUserId}_${walletType}`), {
				balance: increment(-settlement.amount),
				updatedAt: Date.now(),
			});
			
			const newBalance = debtorWallet.balance - settlement.amount;
			if (newBalance < 0) {
				console.warn(`Wallet balance went negative: ₹${newBalance}. User should be notified.`);
			} else {
				console.log("Wallet updated successfully!");
			}
		} catch (walletError) {
			console.warn("Wallet operations failed:", walletError);
		}
		
	} catch (error) {
		console.error("Error in markSettlementComplete:", error);
		throw error;
	}
}

// User Name Functions
export async function setUserName(userId: string, displayName: string): Promise<void> {
	const userNameData: Omit<UserName, "id"> = {
		userId,
		displayName,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};
	
	const ref = doc(db(), "userNames", userId);
	await setDoc(ref, userNameData, { merge: true });
}

export async function getUserName(userId: string): Promise<string | null> {
	try {
		const ref = doc(db(), "userNames", userId);
		const snap = await getDoc(ref);
		if (!snap.exists()) return null;
		const data = snap.data() as UserName;
		return data.displayName;
	} catch (error) {
		console.error("Error getting user name:", error);
		return null;
	}
}

export async function getUserNames(userIds: string[]): Promise<Record<string, string>> {
	if (userIds.length === 0) return {};
	
	const names: Record<string, string> = {};
	
	// Firestore 'in' queries are limited to 10 items, so we need to batch them
	const batchSize = 10;
	for (let i = 0; i < userIds.length; i += batchSize) {
		const batch = userIds.slice(i, i + batchSize);
		const q = query(collection(db(), "userNames"), where("userId", "in", batch));
		const results = await getDocs(q);
		
		results.docs.forEach((doc) => {
			const data = doc.data() as UserName;
			names[data.userId] = data.displayName;
		});
	}
	
	return names;
}

