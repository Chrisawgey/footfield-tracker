// src/pages/admin.js
import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, where, orderBy } from "firebase/firestore";
import { useRouter } from "next/router";
import { onAuthStateChanged } from "firebase/auth";
import Navigation from "../components/Navigation";
import Head from "next/head";

// Admin emails - should be moved to a secure environment variable in production
const ADMIN_EMAILS = [
  "chrisvpopoca@gmail.com",
];

export default function Admin() {
  const router = useRouter();
  // State for adding fields
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [surface, setSurface] = useState("grass");
  const [amenities, setAmenities] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  
  // State for field suggestions
  const [suggestions, setSuggestions] = useState([]);
  const [activeTab, setActiveTab] = useState("suggestions"); // 'suggestions', 'add-field', or 'manage-fields'
  const [isAdmin, setIsAdmin] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  
  // For existing fields management
  const [existingFields, setExistingFields] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login?redirect=/admin");
        return;
      } 
      
      setUser(user);
      // Check if user is an admin - case-insensitive check
      const userIsAdmin = user && user.email && 
        ADMIN_EMAILS.some(email => 
          email.toLowerCase() === user.email.toLowerCase()
        );
        
      setIsAdmin(userIsAdmin);
      
      if (userIsAdmin) {
        // Fetch field suggestions
        fetchSuggestions();
      }
      
      setInitialLoad(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Function to convert address to coordinates using geocoding API
  const geocodeAddress = async (address) => {
    try {
      // Using OpenStreetMap Nominatim (free, doesn't require API key)
      // For production, consider using Google Maps or Mapbox with proper API keys
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon)
        };
      } else {
        throw new Error("Could not geocode address. Please try a more specific address.");
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      throw new Error(`Could not convert address to coordinates: ${error.message}`);
    }
  };

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      const suggestionsRef = collection(db, "field-suggestions");
      const q = query(
        suggestionsRef, 
        orderBy("timestamp", "desc")
      );
      
      const querySnapshot = await getDocs(q);
      const suggestions = [];
      querySnapshot.forEach((doc) => {
        suggestions.push({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
        });
      });
      
      setSuggestions(suggestions);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      setMessage("Error loading suggestions. Please try refreshing the page.");
    } finally {
      setLoading(false);
    }
  };
  
  const fetchExistingFields = async () => {
    try {
      setLoading(true);
      const fieldsRef = collection(db, "fields");
      const q = query(fieldsRef, orderBy("name"));
      
      const querySnapshot = await getDocs(q);
      const fields = [];
      querySnapshot.forEach((doc) => {
        fields.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        });
      });
      
      setExistingFields(fields);
    } catch (error) {
      console.error("Error fetching fields:", error);
      setMessage("Error loading fields. Please try refreshing the page.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // Form validation
      if (!name.trim() || !address.trim()) {
        throw new Error("Name and address are required");
      }

      // Convert amenities string to array
      const amenitiesArray = amenities
        .split(",")
        .map(item => item.trim())
        .filter(item => item !== "");

      // Try to geocode the address
      let coordinates = {};
      try {
        coordinates = await geocodeAddress(address.trim());
        setMessage("Successfully geocoded address to coordinates!");
      } catch (geocodeError) {
        setMessage(`Warning: Could not geocode address. Field will be added without coordinates.`);
        // Continue without coordinates
      }

      // Add document to Firestore
      const docRef = await addDoc(collection(db, "fields"), {
        name: name.trim(),
        address: address.trim(),
        ...coordinates, // Spread the coordinates (may be empty if geocoding failed)
        surface: surface,
        amenities: amenitiesArray,
        currentTraffic: "unknown",
        createdAt: serverTimestamp(),
        addedBy: user.uid,
        addedByEmail: user.email,
        fromSuggestion: true,
        manuallyAdded: true
      });

      setMessage(`Field added successfully with ID: ${docRef.id}`);
      
      // Clear form
      setName("");
      setAddress("");
      setSurface("grass");
      setAmenities("");
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleApproveSuggestion = async (suggestion) => {
    try {
      setLoading(true);
      setMessage("Processing suggestion...");
      
      // If the suggestion doesn't have coordinates, try to geocode the address
      let coordinates = {};
      if (!suggestion.latitude || !suggestion.longitude) {
        try {
          setMessage("Geocoding address...");
          const geocoded = await geocodeAddress(suggestion.address);
          coordinates = geocoded;
          setMessage(`Successfully geocoded to: ${coordinates.latitude}, ${coordinates.longitude}`);
        } catch (geocodeError) {
          setMessage(`Warning: Could not get coordinates for this address. Approving without location data.`);
          // Continue without coordinates - we'll still approve the field
        }
      } else {
        coordinates = {
          latitude: parseFloat(suggestion.latitude),
          longitude: parseFloat(suggestion.longitude)
        };
      }
      
      // 1. Create a new field from the suggestion with the coordinates
      await addDoc(collection(db, "fields"), {
        name: suggestion.name,
        address: suggestion.address,
        ...coordinates, // Spread the coordinates (may be empty if geocoding failed)
        surface: suggestion.surface || "grass",
        amenities: suggestion.amenities || [],
        currentTraffic: "unknown",
        createdAt: serverTimestamp(),
        approvedBy: user.uid,
        approvedByEmail: user.email,
        fromSuggestion: true,
        suggestionId: suggestion.id
      });
      
      // 2. Update the suggestion status
      await updateDoc(doc(db, "field-suggestions", suggestion.id), {
        status: "approved",
        processedBy: user.uid,
        processedByEmail: user.email,
        processedAt: serverTimestamp(),
        ...(coordinates.latitude && coordinates.longitude ? coordinates : {}) // Add coordinates to suggestion if available
      });
      
      setMessage("Field suggestion approved and added to database!");
      // Refresh suggestions
      fetchSuggestions();
    } catch (error) {
      setMessage(`Error approving suggestion: ${error.message}`);
      console.error("Error approving suggestion:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleRejectSuggestion = async (suggestionId) => {
    try {
      setLoading(true);
      
      // Update suggestion status to rejected
      await updateDoc(doc(db, "field-suggestions", suggestionId), {
        status: "rejected",
        processedBy: user.uid,
        processedByEmail: user.email,
        processedAt: serverTimestamp()
      });
      
      setMessage("Field suggestion rejected.");
      // Refresh suggestions
      fetchSuggestions();
    } catch (error) {
      setMessage(`Error rejecting suggestion: ${error.message}`);
      console.error("Error rejecting suggestion:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteSuggestion = async (suggestionId) => {
    if (window.confirm("Are you sure you want to delete this suggestion? This action cannot be undone.")) {
      try {
        setLoading(true);
        
        // Delete the suggestion
        await deleteDoc(doc(db, "field-suggestions", suggestionId));
        
        setMessage("Suggestion deleted successfully.");
        // Refresh suggestions
        fetchSuggestions();
      } catch (error) {
        setMessage(`Error deleting suggestion: ${error.message}`);
        console.error("Error deleting suggestion:", error);
      } finally {
        setLoading(false);
      }
    }
  };
  
  const markAllFieldsAsSuggested = async () => {
    if (window.confirm("Are you sure you want to mark ALL existing fields as approved suggestions? This helps with the transition to only using suggested fields.")) {
      try {
        setLoading(true);
        
        const fieldsRef = collection(db, "fields");
        const querySnapshot = await getDocs(fieldsRef);
        
        let count = 0;
        for (const docSnapshot of querySnapshot.docs) {
          if (!docSnapshot.data().fromSuggestion) {
            await updateDoc(doc(db, "fields", docSnapshot.id), {
              fromSuggestion: true,
              migratedAt: serverTimestamp(),
              migratedBy: user.uid,
              migratedByEmail: user.email
            });
            count++;
          }
        }
        
        setMessage(`Successfully marked ${count} fields as coming from suggestions.`);
        
        if (activeTab === 'manage-fields') {
          fetchExistingFields();
        }
      } catch (error) {
        console.error("Error marking fields:", error);
        setMessage(`Error: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };
  
  const deleteAllNonSuggestedFields = async () => {
    if (window.confirm("⚠️ DANGER: Are you sure you want to DELETE all fields that were not from suggestions? This cannot be undone!")) {
      if (window.confirm("⚠️ FINAL WARNING: This will permanently delete data. Type 'DELETE' to confirm.")) {
        try {
          setLoading(true);
          
          const fieldsRef = collection(db, "fields");
          const q = query(fieldsRef, where("fromSuggestion", "!=", true));
          const querySnapshot = await getDocs(q);
          
          let count = 0;
          for (const docSnapshot of querySnapshot.docs) {
            await deleteDoc(doc(db, "fields", docSnapshot.id));
            count++;
          }
          
          setMessage(`Successfully deleted ${count} non-suggested fields.`);
          
          if (activeTab === 'manage-fields') {
            fetchExistingFields();
          }
        } catch (error) {
          console.error("Error deleting fields:", error);
          setMessage(`Error: ${error.message}`);
        } finally {
          setLoading(false);
        }
      }
    }
  };

  // Show loading spinner during initial auth check
  if (initialLoad) {
    return (
      <div>
        <Head>
          <title>Admin Dashboard | Footy Tracker</title>
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

  // Show access denied for non-admins
  if (!isAdmin) {
    return (
      <div>
        <Head>
          <title>Access Denied | Footy Tracker</title>
        </Head>
        <Navigation user={user} />
        <div className="container mx-auto p-4">
          <div className="bg-red-100 p-4 rounded-lg">
            <h1 className="text-xl font-bold mb-2">Access Denied</h1>
            <p>You don't have permission to access the admin page.</p>
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
      <Head>
        <title>Admin Dashboard | Footy Tracker</title>
      </Head>
      <Navigation user={user} />
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
        
        {message && (
          <div className={`mt-4 p-4 rounded-lg mb-4 ${
            message.includes("Error") 
              ? "bg-red-100 text-red-700 border border-red-200" 
              : message.includes("Warning")
              ? "bg-yellow-100 text-yellow-700 border border-yellow-200"
              : "bg-green-100 text-green-700 border border-green-200"
          }`}>
            {message}
          </div>
        )}
        
        {/* Tab navigation */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button 
            onClick={() => setActiveTab("suggestions")}
            className={`py-2 px-4 rounded ${activeTab === "suggestions" ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Field Suggestions
            {suggestions.filter(s => s.status === 'pending' || !s.status).length > 0 && (
              <span className="ml-2 inline-block bg-red-500 text-white rounded-full px-2 py-1 text-xs">
                {suggestions.filter(s => s.status === 'pending' || !s.status).length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab("add-field")}
            className={`py-2 px-4 rounded ${activeTab === "add-field" ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Add New Field
          </button>
          <button 
            onClick={() => {
              setActiveTab("manage-fields");
              fetchExistingFields();
            }}
            className={`py-2 px-4 rounded ${activeTab === "manage-fields" ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Manage Fields
          </button>
        </div>
        
        {/* Data transition tools */}
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Data Transition Tools</h2>
          <p className="mb-3 text-sm">Use these tools to transition to using only fields from approved suggestions:</p>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={markAllFieldsAsSuggested}
              disabled={loading}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            >
              Mark All Fields as Approved Suggestions
            </button>
            <button 
              onClick={deleteAllNonSuggestedFields}
              disabled={loading}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            >
              Delete All Non-Suggested Fields
            </button>
          </div>
        </div>
        
        {/* Content based on active tab */}
        {activeTab === "suggestions" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Field Suggestions</h2>
            
            {loading && suggestions.length === 0 ? (
              <div className="flex justify-center my-8">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="bg-gray-100 p-6 rounded-lg text-center">
                <p>No field suggestions to review at this time.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="divide-y divide-gray-200">
                  {suggestions
                    .filter(s => s.status === 'pending' || !s.status) // Show pending suggestions first
                    .concat(suggestions.filter(s => s.status && s.status !== 'pending')) // Then others
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
                        <div className="flex flex-col md:flex-row md:justify-between gap-4">
                          <div className="flex-grow">
                            <h3 className="font-bold text-lg">{suggestion.name}</h3>
                            <p className="text-gray-600">{suggestion.address}</p>
                            
                            <div className="mt-2">
                              <span className={`inline-block px-2 py-1 text-xs rounded-full mr-2 ${
                                suggestion.status === "pending" || !suggestion.status
                                  ? "bg-yellow-100 text-yellow-800" 
                                  : suggestion.status === "approved" 
                                  ? "bg-green-100 text-green-800" 
                                  : "bg-red-100 text-red-800"
                              }`}>
                                {suggestion.status ? (suggestion.status.charAt(0).toUpperCase() + suggestion.status.slice(1)) : "Pending"}
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
                              <p><strong>Submitter:</strong> {suggestion.submitterEmail || "Anonymous"}</p>
                              
                              {suggestion.latitude && suggestion.longitude && (
                                <p><strong>Coordinates:</strong> {suggestion.latitude}, {suggestion.longitude}</p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex flex-row md:flex-col md:items-end gap-2">
                            {(!suggestion.status || suggestion.status === "pending") && (
                              <div className="flex flex-row md:flex-col space-y-0 md:space-y-2 space-x-2 md:space-x-0">
                                <button
                                  onClick={() => handleApproveSuggestion(suggestion)}
                                  disabled={loading}
                                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectSuggestion(suggestion.id)}
                                  disabled={loading}
                                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                            
                            <button
                              onClick={() => handleDeleteSuggestion(suggestion.id)}
                              disabled={loading}
                              className="text-red-600 hover:text-red-800 text-sm ml-2 self-start"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === "add-field" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Add Custom Field</h2>
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
              <div className="mb-4">
                <label className="block mb-2">Field Name*</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                  placeholder="e.g. Central Park Soccer Field"
                />
              </div>
              
              <div className="mb-4">
                <label className="block mb-2">Address*</label>
                <input 
                  type="text" 
                  value={address} 
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                  placeholder="e.g. 123 Main St, City, State, ZIP"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter a complete address for automatic geocoding
                </p>
              </div>
              
              <div className="mb-4">
                <label className="block mb-2">Surface Type</label>
                <select
                  value={surface}
                  onChange={(e) => setSurface(e.target.value)}
                  className="w-full p-2 border rounded"
                  >
                  <option value="grass">Grass</option>
                  <option value="turf">Artificial Turf</option>
                  <option value="dirt">Dirt</option>
                  <option value="indoor">Indoor</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block mb-2">Amenities (comma-separated)</label>
                <input 
                  type="text" 
                  value={amenities} 
                  onChange={(e) => setAmenities(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="e.g. parking, lights, bathrooms"
                />
                <p className="text-sm text-gray-500 mt-1">
                  List amenities separated by commas: parking, lights, bathrooms, etc.
                </p>
              </div>
              
              <div className="bg-blue-50 p-3 rounded-lg mb-4 text-sm">
                <p>
                  <strong>Note:</strong> The address will be automatically converted to coordinates using a geocoding service.
                  Please ensure the address is accurate and complete for best results.
                </p>
              </div>
              
              <button 
                type="submit" 
                disabled={loading}
                className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? "Adding..." : "Add Field"}
              </button>
            </form>
          </div>
        )}
        
        {activeTab === "manage-fields" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Manage Existing Fields</h2>
            
            {loading && existingFields.length === 0 ? (
              <div className="flex justify-center my-8">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : existingFields.length === 0 ? (
              <div className="bg-gray-100 p-6 rounded-lg text-center">
                <p>No fields in the database.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Field
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Address
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Coordinates
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Source
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {existingFields.map((field) => (
                        <tr key={field.id} className={!field.fromSuggestion ? "bg-red-50" : ((!field.latitude && !field.longitude) ? "bg-yellow-50" : "")}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{field.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{field.address}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {field.latitude && field.longitude ? (
                              <div className="text-sm text-gray-500">
                                {field.latitude.toFixed(4)}, {field.longitude.toFixed(4)}
                              </div>
                            ) : (
                              <div className="text-sm text-red-500">No coordinates</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {field.fromSuggestion ? (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                {field.manuallyAdded ? "Manual (Approved)" : "Suggestion"}
                              </span>
                            ) : (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                Not from suggestion
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {!field.latitude && !field.longitude && (
                              <button
                                onClick={async () => {
                                  try {
                                    setLoading(true);
                                    setMessage("Geocoding address...");

                                    // Try to geocode the address
                                    const coordinates = await geocodeAddress(field.address);
                                    
                                    // Update the field with coordinates
                                    await updateDoc(doc(db, "fields", field.id), {
                                      latitude: coordinates.latitude,
                                      longitude: coordinates.longitude,
                                      geocodedAt: serverTimestamp(),
                                      geocodedBy: user.uid
                                    });
                                    
                                    setMessage(`Successfully geocoded "${field.name}" to coordinates.`);
                                    fetchExistingFields();
                                  } catch (error) {
                                    console.error("Error geocoding field:", error);
                                    setMessage(`Error geocoding: ${error.message}`);
                                  } finally {
                                    setLoading(false);
                                  }
                                }}
                                className="text-blue-600 hover:text-blue-900 mr-3"
                              >
                                Geocode
                              </button>
                            )}
                            {!field.fromSuggestion && (
                              <button
                                onClick={async () => {
                                  try {
                                    setLoading(true);
                                    await updateDoc(doc(db, "fields", field.id), {
                                      fromSuggestion: true,
                                      migratedAt: serverTimestamp(),
                                      migratedBy: user.uid,
                                      migratedByEmail: user.email
                                    });
                                    setMessage(`Marked "${field.name}" as coming from suggestion.`);
                                    fetchExistingFields();
                                  } catch (error) {
                                    console.error("Error updating field:", error);
                                    setMessage(`Error: ${error.message}`);
                                  } finally {
                                    setLoading(false);
                                  }
                                }}
                                className="text-blue-600 hover:text-blue-900 mr-3"
                              >
                                Mark as Suggestion
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                if (window.confirm(`Are you sure you want to delete "${field.name}"? This cannot be undone.`)) {
                                  try {
                                    setLoading(true);
                                    await deleteDoc(doc(db, "fields", field.id));
                                    setMessage(`Deleted "${field.name}" successfully.`);
                                    fetchExistingFields();
                                  } catch (error) {
                                    console.error("Error deleting field:", error);
                                    setMessage(`Error: ${error.message}`);
                                  } finally {
                                    setLoading(false);
                                  }
                                }
                              }}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}