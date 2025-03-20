import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useRouter } from "next/router";
import "@/styles/globals.css";

export default function App({ Component, pageProps }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // List of public routes that don't require authentication
  const publicRoutes = ['/login'];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      
      // If no user and not on a public route, redirect to login
      if (!user && !publicRoutes.includes(router.pathname)) {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Loading screen while checking authentication
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // If not logged in and not on a public route, don't render anything (redirect will happen)
  if (!user && !publicRoutes.includes(router.pathname)) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Pass the user to all pages
  return <Component {...pageProps} user={user} />;
}