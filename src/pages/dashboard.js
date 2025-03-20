import { useState, useEffect } from "react";
import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";
import AuthGuard from "../components/AuthGuard";

export default function Dashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthGuard>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        {user && (
          <>
            <p className="mb-4">Welcome, {user.displayName || user.email}!</p>
            <button 
              onClick={() => signOut(auth)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </AuthGuard>
  );
}