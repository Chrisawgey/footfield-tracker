// src/components/NearbyFields.js
import { useState } from "react";
import FieldHeatmap from "./FieldHeatmap";

export default function NearbyFields({ fields, onFieldSelect }) {
  if (!fields || fields.length === 0) {
    return <div>No fields found. Try expanding your search.</div>;
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