// src/components/FieldInfo.js
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, query, where, orderBy, getDocs, limit } from "firebase/firestore";
import FieldHeatmap from "./FieldHeatmap";
import Link from "next/link";

// API keys - hardcoded for development, in production use env variables
const GOOGLE_MAPS_API_KEY = 'AIzaSyAGY7tWvYJrM21O6JY7VP0Dtr2K7344Dw8';
const OPENWEATHER_API_KEY = '83dfbcc55c4b0d6f4c8db4c5bf62af32';

export default function FieldInfo({ field, trafficData }) {
  const [weatherData, setWeatherData] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [nearbyFields, setNearbyFields] = useState([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  
  // Calculate majority traffic level
  const trafficDetails = determineTrafficLevel(trafficData);
  
  // Fetch nearby fields when component mounts
  useEffect(() => {
    if (field?.latitude && field?.longitude) {
      fetchNearbyFields();
      fetchWeatherWithCache();
    }
  }, [field]);
  
  // Fetch weather data with caching to reduce API calls
  const fetchWeatherWithCache = async () => {
    if (!field?.latitude || !field?.longitude) return;
    
    setLoadingWeather(true);
    try {
      // Check for cached weather data
      const cacheKey = `weather_${field.latitude.toFixed(2)}_${field.longitude.toFixed(2)}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
        try {
          const { data, timestamp } = JSON.parse(cachedData);
          // Use cache if it's less than 3 hours old
          if (Date.now() - timestamp < 3 * 60 * 60 * 1000) {
            setWeatherData(data);
            setLoadingWeather(false);
            return;
          }
        } catch (err) {
          console.error("Error parsing cached weather:", err);
        }
      }
      
      // Fetch fresh data if no valid cache exists
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${field.latitude}&lon=${field.longitude}&units=imperial&appid=${OPENWEATHER_API_KEY}`
      );
      
      if (response.ok) {
        const data = await response.json();
        const weatherInfo = {
          temp: Math.round(data.main.temp),
          condition: data.weather[0].main,
          icon: `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`,
          humidity: data.main.humidity,
          windSpeed: Math.round(data.wind.speed),
          description: data.weather[0].description,
        };
        
        // Save to cache with timestamp
        localStorage.setItem(cacheKey, JSON.stringify({
          data: weatherInfo,
          timestamp: Date.now()
        }));
        
        setWeatherData(weatherInfo);
      }
    } catch (error) {
      console.error("Error fetching weather:", error);
    } finally {
      setLoadingWeather(false);
    }
  };
  
  // Fetch other nearby fields with caching
  const fetchNearbyFields = async () => {
    if (!field?.id || !field?.latitude || !field?.longitude) return;
    
    setLoadingNearby(true);
    try {
      // Check cache first
      const cacheKey = `nearby_fields_${field.id}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
        try {
          const { data, timestamp } = JSON.parse(cachedData);
          // Use cache if it's less than 24 hours old
          if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
            setNearbyFields(data);
            setLoadingNearby(false);
            return;
          }
        } catch (err) {
          console.error("Error parsing cached nearby fields:", err);
        }
      }
      
      // Get all fields (in a real app, you would use geospatial queries)
      const fieldsRef = collection(db, "fields");
      const querySnapshot = await getDocs(fieldsRef);
      
      const allFields = [];
      querySnapshot.forEach((doc) => {
        // Skip the current field
        if (doc.id !== field.id) {
          allFields.push({ id: doc.id, ...doc.data() });
        }
      });
      
      // Filter fields with coordinates
      const fieldsWithCoords = allFields.filter(f => f.latitude && f.longitude);
      
      // Calculate distance to each field
      const fieldsWithDistance = fieldsWithCoords.map(f => {
        const distance = calculateDistance(
          field.latitude, field.longitude,
          f.latitude, f.longitude
        );
        return { ...f, distance };
      });
      
      // Sort by distance and take the closest 3
      fieldsWithDistance.sort((a, b) => a.distance - b.distance);
      const nearestFields = fieldsWithDistance.slice(0, 3);
      
      // Save to cache
      localStorage.setItem(cacheKey, JSON.stringify({
        data: nearestFields,
        timestamp: Date.now()
      }));
      
      setNearbyFields(nearestFields);
    } catch (error) {
      console.error("Error fetching nearby fields:", error);
    } finally {
      setLoadingNearby(false);
    }
  };
  
  // Calculate distance between two coordinates in miles (using Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3958.8; // Earth's radius in miles
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };
  
  // Convert degrees to radians
  const toRadians = (degrees) => {
    return degrees * (Math.PI/180);
  };
  
  // Helper function for getting marker icon that safely handles missing window.google
  const getSafeMarkerIcon = (trafficLevel) => {
    // Default colors if window.google is not available
    const colors = {
      low: "#22c55e",
      medium: "#eab308",
      high: "#ef4444",
      unknown: "#94a3b8"
    };
    
    return {
      url: `https://maps.google.com/mapfiles/ms/icons/${
        trafficLevel === "low" ? "green" :
        trafficLevel === "medium" ? "yellow" :
        trafficLevel === "high" ? "red" :
        "blue"
      }-dot.png`
    };
  };
  
  // Algorithm to determine the majority traffic level
  function determineTrafficLevel(trafficData) {
    if (!trafficData || trafficData.length === 0) {
      return { level: "unknown", confidence: 0, reportCount: 0 };
    }
    
    // Count occurrences of each level
    const counts = trafficData.reduce((acc, report) => {
      acc[report.trafficLevel] = (acc[report.trafficLevel] || 0) + 1;
      return acc;
    }, {});
    
    // Find the level with the most reports
    let highestCount = 0;
    let majorityLevel = "unknown";
    
    for (const [level, count] of Object.entries(counts)) {
      if (count > highestCount) {
        highestCount = count;
        majorityLevel = level;
      }
    }
    
    // Calculate confidence (percentage of reports agreeing)
    const totalReports = trafficData.length;
    const confidence = totalReports > 0 ? (highestCount / totalReports) * 100 : 0;
    
    return {
      level: majorityLevel,
      confidence: Math.round(confidence),
      reportCount: totalReports
    };
  }
  
  // Display features based on amenities
  const getFeaturesList = () => {
    const features = [];
    
    // Standard features based on surface
    if (field.surface) {
      features.push({
        name: capitalizeFirst(field.surface) + " Surface",
        icon: getSurfaceIcon(field.surface)
      });
    }
    
    // Features based on amenities
    if (field.amenities && field.amenities.length > 0) {
      // Map common amenities to nicer names and icons
      field.amenities.forEach(amenity => {
        const lowerAmenity = amenity.toLowerCase().trim();
        
        if (lowerAmenity.includes("parking")) {
          features.push({ name: "Parking Available", icon: "🅿️" });
        }
        else if (lowerAmenity.includes("light") || lowerAmenity.includes("lit")) {
          features.push({ name: "Field Lighting", icon: "💡" });
        }
        else if (lowerAmenity.includes("bathroom") || lowerAmenity.includes("restroom") || lowerAmenity.includes("toilet")) {
          features.push({ name: "Restrooms", icon: "🚻" });
        }
        else if (lowerAmenity.includes("bench") || lowerAmenity.includes("seating")) {
          features.push({ name: "Seating/Benches", icon: "🪑" });
        }
        else if (lowerAmenity.includes("water") || lowerAmenity.includes("fountain")) {
          features.push({ name: "Water Fountain", icon: "💧" });
        }
        else if (lowerAmenity.includes("shade") || lowerAmenity.includes("tree")) {
          features.push({ name: "Shaded Areas", icon: "🌳" });
        }
        else {
          // If not a known amenity, just capitalize and add it
          features.push({
            name: capitalizeFirst(amenity),
            icon: "✅"
          });
        }
      });
    }
    
    return features;
  };
  
  // Get appropriate icon for surface type
  const getSurfaceIcon = (surface) => {
    const lowerSurface = (surface || "").toLowerCase();
    
    if (lowerSurface.includes("grass")) return "🌱";
    if (lowerSurface.includes("turf")) return "🟩";
    if (lowerSurface.includes("indoor")) return "🏢";
    if (lowerSurface.includes("dirt")) return "🟤";
    
    return "🟩"; // Default
  };
  
  // Capitalize first letter
  const capitalizeFirst = (string) => {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
  };
  
  // Generate a field description
  const getFieldDescription = () => {
    let description = `${field.name} is a soccer field located at ${field.address}.`;
    
    // Add surface info
    if (field.surface) {
      description += ` The field features a ${field.surface} playing surface.`;
    }
    
    // Add amenities info
    if (field.amenities && field.amenities.length > 0) {
      if (field.amenities.length === 1) {
        description += ` The facility offers ${field.amenities[0]}.`;
      } else {
        const lastAmenity = field.amenities[field.amenities.length - 1];
        const otherAmenities = field.amenities.slice(0, -1).join(", ");
        description += ` The facility offers ${otherAmenities}, and ${lastAmenity}.`;
      }
    }
    
    // Add traffic data
    if (trafficDetails.reportCount > 0) {
      description += ` Based on ${trafficDetails.reportCount} reports, the field typically experiences ${trafficDetails.level} traffic.`;
    }
    
    return description;
  };
  
  // Format date for last updated
  const formatLastUpdated = (timestamp) => {
    if (!timestamp) return "No data available";
    
    // If it's a Firebase timestamp, convert to JS Date
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    // Format the date
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:gap-6">
          {/* Left column - Field map and traffic */}
          <div className="w-full md:w-2/5">
            {/* Field visualization */}
            <div className="mb-6">
              <FieldHeatmap 
                trafficLevel={trafficDetails.level} 
                fieldName={field.name}
              />
              
              <div className="mt-4 flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium">Current Traffic</div>
                  <div className={`text-lg font-bold ${
                    trafficDetails.level === "low" ? "text-green-600" : 
                    trafficDetails.level === "medium" ? "text-yellow-600" : 
                    trafficDetails.level === "high" ? "text-red-600" :
                    "text-gray-600"
                  }`}>
                    {capitalizeFirst(trafficDetails.level)}
                  </div>
                </div>
                
                {trafficDetails.reportCount > 0 && (
                  <div className="text-right">
                    <div className="text-sm font-medium">Reliability</div>
                    <div className="flex items-center">
                      <div className="bg-gray-200 w-24 h-2 rounded-full overflow-hidden mr-2">
                        <div 
                          className={`h-full ${
                            trafficDetails.confidence >= 80 ? "bg-green-500" : 
                            trafficDetails.confidence >= 50 ? "bg-yellow-500" : 
                            "bg-red-500"
                          }`}
                          style={{ width: `${trafficDetails.confidence}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-600">{trafficDetails.confidence}%</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Based on {trafficDetails.reportCount} report{trafficDetails.reportCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Weather card - shown if weather data is available */}
            {(loadingWeather || weatherData) && (
              <div className="mb-6 border rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-2">Current Weather</h3>
                
                {loadingWeather ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : weatherData && (
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <img 
                        src={weatherData.icon} 
                        alt={weatherData.condition} 
                        className="w-14 h-14"
                      />
                    </div>
                    <div className="ml-3">
                      <div className="text-xl font-bold">{weatherData.temp}°F</div>
                      <div className="text-sm text-gray-600">{weatherData.description}</div>
                      <div className="flex mt-1 text-xs text-gray-500 space-x-3">
                        <span>Humidity: {weatherData.humidity}%</span>
                        <span>Wind: {weatherData.windSpeed} mph</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Location card - Using static map image to reduce API usage */}
            {field.latitude && field.longitude && (
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium text-gray-800">Location</h3>
                  <a 
                    href={`https://www.google.com/maps/dir/?api=1&destination=${field.latitude},${field.longitude}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Get Directions
                  </a>
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                  {/* Using static map image instead of embedded map to save API calls */}
                  <div className="bg-gray-100 p-4">
                    <img 
                      src={`https://maps.googleapis.com/maps/api/staticmap?center=${field.latitude},${field.longitude}&zoom=15&size=400x200&markers=color:red%7C${field.latitude},${field.longitude}&key=${GOOGLE_MAPS_API_KEY}`}
                      alt={`Map of ${field.name}`}
                      className="w-full h-32 rounded object-cover"
                    />
                  </div>
                  <div className="p-3 text-sm text-gray-600">
                    {field.address}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Right column - Field details */}
          <div className="w-full md:w-3/5">
            {/* Field description */}
            <div className="mb-6">
              <h3 className="font-medium text-gray-800 mb-2">About This Field</h3>
              <div className="bg-gray-50 rounded-lg p-4 text-gray-600">
                <p>
                  {showFullDescription 
                    ? getFieldDescription() 
                    : `${getFieldDescription().substring(0, 150)}${getFieldDescription().length > 150 ? '...' : ''}`}
                </p>
                
                {getFieldDescription().length > 150 && (
                  <button 
                    onClick={() => setShowFullDescription(!showFullDescription)}
                    className="text-blue-600 hover:underline text-sm mt-2"
                  >
                    {showFullDescription ? 'Show Less' : 'Read More'}
                  </button>
                )}
              </div>
            </div>
            
            {/* Features/Amenities grid */}
            <div className="mb-6">
              <h3 className="font-medium text-gray-800 mb-2">Field Features</h3>
              
              <div className="grid grid-cols-2 gap-3">
                {getFeaturesList().map((feature, index) => (
                  <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-lg mr-2">{feature.icon}</span>
                    <span className="text-sm">{feature.name}</span>
                  </div>
                ))}
                
                {getFeaturesList().length === 0 && (
                  <div className="col-span-2 p-3 bg-gray-50 rounded-lg text-center text-gray-500">
                    No features or amenities listed for this field
                  </div>
                )}
              </div>
            </div>
            
            {/* Recent traffic reports */}
            <div className="mb-6">
              <h3 className="font-medium text-gray-800 mb-2">Recent Traffic Reports</h3>
              
              {trafficData && trafficData.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr className="text-left text-gray-500 text-xs">
                          <th className="py-2 px-4 font-medium">Traffic</th>
                          <th className="py-2 px-4 font-medium">Time</th>
                          <th className="py-2 px-4 font-medium">Comment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {trafficData.slice(0, 5).map(report => (
                          <tr key={report.id} className="text-sm">
                            <td className="py-3 px-4">
                              <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                                report.trafficLevel === "low" 
                                  ? "bg-green-100 text-green-800" 
                                  : report.trafficLevel === "medium" 
                                  ? "bg-yellow-100 text-yellow-800" 
                                  : "bg-red-100 text-red-800"
                              }`}>
                                {capitalizeFirst(report.trafficLevel)}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-gray-500">
                              {typeof report.timestamp.toDate === 'function' 
                                ? report.timestamp.toDate().toLocaleString()
                                : new Date(report.timestamp).toLocaleString()}
                            </td>
                            <td className="py-3 px-4">
                              {report.comment || <span className="text-gray-400 italic">No comment</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
                  No traffic reports available yet
                </div>
              )}
            </div>
            
            {/* Nearby fields */}
            <div className="mb-6">
              <h3 className="font-medium text-gray-800 mb-2">Nearby Fields</h3>
              
              {loadingNearby ? (
                <div className="flex justify-center p-4 bg-gray-50 rounded-lg">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : nearbyFields.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {nearbyFields.map(nearbyField => (
                    <Link 
                      href={`/field/${nearbyField.id}`} 
                      key={nearbyField.id}
                      className="block border rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="p-3">
                        <h4 className="font-medium text-gray-800 mb-1 line-clamp-1">{nearbyField.name}</h4>
                        <p className="text-xs text-gray-500 mb-2 line-clamp-1">{nearbyField.address}</p>
                        <div className="flex justify-between items-center">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            nearbyField.currentTraffic === "low" 
                              ? "bg-green-100 text-green-800" 
                              : nearbyField.currentTraffic === "medium" 
                              ? "bg-yellow-100 text-yellow-800" 
                              : nearbyField.currentTraffic === "high" 
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {capitalizeFirst(nearbyField.currentTraffic || "unknown")}
                          </span>
                          <span className="text-xs text-blue-600">
                            {nearbyField.distance.toFixed(1)} mi
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
                  No nearby fields found
                </div>
              )}
            </div>
            
            {/* Last updated information */}
            {trafficData && trafficData.length > 0 && (
              <div className="text-xs text-gray-500 text-right">
                Last updated: {formatLastUpdated(trafficData[0].timestamp)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}