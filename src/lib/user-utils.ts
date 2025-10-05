import { User } from "firebase/auth";

// Extract name from email (e.g., "john.doe@gmail.com" -> "John Doe")
export function extractNameFromEmail(email: string): string {
	const localPart = email.split('@')[0];
	const nameParts = localPart.split(/[._-]/);
	const capitalizedParts = nameParts.map(part => 
		part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
	);
	return capitalizedParts.join(' ');
}

// Get display name for a user, with fallbacks
export function getUserDisplayName(user: User | null): string {
	if (!user) return "Unknown User";
	
	// Use display name if available
	if (user.displayName) return user.displayName;
	
	// Extract name from email
	if (user.email) return extractNameFromEmail(user.email);
	
	// Final fallback
	return "User";
}

// Get display name for any user ID (for group members)
export function getUserDisplayNameById(userId: string, currentUser: User | null, storedNames?: Record<string, string>): string {
	// If it's the current user, use their display name
	if (userId === currentUser?.uid) {
		return getUserDisplayName(currentUser);
	}
	
	// Check if we have a stored name for this user
	if (storedNames && storedNames[userId]) {
		return storedNames[userId];
	}
	
	// Final fallback
	return `User ${userId.slice(-4)}`;
}
