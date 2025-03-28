// src/components/Navigation.js
import Link from "next/link";
import { useRouter } from "next/router";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useState, useEffect } from "react";

// Admin emails - should match across all files
const ADMIN_EMAILS = [
  "chrisvpopoca@gmail.com",
];

export default function Navigation({ user }) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (user) {
      // Case-insensitive check for admin email
      setIsAdmin(ADMIN_EMAILS.some(email => 
        email.toLowerCase() === user.email?.toLowerCase()
      ));
    } else {
      setIsAdmin(false);
    }
  }, [user]);

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
        {/* Make the logo/name clickable with a Link to home */}
        <Link href="/" className="font-bold text-xl hover:text-gray-300">
          Footy Tracker
        </Link>
        
        {/* Mobile menu button */}
        <button 
          className="md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7"></path>
          </svg>
        </button>

        {/* Desktop navigation */}
        <div className="hidden md:flex space-x-4">
          {user ? (
            <>
              <Link href="/" className="hover:text-gray-300">Home</Link>
              <Link href="/dashboard" className="hover:text-gray-300">Dashboard</Link>
              <Link href="/suggest-field" className="hover:text-gray-300">Suggest Field</Link>
              
              {/* Only show Admin link to admin users */}
              {isAdmin && (
                <Link href="/admin" className="hover:text-gray-300">Admin</Link>
              )}
              
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

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden pt-4">
          <div className="flex flex-col space-y-3">
            {user ? (
              <>
                <Link href="/" className="hover:text-gray-300 py-1">Home</Link>
                <Link href="/dashboard" className="hover:text-gray-300 py-1">Dashboard</Link>
                <Link href="/suggest-field" className="hover:text-gray-300 py-1">Suggest Field</Link>
                
                {/* Only show Admin link to admin users in mobile menu too */}
                {isAdmin && (
                  <Link href="/admin" className="hover:text-gray-300 py-1">Admin</Link>
                )}
                
                <button 
                  onClick={handleLogout}
                  className="hover:text-gray-300 text-left py-1"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link href="/login" className="hover:text-gray-300 py-1">Login</Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}