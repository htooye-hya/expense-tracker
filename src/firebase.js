import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA5Y4d1vvB8npLOHl6vuFcuE3yYO4sE2Wg",
  authDomain: "my-expense-tracker-b887c.firebaseapp.com",
  projectId: "my-expense-tracker-b887c",
  storageBucket: "my-expense-tracker-b887c.firebasestorage.app",
  messagingSenderId: "535161053730",
  appId: "1:535161053730:web:9278fb2c78d5813fe7a07b",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
