// src/components/TrafficRater.js - Without comments section (continued)
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { doc, setDoc, serverTimestamp, collection, addDoc, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { useRouter } from "next/router";
import FieldHeatmap from "./FieldHeatmap";

export default function TrafficRater({ field, user, onSubmitSuccess }) {
  const [trafficLevel, setTrafficLevel] = useState("medium");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [aggregatedTraffic, setAggregatedTraffic] = useState(null);
  const router = useRouter();

  // Fetch existing traffic reports when component mounts
  useEffect(() => {
    if (field?.id) {
      fetchTrafficReports();
    }
  }, [field]);

  const fetchTrafficReports = async () => {
    try {
      const trafficRef = collection(db, "traffic-reports");
      const q = query(
        trafficRef,
        where("fieldId", "==", field.id),
        orderBy("timestamp", "desc"),
        limit(20) // Get the most recent 20 reports
      );
      
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const reports = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Calculate majority traffic level
        const aggregated = determineTrafficLevel(reports);
        setAggregatedTraffic(aggregated);
        
        // Initialize form with the majority level as default
        setTrafficLevel(aggregated.level);
      }
    } catch (error) {
      console.error("Error fetching traffic reports:", error);
    }
  };

  // Algorithm to determine the majority traffic level
  const determineTrafficLevel = (reports) => {
    // Count occurrences of each level
    const counts = reports.reduce((acc, report) => {
      acc[report.trafficLevel] = (acc[report.trafficLevel] || 0) + 1;
      return acc;
    }, {});
    
    // Find the level with the most reports
    let highestCount = 0;
    let majorityLevel = "medium"; // Default if no reports
    
    for (const [level, count] of Object.entries(counts)) {
      if (count > highestCount) {
        highestCount = count;
        majorityLevel = level;
      }
    }
    
    // Calculate confidence (percentage of reports agreeing)
    const totalReports = reports.length;
    const confidence = totalReports > 0 ? (highestCount / totalReports) * 100 : 0;
    
    return {
      level: majorityLevel,
      confidence: Math.round(confidence),
      reportCount: totalReports,
      lastUpdated: reports.length > 0 ? reports[0].timestamp : null
    };
  };

  // Determine category based on comment content
  const determineCommentCategory = (comment) => {
    if (!comment || comment.trim() === "") return "general";
    
    const lowerComment = comment.toLowerCase();
    
    if (lowerComment.includes("mud") || lowerComment.includes("grass") || 
        lowerComment.includes("turf") || lowerComment.includes("condition")) {
      return "conditions";
    } 
    else if (lowerComment.includes("game") || lowerComment.includes("player") || 
             lowerComment.includes("team") || lowerComment.includes("match")) {
      return "players";
    }
    else if (lowerComment.includes("bathroom") || lowerComment.includes("toilet") || 
             lowerComment.includes("water") || lowerComment.includes("bench")) {
      return "facilities";
    }
    else if (lowerComment.includes("park") || lowerComment.includes("car") || 
             lowerComment.includes("lot")) {
      return "parking";
    }
    else if (lowerComment.includes("safe") || lowerComment.includes("light") || 
             lowerComment.includes("danger") || lowerComment.includes("secure")) {
      return "safety";
    }
    
    return "general";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) {
      router.push("/login");
      return;
    }
    
    setSubmitting(true);
    setError("");
    setSuccess(false);
    
    try {
      // First, update the current traffic level for the field
      await setDoc(doc(db, "fields", field.id), {
        currentTraffic: trafficLevel,
        lastUpdated: serverTimestamp()
      }, { merge: true });
      
      // Create a timestamp that we'll use for both records
      const currentTimestamp = serverTimestamp();
      
      // Then, add a traffic report to the history
      const trafficReportData = {
        fieldId: field.id,
        fieldName: field.name,
        trafficLevel: trafficLevel,
        comment: comment,
        userId: user.uid,
        userEmail: user.email,
        timestamp: currentTimestamp
      };
      
      await addDoc(collection(db, "traffic-reports"), trafficReportData);
      
      // If there's a comment, also add it to the field-comments collection
      if (comment && comment.trim() !== "") {
        const category = determineCommentCategory(comment);
        
        await addDoc(collection(db, "field-comments"), {
          fieldId: field.id,
          fieldName: field.name,
          comment: comment.trim(),
          category: category,
          userId: user.uid,
          userEmail: user.email,
          userName: user.displayName || user.email.split('@')[0],
          timestamp: currentTimestamp,
          fromTrafficReport: true,
          trafficLevel: trafficLevel
        });
      }
      
      // Refresh the traffic reports
      await fetchTrafficReports();
      
      setSuccess(true);
      setComment("");
      
      // Call onSubmitSuccess callback if provided (for mobile UI)
      if (onSubmitSuccess && typeof onSubmitSuccess === 'function') {
        setTimeout(() => {
          onSubmitSuccess();
        }, 1500); // Wait a moment so user can see success message
      }
    } catch (error) {
      console.error("Error submitting traffic report: ", error);
      setError("Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-medium mb-2">{field.name}</h3>
      <p className="text-sm text-gray-500 mb-4">{field.address}</p>
      
      {/* Visual representation of the field */}
      <div className="mb-4">
        <FieldHeatmap 
          trafficLevel={aggregatedTraffic?.level || trafficLevel} 
          fieldName={field.name}
        />
      </div>
      
      {aggregatedTraffic && (
        <div className="mb-4 p-3 bg-gray-100 rounded">
          <p><strong>Current Traffic:</strong> {capitalizeFirst(aggregatedTraffic.level)}</p>
          <p><strong>Confidence:</strong> {aggregatedTraffic.confidence}% ({aggregatedTraffic.reportCount} reports)</p>
          {aggregatedTraffic.lastUpdated && (
            <p className="text-xs text-gray-500 mt-1">
              Last updated: {new Date(aggregatedTraffic.lastUpdated?.seconds * 1000).toLocaleString()}
            </p>
          )}
        </div>
      )}
      
      {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-100 text-green-700 p-2 rounded mb-4">Traffic report submitted successfully!</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Current Traffic Level</label>
          <div className="flex space-x-2">
            <TrafficButton 
              level="low" 
              selected={trafficLevel === "low"} 
              onClick={() => setTrafficLevel("low")} 
            />
            <TrafficButton 
              level="medium" 
              selected={trafficLevel === "medium"} 
              onClick={() => setTrafficLevel("medium")} 
            />
            <TrafficButton 
              level="high" 
              selected={trafficLevel === "high"} 
              onClick={() => setTrafficLevel("high")} 
            />
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Comment (Optional)</label>
          <textarea 
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full border rounded p-2 text-sm"
            placeholder="Add details about the field conditions..."
          />
          <p className="text-xs text-gray-500 mt-1">
            Your comment will be visible to other users
          </p>
        </div>
        
        {user ? (
          <button 
            type="submit" 
            disabled={submitting}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Traffic Report"}
          </button>
        ) : (
          <button 
            type="button"
            onClick={() => router.push("/login")}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
          >
            Login to Submit
          </button>
        )}
      </form>
    </div>
  );
}

function TrafficButton({ level, selected, onClick }) {
  const getColor = () => {
    const baseClass = selected ? "text-white " : "text-gray-700 ";
    
    switch(level) {
      case "low": 
        return baseClass + (selected ? "bg-green-500" : "bg-green-100");
      case "medium": 
        return baseClass + (selected ? "bg-yellow-500" : "bg-yellow-100");
      case "high": 
        return baseClass + (selected ? "bg-red-500" : "bg-red-100");
      default: 
        return baseClass + "bg-gray-200";
    }
  };
  
  const getLabel = () => {
    switch(level) {
      case "low": return "Low";
      case "medium": return "Medium";
      case "high": return "High";
      default: return "Unknown";
    }
  };
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2 px-3 rounded font-medium ${getColor()}`}
    >
      {getLabel()}
    </button>
  );
}

function capitalizeFirst(string) {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
}