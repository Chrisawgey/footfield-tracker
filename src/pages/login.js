import { auth, googleProvider } from "../lib/firebase";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Navigation from "../components/Navigation";

export default function Login({ user }) {
  const router = useRouter();
  const { redirect } = router.query;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

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
      await signInWithPopup(auth, googleProvider);
      handleRedirect();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError("");
    
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      handleRedirect();
    } catch (err) {
      setError(err.message);
    }
  };

  // Don't render login page if already authenticated
  if (user) {
    return null;
  }

  return (
    <div>
      <Navigation user={user} />
      <div className="container mx-auto max-w-md p-4">
        <h1 className="text-2xl font-bold mb-6">{isSignUp ? "Sign Up" : "Login"}</h1>
        <p className="mb-4">Sign in to access Footy Tracker's features</p>
        
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {error}
          </div>
        )}

        <button 
          onClick={signInWithGoogle}
          className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 mb-4 flex items-center justify-center"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 mr-2" />
          <span>{isSignUp ? "Sign up with Google" : "Sign in with Google"}</span>
        </button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="px-2 bg-white text-gray-500">or</span>
          </div>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input 
              type="email" 
              placeholder="Your email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded p-2" 
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input 
              type="password" 
              placeholder="Your password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded p-2" 
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="w-full bg-blue-500 hover:bg-blue-600 text-black font-medium py-2 px-4 rounded"
          >
            {isSignUp ? "Sign Up" : "Login"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsSignUp(!isSignUp)} 
            className="text-blue-500 hover:underline"
          >
            {isSignUp ? "Already have an account? Login" : "Need an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}