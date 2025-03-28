// src/components/NearbyFields.js - With smoother comment animations
import { useState, useEffect, useRef } from "react";
import { db } from "../lib/firebase";
import { collection, query, where, orderBy, getDocs, limit } from "firebase/firestore";
import FieldHeatmap from "./FieldHeatmap";

export default function NearbyFields({ fields, onFieldSelect }) {
  // State to track comments for each field
  const [fieldComments, setFieldComments] = useState({});
  const [activeCommentIndices, setActiveCommentIndices] = useState({});
  const intervalRefs = useRef({});

  useEffect(() => {
    // Clean up all intervals on unmount
    return () => {
      Object.values(intervalRefs.current).forEach(interval => {
        if (interval) clearInterval(interval);
      });
    };
  }, []);

  useEffect(() => {
    if (fields && fields.length > 0) {
      // Fetch comments for all fields
      fields.forEach(field => {
        fetchFieldComments(field.id);
      });
    }
  }, [fields]);

  const fetchFieldComments = async (fieldId) => {
    try {
      const commentsRef = collection(db, "field-comments");
      const q = query(
        commentsRef,
        where("fieldId", "==", fieldId),
        orderBy("timestamp", "desc"),
        limit(5)
      );
      
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const comments = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || new Date()
        }));
        
        // Update comments for this field
        setFieldComments(prev => ({
          ...prev,
          [fieldId]: comments
        }));
        
        // Initialize active comment index for this field
        setActiveCommentIndices(prev => ({
          ...prev,
          [fieldId]: 0
        }));
        
        // Set up interval to cycle through comments for this field
        if (comments.length > 1) {
          // Clear any existing interval for this field
          if (intervalRefs.current[fieldId]) {
            clearInterval(intervalRefs.current[fieldId]);
          }
          
          // Create new interval
          intervalRefs.current[fieldId] = setInterval(() => {
            setActiveCommentIndices(prev => ({
              ...prev,
              [fieldId]: (prev[fieldId] + 1) % comments.length
            }));
          }, 6000); // Increased to 6 seconds for smoother experience
        }
      }
    } catch (error) {
      console.error("Error fetching comments for field:", fieldId, error);
    }
  };

  // Format date to a relative time format
  const formatRelativeTime = (date) => {
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) {
      return "just now";
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Get emoji for category
  const getCategoryEmoji = (category) => {
    switch(category) {
      case "conditions": return "🌱";
      case "players": return "⚽";
      case "facilities": return "🚽";
      case "parking": return "🅿️";
      case "safety": return "🛡️";
      case "game": return "🥅";
      default: return "💬";
    }
  };

  if (!fields || fields.length === 0) {
    return <div>No fields found. Try expanding your search.</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="divide-y divide-gray-200">
        {fields.map((field) => (
          <div 
            key={field.id} 
            className="p-4 hover:bg-gray-50 cursor-pointer relative"
            onClick={() => onFieldSelect(field)}
          >
            <div className="flex flex-col md:flex-row gap-4">
              {/* Visual field representation */}
              <div className="w-full md:w-1/3">
                <FieldHeatmap 
                  trafficLevel={field.currentTraffic || "unknown"} 
                  fieldName={field.name}
                />
              </div>
              
              <div className="w-full md:w-2/3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{field.name}</h3>
                    <p className="text-sm text-gray-500">{field.address}</p>
                    <div className="flex items-center mt-2">
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full mr-2">
                        {field.surface || "Grass"}
                      </span>
                      {field.noLocation ? (
                        <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
                          Distance unknown
                        </span>
                      ) : (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          {field.distance !== Infinity ? `${field.distance.toFixed(1)} mi away` : "Distance unknown"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <TrafficIndicator trafficLevel={field.currentTraffic || "unknown"} />
                  </div>
                </div>
                
                {/* Field amenities if available */}
                {field.amenities && field.amenities.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 mb-1">Amenities:</p>
                    <div className="flex flex-wrap gap-1">
                      {field.amenities.map((amenity, index) => (
                        <span key={index} className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
                          {amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Comment bubble, with improved animation */}
            {fieldComments[field.id] && fieldComments[field.id].length > 0 && (
              <div className="comment-container mt-4 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-3 shadow-sm hover:shadow transition-all duration-300"
                  style={{ minHeight: "80px" }} // Fixed height to prevent layout shifts
                >
                  <div className="relative h-full">
                    {fieldComments[field.id].map((comment, index) => (
                      <div 
                        key={comment.id} 
                        className={`transition-all duration-1000 ease-in-out absolute inset-0 ${
                          index === activeCommentIndices[field.id] 
                            ? 'opacity-100 translate-y-0 z-10' 
                            : 'opacity-0 translate-y-8 z-0'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="bg-blue-500 text-white w-7 h-7 rounded-full flex items-center justify-center mr-1 font-medium text-xs flex-shrink-0">
                            {comment.userName?.substring(0, 1).toUpperCase() || "?"}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between mb-1 items-center">
                              <span className="font-medium text-sm text-gray-700">{comment.userName || "Anonymous"}</span>
                              <div className="flex items-center">
                                <span className="text-xs bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 mr-2">
                                  {getCategoryEmoji(comment.category)}
                                </span>
                                <span className="text-xs text-gray-500">{formatRelativeTime(comment.timestamp)}</span>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2">{comment.comment}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Comment indicators */}
                {fieldComments[field.id].length > 1 && (
                  <div className="flex justify-center mt-2 space-x-1.5">
                    {fieldComments[field.id].map((_, index) => (
                      <div
                        key={index}
                        className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${
                          index === activeCommentIndices[field.id] ? 'bg-blue-500' : 'bg-gray-300'
                        }`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            
          </div>
        ))}
      </div>
    </div>
  );
}

function TrafficIndicator({ trafficLevel }) {
  const getTrafficColor = () => {
    switch(trafficLevel) {
      case "low": return "bg-green-500";
      case "medium": return "bg-yellow-500"; 
      case "high": return "bg-red-500";
      default: return "bg-gray-300";
    }
  };

  const getTrafficLabel = () => {
    switch(trafficLevel) {
      case "low": return "Low";
      case "medium": return "Medium"; 
      case "high": return "High";
      default: return "Unknown";
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className={`w-4 h-4 rounded-full ${getTrafficColor()} mb-1`}></div>
      <span className="text-xs text-gray-500">{getTrafficLabel()}</span>
    </div>
  );
}