import React, { useState } from 'react';
import { FaExpand, FaTimes } from 'react-icons/fa';

interface ImageDisplayProps {
  src: string;
  alt: string;
}

export default function ImageDisplay({ src, alt }: ImageDisplayProps) {
  const [fullscreen, setFullscreen] = useState(false);

  const openFullscreen = () => {
    setFullscreen(true);
    // Prevenir scroll cuando la imagen está en pantalla completa
    document.body.style.overflow = 'hidden';
  };

  const closeFullscreen = () => {
    setFullscreen(false);
    // Restaurar scroll
    document.body.style.overflow = 'auto';
  };

  return (
    <>
      <div className="relative w-full h-full">
        <img 
          src={src} 
          alt={alt} 
          className="w-full h-full object-cover" 
        />
        <button
          onClick={openFullscreen}
          className="absolute bottom-2 right-2 bg-white/80 dark:bg-gray-800/80 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-white dark:hover:bg-gray-700"
          aria-label="Ver en pantalla completa"
        >
          <FaExpand className="text-purple-600" />
        </button>
      </div>

      {fullscreen && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={closeFullscreen}
        >
          <button
            onClick={closeFullscreen}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-50"
            aria-label="Cerrar pantalla completa"
          >
            <FaTimes size={24} />
          </button>
          
          <div 
            className="relative max-w-7xl max-h-screen"
            onClick={e => e.stopPropagation()}
          >
            <img 
              src={src} 
              alt={alt} 
              className="max-w-full max-h-[90vh] object-contain" 
            />
          </div>
        </div>
      )}
    </>
  );
} 