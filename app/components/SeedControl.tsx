'use client';

import { useState, useEffect } from 'react';
import { resetGenerationSeed, isSeedLocked, setSeedLocked } from '../lib/gemini';

type SeedControlProps = {
  className?: string;
  onLockChange?: (locked: boolean) => void;
};

export default function SeedControl({ className, onLockChange }: SeedControlProps) {
  const [currentSeed, setCurrentSeed] = useState<number | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // Al iniciar, intentamos obtener la semilla actual y el estado de bloqueo
  useEffect(() => {
    // La semilla se reinicia si no hay una (genera una nueva)
    const seed = resetGenerationSeed();
    setCurrentSeed(seed);
    
    // Obtenemos el estado de bloqueo actual
    setIsLocked(isSeedLocked());

    // Agregar un listener para actualizar la semilla cuando cambie globalmente
    const handleSeedChange = (event: CustomEvent) => {
      if (event.detail && typeof event.detail.seed === 'number') {
        console.log("Actualizando visualización de semilla:", event.detail.seed);
        setCurrentSeed(event.detail.seed);
      }
    };

    // Registrar el evento personalizado para actualizaciones de semilla
    window.addEventListener('seedChanged' as any, handleSeedChange as EventListener);

    // Limpiar el listener cuando el componente se desmonte
    return () => {
      window.removeEventListener('seedChanged' as any, handleSeedChange as EventListener);
    };
  }, []);

  const handleResetSeed = () => {
    if (isLocked) return; // No permitir cambios si está bloqueada

    const newSeed = resetGenerationSeed();
    setCurrentSeed(newSeed);
    setShowTooltip(true);
    
    // Ocultar el tooltip después de 3 segundos
    setTimeout(() => {
      setShowTooltip(false);
    }, 3000);
  };

  const toggleLock = () => {
    const newLockState = !isLocked;
    setIsLocked(newLockState);
    
    // Actualizar el estado de bloqueo en el módulo gemini
    setSeedLocked(newLockState);
    
    // Notificar al componente padre sobre el cambio
    if (onLockChange) {
      onLockChange(newLockState);
    }
  };

  return (
    <div className={`flex items-center text-sm ${className || ''}`}>
      <div className="flex items-center relative">
        <button
          onClick={handleResetSeed}
          className={`flex items-center text-xs gap-1.5 py-1.5 px-3 rounded-full ${
            isLocked 
              ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
              : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors'
          }`}
          title={isLocked ? "Desbloquea la semilla para cambiarla" : "Reiniciar semilla para variedad en las imágenes"}
          disabled={isLocked}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
            />
          </svg>
          <span>
            Semilla: {currentSeed || '---'}
          </span>
        </button>
        
        {/* Botón de candado */}
        <button
          onClick={toggleLock}
          className={`ml-1 p-1.5 rounded-full ${
            isLocked 
              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          } transition-colors`}
          title={isLocked ? "Desbloquear semilla" : "Bloquear semilla actual"}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d={isLocked 
                ? "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
                : "M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
              }
            />
          </svg>
        </button>
        
        {showTooltip && (
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 text-xs bg-indigo-700 text-white rounded-lg shadow-lg whitespace-nowrap">
            ¡Semilla actualizada!
            <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-indigo-700 rotate-45"></div>
          </div>
        )}
      </div>
      
      <div className="ml-2 group relative cursor-help">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-4 w-4 text-indigo-500" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
          />
        </svg>
        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg z-10">
          <p>La semilla controla la consistencia de las generaciones. Mantener la misma semilla ayuda a generar el mismo tipo de elementos en áreas enmascaradas.</p>
          <p className="mt-1">El candado <span className="inline-block align-text-bottom"><svg className="h-3 w-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg></span> permite bloquear la semilla para mantenerla entre generaciones.</p>
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
        </div>
      </div>
    </div>
  );
} 