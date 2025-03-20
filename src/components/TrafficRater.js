// src/components/TrafficRater.js
import { useState } from "react";
import { db } from "../lib/firebase";
import { doc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import { useRouter } from "next/router";

export default function TrafficRater({ field, user }) {
  const [trafficLevel, setTrafficLevel] = useState("medium");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

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
      
      // Then, add a traffic report to the history
      await addDoc(collection(db, "traffic-reports"), {
        fieldId: field.id,
        fieldName: field.name,
        trafficLevel: trafficLevel,
        comment: comment,
        userId: user.uid,
        userEmail: user.email,
        timestamp: serverTimestamp()
      });
      
      setSuccess(true);
      setComment("");
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