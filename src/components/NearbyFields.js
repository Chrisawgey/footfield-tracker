// src/components/NearbyFields.js
import { useState } from "react";

export default function NearbyFields({ fields, onFieldSelect }) {
  if (!fields || fields.length === 0) {
    return <div>No fields found nearby. Try expanding your search.</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="divide-y divide-gray-200">
        {fields.map((field) => (
          <div 
            key={field.id} 
            className="p-4 hover:bg-gray-50 cursor-pointer"
            onClick={() => onFieldSelect(field)}
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium">{field.name}</h3>
                <p className="text-sm text-gray-500">{field.address}</p>
                <div className="flex items-center mt-2">
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full mr-2">
                    {field.surface || "Grass"}
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    {field.distance ? `${field.distance.toFixed(1)} km away` : "Distance unknown"}
                  </span>
                </div>
              </div>
              <div>
                <TrafficIndicator trafficLevel={field.currentTraffic || "unknown"} />
              </div>
            </div>
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