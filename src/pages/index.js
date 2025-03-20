import { useState, useEffect } from "react";
import Navigation from "../components/Navigation";
import NearbyFields from "../components/NearbyFields";
import TrafficRater from "../components/TrafficRater";
import { db } from "../lib/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";

export default function Home({ user }) {
  const [nearbyFields, setNearbyFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(true);

  // Get user's location on component mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLoadingLocation(false);
        },
        (error) => {
          console.error("Error getting location: ", error);
          setLoadingLocation(false);
        }
      );
    } else {
      console.error("Geolocation not supported by this browser");
      setLoadingLocation(false);
    }
  }, []);

  // Fetch nearby fields when user location is available
  useEffect(() => {
    const fetchNearbyFields = async () => {
      if (!userLocation) return;
      
      try {
        // This is a simplified example. In a real app, you'd query based on geolocation
        const fieldsRef = collection(db, "fields");
        const q = query(fieldsRef, orderBy("name"), limit(5));
        const querySnapshot = await getDocs(q);
        
        const fields = [];
        querySnapshot.forEach((doc) => {
          const field = { id: doc.id, ...doc.data() };
          
          // Calculate distance (simplified)
          if (field.location) {
            const distance = calculateDistance(
              userLocation.lat, userLocation.lng,
              field.location.lat, field.location.lng
            );
            field.distance = distance;
          }
          
          fields.push(field);
        });
        
        // Sort by distance
        fields.sort((a, b) => a.distance - b.distance);
        setNearbyFields(fields);
      } catch (error) {
        console.error("Error fetching fields: ", error);
      }
    };

    fetchNearbyFields();
  }, [userLocation]);

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in km
    return distance;
  };

  const deg2rad = (deg) => {
    return deg * (Math.PI/180);
  };

  const handleFieldSelect = (field) => {
    setSelectedField(field);
  };

  return (
    <div>
      <Navigation user={user} />
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">Welcome to Footy Tracker</h1>

        {loadingLocation && (
          <div className="mb-4">Loading your location...</div>
        )}

        {!loadingLocation && !userLocation && (
          <div className="mb-4">
            <p>We need your location to show nearby fields. Please enable location services.</p>
          </div>
        )}

        {userLocation && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <h2 className="text-xl font-semibold mb-4">Nearby Soccer Fields</h2>
              <NearbyFields 
                fields={nearbyFields} 
                onFieldSelect={handleFieldSelect} 
              />
            </div>
            
            <div>
              {selectedField ? (
                <div>
                  <h2 className="text-xl font-semibold mb-4">Rate Field Traffic</h2>
                  <TrafficRater 
                    field={selectedField} 
                    user={user} 
                  />
                </div>
              ) : (
                <div className="bg-gray-100 p-4 rounded">
                  <p>Select a field to rate its traffic</p>
                </div>
              )}
            </div>
          </div>
        )}

        {!user && (
          <div className="mt-6 p-4 bg-blue-50 rounded">
            <p className="font-semibold">Want to track field traffic or add ratings?</p>
            <p className="mb-2">Please <a href="/login" className="text-blue-500 hover:underline">login</a> to access all features.</p>
          </div>
        )}
      </div>
    </div>
  );
}