// src/pages/field/[id].js - With comment bubbles in field info
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { db, auth } from "../../lib/firebase";
import { doc, getDoc, collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import Navigation from "../../components/Navigation";
import FieldHeatmap from "../../components/FieldHeatmap";
import TrafficRater from "../../components/TrafficRater";
import FieldComments from "../../components/FieldComments";
import Head from "next/head";

export default function FieldDetail({ user }) {
  const router = useRouter();
  const { id } = router.query;
  const [field, setField] = useState(null);
  const [trafficData, setTrafficData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("info"); // "info", "comments"
  
  // For comment carousel
  const [recentComments, setRecentComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [activeCommentIndex, setActiveCommentIndex] = useState(0);
  const carouselIntervalRef = useRef(null);
  
  useEffect(() => {
    if (recentComments.length > 1) {
      // Clear any existing interval
      if (carouselIntervalRef.current) {
        clearInterval(carouselIntervalRef.current);
      }
      
      // Set up new interval to cycle through comments
      carouselIntervalRef.current = setInterval(() => {
        setActiveCommentIndex(prevIndex => 
          prevIndex === recentComments.length - 1 ? 0 : prevIndex + 1
        );
      }, 5000); // Change comment every 5 seconds
    }
    
    return () => {
      if (carouselIntervalRef.current) {
        clearInterval(carouselIntervalRef.current);
      }
    };
  }, [recentComments]);

  useEffect(() => {
    async function fetchFieldData() {
      if (!id) return;
      
      try {
        // Get field details
        const fieldRef = doc(db, "fields", id);
        const fieldSnap = await getDoc(fieldRef);
        
        if (fieldSnap.exists()) {
          setField({ id: fieldSnap.id, ...fieldSnap.data() });
          
          // Get recent traffic reports
          const trafficRef = collection(db, "traffic-reports");
          const trafficQuery = query(
            trafficRef, 
            where("fieldId", "==", id),
            orderBy("timestamp", "desc"),
            limit(10)
          );
          
          const trafficSnap = await getDocs(trafficQuery);
          const trafficData = trafficSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date()
          }));
          
          setTrafficData(trafficData);
          
          // Fetch recent comments
          fetchRecentComments(id);
        } else {
          router.push("/404");
        }
        
        setLoading(false);
      } catch (err) {
        console.error("Error fetching field data:", err);
        setLoading(false);
      }
    }
    
    fetchFieldData();
    
    return () => {
      // Clean up interval on unmount
      if (carouselIntervalRef.current) {
        clearInterval(carouselIntervalRef.current);
      }
    };
  }, [id, router]);
  
  const fetchRecentComments = async (fieldId) => {
    try {
      setLoadingComments(true);
      const commentsRef = collection(db, "field-comments");
      const q = query(
        commentsRef,
        where("fieldId", "==", fieldId),
        orderBy("timestamp", "desc"),
        limit(5) // Get the 5 most recent comments
      );
      
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const comments = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || new Date()
        }));
        
        setRecentComments(comments);
        setActiveCommentIndex(0); // Reset to first comment
      } else {
        setRecentComments([]);
      }
    } catch (error) {
      console.error("Error fetching recent comments:", error);
    } finally {
      setLoadingComments(false);
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
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
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
      default: return "💬";
    }
  };

  // Calculate majority traffic level
  const determineTrafficLevel = () => {
    if (trafficData.length === 0) return { level: "unknown", confidence: 0 };
    
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
  };

  const trafficDetails = determineTrafficLevel();

  if (loading) {
    return (
      <div>
        <Head>
          <title>Loading Field Details | Footy Tracker</title>
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

  if (!field) return (
    <div>
      <Head>
        <title>Field Not Found | Footy Tracker</title>
      </Head>
      <Navigation user={user} />
      <div className="container mx-auto p-4">
        <div className="bg-red-100 p-4 rounded-lg">
          <h1 className="text-xl font-bold mb-2">Field Not Found</h1>
          <p>The requested field could not be found.</p>
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

  return (
    <div>
      <Head>
        <title>{field.name} | Footy Tracker</title>
        <meta name="description" content={`View details and current traffic for ${field.name}`} />
      </Head>
      <Navigation user={user} />
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{field.name}</h1>
          <p className="text-gray-600">{field.address}</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            {/* Tabs navigation */}
            <div className="mb-4 flex border-b">
              <button
                onClick={() => setActiveTab("info")}
                className={`py-2 px-4 font-medium ${
                  activeTab === "info"
                    ? "text-blue-600 border-b-2 border-blue-500"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Field Information
              </button>
              <button
                onClick={() => setActiveTab("comments")}
                className={`py-2 px-4 font-medium ${
                  activeTab === "comments"
                    ? "text-blue-600 border-b-2 border-blue-500"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Comments
              </button>
            </div>
            
            {/* Field information tab */}
            {activeTab === "info" && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Field Information</h2>
                
                {/* Field visualization */}
                <div className="mb-8 relative">
                  <FieldHeatmap 
                    trafficLevel={trafficDetails.level} 
                    fieldName={field.name}
                  />
                  
                  {/* Floating comment bubble */}
                  {recentComments.length > 0 && (
                    <div className="absolute -bottom-4 right-4 w-64 bg-white rounded-lg shadow-lg border border-gray-200 animate-float">
                      <div className="p-3 max-h-32 overflow-hidden">
                        {recentComments.map((comment, index) => (
                          <div 
                            key={comment.id} 
                            className={`transition-all duration-700 ${
                              index === activeCommentIndex 
                                ? 'opacity-100 translate-y-0' 
                                : 'opacity-0 absolute inset-0 translate-y-2 pointer-events-none'
                            }`}
                          >
                            {/* Comment content */}
                            <div className="flex items-start gap-2">
                              <div className="bg-blue-100 text-blue-800 w-6 h-6 rounded-full flex items-center justify-center mr-1 font-bold text-xs flex-shrink-0 mt-1">
                                {comment.userName?.substring(0, 1).toUpperCase() || "?"}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-medium text-xs truncate">{comment.userName || "Anonymous"}</span>
                                  <span className="text-xs text-gray-500">{formatRelativeTime(comment.timestamp)}</span>
                                </div>
                                <p className="text-sm line-clamp-3">{comment.comment}</p>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Carousel indicator dots */}
                        {recentComments.length > 1 && (
                          <div className="absolute bottom-1 right-2 flex items-center justify-center space-x-1">
                            {recentComments.map((_, index) => (
                              <div
                                key={index}
                                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                                  index === activeCommentIndex ? 'bg-blue-500' : 'bg-gray-300'
                                }`}
                                aria-hidden="true"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium text-lg mb-2">Details</h3>
                    <ul className="space-y-2">
                      <li><strong>Surface:</strong> {field.surface || "Not specified"}</li>
                      {field.amenities && field.amenities.length > 0 && (
                        <li>
                          <strong>Amenities:</strong> 
                          <div className="flex flex-wrap gap-1 mt-1">
                            {field.amenities.map((amenity, index) => (
                              <span key={index} className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
                                {amenity}
                              </span>
                            ))}
                          </div>
                        </li>
                      )}
                      {field.latitude && field.longitude && (
                        <li>
                          <strong>Coordinates:</strong> {field.latitude}, {field.longitude}
                          <a 
                            href={`https://maps.google.com/?q=${field.latitude},${field.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-blue-500 hover:underline text-sm"
                          >
                            View on Google Maps
                          </a>
                        </li>
                      )}
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-lg mb-2">Current Traffic</h3>
                    {trafficData.length > 0 ? (
                      <div>
                        <div 
                          className={`p-4 mb-4 rounded ${
                            trafficDetails.level === "low" ? "bg-green-100" : 
                            trafficDetails.level === "medium" ? "bg-yellow-100" : 
                            trafficDetails.level === "high" ? "bg-red-100" :
                            "bg-gray-100"
                          }`}
                        >
                          <p className="font-bold">Current level: {trafficDetails.level.charAt(0).toUpperCase() + trafficDetails.level.slice(1)}</p>
                          <p>Based on {trafficDetails.reportCount} reports ({trafficDetails.confidence}% agreement)</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Last updated: {trafficData[0].timestamp.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-600">No traffic data available yet.</p>
                    )}
                  </div>
                </div>
                
                <h3 className="font-medium text-lg mt-6 mb-2">Recent Reports</h3>
                {trafficData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Traffic</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {trafficData.slice(0, 5).map((report) => (
                          <tr key={report.id}>
                            <td className="px-4 py-3 text-sm">
                              <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                                report.trafficLevel === "low" 
                                  ? "bg-green-100 text-green-800" 
                                  : report.trafficLevel === "medium" 
                                  ? "bg-yellow-100 text-yellow-800" 
                                  : "bg-red-100 text-red-800"
                              }`}>
                                {report.trafficLevel}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">{report.timestamp.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm">
                              {report.comment || <span className="text-gray-400">No comment</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-600">No traffic reports yet. Be the first to report!</p>
                )}
              </div>
            )}
            
            {/* Comments tab */}
            {activeTab === "comments" && (
              <div id="comments-section">
                <FieldComments field={field} user={user} />
              </div>
            )}
          </div>
          
          <div>
            <TrafficRater 
              field={field} 
              user={user} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
