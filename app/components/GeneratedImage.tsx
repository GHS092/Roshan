'use client';
import { useState } from 'react';

export type GeneratedImageVariant = {
  imageUrl: string;
  variationLabel?: string;
};

type GeneratedImageProps = {
  imageVariants: GeneratedImageVariant[];
  onEditImage?: (index: number) => void;
  onRegenerateImage?: () => void;
};

export default function GeneratedImage({ imageVariants, onEditImage, onRegenerateImage }: GeneratedImageProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  if (!imageVariants || imageVariants.length === 0) return null;

  const handleDownload = (index: number = activeImageIndex) => {
    try {
      const imageUrl = imageVariants[index].imageUrl;
      
      // Crear un objeto de URL directamente
      fetch(imageUrl)
        .then(res => res.blob())
        .then(blob => {
          // Crear una URL para el blob
          const url = window.URL.createObjectURL(blob);
          
          // Crear un enlace temporal
          const link = document.createElement('a');
          link.href = url;
          
          const variationLabel = imageVariants[index].variationLabel || '';
          link.download = `imagen-generada-${variationLabel}-${new Date().getTime()}.jpg`;
          
          // Añadir al DOM, hacer clic y limpiar de manera segura
          document.body.appendChild(link);
          
          // Usar setTimeout para asegurar que el enlace está en el DOM
          setTimeout(() => {
            link.click();
            // Usar setTimeout para asegurar que ha iniciado la descarga antes de eliminar el enlace
            setTimeout(() => {
              // Verificar que el enlace todavía está en el DOM antes de eliminarlo
              if (document.body.contains(link)) {
                document.body.removeChild(link);
              }
              // Liberar la URL del objeto
              window.URL.revokeObjectURL(url);
            }, 100);
          }, 0);
        })
        .catch(err => {
          console.error('Error al descargar la imagen:', err);
          // Método de respaldo si falla el fetch
          fallbackDownload(index);
        });
    } catch (error) {
      console.warn('Error en el método principal de descarga:', error);
      // Si falla el método principal, usar método de respaldo
      fallbackDownload(index);
    }
  };
  
  // Método de respaldo para descargar usando el método anterior
  const fallbackDownload = (index: number = activeImageIndex) => {
    try {
      const imageUrl = imageVariants[index].imageUrl;
      const link = document.createElement('a');
      link.href = imageUrl;
      
      const variationLabel = imageVariants[index].variationLabel || '';
      link.download = `imagen-generada-${variationLabel}-${new Date().getTime()}.jpg`;
      
      // Usar la API moderna para descargar
      link.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      }));
    } catch (error) {
      console.error('Error completo al descargar la imagen:', error);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    // Bloquear scroll cuando el modal está abierto
    if (!isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  };

  const handleDownloadAll = () => {
    // Descargar todas las imágenes una tras otra
    imageVariants.forEach((_, index) => {
      // Uso de setTimeout para secuenciar las descargas
      setTimeout(() => {
        handleDownload(index);
      }, index * 700); // Retraso de 700ms entre descargas
    });
    
    // Notificar al usuario usando alert sin condición
    alert(`Se descargarán ${imageVariants.length} imágenes.`);
  };

  return (
    <div className="w-full space-y-4">
      <div className="border rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-indigo-50/30 relative group shadow-lg hover:shadow-indigo-200/40 transition-all duration-300">
        <div className="aspect-w-16">
          <img
            src={imageVariants[activeImageIndex].imageUrl}
            alt={`Imagen generada - Variante ${activeImageIndex + 1}`}
            className="w-full object-contain max-h-[500px] cursor-pointer"
            onClick={toggleFullscreen}
          />
        </div>
        <button 
          onClick={toggleFullscreen}
          className="absolute top-2 right-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-2.5 rounded-full transition-all duration-300 transform hover:scale-110 shadow-lg hover:shadow-indigo-500/50 border border-white/30 backdrop-blur-sm opacity-100"
          aria-label="Ampliar imagen"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            strokeWidth={1.5} 
            stroke="currentColor" 
            className="w-5 h-5"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" 
            />
          </svg>
        </button>

        {/* Indicador de variante activa */}
        {imageVariants.length > 1 && (
          <div className="absolute top-2 left-2 bg-black/50 text-white py-1 px-3 rounded-full text-xs font-medium backdrop-blur-sm">
            Variante {activeImageIndex + 1} de {imageVariants.length}
          </div>
        )}
      </div>

      {/* Miniaturas para cambiar entre variantes */}
      {imageVariants.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {imageVariants.map((variant, index) => (
            <button 
              key={index} 
              onClick={() => setActiveImageIndex(index)}
              className={`relative flex-shrink-0 h-20 w-20 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                activeImageIndex === index 
                  ? 'border-indigo-600 shadow-md shadow-indigo-500/30 ring-2 ring-offset-2 ring-indigo-500/30' 
                  : 'border-gray-200 hover:border-indigo-300'
              }`}
              title={variant.variationLabel || `Variante ${index + 1}`}
            >
              <img 
                src={variant.imageUrl} 
                alt={`Miniatura variante ${index + 1}`} 
                className="h-full w-full object-cover"
              />
              <div className={`absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px] ${
                activeImageIndex === index ? 'opacity-0' : 'opacity-70'
              }`}>
                <span className="text-white text-xs font-bold">{index + 1}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-wrap gap-3 mb-2 w-full sm:w-auto sm:mb-0">
          {onEditImage && (
            <button
              onClick={() => onEditImage(activeImageIndex)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-full shadow-lg text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform transition-transform hover:scale-105"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
              Editar
            </button>
          )}
          
          {onRegenerateImage && (
            <button
              onClick={onRegenerateImage}
              className="flex-1 sm:flex-none inline-flex items-center justify-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-full shadow-lg text-white bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transform transition-transform hover:scale-105"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
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
              Regenerar
            </button>
          )}
        </div>
        
        <div className="flex flex-wrap gap-3 flex-1 sm:flex-none">
          <button
            onClick={toggleFullscreen}
            className="flex-1 inline-flex items-center justify-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-full shadow-lg text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transform transition-transform hover:scale-105"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Ampliar
          </button>
          
          <button
            onClick={() => handleDownload(activeImageIndex)}
            className="flex-1 inline-flex items-center justify-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-full shadow-lg text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transform transition-transform hover:scale-105"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Descargar
          </button>
        </div>
      </div>

      {/* Botón para descargar todas las variantes */}
      {imageVariants.length > 1 && (
        <button
          onClick={handleDownloadAll}
          className="w-full flex items-center justify-center px-5 py-2.5 border border-indigo-600 text-sm font-medium rounded-full text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 mt-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          Descargar todas las variantes
        </button>
      )}

      {/* Modal de imagen a pantalla completa */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 bg-gradient-to-br from-gray-900/95 to-black/98 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6"
          onClick={toggleFullscreen}
        >
          <div className="relative max-w-7xl w-full h-full flex items-center justify-center">
            {/* Botón de cerrar más sutil */}
            <button 
              onClick={toggleFullscreen}
              className="fixed top-3 right-3 z-50 bg-black/40 hover:bg-red-500/80 text-white/80 hover:text-white p-2 rounded-full transition-all duration-300 shadow-sm transform hover:scale-105 border border-white/10 backdrop-blur-sm flex items-center gap-1.5"
              aria-label="Cerrar imagen"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                strokeWidth={2} 
                stroke="currentColor" 
                className="w-4 h-4"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  d="M6 18L18 6M6 6l12 12" 
                />
              </svg>
              <span className="hidden sm:inline text-xs font-medium">Cerrar</span>
            </button>

            {/* Marco estético para la imagen */}
            <div className="relative bg-gradient-to-br from-white/10 to-white/5 rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl border border-white/20 w-full max-w-5xl mx-auto transform transition-all duration-500 scale-100">
              {/* Decoración del marco */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl opacity-50"></div>
              <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl opacity-20 blur-sm"></div>
              
              {/* Contenedor de la imagen con sombra interior */}
              <div className="relative rounded-xl overflow-hidden shadow-inner bg-black/30">
                <img
                  src={imageVariants[activeImageIndex].imageUrl}
                  alt={`Imagen generada a pantalla completa - Variante ${activeImageIndex + 1}`}
                  className="w-full h-full object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              
              {/* Controles de navegación en pantalla completa si hay múltiples variantes */}
              {imageVariants.length > 1 && (
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-2 bg-black/40 backdrop-blur-sm p-1.5 rounded-full">
                  {imageVariants.map((_, index) => (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveImageIndex(index);
                      }}
                      className={`h-3 w-3 rounded-full transition-all ${
                        activeImageIndex === index
                          ? 'bg-white scale-110'
                          : 'bg-white/40 hover:bg-white/70'
                      }`}
                      aria-label={`Ver variante ${index + 1}`}
                    />
                  ))}
                </div>
              )}
              
              {/* Botones de navegación laterales para pantalla completa */}
              {imageVariants.length > 1 && (
                <>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImageIndex(prev => (prev > 0 ? prev - 1 : imageVariants.length - 1));
                    }}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/60 text-white/80 hover:text-white p-2 rounded-full transition-all duration-300 shadow-sm border border-white/10 backdrop-blur-sm"
                    aria-label="Imagen anterior"
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      strokeWidth={2} 
                      stroke="currentColor" 
                      className="w-6 h-6"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        d="M15.75 19.5L8.25 12l7.5-7.5" 
                      />
                    </svg>
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImageIndex(prev => (prev < imageVariants.length - 1 ? prev + 1 : 0));
                    }}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/60 text-white/80 hover:text-white p-2 rounded-full transition-all duration-300 shadow-sm border border-white/10 backdrop-blur-sm"
                    aria-label="Imagen siguiente"
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      strokeWidth={2} 
                      stroke="currentColor" 
                      className="w-6 h-6"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        d="M8.25 4.5l7.5 7.5-7.5 7.5" 
                      />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 