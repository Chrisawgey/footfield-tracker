// src/pages/login.js
import { auth, googleProvider } from "../lib/firebase";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Navigation from "../components/Navigation";
import Head from "next/head";

export default function Login({ user }) {
  const router = useRouter();
  const { redirect } = router.query;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect to home if already logged in
  useEffect(() => {
    if (user) {
      if (redirect) {
        router.push(redirect);
      } else {
        router.push("/");
      }
    }
  }, [user, router, redirect]);

  const handleRedirect = () => {
    if (redirect) {
      router.push(redirect);
    } else {
      router.push("/");
    }
  };

  const signInWithGoogle = async () => {
    try {
      setIsLoading(true);
      setError("");
      await signInWithPopup(auth, googleProvider);
      handleRedirect();
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      handleRedirect();
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  // Don't render login page if already authenticated
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>{isSignUp ? "Sign Up" : "Login"} | Footy Tracker</title>
      </Head>
      <Navigation user={user} />
      
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)] px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-800 to-green-600 p-6 text-center">
              <h1 className="text-white text-2xl font-bold">
                {isSignUp ? "Create an Account" : "Welcome Back"}
              </h1>
              <p className="text-green-100 mt-1">
                {isSignUp ? "Join the Footy Tracker community" : "Sign in to continue to Footy Tracker"}
              </p>
            </div>
            
            {/* Body */}
            <div className="p-6">
              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-6 text-sm border border-red-100">
                  {error}
                </div>
              )}
              
              <button 
                onClick={signInWithGoogle}
                disabled={isLoading}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 mb-6 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-70"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 mr-2" />
                <span className="font-medium">{isSignUp ? "Sign up with Google" : "Sign in with Google"}</span>
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-white text-gray-500 text-sm">or continue with email</span>
                </div>
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <input 
                    type="email" 
                    placeholder="you@example.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" 
                    required
                  />
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">Password</label>
                    {!isSignUp && (
                      <a href="#" className="text-sm text-green-600 hover:text-green-800">Forgot password?</a>
                    )}
                  </div>
                  <input 
                    type="password" 
                    placeholder={isSignUp ? "Create a password" : "Enter your password"} 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" 
                    required
                  />
                </div>
                
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-70"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      {isSignUp ? "Creating Account..." : "Signing In..."}
                    </div>
                  ) : (
                    isSignUp ? "Create Account" : "Sign In"
                  )}
                </button>
              </form>
            </div>
            
            {/* Footer */}
            <div className="bg-gray-50 p-6 border-t border-gray-100 text-center">
              <button 
                onClick={() => setIsSignUp(!isSignUp)} 
                className="text-green-600 hover:text-green-800 font-medium text-sm"
              >
                {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </button>
            </div>
          </div>
          
          {/* Redirect message */}
          {redirect && (
            <div className="mt-4 text-center text-sm text-gray-600">
              You'll be redirected back to your previous page after login.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}