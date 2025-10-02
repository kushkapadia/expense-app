"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

let firebaseApp: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let googleProvider: GoogleAuthProvider | null = null;

function getFirebaseConfig() {
	const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
	const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
	const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
	const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
	const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
	const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
	const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

	const missing: string[] = [];
	if (!apiKey) missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
	if (!authDomain) missing.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
	if (!projectId) missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
	if (!storageBucket) missing.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
	if (!messagingSenderId) missing.push("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
	if (!appId) missing.push("NEXT_PUBLIC_FIREBASE_APP_ID");
	if (missing.length) {
		throw new Error(
			`Missing Firebase env: ${missing.join(", ")}. Add them to .env.local and restart dev server.`
		);
	}

	return {
		apiKey,
		authDomain,
		projectId,
		storageBucket,
		messagingSenderId,
		appId,
		measurementId,
	} as const;
}

export function getFirebaseApp(): FirebaseApp {
	if (!firebaseApp) {
		const config = getFirebaseConfig();
		firebaseApp = getApps().length ? getApps()[0]! : initializeApp(config);
	}
	return firebaseApp;
}

export function getFirebaseAuth(): Auth {
	if (!authInstance) {
		authInstance = getAuth(getFirebaseApp());
	}
	return authInstance;
}

export function getFirestoreDb(): Firestore {
	if (!dbInstance) {
		dbInstance = getFirestore(getFirebaseApp());
	}
	return dbInstance;
}

export function getGoogleProvider(): GoogleAuthProvider {
	if (!googleProvider) {
		googleProvider = new GoogleAuthProvider();
	}
	return googleProvider;
}
