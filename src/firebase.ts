import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, type User } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCq4CVyeUN_VyOjOL24GLdmEJWJS6toYKI",
  authDomain: "db-fg-9608f.firebaseapp.com",
  projectId: "db-fg-9608f",
  storageBucket: "db-fg-9608f.firebasestorage.app",
  messagingSenderId: "635517470184",
  appId: "1:635517470184:web:ddbe490fafca9ac5c7505d",
  measurementId: "G-XZ96NX6KB8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

let authPromise: Promise<User> | null = null;
export function getFirebaseUser(): Promise<User> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  if (!authPromise) {
    authPromise = signInAnonymously(auth).then(result => result.user).catch(error => {
      authPromise = null;
      throw error;
    });
  }
  return authPromise;
}
