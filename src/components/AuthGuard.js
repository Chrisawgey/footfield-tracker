// src/components/AuthGuard.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";

export default function AuthGuard({ children }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthenticated(true);
      } else {
        // Store the current path to redirect back after login
        router.push("/login?redirect=" + encodeURIComponent(router.pathname));
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return authenticated ? children : null;
}