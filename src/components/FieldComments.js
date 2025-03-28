// src/components/FieldComments.js - Complete updated version
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, query, where, orderBy, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/router";

const COMMENT_CATEGORIES = [
  { id: "conditions", label: "Field Conditions", emoji: "🌱" },
  { id: "players", label: "Players & Games", emoji: "⚽" },
  { id: "facilities", label: "Facilities", emoji: "🚽" },
  { id: "parking", label: "Parking", emoji: "🅿️" },
  { id: "safety", label: "Safety", emoji: "🛡️" },
  { id: "general", label: "General", emoji: "💬" }
];

export default function FieldComments({ field, user }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("general");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const router = useRouter();

  useEffect(() => {
    if (field?.id) {
      fetchComments();
      console.log("Fetching comments for field:", field.id);
    }
  }, [field]);
  
  // Add debugging logs
  useEffect(() => {
    console.log("Comments loaded:", comments.length);
    console.log("Comments data:", comments);
  }, [comments]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      console.log("Starting to fetch comments for field ID:", field.id);
      
      const commentsRef = collection(db, "field-comments");
      
      // Using a simplified query first to ensure it works
      const q = query(
        commentsRef,
        where("fieldId", "==", field.id)
      );
      
      console.log("Executing Firestore query");
      const snapshot = await getDocs(q);
      console.log("Query completed, docs count:", snapshot.size);
      
      if (snapshot.empty) {
        console.log("No comments found for this field");
        setComments([]);
      } else {
        const fetchedComments = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log("Comment data:", data);
          return {
            id: doc.id,
            ...data,
            // Handle different timestamp formats safely
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date()
          };
        });
        
        // Sort comments by timestamp manually (newest first)
        fetchedComments.sort((a, b) => b.timestamp - a.timestamp);
        
        console.log("Processed comments:", fetchedComments);
        setComments(fetchedComments);
      }
      
      setError(null);
    } catch (err) {
      console.error("Error fetching comments:", err);
      setError("Failed to load comments. Please try again later: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    
    if (!user) {
      router.push(`/login?redirect=/field/${field.id}`);
      return;
    }
    
    if (!newComment.trim()) {
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      // Auto-detect categories from comment content (simple keyword matching)
      let detectedCategory = selectedCategory;
      
      if (selectedCategory === "general") {
        // Only try to auto-detect if user selected "general"
        const lowerComment = newComment.toLowerCase();
        
        if (lowerComment.includes("mud") || lowerComment.includes("grass") || 
            lowerComment.includes("turf") || lowerComment.includes("condition")) {
          detectedCategory = "conditions";
        } 
        else if (lowerComment.includes("game") || lowerComment.includes("player") || 
                 lowerComment.includes("team") || lowerComment.includes("match")) {
          detectedCategory = "players";
        }
        else if (lowerComment.includes("bathroom") || lowerComment.includes("toilet") || 
                 lowerComment.includes("water") || lowerComment.includes("bench")) {
          detectedCategory = "facilities";
        }
        else if (lowerComment.includes("park") || lowerComment.includes("car") || 
                 lowerComment.includes("lot")) {
          detectedCategory = "parking";
        }
        else if (lowerComment.includes("safe") || lowerComment.includes("light") || 
                 lowerComment.includes("danger") || lowerComment.includes("secure")) {
          detectedCategory = "safety";
        }
      }
      
      await addDoc(collection(db, "field-comments"), {
        fieldId: field.id,
        fieldName: field.name,
        comment: newComment.trim(),
        category: detectedCategory,
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || user.email.split('@')[0],
        timestamp: serverTimestamp()
      });
      
      // Clear the form
      setNewComment("");
      
      // Refresh comments
      await fetchComments();
    } catch (err) {
      console.error("Error posting comment:", err);
      setError("Failed to post your comment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const getFilteredComments = () => {
    if (activeFilter === "all") {
      return comments;
    }
    return comments.filter(comment => comment.category === activeFilter);
  };

  const getCategoryInfo = (categoryId) => {
    return COMMENT_CATEGORIES.find(cat => cat.id === categoryId) || 
           { id: "general", label: "General", emoji: "💬" };
  };

  // Format date to more user-friendly format
  const formatDate = (date) => {
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

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="border-b p-4 bg-gray-50">
        <h3 className="font-medium text-lg">Field Comments</h3>
      </div>
      
      {/* Category filters */}
      <div className="p-4 border-b overflow-x-auto">
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1 rounded-full text-sm ${
              activeFilter === "all" 
                ? "bg-blue-100 text-blue-800" 
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          
          {COMMENT_CATEGORIES.map(category => (
            <button
              type="button"
              key={category.id}
              onClick={() => setActiveFilter(category.id)}
              className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
                activeFilter === category.id 
                  ? "bg-blue-100 text-blue-800" 
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {category.emoji} {category.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Comment list */}
      <div className="p-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading comments...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-700 rounded">
            {error}
          </div>
        ) : getFilteredComments().length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {activeFilter === "all" 
              ? "No comments yet. Be the first to leave a comment!" 
              : `No comments in the ${getCategoryInfo(activeFilter).label} category yet.`}
          </div>
        ) : (
          <div className="space-y-4">
            {getFilteredComments().map(comment => (
              <div key={comment.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex items-center">
                    <div className="bg-blue-100 text-blue-800 w-8 h-8 rounded-full flex items-center justify-center mr-2 font-bold text-sm">
                      {comment.userName?.substring(0, 1).toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="font-medium">{comment.userName || "Anonymous"}</p>
                      <p className="text-xs text-gray-500">{formatDate(comment.timestamp)}</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                    {getCategoryInfo(comment.category).emoji} {getCategoryInfo(comment.category).label}
                  </span>
                </div>
                <p className="mt-2">{comment.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Comment form */}
      <div className="p-4 bg-gray-50 border-t">
        <form onSubmit={handleSubmitComment}>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Add a comment</label>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Share your thoughts about this field..."
              className="w-full border rounded p-2 text-sm"
              rows="3"
              required
            />
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <label className="text-sm font-medium mr-2">Category:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="border rounded p-1 text-sm"
              >
                {COMMENT_CATEGORIES.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.emoji} {category.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select "General" for automatic category detection
              </p>
            </div>
            
            {user ? (
              <button
                type="submit"
                disabled={submitting || !newComment.trim()}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 text-sm sm:self-end"
              >
                {submitting ? "Posting..." : "Post Comment"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push(`/login?redirect=/field/${field.id}`)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm sm:self-end"
              >
                Login to Comment
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}