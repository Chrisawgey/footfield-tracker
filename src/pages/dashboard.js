import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { auth } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) router.push("/login");
      else setUser(user);
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div>
      <h1>Dashboard</h1>
      {user && (
        <>
          <p>Welcome, {user.displayName || user.email}!</p>
          <button onClick={() => signOut(auth)}>Logout</button>
        </>
      )}
    </div>
  );
}
