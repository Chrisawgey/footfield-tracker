// src/pages/dashboard.js
import { useState, useEffect, useRef } from "react";
import { auth, db } from "../lib/firebase";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { useRouter } from "next/router";
import Navigation from "../components/Navigation";
import Head from "next/head";
import Link from "next/link";

export default function Dashboard({ user }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  
  // User profile
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  
  // Activity data
  const [recentActivity, setRecentActivity] = useState([]);
  const [favoriteFields, setFavoriteFields] = useState([]);
  const [stats, setStats] = useState({
    totalRatings: 0,
    totalComments: 0,
    fieldsRated: 0
  });

  useEffect(() => {
    if (!user) {
      router.push("/login?redirect=/dashboard");
      return;
    }

    const loadUserProfile = async () => {
      try {
        setLoading(true);
        
        // Get user profile from Firestore if exists
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUsername(userData.username || "");
          
          // Also load user's activity
          await loadUserActivity();
        }
        
        // Set display name and photo from auth object
        setDisplayName(user.displayName || "");
        setPhotoURL(user.photoURL || "");
        
      } catch (error) {
        console.error("Error loading user profile:", error);
        setMessage({
          type: "error",
          text: "Failed to load your profile. Please try refreshing the page."
        });
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [user, router]);
  
  const loadUserActivity = async () => {
    try {
      // Get user's recent comments
      const commentsQuery = query(
        collection(db, "field-comments"),
        where("userId", "==", user.uid),
        orderBy("timestamp", "desc"),
        limit(5)
      );
      
      const commentsSnapshot = await getDocs(commentsQuery);
      const comments = commentsSnapshot.docs.map(doc => ({
        id: doc.id,
        type: "comment",
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
      
      // Get user's recent traffic reports
      const reportsQuery = query(
        collection(db, "traffic-reports"),
        where("userId", "==", user.uid),
        orderBy("timestamp", "desc"),
        limit(5)
      );
      
      const reportsSnapshot = await getDocs(reportsQuery);
      const reports = reportsSnapshot.docs.map(doc => ({
        id: doc.id,
        type: "traffic",
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
      
      // Combine and sort by timestamp
      const combined = [...comments, ...reports].sort((a, b) => 
        b.timestamp - a.timestamp
      ).slice(0, 5);
      
      setRecentActivity(combined);
      
      // Calculate stats
      setStats({
        totalRatings: reportsSnapshot.size,
        totalComments: commentsSnapshot.size,
        fieldsRated: new Set(reports.map(r => r.fieldId)).size
      });
      
      // Get favorite fields (most rated/commented)
      const fieldCounts = {};
      [...comments, ...reports].forEach(item => {
        fieldCounts[item.fieldId] = (fieldCounts[item.fieldId] || 0) + 1;
      });
      
      // Get top 3 fields
      const topFields = Object.entries(fieldCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([fieldId, count]) => ({ 
          id: fieldId, 
          name: comments.find(c => c.fieldId === fieldId)?.fieldName || 
                reports.find(r => r.fieldId === fieldId)?.fieldName || 
                "Unknown Field",
          count
        }));
      
      setFavoriteFields(topFields);
      
    } catch (error) {
      console.error("Error loading user activity:", error);
    }
  };

  const handleUsernameSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setMessage({
        type: "error",
        text: "Username cannot be empty"
      });
      return;
    }
    
    try {
      setSaving(true);
      setMessage({ type: "", text: "" });
      
      // Save to Firestore
      await setDoc(doc(db, "users", user.uid), {
        username: username.trim(),
        updatedAt: new Date()
      }, { merge: true });
      
      setMessage({
        type: "success",
        text: "Username updated successfully"
      });
      
    } catch (error) {
      console.error("Error updating username:", error);
      setMessage({
        type: "error",
        text: "Failed to update username. Please try again."
      });
    } finally {
      setSaving(false);
    }
  };
  
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setMessage({ type: "", text: "" });
      
      // Here we'd normally upload the image to storage
      // For simplicity in this demo, we'll use a placeholder URL based on initials
      // In a real implementation, you'd upload to Firebase Storage
      
      // Generate a profile picture URL (in a real app, use Firebase Storage)
      let profilePhotoUrl = photoURL;
      
      if (selectedFile) {
        // Simulate uploading to storage
        // Replace this with actual Firebase Storage upload code
        console.log("Would upload file:", selectedFile.name);
        
        // For now, generate a placeholder URL
        const initials = (displayName || username || user.email || "U").charAt(0).toUpperCase();
        const colors = ["1abc9c", "3498db", "9b59b6", "f1c40f", "e67e22", "e74c3c", "34495e"];
        const colorIndex = initials.charCodeAt(0) % colors.length;
        profilePhotoUrl = `https://via.placeholder.com/150/${colors[colorIndex]}/ffffff?text=${initials}`;
      }
      
      // Update Firebase Auth profile
      await updateProfile(user, {
        displayName: displayName,
        photoURL: profilePhotoUrl
      });
      
      // Update Firestore as well
      await setDoc(doc(db, "users", user.uid), {
        displayName: displayName,
        photoURL: profilePhotoUrl,
        updatedAt: new Date()
      }, { merge: true });
      
      setMessage({
        type: "success",
        text: "Profile updated successfully"
      });
      
      // Reset file input
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage({
        type: "error",
        text: "Failed to update profile. Please try again."
      });
    } finally {
      setSaving(false);
    }
  };
  
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setMessage({
          type: "error",
          text: "Image size must be less than 2MB"
        });
        return;
      }
      
      setSelectedFile(file);
      
      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoURL(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Format date to relative time
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

  // Get emoji for activity type
  const getActivityEmoji = (activity) => {
    if (activity.type === "comment") {
      switch(activity.category) {
        case "conditions": return "🌱";
        case "players": return "⚽";
        case "facilities": return "🚽";
        case "parking": return "🅿️";
        case "safety": return "🛡️";
        default: return "💬";
      }
    } else {
      switch(activity.trafficLevel) {
        case "low": return "🟢";
        case "medium": return "🟡";
        case "high": return "🔴";
        default: return "⚪";
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Head>
          <title>Dashboard | Footy Tracker</title>
        </Head>
        <Navigation user={user} />
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Dashboard | Footy Tracker</title>
      </Head>
      <Navigation user={user} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Dashboard header */}
        <div className="bg-gradient-to-r from-green-800 to-green-600 rounded-xl shadow-md overflow-hidden mb-8">
          <div className="md:flex">
            <div className="p-8 md:flex-shrink-0 text-center md:text-left">
              <div className="relative inline-block">
                {photoURL ? (
                  <img 
                    src={photoURL} 
                    alt="Profile" 
                    className="w-24 h-24 rounded-full border-4 border-white shadow-md object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-white text-green-800 flex items-center justify-center text-3xl font-bold border-4 border-white shadow-md">
                    {(displayName || username || user?.email || "U").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <div className="px-8 pb-8 md:pt-8 text-center md:text-left">
              <h1 className="text-xl md:text-2xl font-bold text-white mb-1">
                {displayName || username || user?.email?.split('@')[0] || "Soccer Enthusiast"}
              </h1>
              <p className="text-green-100 mb-4">{user?.email}</p>
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <div className="bg-green-700 bg-opacity-50 px-3 py-1 rounded-full text-sm text-white">
                  <span className="font-bold">{stats.totalRatings}</span> traffic reports
                </div>
                <div className="bg-green-700 bg-opacity-50 px-3 py-1 rounded-full text-sm text-white">
                  <span className="font-bold">{stats.totalComments}</span> comments
                </div>
                <div className="bg-green-700 bg-opacity-50 px-3 py-1 rounded-full text-sm text-white">
                  <span className="font-bold">{stats.fieldsRated}</span> fields visited
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left column - Profile settings */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                <h2 className="font-bold text-lg">Profile Settings</h2>
              </div>
              
              <div className="p-6">
                {message.text && (
                  <div className={`mb-6 p-3 rounded-lg text-sm ${
                    message.type === "error" 
                      ? "bg-red-50 text-red-700 border border-red-100" 
                      : "bg-green-50 text-green-700 border border-green-100"
                  }`}>
                    {message.text}
                  </div>
                )}
                
                {/* Username form */}
                <form onSubmit={handleUsernameSubmit} className="mb-8">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Username
                    </label>
                    <input 
                      type="text" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Choose a username"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      This will be displayed when you comment on fields
                    </p>
                  </div>
                  
                  <button 
                    type="submit"
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-70"
                  >
                    {saving ? "Saving..." : "Update Username"}
                  </button>
                </form>
                
                {/* Profile picture and display name form */}
                <form onSubmit={handleProfileUpdate}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Display Name
                    </label>
                    <input 
                      type="text" 
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Your display name"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Profile Picture
                    </label>
                    
                    <div className="flex items-center mb-3">
                      {photoURL ? (
                        <img 
                          src={photoURL} 
                          alt="Profile preview" 
                          className="w-16 h-16 rounded-full border border-gray-200 object-cover mr-4"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-500 mr-4">
                          {(displayName || username || user?.email || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                      
                      <div className="flex-1">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="image/*"
                          className="hidden"
                          id="profile-picture-input"
                        />
                        <label 
                          htmlFor="profile-picture-input"
                          className="inline-block bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg cursor-pointer text-sm"
                        >
                          Choose Image
                        </label>
                        
                        {selectedFile && (
                          <p className="mt-1 text-xs text-gray-500">
                            Selected: {selectedFile.name}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-500">
                      Max size: 2MB. Recommended: square image (1:1 ratio)
                    </p>
                  </div>
                  
                  <button 
                    type="submit"
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-70"
                  >
                    {saving ? "Saving..." : "Update Profile"}
                  </button>
                </form>
              </div>
            </div>
          </div>
          
          {/* Right column - Activity and stats */}
          <div className="md:col-span-2">
            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
              <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                <h2 className="font-bold text-lg">Recent Activity</h2>
              </div>
              
              <div className="p-6">
                {recentActivity.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No activity yet. Start rating fields and leaving comments!</p>
                    <Link href="/" className="inline-block mt-4 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg">
                      Explore Fields
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentActivity.map((activity) => (
                      <div key={`${activity.type}-${activity.id}`} className="border rounded-lg p-4 hover:bg-gray-50 transition">
                        <div className="flex items-start">
                          <div className="bg-green-100 text-green-800 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-lg">
                            {getActivityEmoji(activity)}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex justify-between mb-1">
                              <p className="font-medium">
                                {activity.type === "comment" ? "Left a comment" : "Rated traffic"}
                              </p>
                              <span className="text-xs text-gray-500">
                                {formatRelativeTime(activity.timestamp)}
                              </span>
                            </div>
                            
                            <Link href={`/field/${activity.fieldId}`} className="text-blue-600 hover:underline block mb-1">
                              {activity.fieldName}
                            </Link>
                            
                            {activity.type === "comment" ? (
                              <p className="text-sm text-gray-700">{activity.comment}</p>
                            ) : (
                              <p className="text-sm text-gray-700">
                                Reported 
                                <span className={`font-medium ${
                                  activity.trafficLevel === "low" ? "text-green-600" :
                                  activity.trafficLevel === "medium" ? "text-yellow-600" :
                                  "text-red-600"
                                }`}>
                                  {" " + activity.trafficLevel + " "}
                                </span>
                                traffic
                                {activity.comment && `: "${activity.comment}"`}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* View more link */}
                    <div className="text-center pt-2">
                      <button className="text-green-600 hover:text-green-800 text-sm font-medium">
                        View More Activity
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Favorite Fields */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                <h2 className="font-bold text-lg">Your Favorite Fields</h2>
              </div>
              
              <div className="p-6">
                {favoriteFields.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No favorite fields yet. Start interacting with fields to see them here!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {favoriteFields.map((field, index) => (
                      <div key={field.id} className="border rounded-lg overflow-hidden hover:shadow-md transition">
                        <div className={`h-3 ${
                          index === 0 ? "bg-yellow-400" : 
                          index === 1 ? "bg-gray-400" : 
                          "bg-amber-700"
                        }`}></div>
                        <div className="p-4">
                          <Link href={`/field/${field.id}`} className="font-medium hover:text-green-600">
                            {field.name}
                          </Link>
                          <p className="text-sm text-gray-500 mt-1">
                            {field.count} interaction{field.count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}