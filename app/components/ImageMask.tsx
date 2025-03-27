'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';

// Importar Konva dinámicamente solo en el cliente
const KonvaComponents = dynamic(
  () => import('./KonvaComponents'),
  { ssr: false }
);

interface ImageMaskProps {
  imageUrl: string;
  width?: number;
  height?: number;
  brushSize?: number;
  onMaskChange?: (maskData: string) => void;
  className?: string;
}

const ImageMask: React.FC<ImageMaskProps> = ({
  imageUrl,
  width = 700,
  height = 700,
  brushSize = 15,
  onMaskChange,
  className = '',
}) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [lines, setLines] = useState<{points: number[]; brushSize: number}[]>([]);
  const [isPainting, setIsPainting] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [actualWidth, setActualWidth] = useState(width);
  const [actualHeight, setActualHeight] = useState(height);
  const [currentBrushSize, setCurrentBrushSize] = useState(brushSize);
  const containerRef = useRef<HTMLDivElement>(null);
  // Ref para almacenar la última máscara generada y evitar actualizaciones innecesarias
  const lastMaskRef = useRef<string>('');
  // Ref para controlar si estamos en proceso de actualización
  const isUpdatingRef = useRef<boolean>(false);

  // Cargar la imagen y ajustar tamaño
  useEffect(() => {
    if (!imageUrl) return;

    const img = new window.Image();
    img.src = imageUrl;
    img.crossOrigin = 'Anonymous';
    
    img.onload = () => {
      setImage(img);
      adjustImageSize(img);
    };
  }, [imageUrl, width, height]);

  // Ajustar tamaño cuando cambie el contenedor
  useEffect(() => {
    function handleResize() {
      if (image) {
        adjustImageSize(image);
      }
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [image]);

  // Función para ajustar el tamaño de la imagen
  const adjustImageSize = useCallback((img: HTMLImageElement) => {
    const container = containerRef.current;
    if (!container) return;

    // Obtener el ancho disponible del contenedor
    const containerWidth = container.clientWidth;
    // Usar un valor más pequeño para asegurar que cabe en pantallas pequeñas
    const maxHeight = Math.min(window.innerHeight * 0.6, height);
    const maxWidth = Math.min(containerWidth - 40, width); // 40px de margen

    // Calcular las dimensiones para mantener la proporción
    const imgAspectRatio = img.width / img.height;
    
    let newWidth, newHeight;
    
    if (imgAspectRatio > 1) {
      // Imagen más ancha que alta - ajustar al ancho
      newWidth = maxWidth;
      newHeight = newWidth / imgAspectRatio;
      
      // Si la altura calculada supera la máxima, ajustar por altura
      if (newHeight > maxHeight) {
        newHeight = maxHeight;
        newWidth = newHeight * imgAspectRatio;
      }
    } else {
      // Imagen más alta que ancha - ajustar a la altura
      newHeight = maxHeight;
      newWidth = newHeight * imgAspectRatio;
      
      // Si el ancho calculado supera el máximo, ajustar por ancho
      if (newWidth > maxWidth) {
        newWidth = maxWidth;
        newHeight = newWidth / imgAspectRatio;
      }
    }
    
    // Actualizar dimensiones
    setActualWidth(newWidth);
    setActualHeight(newHeight);
  }, [height, width]);

  // Eventos para manejar el dibujo - uso callback para memoizar funciones
  const handleMouseDown = useCallback((pos: {x: number, y: number}) => {
    setIsPainting(true);
    if (pos) {
      const newLine = {
        points: [pos.x, pos.y],
        brushSize: isErasing ? currentBrushSize * 2 : currentBrushSize,
      };
      setLines(prevLines => [...prevLines, newLine]);
    }
  }, [isErasing, currentBrushSize]);

  const handleMouseMove = useCallback((pos: {x: number, y: number}) => {
    if (!isPainting) return;
    
    if (pos) {
      setLines(prevLines => {
        // Verificar que hay líneas existentes
        if (prevLines.length === 0) return prevLines;
        
        const lastLine = prevLines[prevLines.length - 1];
        if (!lastLine) return prevLines;
        
        // Crear una copia de las líneas
        const updatedLines = [...prevLines];
        // Añadir punto a la última línea
        const newPoints = [...lastLine.points, pos.x, pos.y];
        updatedLines[updatedLines.length - 1] = {
          ...lastLine,
          points: newPoints
        };
        
        return updatedLines;
      });
    }
  }, [isPainting]);

  const handleMouseUp = useCallback(() => {
    setIsPainting(false);
  }, []);

  // Gestionar eventos táctiles
  useEffect(() => {
    const preventScrolling = (e: TouchEvent) => {
      if (isPainting) {
        e.preventDefault();
      }
    };

    // Prevenir zoom y desplazamiento durante la edición
    const container = containerRef.current;
    if (container) {
      container.addEventListener('touchmove', preventScrolling, { passive: false });
      return () => {
        container.removeEventListener('touchmove', preventScrolling);
      };
    }
  }, [isPainting]);

  // Cambiar entre modo dibujo y borrado
  const toggleEraseMode = useCallback(() => {
    setIsErasing(prev => !prev);
  }, []);

  // Limpiar todas las líneas dibujadas
  const clearMask = useCallback(() => {
    setLines([]);
    if (onMaskChange) {
      lastMaskRef.current = '';
      onMaskChange('');
    }
  }, [onMaskChange]);

  // Cambiar tamaño del pincel
  const changeBrushSize = useCallback((size: number) => {
    setCurrentBrushSize(size);
  }, []);

  // Manejar cambios en la máscara desde KonvaComponents
  const handleMaskChange = useCallback((maskData: string) => {
    // Evitar actualizaciones redundantes o bucles
    if (maskData === lastMaskRef.current || isUpdatingRef.current) return;
    
    // Marcar que estamos actualizando para evitar llamadas múltiples
    isUpdatingRef.current = true;
    
    // Almacenar el último valor para comparaciones futuras
    lastMaskRef.current = maskData;
    
    // Propagar el cambio solo si hay un handler
    if (onMaskChange) {
      // Usar requestAnimationFrame para sincronizar con el ciclo de renderizado
      requestAnimationFrame(() => {
        // Esperar un breve momento antes de notificar el cambio
        setTimeout(() => {
          onMaskChange(maskData);
          // Restaurar la bandera de actualización después de un retraso
          setTimeout(() => {
            isUpdatingRef.current = false;
          }, 50);
        }, 10);
      });
    } else {
      // Restaurar la bandera si no hay handler
      isUpdatingRef.current = false;
    }
  }, [onMaskChange]);

  // Limpiar el estado de pintura cuando cambia la imagen
  useEffect(() => {
    // Limpiar las líneas cuando cambia la URL de la imagen
    setLines([]);
    setIsPainting(false);
    lastMaskRef.current = '';
    isUpdatingRef.current = false;
  }, [imageUrl]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="absolute top-2 right-2 z-10 flex gap-2 flex-wrap justify-end">
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-md">
          <span className="text-xs font-medium text-gray-700">Tamaño:</span>
          <button 
            className={`h-4 w-4 rounded-full ${currentBrushSize === 5 ? 'bg-indigo-500' : 'bg-gray-300'}`}
            onClick={() => changeBrushSize(5)}
          />
          <button 
            className={`h-6 w-6 rounded-full ${currentBrushSize === 15 ? 'bg-indigo-500' : 'bg-gray-300'}`}
            onClick={() => changeBrushSize(15)}
          />
          <button 
            className={`h-8 w-8 rounded-full ${currentBrushSize === 25 ? 'bg-indigo-500' : 'bg-gray-300'}`}
            onClick={() => changeBrushSize(25)}
          />
        </div>
        <button
          className={`px-3 py-1.5 rounded-full text-xs font-medium shadow-md transition-all ${
            isErasing 
              ? 'bg-green-500 text-white'
              : 'bg-white text-gray-800 border border-gray-200'
          }`}
          onClick={toggleEraseMode}
        >
          {isErasing ? 'Borrar ✓' : 'Borrar'}
        </button>
        <button
          className="bg-red-500 text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-md hover:bg-red-600 transition-all"
          onClick={clearMask}
        >
          Limpiar
        </button>
      </div>
      
      <div className="flex justify-center my-4">
        {/* Renderizar los componentes de Konva solo en el cliente */}
        <KonvaComponents
          image={image}
          lines={lines}
          isErasing={isErasing}
          actualWidth={actualWidth}
          actualHeight={actualHeight}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMaskChange={handleMaskChange}
        />
      </div>
      
      <div className="absolute bottom-2 left-2 bg-white/70 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium shadow-sm">
        <span>
          {lines.length > 0 ? 
            `${isErasing ? 'Borrando áreas' : 'Seleccionando áreas'} - ${lines.length} trazos` : 
            `Pinta las áreas que deseas ${isErasing ? 'borrar' : 'seleccionar'}`}
        </span>
      </div>
    </div>
  );
};

export default React.memo(ImageMask); 