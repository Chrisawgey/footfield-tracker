// src/components/FieldHeatmap.js
import React from 'react';

export default function FieldHeatmap({ trafficLevel, fieldName }) {
  // Get color based on traffic level
  const getOverlayColor = () => {
    switch(trafficLevel) {
      case "low": return "rgba(0, 255, 0, 0.4)"; // Green with transparency
      case "medium": return "rgba(255, 255, 0, 0.4)"; // Yellow with transparency
      case "high": return "rgba(255, 0, 0, 0.4)"; // Red with transparency
      default: return "rgba(200, 200, 200, 0.4)"; // Gray for unknown
    }
  };

  return (
    <div className="relative w-full h-48 rounded-lg overflow-hidden border border-gray-300">
      {/* Generic soccer field background */}
      <div className="absolute inset-0 bg-green-200">
        {/* Field markings */}
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
          {/* Center circle */}
          <div className="w-24 h-24 rounded-full border-2 border-white"></div>
          
          {/* Center line */}
          <div className="absolute w-full h-0.5 bg-white"></div>
          
          {/* Goal boxes */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-24 h-12 border-b-2 border-l-2 border-r-2 border-white"></div>
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-24 h-12 border-t-2 border-l-2 border-r-2 border-white"></div>
        </div>
      </div>
      
      {/* Traffic overlay */}
      <div 
        className="absolute inset-0"
        style={{ backgroundColor: getOverlayColor() }}
      ></div>
      
      {/* Field name */}
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 text-center">
        {fieldName || "Soccer Field"}
      </div>
    </div>
  );
}