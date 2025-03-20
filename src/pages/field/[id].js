import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { db, auth } from "../../lib/firebase";
import { doc, getDoc, collection, getDocs, query, where, orderBy, limit, addDoc, serverTimestamp } from "firebase/firestore";

export default function FieldDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [field, setField] = useState(null);
  const [trafficData, setTrafficData] = useState([]);
  const [loading, setLoading] = useState(true);

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
          const trafficRef = collection(db, "traffic");
          const trafficQuery = query(
            trafficRef, 
            where("fieldId", "==", id),
            orderBy("timestamp", "desc"),
            limit(10)
          );
          
          const trafficSnap = await getDocs(trafficQuery);
          const trafficData = trafficSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          setTrafficData(trafficData);
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
  }, [id, router]);

  const reportTraffic = async (level) => {
    if (!auth.currentUser) {
      // Redirect to login if not logged in
      router.push(`/login?redirect=/field/${id}`);
      return;
    }
    
    try {
      const trafficRef = collection(db, "traffic");
      await addDoc(trafficRef, {
        fieldId: id,
        userId: auth.currentUser.uid,
        level: level, // "Light", "Moderate", or "Crowded"
        timestamp: serverTimestamp()
      });
      
      // Refresh traffic data
      const updatedTrafficQuery = query(
        collection(db, "traffic"),
        where("fieldId", "==", id),
        orderBy("timestamp", "desc"),
        limit(10)
      );
      
      const updatedTrafficSnap = await getDocs(updatedTrafficQuery);
      const updatedTrafficData = updatedTrafficSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setTrafficData(updatedTrafficData);
    } catch (err) {
      console.error("Error reporting traffic:", err);
    }
  };

  if (loading) return <div>Loading field data...</div>;
  if (!field) return <div>Field not found</div>;

  return (
    <div>
      <h1>{field.name}</h1>
      <p>{field.address}</p>
      
      <div>
        <h2>Current Traffic</h2>
        {trafficData.length > 0 ? (
          <div>
            {/* Display traffic level with color coding */}
            <p>Last updated: {trafficData[0].timestamp && trafficData[0].timestamp.toDate().toLocaleString()}</p>
            <div 
              className={`p-4 mb-4 rounded ${
                trafficData[0].level === "Light" ? "bg-green-200" : 
                trafficData[0].level === "Moderate" ? "bg-yellow-200" : 
                "bg-red-200"
              }`}
            >
              <p className="font-bold">Current level: {trafficData[0].level}</p>
            </div>
          </div>
        ) : (
          <p>No traffic data available</p>
        )}
      </div>
      
      <div>
        <h2>Report Traffic</h2>
        <div className="flex space-x-2 mt-2">
          <button 
            onClick={() => reportTraffic("Light")}
            className="bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600"
          >
            Light
          </button>
          <button 
            onClick={() => reportTraffic("Moderate")}
            className="bg-yellow-500 text-white py-2 px-4 rounded hover:bg-yellow-600"
          >
            Moderate
          </button>
          <button 
            onClick={() => reportTraffic("Crowded")}
            className="bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600"
          >
            Crowded
          </button>
        </div>
      </div>
    </div>
  );
}