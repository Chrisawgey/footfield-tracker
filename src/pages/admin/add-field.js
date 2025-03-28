// src/pages/admin/add-field.js
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/router";
import Navigation from "../../components/Navigation";

// List of admin emails - in a real app, this would be handled with proper authorization in Firebase
const ADMIN_EMAILS = [
  "admin@example.com",  // Replace with your admin email
];

export default function AddField({ user }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [surface, setSurface] = useState("grass");
  const [amenities, setAmenities] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if user is authenticated and is an admin
    if (!user) {
      router.push("/login?redirect=/admin/add-field");
      return;
    }

    // Check if user has admin privileges
    const userIsAdmin = ADMIN_EMAILS.includes(user.email);
    setIsAdmin(userIsAdmin);

    if (!userIsAdmin) {
      setLoading(false);
    }
  }, [user, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // Convert amenities string to array
      const amenitiesArray = amenities
        .split(",")
        .map(item => item.trim())
        .filter(item => item !== "");

      // Convert latitude and longitude to numbers
      const latNum = parseFloat(latitude);
      const lngNum = parseFloat(longitude);
      
      if (isNaN(latNum) || isNaN(lngNum)) {
        throw new Error("Latitude and longitude must be valid numbers");
      }

      // Add document to Firestore
      const docRef = await addDoc(collection(db, "fields"), {
        name,
        address,
        latitude: latNum,
        longitude: lngNum,
        surface: surface,
        amenities: amenitiesArray,
        currentTraffic: "unknown",
        createdAt: serverTimestamp(),
        addedBy: user.uid,
        addedByEmail: user.email
      });

      setMessage(`Field added successfully with ID: ${docRef.id}`);
      
      // Clear form
      setName("");
      setAddress("");
      setLatitude("");
      setLongitude("");
      setSurface("grass");
      setAmenities("");
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Add pre-defined fields
  const addPredefinedFields = async () => {
    setLoading(true);
    setMessage("");
    
    const fields = [
      {
        name: "Kenilworth Recreation Center Soccer Field",
        address: "575 Boulevard, Kenilworth, NJ 07033",
        latitude: 40.6772,
        longitude: -74.2861,
        surface: "grass",
        amenities: ["parking", "lights", "bleachers"],
        currentTraffic: "unknown"
      },
      {
        name: "Black Brook Park Soccer Field",
        address: "Galloping Hill Rd, Kenilworth, NJ 07033",
        latitude: 40.6821,
        longitude: -74.2908,
        surface: "grass",
        amenities: ["parking", "bathrooms", "playground"],
        currentTraffic: "unknown"
      },
      {
        name: "Nomahegan Park Soccer Field",
        address: "1024 Springfield Ave, Cranford, NJ 07016",
        latitude: 40.6658,
        longitude: -74.3050,
        surface: "grass",
        amenities: ["parking", "jogging path", "shade"],
        currentTraffic: "unknown"
      },
      {
        name: "Unami Park Soccer Fields",
        address: "1350 Martine Ave, Scotch Plains, NJ 07076",
        latitude: 40.6558,
        longitude: -74.3211,
        surface: "grass",
        amenities: ["multiple fields", "parking", "playground"],
        currentTraffic: "unknown"
      },
      {
        name: "Meisel Avenue Park Soccer Field",
        address: "Meisel Ave, Springfield Township, NJ 07081",
        latitude: 40.6972,
        longitude: -74.3054,
        surface: "turf",
        amenities: ["parking", "open space"],
        currentTraffic: "unknown"
      }
    ];

    try {
      let added = 0;
      for (const field of fields) {
        // Add additional fields
        const fieldWithMeta = {
          ...field,
          createdAt: serverTimestamp(),
          addedBy: user.uid,
          addedByEmail: user.email
        };
        
        await addDoc(collection(db, "fields"), fieldWithMeta);
        added++;
      }
      setMessage(`Successfully added ${added} fields!`);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div>
        <Navigation user={user} />
        <div className="container mx-auto p-4">
          <div className="bg-red-100 p-4 rounded-lg">
            <h1 className="text-xl font-bold mb-2">Access Denied</h1>
            <p>You don't have permission to access this page.</p>
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
        <h1 className="text-2xl mb-4">Admin - Add Soccer Fields</h1>
        
        <div className="mb-8">
          <button 
            onClick={addPredefinedFields}
            disabled={loading}
            className="bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 disabled:bg-gray-400"
          >
            Add 5 Kenilworth Area Fields
          </button>
          <p className="text-sm text-gray-600 mt-2">
            This will add 5 predefined fields near Kenilworth, NJ
          </p>
        </div>

        <h2 className="text-xl mb-4">Add Custom Field</h2>
        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block mb-2">Field Name:</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block mb-2">Address:</label>
              <input 
                type="text" 
                value={address} 
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block mb-2">Latitude:</label>
              <input 
                type="text" 
                value={latitude} 
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block mb-2">Longitude:</label>
              <input 
                type="text" 
                value={longitude} 
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block mb-2">Surface:</label>
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
              <label className="block mb-2">Amenities (comma-separated):</label>
              <input 
                type="text" 
                value={amenities} 
                onChange={(e) => setAmenities(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="parking, lights, turf"
              />
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {loading ? "Adding..." : "Add Field"}
            </button>
          </form>
          
          {message && (
            <div className="mt-4 p-2 bg-gray-100 border rounded">
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}