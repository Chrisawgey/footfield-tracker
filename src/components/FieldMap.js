// src/components/FieldMap.js
import React, { useState, useEffect, useRef } from 'react';
import { db } from "../lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import Link from 'next/link';

// API key is hardcoded here for development, but in production you should use env variables
const GOOGLE_MAPS_API_KEY = 'AIzaSyAGY7tWvYJrM21O6JY7VP0Dtr2K7344Dw8';

export default function FieldMap({ userLocation, nearbyFields }) {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [infoWindows, setInfoWindows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allFields, setAllFields] = useState(nearbyFields || []);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Load Google Maps API script dynamically with caching
  useEffect(() => {
    // Check if Google Maps script is already loaded
    if (window.google && window.google.maps) {
      setMapLoaded(true);
      initializeMap();
      return;
    }

    // Check for cached map data first
    const cachedMapData = localStorage.getItem('fieldsMapData');
    if (cachedMapData) {
      try {
        const { data, timestamp } = JSON.parse(cachedMapData);
        // Use cache if it's less than 24 hours old
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          setAllFields(prevFields => prevFields.length ? prevFields : data);
        }
      } catch (err) {
        console.error("Error parsing cached map data:", err);
      }
    }

    // Otherwise, load the script
    const googleMapScript = document.createElement('script');
    googleMapScript.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    googleMapScript.async = true;
    googleMapScript.defer = true;
    googleMapScript.onload = () => {
      setMapLoaded(true);
      initializeMap();
    };
    googleMapScript.onerror = () => {
      setError("Failed to load Google Maps. Please refresh and try again.");
      setLoading(false);
    };
    document.head.appendChild(googleMapScript);

    return () => {
      // Clean up markers and info windows when component unmounts
      if (markers.length > 0) {
        markers.forEach(marker => marker.setMap(null));
      }
      
      if (infoWindows.length > 0) {
        infoWindows.forEach(infoWindow => infoWindow.close());
      }
    };
  }, []);

  // When nearbyFields changes, update the allFields state
  useEffect(() => {
    if (nearbyFields && nearbyFields.length > 0) {
      setAllFields(nearbyFields);
    }
  }, [nearbyFields]);

  // When allFields or map changes, update the markers
  useEffect(() => {
    if (mapLoaded && map && allFields.length > 0) {
      addFieldMarkers();
    }
  }, [map, allFields, mapLoaded]);

  // Initialize the map once the script is loaded
  const initializeMap = () => {
    try {
      if (!mapRef.current || !window.google || !window.google.maps) return;

      // Default to a central location if user location is not available
      const defaultLocation = { lat: 40.7128, lng: -74.0060 }; // New York City
      const center = userLocation || defaultLocation;

      const mapOptions = {
        center: center,
        zoom: 12,
        mapTypeId: "roadmap",
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: false,
        zoomControl: true,
        // Reduce API usage by disabling some features:
        gestureHandling: 'cooperative', // Requires Ctrl + scroll to zoom
        minZoom: 5, // Prevent excessive zooming out
        maxZoom: 18 // Prevent excessive zooming in
      };

      const newMap = new window.google.maps.Map(mapRef.current, mapOptions);
      setMap(newMap);

      // Add user location marker if available
      if (userLocation) {
        new window.google.maps.Marker({
          position: userLocation,
          map: newMap,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#4285F4",
            fillOpacity: 1,
            strokeColor: "#FFFFFF",
            strokeWeight: 2,
          },
          title: "Your Location",
        });
      }

      // If no nearby fields were provided, fetch all fields
      if (!nearbyFields || nearbyFields.length === 0) {
        fetchAllFields();
      }

      setLoading(false);
    } catch (err) {
      console.error("Error initializing map:", err);
      setError("Failed to initialize the map. Please refresh and try again.");
      setLoading(false);
    }
  };

  // Fetch all fields from Firestore with caching
  const fetchAllFields = async () => {
    try {
      // Check cache first
      const cachedFields = localStorage.getItem('fieldsMapData');
      if (cachedFields) {
        try {
          const { data, timestamp } = JSON.parse(cachedFields);
          // Use cache if it's less than 24 hours old
          if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
            setAllFields(data);
            return;
          }
        } catch (err) {
          console.error("Error parsing cached fields:", err);
        }
      }

      // Fetch from Firestore if cache is invalid or expired
      const fieldsRef = collection(db, "fields");
      const snapshot = await getDocs(fieldsRef);
      
      const fields = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(field => field.latitude && field.longitude); // Only include fields with coordinates
      
      setAllFields(fields);

      // Save to cache
      localStorage.setItem('fieldsMapData', JSON.stringify({
        data: fields,
        timestamp: Date.now()
      }));
    } catch (err) {
      console.error("Error fetching fields:", err);
      setError("Failed to load field data. Please try again later.");
    }
  };

  // Add markers for each field
  const addFieldMarkers = () => {
    if (!window.google || !window.google.maps) return;
    
    // Clear existing markers and info windows
    markers.forEach(marker => marker.setMap(null));
    infoWindows.forEach(infoWindow => infoWindow.close());
    
    const newMarkers = [];
    const newInfoWindows = [];
    
    const bounds = new window.google.maps.LatLngBounds();
    
    // Add user location to bounds if available
    if (userLocation) {
      bounds.extend(userLocation);
    }
    
    // Add markers for each field with coordinates
    allFields.forEach(field => {
      if (!field.latitude || !field.longitude) return;
      
      const position = { lat: field.latitude, lng: field.longitude };
      
      // Create marker
      const marker = new window.google.maps.Marker({
        position,
        map,
        title: field.name,
        icon: getMarkerIcon(field.currentTraffic),
        animation: window.google.maps.Animation.DROP
      });
      
      // Create info window content
      const contentString = `
        <div class="p-2 max-w-xs">
          <h3 class="font-bold text-lg">${field.name}</h3>
          <p class="text-sm text-gray-600 mb-2">${field.address}</p>
          <div class="mb-2">
            <span class="px-2 py-1 text-xs rounded-full bg-${getTrafficColor(field.currentTraffic)}-100 text-${getTrafficColor(field.currentTraffic)}-800">
              Traffic: ${capitalizeFirst(field.currentTraffic || "unknown")}
            </span>
          </div>
          <a href="/field/${field.id}" class="text-blue-600 hover:underline text-sm">View Details</a>
        </div>
      `;
      
      // Create info window
      const infoWindow = new window.google.maps.InfoWindow({
        content: contentString,
        maxWidth: 250
      });
      
      // Add click listener to marker
      marker.addListener("click", () => {
        // Close all info windows first
        newInfoWindows.forEach(iw => iw.close());
        
        // Open this info window
        infoWindow.open(map, marker);
      });
      
      newMarkers.push(marker);
      newInfoWindows.push(infoWindow);
      bounds.extend(position);
    });
    
    // Set the map view to fit all markers
    if (newMarkers.length > 0) {
      map.fitBounds(bounds);
      
      // Adjust zoom if too zoomed in (helpful when only 1-2 markers)
      const listener = window.google.maps.event.addListener(map, "idle", () => {
        if (map.getZoom() > 15) {
          map.setZoom(15);
        }
        window.google.maps.event.removeListener(listener);
      });
    }
    
    setMarkers(newMarkers);
    setInfoWindows(newInfoWindows);
  };

  // Helper function to get marker icon based on traffic level
  const getMarkerIcon = (trafficLevel) => {
    // Use simple dot markers to reduce API usage
    return {
      url: `https://maps.google.com/mapfiles/ms/icons/${
        trafficLevel === "low" ? "green" :
        trafficLevel === "medium" ? "yellow" :
        trafficLevel === "high" ? "red" :
        "blue"
      }-dot.png`
    };
  };

  // Helper function to get color name for Tailwind classes
  const getTrafficColor = (trafficLevel) => {
    switch(trafficLevel) {
      case "low": return "green";
      case "medium": return "yellow";
      case "high": return "red";
      default: return "gray";
    }
  };

  // Helper function to capitalize first letter
  const capitalizeFirst = (string) => {
    if (!string) return 'Unknown';
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {loading && (
        <div className="flex justify-center items-center h-64 bg-gray-100">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500"></div>
        </div>
      )}
      
      {error && (
        <div className="p-4 text-red-600 bg-red-50 h-64 flex items-center justify-center">
          <div className="text-center">
            <p className="mb-2">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm"
            >
              Reload Page
            </button>
          </div>
        </div>
      )}
      
      <div 
        ref={mapRef} 
        className={`w-full h-96 ${loading || error ? 'hidden' : ''}`}
      ></div>
      
      <div className="p-3 bg-gray-50 border-t border-gray-100 text-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-1"></div>
              <span>Low Traffic</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-yellow-500 mr-1"></div>
              <span>Medium Traffic</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-red-500 mr-1"></div>
              <span>High Traffic</span>
            </div>
          </div>
          
          <Link href="/suggest-field" className="text-green-600 hover:underline">
            Suggest a Field
          </Link>
        </div>
      </div>
    </div>
  );
}