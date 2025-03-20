import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyASZu8Xxpdv5PRRhkCIpsMqbuqoiVNL6ic",
  authDomain: "field-heatmap.firebaseapp.com",
  projectId: "field-heatmap",
  storageBucket: "field-heatmap.firebasestorage.app",
  messagingSenderId: "493975986036",
  appId: "1:493975986036:web:93b4abfff9cfa94eb31621",
  measurementId: "G-WBYBEJTY0L",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { auth, googleProvider, db };
