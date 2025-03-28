// src/pages/suggest-field.js
import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/router";
import Navigation from "../components/Navigation";
import Head from "next/head";
import { onAuthStateChanged } from "firebase/auth";

export default function SuggestField() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [surface, setSurface] = useState("grass");
  const [amenities, setAmenities] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setInitialLoad(false);
    });
    
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!user) {
      router.push("/login?redirect=/suggest-field");
      return;
    }

    try {
      // Form validation
      if (!name.trim() || !address.trim()) {
        throw new Error("Field name and address are required");
      }

      // Convert amenities string to array
      const amenitiesArray = amenities
        .split(",")
        .map(item => item.trim())
        .filter(item => item !== "");

      // Add suggestion to Firestore - no need for coordinates
      await addDoc(collection(db, "field-suggestions"), {
        name: name.trim(),
        address: address.trim(),
        surface,
        amenities: amenitiesArray,
        status: "pending", // Initial status
        submittedBy: user.uid,
        submitterEmail: user.email,
        timestamp: serverTimestamp()
      });

      setMessage("Thank you for your suggestion! It has been submitted for review.");
      
      // Clear form
      setName("");
      setAddress("");
      setSurface("grass");
      setAmenities("");
      
      // Redirect after 3 seconds
      setTimeout(() => {
        router.push("/");
      }, 3000);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Show loading indicator during auth check
  if (initialLoad) {
    return (
      <div>
        <Head>
          <title>Suggest a Soccer Field | Footy Tracker</title>
        </Head>
        <Navigation user={user} />
        <div className="container mx-auto p-4">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return (
      <div>
        <Head>
          <title>Login Required | Footy Tracker</title>
        </Head>
        <Navigation user={user} />
        <div className="container mx-auto p-4 max-w-lg">
          <div className="bg-yellow-100 p-4 rounded-lg">
            <h1 className="text-xl font-bold mb-2">Login Required</h1>
            <p className="mb-4">You must be logged in to suggest a field.</p>
            <button
              onClick={() => router.push("/login?redirect=/suggest-field")}
              className="mt-2 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
            >
              Log in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Head>
        <title>Suggest a Soccer Field | Footy Tracker</title>
      </Head>
      <Navigation user={user} />
      <div className="container mx-auto p-4 max-w-lg">
        <h1 className="text-2xl font-bold mb-6">Suggest a Soccer Field</h1>
        <p className="mb-4">
          Help grow our database by suggesting soccer fields in your area. 
          All suggestions will be reviewed by our team before being added.
        </p>
        
        {message && (
          <div className={`p-4 rounded-lg mb-4 ${message.startsWith("Error") 
            ? "bg-red-100 text-red-700" 
            : "bg-green-100 text-green-700"}`}
          >
            {message}
          </div>
        )}
        
        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Field Name*</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className="w-full border rounded p-2"
                required
                placeholder="e.g. Central Park Soccer Field"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Address*</label>
              <input 
                type="text" 
                value={address} 
                onChange={(e) => setAddress(e.target.value)}
                className="w-full border rounded p-2"
                required
                placeholder="e.g. 123 Main St, City, State, ZIP"
              />
              <p className="text-xs text-gray-500 mt-1">
                Please provide as detailed an address as possible to help us locate the field
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Surface Type</label>
              <select
                value={surface}
                onChange={(e) => setSurface(e.target.value)}
                className="w-full border rounded p-2"
              >
                <option value="grass">Grass</option>
                <option value="turf">Artificial Turf</option>
                <option value="dirt">Dirt</option>
                <option value="indoor">Indoor</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Amenities (comma-separated)</label>
              <input 
                type="text" 
                value={amenities} 
                onChange={(e) => setAmenities(e.target.value)}
                className="w-full border rounded p-2"
                placeholder="e.g. parking, lights, bathrooms, bleachers"
              />
              <p className="text-xs text-gray-500 mt-1">
                List any amenities available at this field
              </p>
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit Suggestion"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}