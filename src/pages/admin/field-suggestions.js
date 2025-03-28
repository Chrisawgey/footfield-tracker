// src/pages/admin/field-suggestions.js
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, getDocs, doc, updateDoc, query, where, orderBy, deleteDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/router";
import Navigation from "../../components/Navigation";

// List of admin emails - in a real app, this would be handled with proper authorization in Firebase
const ADMIN_EMAILS = [
  "admin@example.com",  // Replace with your admin email
];

export default function FieldSuggestions({ user }) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if user is authenticated and is an admin
    if (!user) {
      router.push("/login?redirect=/admin/field-suggestions");
      return;
    }

    // Check if user has admin privileges
    const userIsAdmin = ADMIN_EMAILS.includes(user.email);
    setIsAdmin(userIsAdmin);

    if (!userIsAdmin) {
      setMessage("You don't have permission to access this page.");
      setLoading(false);
      return;
    }

    fetchSuggestions();
  }, [user, router]);

  const fetchSuggestions = async () => {
    try {
      const suggestionsRef = collection(db, "field-suggestions");
      const q = query(suggestionsRef, orderBy("timestamp", "desc"));
      const querySnapshot = await getDocs(q);
      
      const fetchedSuggestions = [];
      querySnapshot.forEach((doc) => {
        fetchedSuggestions.push({
          id: doc.id,
          ...doc.data(),
          // Convert Firebase timestamp to JS Date for display
          timestamp: doc.data().timestamp?.toDate() || new Date()
        });
      });
      
      setSuggestions(fetchedSuggestions);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      setMessage("Error loading suggestions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (suggestion) => {
    try {
      // 1. Add to fields collection
      await addDoc(collection(db, "fields"), {
        name: suggestion.name,
        address: suggestion.address,
        surface: suggestion.surface || "grass",
        amenities: suggestion.amenities || [],
        currentTraffic: "unknown",
        createdAt: serverTimestamp(),
        approvedBy: user.uid,
        suggestionId: suggestion.id
      });
      
      // 2. Update suggestion status
      await updateDoc(doc(db, "field-suggestions", suggestion.id), {
        status: "approved",
        processedBy: user.uid,
        processedAt: serverTimestamp()
      });
      
      setMessage("Field approved and added to database.");
      fetchSuggestions(); // Refresh the list
    } catch (error) {
      console.error("Error approving field:", error);
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleReject = async (suggestionId) => {
    try {
      // Update suggestion status
      await updateDoc(doc(db, "field-suggestions", suggestionId), {
        status: "rejected",
        processedBy: user.uid,
        processedAt: serverTimestamp()
      });
      
      setMessage("Field suggestion rejected.");
      fetchSuggestions(); // Refresh the list
    } catch (error) {
      console.error("Error rejecting field:", error);
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleDelete = async (suggestionId) => {
    if (window.confirm("Are you sure you want to delete this suggestion? This cannot be undone.")) {
      try {
        await deleteDoc(doc(db, "field-suggestions", suggestionId));
        setMessage("Suggestion deleted successfully.");
        fetchSuggestions(); // Refresh the list
      } catch (error) {
        console.error("Error deleting suggestion:", error);
        setMessage(`Error: ${error.message}`);
      }
    }
  };

  if (loading) {
    return (
      <div>
        <Navigation user={user} />
        <div className="container mx-auto p-4">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div>
        <Navigation user={user} />
        <div className="container mx-auto p-4">
          <div className="bg-red-100 p-4 rounded-lg">
            <h1 className="text-xl font-bold mb-2">Access Denied</h1>
            <p>{message}</p>
            <button
              onClick={() => router.push("/")}
              className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation user={user} />
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-2">Admin - Field Suggestions</h1>
        <p className="mb-4">Review and approve community-submitted soccer fields</p>

        {message && (
          <div className="p-4 bg-blue-100 rounded-lg mb-4">
            {message}
          </div>
        )}

        {suggestions.length === 0 ? (
          <div className="bg-gray-100 p-6 rounded-lg text-center">
            <p>No field suggestions to review at this time.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="divide-y divide-gray-200">
              {suggestions
                .filter(s => s.status === "pending") // Show pending suggestions first
                .concat(suggestions.filter(s => s.status !== "pending")) // Then others
                .map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className={`p-6 ${
                      suggestion.status === "approved" 
                        ? "bg-green-50" 
                        : suggestion.status === "rejected" 
                        ? "bg-red-50" 
                        : "bg-white"
                    }`}
                  >
                    <div className="flex justify-between">
                      <div>
                        <h3 className="font-bold text-lg">{suggestion.name}</h3>
                        <p className="text-gray-600">{suggestion.address}</p>
                        
                        <div className="mt-2">
                          <span className={`inline-block px-2 py-1 text-xs rounded-full mr-2 ${
                            suggestion.status === "pending" 
                              ? "bg-yellow-100 text-yellow-800" 
                              : suggestion.status === "approved" 
                              ? "bg-green-100 text-green-800" 
                              : "bg-red-100 text-red-800"
                          }`}>
                            {suggestion.status.charAt(0).toUpperCase() + suggestion.status.slice(1)}
                          </span>
                          
                          <span className="text-xs text-gray-500">
                            Submitted: {suggestion.timestamp.toLocaleString()}
                          </span>
                        </div>
                        
                        <div className="mt-2 text-sm">
                          <p><strong>Surface:</strong> {suggestion.surface || "Not specified"}</p>
                          {suggestion.amenities && suggestion.amenities.length > 0 && (
                            <p><strong>Amenities:</strong> {suggestion.amenities.join(", ")}</p>
                          )}
                          <p><strong>Submitter:</strong> {suggestion.submitterEmail}</p>
                        </div>
                      </div>
                      
                      {suggestion.status === "pending" && (
                        <div className="flex flex-col space-y-2">
                          <button
                            onClick={() => handleApprove(suggestion)}
                            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(suggestion.id)}
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      
                      <button
                        onClick={() => handleDelete(suggestion.id)}
                        className="text-red-600 hover:text-red-800 text-sm ml-2 self-start"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}