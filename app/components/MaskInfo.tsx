'use client';

import { useState, useEffect } from 'react';

type MaskInfoProps = {
  masks: Record<number, string> | undefined;
  className?: string;
};

type RegionInfo = {
  minX: number;
  maxX: number; 
  minY: number;
  maxY: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
};

export default function MaskInfo({ masks, className }: MaskInfoProps) {
  const [regionsInfo, setRegionsInfo] = useState<RegionInfo[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  
  useEffect(() => {
    // Recuperar información de regiones del sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      try {
        const savedRegions = JSON.parse(sessionStorage.getItem('maskRedRegions') || '[]');
        if (savedRegions.length > 0) {
          setRegionsInfo(savedRegions);
        }
      } catch (e) {
        console.error('Error al recuperar información de regiones:', e);
      }
    }
  }, [masks]); // Refrescar cuando cambian las máscaras
  
  // Si no hay máscaras o regiones, no mostrar nada
  if (!masks || Object.keys(masks).length === 0 || regionsInfo.length === 0) {
    return null;
  }
  
  return (
    <div className={`border border-indigo-100 rounded-lg bg-indigo-50/60 p-3 ${className || ''}`}>
      <div 
        className="flex items-center text-indigo-700 cursor-pointer" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-5 w-5 mr-2 flex-shrink-0" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
          />
        </svg>
        <span className="text-sm font-medium">
          Información de máscaras - {regionsInfo.length} {regionsInfo.length === 1 ? 'región' : 'regiones'} detectada{regionsInfo.length === 1 ? '' : 's'}
        </span>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className={`h-5 w-5 ml-auto transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      
      {isExpanded && (
        <div className="mt-3 text-xs text-indigo-800">
          <p className="mb-2">Estas regiones están siendo usadas para posicionar correctamente los elementos añadidos:</p>
          <div className="grid grid-cols-2 gap-2">
            {regionsInfo.map((region, index) => (
              <div key={index} className="bg-white/50 p-2 rounded border border-indigo-100">
                <div className="font-medium">Región {index + 1}</div>
                <div className="grid grid-cols-2 gap-x-2 text-xs mt-1">
                  <div>Tamaño: {region.width}×{region.height}px</div>
                  <div>Centro: ({region.centerX}, {region.centerY})</div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-indigo-600">
            Si los elementos añadidos no aparecen correctamente centrados, prueba a cambiar la semilla de generación.
          </p>
        </div>
      )}
    </div>
  );
} 