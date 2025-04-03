// src/pages/field/[id].js - Updated with enhanced field info
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { db, auth } from "../../lib/firebase";
import { doc, getDoc, collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import Navigation from "../../components/Navigation";
import TrafficRater from "../../components/TrafficRater";
import FieldComments from "../../components/FieldComments";
import FieldInfo from "../../components/FieldInfo";
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
            
            {/* Field information tab - UPDATED to use new FieldInfo component */}
            {activeTab === "info" && (
              <FieldInfo field={field} trafficData={trafficData} />
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