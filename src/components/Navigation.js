// src/components/Navigation.js
import Link from "next/link";
import { useRouter } from "next/router";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

export default function Navigation({ user }) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login"); // Redirect to login page after logout
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  return (
    <nav className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="font-bold text-xl">Footy Tracker</div>
        <div className="space-x-4">
          {user ? (
            <>
              <Link href="/" className="hover:text-gray-300">Home</Link>
              <Link href="/dashboard" className="hover:text-gray-300">Dashboard</Link>
              <button 
                onClick={handleLogout}
                className="hover:text-gray-300"
              >
                Logout
              </button>
            </>
          ) : (
            <Link href="/login" className="hover:text-gray-300">Login</Link>
          )}
        </div>
      </div>
    </nav>
  );
}