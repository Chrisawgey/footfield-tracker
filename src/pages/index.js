// src/pages/index.js with integrated FieldMap
import { useState, useEffect, useRef } from "react";
import Navigation from "../components/Navigation";
import NearbyFields from "../components/NearbyFields";
import TrafficRater from "../components/TrafficRater";
import FieldMap from "../components/FieldMap"; // Import the new FieldMap component
import { db } from "../lib/firebase";
import { collection, query, getDocs } from "firebase/firestore";
import { getDistance } from "geolib";
import Link from "next/link";
import Head from "next/head";

// Admin emails - should match across all files
const ADMIN_EMAILS = [
  "chrisvpopoca@gmail.com",
];

export default function Home({ user }) {
  const [nearbyFields, setNearbyFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileRater, setShowMobileRater] = useState(false);
  const [useLiteMode, setUseLiteMode] = useState(false); // New state for lite mode
  
  // Reference for the rater component to scroll to
  const raterRef = useRef(null);

  // Check if the current user is an admin
  const isAdmin = (user) => {
    return user && user.email && 
      ADMIN_EMAILS.some(email => 
        email.toLowerCase() === user.email.toLowerCase()
      );
  };

  // Check if the device is mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkIfMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkIfMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Load user's location as soon as the page loads
  useEffect(() => {
    getCurrentLocation();
  }, []);

  // Watch for location changes and update fields
  useEffect(() => {
    if (userLocation) {
      fetchAllFields();
    }
  }, [userLocation]);

  // Scroll to the rater when it appears on mobile
  useEffect(() => {
    if (showMobileRater && raterRef.current && isMobile) {
      // Add small delay to ensure DOM is updated
      setTimeout(() => {
        raterRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [showMobileRater, isMobile]);

  const getCurrentLocation = () => {
    setLoadingLocation(true);
    setLocationError(null);
    
    // First try to get cached location from localStorage
    const savedLocation = localStorage.getItem('userLocation');
    if (savedLocation) {
      try {
        const parsedLocation = JSON.parse(savedLocation);
        setUserLocation(parsedLocation);
        setLoadingLocation(false);
        return;
      } catch (error) {
        console.error("Error parsing saved location:", error);
        // Continue to get fresh location if parsing fails
      }
    }
    
    // Get fresh location if no cached location or parsing failed
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          // Save location to localStorage
          localStorage.setItem('userLocation', JSON.stringify(location));
          setUserLocation(location);
          setDebugInfo(`Location obtained: ${location.lat}, ${location.lng}`);
          setLoadingLocation(false);
        },
        (error) => {
          console.error("Geolocation error:", error);
          setLocationError(`Error getting location: ${error.message}. Please ensure location services are enabled.`);
          setLoadingLocation(false);
          setDebugInfo(`Geolocation error: ${error.code} - ${error.message}`);
        },
        { 
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    } else {
      setLocationError("Your browser doesn't support geolocation.");
      setLoadingLocation(false);
      setDebugInfo("Geolocation not supported");
    }
  };

  // Fetch all fields and calculate distances
  const fetchAllFields = async () => {
    if (!userLocation) return;
    
    try {
      setLoadingFields(true);
      // Get all fields without filtering
      const fieldsRef = collection(db, "fields");
      const querySnapshot = await getDocs(fieldsRef);
      
      const allFields = [];
      querySnapshot.forEach((doc) => {
        allFields.push({ id: doc.id, ...doc.data() });
      });
      
      setDebugInfo(prev => `${prev || ''}\nFound ${allFields.length} fields in database`);
      
      // Calculate distance for each field that has coordinates
      const fieldsWithLocation = allFields.filter(field => field.latitude && field.longitude);
      const fieldsWithoutLocation = allFields.filter(field => !field.latitude || !field.longitude);
      
      setDebugInfo(prev => `${prev || ''}\n${fieldsWithLocation.length} fields have coordinates, ${fieldsWithoutLocation.length} don't`);
      
      // Calculate distance for fields with coordinates
      const fieldsWithDistance = fieldsWithLocation.map(field => {
        // Calculate distance in meters
        const distanceMeters = getDistance(
          { latitude: userLocation.lat, longitude: userLocation.lng },
          { latitude: field.latitude, longitude: field.longitude }
        );
        
        return {
          ...field,
          distance: distanceMeters / 1609.34 // Convert to miles (1609.34 meters in a mile)
        };
      });
      
      // Sort fields with coordinates by distance
      fieldsWithDistance.sort((a, b) => a.distance - b.distance);
      
      // For fields without coordinates, set distance to Infinity so they appear at the end
      const fieldsWithoutDistance = fieldsWithoutLocation.map(field => ({
        ...field,
        distance: Infinity,
        noLocation: true
      }));
      
      // Combine the two arrays: sorted fields with coordinates first, then fields without coordinates
      const combinedFields = [...fieldsWithDistance, ...fieldsWithoutDistance];
      
      // Log some debug info
      if (fieldsWithDistance.length > 0) {
        setDebugInfo(prev => `${prev || ''}\nClosest field: ${fieldsWithDistance[0].name} (${fieldsWithDistance[0].distance.toFixed(2)} miles)`);
      }
      
      // Update state with the fields (10 max)
      setNearbyFields(combinedFields.slice(0, 10));
    } catch (error) {
      console.error("Error fetching fields:", error);
      setDebugInfo(prev => `${prev || ''}\nError fetching fields: ${error.message}`);
    } finally {
      setLoadingFields(false);
    }
  };

  const handleFieldSelect = (field) => {
    setSelectedField(field);
    // On mobile, show the mobile rater when a field is selected
    if (isMobile) {
      setShowMobileRater(true);
    }
  };

  const resetLocation = () => {
    localStorage.removeItem('userLocation');
    setUserLocation(null);
    getCurrentLocation();
  };

  const closeMobileRater = () => {
    setShowMobileRater(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Footy Tracker - Find Soccer Fields Near You</title>
        <meta name="description" content="Discover and rate soccer fields in your area with Footy Tracker" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0" />
      </Head>
      <Navigation user={user} />
      
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-green-800 to-green-600 text-white py-10 md:py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl md:text-5xl font-bold mb-4">Find Soccer Fields Near You</h1>
            <p className="text-lg md:text-xl opacity-90 mb-6 md:mb-8">Discover local soccer fields and see real-time traffic conditions</p>
            
            {!user && (
              <Link 
                href="/login" 
                className="inline-block bg-white text-green-700 font-medium py-3 px-6 rounded-lg shadow-md hover:bg-gray-100 transition-colors"
              >
                Sign in to rate fields
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 md:py-8">
        {/* Debug information - only shown to admin users */}
        {debugInfo && user && isAdmin(user) && (
          <div className="bg-gray-100 p-4 mb-6 text-xs font-mono whitespace-pre-line rounded-lg border border-gray-200">
            <strong>Debug Info:</strong>
            <br/>{debugInfo}
          </div>
        )}

        {/* Location loading indicator */}
        {loadingLocation && (
          <div className="bg-white rounded-lg shadow-sm p-8 mb-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Getting your location...</p>
          </div>
        )}

        {/* Location error message */}
        {locationError && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center text-red-500 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="font-medium">Location Error</h3>
            </div>
            <p className="text-gray-600 mb-4">{locationError}</p>
            <button 
              onClick={getCurrentLocation}
              className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Fields loading indicator */}
        {loadingFields && (
          <div className="bg-white rounded-lg shadow-sm p-8 mb-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Finding fields near you...</p>
          </div>
        )}

        {/* Fields display */}
        {userLocation && !loadingFields && (
          <div>
            {nearbyFields.length > 0 ? (
              <div>
                {/* NEW: Field Map Section */}
                <div className="mb-8">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">Field Map</h2>
                    <div className="flex items-center">
                      <label className="inline-flex items-center mr-4 text-sm text-gray-600">
                        <input 
                          type="checkbox" 
                          checked={useLiteMode}
                          onChange={(e) => setUseLiteMode(e.target.checked)}
                          className="mr-2"
                        />
                        Lite Mode (Save Data)
                      </label>
                      <button 
                        onClick={resetLocation} 
                        className="flex items-center text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Update Location
                      </button>
                    </div>
                  </div>
                  
                  {/* Only show map if not in lite mode */}
                  {!useLiteMode && (
                    <FieldMap 
                      userLocation={userLocation}
                      nearbyFields={nearbyFields}
                    />
                  )}
                </div>
                
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">Nearby Soccer Fields</h2>
                  <button 
                    onClick={resetLocation} 
                    className="flex items-center text-sm text-gray-600 hover:text-green-600 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Update Location
                  </button>
                </div>
                
                {/* Desktop layout */}
                <div className="hidden md:grid grid-cols-3 gap-6">
                  <div className="col-span-2">
                    <NearbyFields 
                      fields={nearbyFields} 
                      onFieldSelect={handleFieldSelect} 
                    />
                  </div>
                  
                  <div>
                    {selectedField ? (
                      <div className="bg-white rounded-lg shadow-sm overflow-hidden sticky top-6">
                        <div className="bg-green-600 text-white px-4 py-3">
                          <h2 className="font-bold">Rate Field Traffic</h2>
                        </div>
                        <div className="p-4">
                          <TrafficRater 
                            field={selectedField} 
                            user={user} 
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white rounded-lg shadow-sm p-6 text-center border-2 border-dashed border-gray-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-gray-600">Select a field to rate its current traffic</p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Mobile layout */}
                <div className="md:hidden">
                  <NearbyFields 
                    fields={nearbyFields} 
                    onFieldSelect={handleFieldSelect} 
                  />
                  
                  {/* Mobile rater overlay */}
                  {selectedField && showMobileRater && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-end" onClick={closeMobileRater}>
                      <div 
                        className="bg-white rounded-t-xl w-full max-h-[90vh] overflow-y-auto z-50 pb-safe"
                        onClick={e => e.stopPropagation()}
                        ref={raterRef}
                      >
                        <div className="sticky top-0 bg-green-600 text-white px-4 py-3 flex justify-between items-center">
                          <h2 className="font-bold">{selectedField.name}</h2>
                          <button 
                            onClick={closeMobileRater}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-green-700 text-white"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                        <div className="px-4 py-4">
                          <TrafficRater 
                            field={selectedField} 
                            user={user}
                            onSubmitSuccess={closeMobileRater}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">No fields found nearby</h2>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">We couldn't find any soccer fields near your location. Help us expand our database!</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link 
                    href="/suggest-field" 
                    className="bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    Suggest a Field
                  </Link>
                  <button
                    onClick={resetLocation}
                    className="border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    Update Location
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* App features section - simplified for mobile */}
        <div className="mt-12 mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-center text-gray-800 mb-6 md:mb-8">How Footy Tracker Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <div className="bg-white rounded-lg shadow-sm p-6 text-center">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-8 md:w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Find Nearby Fields</h3>
              <p className="text-gray-600">Discover soccer fields close to your location with all the details you need.</p>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6 text-center">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-8 md:w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Check Traffic</h3>
              <p className="text-gray-600">See real-time field traffic conditions reported by other players.</p>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6 text-center">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-8 md:w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Rate & Contribute</h3>
              <p className="text-gray-600">Help other players by reporting current field conditions and suggesting new fields.</p>
            </div>
          </div>
        </div>
        
        {/* CTA for non-logged in users */}
        {!user && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center mt-8">
            <h3 className="text-xl font-bold text-green-800 mb-2">Join the community</h3>
            <p className="text-gray-700 mb-4">Create an account to rate field traffic and help other players find the best places to play.</p>
            <Link href="/login" className="inline-block bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-lg transition-colors">
              Sign Up Now
            </Link>
          </div>
        )}
      </div>
      
      {/* Simple footer */}
      <footer className="bg-gray-800 text-gray-300 py-6 md:py-8 mt-10 md:mt-12">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <p className="font-bold text-xl mb-2">Footy Tracker</p>
            <p className="text-sm text-gray-400">Find and rate soccer fields in your area</p>
            <div className="mt-4 text-sm flex flex-wrap justify-center">
              <a href="#" className="text-gray-400 hover:text-white mx-3 my-1">About</a>
              <a href="#" className="text-gray-400 hover:text-white mx-3 my-1">Terms</a>
              <a href="#" className="text-gray-400 hover:text-white mx-3 my-1">Privacy</a>
              <a href="#" className="text-gray-400 hover:text-white mx-3 my-1">Contact</a>
            </div>
            <p className="mt-6 text-xs text-gray-500">© 2025 Footy Tracker. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}