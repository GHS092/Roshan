'use client';

import { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import ImageMask from './ImageMask';
import React from 'react';

type ImageData = {
  id: string;
  base64: string;
  preview: string;
  mask?: string;
};

type ImageUploaderProps = {
  onImagesUpload: (images: string[], masks?: Record<number, string>) => void;
  uploadedImages?: string[] | null;
  previousMasks?: Record<number, string>;
  keepMasks?: boolean;
};

export default React.memo(function ImageUploader({ 
  onImagesUpload, 
  uploadedImages,
  previousMasks,
  keepMasks = false
}: ImageUploaderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages] = useState<ImageData[]>([]);
  const [masks, setMasks] = useState<Record<number, string>>({});
  const [maskEditIndex, setMaskEditIndex] = useState<number | null>(null);
  // Usar una ref para controlar actualizaciones y evitar bucles
  const isUpdatingRef = useRef<boolean>(false);
  const lastUpdateTimeRef = useRef<number>(0);

  // Actualizar las imágenes cuando cambien las props
  useEffect(() => {
    if (uploadedImages && uploadedImages.length > 0) {
      const newImages = uploadedImages.map((img, index) => {
        // Si recibimos el base64 sin el prefijo data:image, lo agregamos
        const preview = !img.startsWith('data:') 
          ? `data:image/jpeg;base64,${img}`
          : img;
          
        return {
          id: `external-${index}-${Date.now()}`,
          base64: img,
          preview,
        };
      });
      
      setImages(newImages);
      
      // Si keepMasks está activado y hay máscaras previas disponibles, usarlas
      if (keepMasks && previousMasks && Object.keys(previousMasks).length > 0) {
        setMasks(previousMasks);
      } else if (!keepMasks) {
        // Solo limpiar máscaras si keepMasks está desactivado
        setMasks({});
      }
    } else if (uploadedImages === null) {
      // Si uploadedImages es null (explícitamente), limpiar las imágenes existentes
      setImages([]);
      
      // Solo limpiar máscaras si keepMasks está desactivado
      if (!keepMasks) {
        setMasks({});
      }
      
      // Limpiar cualquier estado interno que pudiera mantener referencias a imágenes
      isUpdatingRef.current = false;
      lastUpdateTimeRef.current = 0;
    }
  }, [uploadedImages, keepMasks, previousMasks]); // Eliminamos onImagesUpload de las dependencias
  
  // Efecto para sincronizar máscaras cuando cambian o cuando se activa keepMasks
  useEffect(() => {
    // Solo ejecutamos si hay imágenes para evitar notificaciones innecesarias
    if (images.length > 0) {
      // Usamos debounce con setTimeout para evitar actualizaciones excesivas
      const timeoutId = setTimeout(() => {
        if (!isUpdatingRef.current) {
          const imageBases = images.map(img => img.base64);
          // Siempre notificamos las máscaras actuales, sean vacías o no
          onImagesUpload(imageBases, Object.keys(masks).length > 0 ? masks : undefined);
        }
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [masks, images, onImagesUpload]);

  // Función para notificar cambios al padre, optimizada para evitar múltiples llamadas
  const notifyChanges = useCallback((newImages: ImageData[], newMasks: Record<number, string>) => {
    // Evitar actualizaciones demasiado frecuentes o durante otra actualización
    const now = Date.now();
    if (isUpdatingRef.current || (now - lastUpdateTimeRef.current < 300)) {
      return;
    }
    
    isUpdatingRef.current = true;
    lastUpdateTimeRef.current = now;
    
    // Desacoplar la operación del ciclo de renderizado actual
    const imageBases = newImages.map(img => img.base64);
    
    // Usar requestAnimationFrame para asegurar que ocurra en el momento adecuado
    requestAnimationFrame(() => {
      onImagesUpload(imageBases, Object.keys(newMasks).length > 0 ? newMasks : undefined);
      
      // Restaurar la bandera después de un breve retraso
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 50);
    });
  }, [onImagesUpload]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      
      setIsLoading(true);
      
      try {
        const newImages = await Promise.all(
          acceptedFiles.map(async (file) => {
            return new Promise<ImageData>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                // Obtener el base64 sin metadatos
                const result = reader.result as string;
                const base64String = result.split(',')[1];
                
                // Comprobar el tamaño de la imagen y limitar si es demasiado grande
                const tmpImg = new Image();
                tmpImg.onload = () => {
                  let finalPreview = result;
                  
                  // Usar la imagen original sin redimensionar para mantener calidad
                  resolve({
                    id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    base64: base64String,
                    preview: finalPreview,
                  });
                };
                tmpImg.onerror = () => reject(new Error('Error al cargar la imagen'));
                tmpImg.src = result;
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
          })
        );
        
        const updatedImages = [...images, ...newImages];
        setImages(updatedImages);
        
        // Notificar al componente padre con el método optimizado
        notifyChanges(updatedImages, masks);
      } catch (error) {
        console.error('Error al procesar las imágenes:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [images, masks, notifyChanges]
  );

  const handleRemoveImage = useCallback((id: string) => {
    setImages(prevImages => {
      const updatedImages = prevImages.filter(img => img.id !== id);
      
      // Actualizar máscaras si se elimina una imagen
      const newMasks = { ...masks };
      const indexToRemove = prevImages.findIndex(img => img.id === id);
      
      if (indexToRemove !== -1) {
        // Eliminar máscara para la imagen que se está eliminando
        delete newMasks[indexToRemove];
        
        // Reajustar los índices para las máscaras que quedan
        const adjustedMasks: Record<number, string> = {};
        Object.keys(newMasks).forEach((key) => {
          const numKey = parseInt(key);
          if (numKey > indexToRemove) {
            adjustedMasks[numKey - 1] = newMasks[numKey];
          } else {
            adjustedMasks[numKey] = newMasks[numKey];
          }
        });
        
        setMasks(adjustedMasks);
        // Notificar al componente padre usando método optimizado
        notifyChanges(updatedImages, adjustedMasks);
      } else {
        // Notificar al componente padre usando método optimizado
        notifyChanges(updatedImages, newMasks);
      }
      
      return updatedImages;
    });
  }, [masks, notifyChanges]);

  const toggleMaskMode = useCallback((index: number) => {
    // En lugar de cambiar el estado de la imagen, abrimos el modal de edición
    setMaskEditIndex(index);
  }, []);

  const closeMaskEditor = useCallback(() => {
    setMaskEditIndex(null);
  }, []);

  const handleMaskChange = useCallback((index: number, maskData: string) => {
    // Evitar actualizaciones si estamos ya en proceso
    if (isUpdatingRef.current) return;
    
    setMasks(prevMasks => {
      const newMasks = { ...prevMasks };
      
      if (maskData) {
        newMasks[index] = maskData;
      } else {
        delete newMasks[index];
      }
      
      // Usar debounce para evitar demasiadas actualizaciones
      // y envolver en requestAnimationFrame para sincronizar con el siguiente frame
      requestAnimationFrame(() => {
        // Esperar un poco antes de notificar para permitir que el estado se actualice
        setTimeout(() => {
          notifyChanges(images, newMasks);
        }, 100);
      });
      
      return newMasks;
    });
  }, [images, notifyChanges]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png']
    },
    maxFiles: 10,
    multiple: true,
  });

  // Limitar a un máximo de 3 imágenes mostradas
  const displayImages = useMemo(() => images.slice(0, 3), [images]);

  return (
    <div className="w-full image-uploader">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md ${
          isDragActive 
            ? 'border-indigo-500 bg-indigo-50/80 shadow-indigo-100' 
            : 'border-indigo-200 hover:border-indigo-300 bg-white/90'
        }`}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-300 to-purple-300 rounded-full blur-lg opacity-20 animate-pulse"></div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-16 w-16 text-indigo-500 relative"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>
          <p className="text-xl font-bold text-gray-800">
            {isDragActive ? '¡Suelta las imágenes aquí!' : 'Arrastra y suelta imágenes'}
          </p>
          <p className="text-sm text-indigo-600">o haz clic para seleccionar</p>
          <p className="text-xs text-gray-500">PNG, JPG o JPEG (máximo 10MB)</p>
          <div className="mt-2 inline-block bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-full px-4 py-2">
            <p className="text-sm font-medium text-indigo-700">
              La primera imagen será la principal (a modificar)
            </p>
          </div>
        </div>
      </div>

      {/* Mostrar las imágenes cargadas solo si hay alguna */}
      {displayImages.length > 0 && (
        <div className="mt-6">
          <p className="font-medium text-indigo-700 mb-4 flex items-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5 mr-2 text-indigo-500" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
              />
            </svg>
            Imágenes subidas ({displayImages.length}/3)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 thumbnails-container">
            {displayImages.map((image, index) => (
              <div 
                key={image.id} 
                className={`relative rounded-xl overflow-hidden shadow-lg transform transition-all duration-300 hover:scale-102 hover:shadow-xl ${
                  image.id === displayImages[0].id 
                    ? 'border-2 border-indigo-500/70 ring-2 ring-indigo-200' 
                    : 'border border-indigo-100'
                }`}
              >
                <div className="aspect-w-16">
                  <img
                    src={image.preview}
                    alt="Preview"
                    className="object-contain bg-gradient-to-br from-indigo-50/50 to-white"
                  />
                </div>
                
                <div className="absolute top-2 right-2 flex gap-2">
                  <button
                    onClick={() => toggleMaskMode(index)}
                    className={`bg-gradient-to-br ${
                      masks[index] 
                        ? 'from-green-500 to-emerald-600'
                        : 'from-indigo-500 to-purple-600'
                    } text-white rounded-full p-1.5 hover:from-indigo-600 hover:to-purple-700 focus:outline-none shadow-md transform transition-transform duration-300 hover:scale-110`}
                    aria-label={masks[index] ? "Editar máscara" : "Activar máscara"}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor" 
                      className="w-5 h-5"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" 
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleRemoveImage(image.id)}
                    className="bg-gradient-to-br from-red-500 to-pink-600 text-white rounded-full p-1.5 hover:from-red-600 hover:to-pink-700 focus:outline-none shadow-md transform transition-transform duration-300 hover:scale-110"
                    aria-label="Eliminar imagen"
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor" 
                      className="w-5 h-5"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de edición de máscara */}
      {maskEditIndex !== null && (
        <div className="fixed inset-0 bg-gray-800/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-indigo-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800 flex items-center">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-5 w-5 mr-2 text-indigo-500" 
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
                Seleccionar áreas de la imagen
              </h3>
              <button
                onClick={closeMaskEditor}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-6 w-6" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M6 18L18 6M6 6l12 12" 
                  />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                Pinta las áreas de la imagen que quieres incluir en la edición. Las áreas seleccionadas serán las únicas modificadas por la IA.
              </p>
              <div className="rounded-xl overflow-hidden">
                <ImageMask 
                  imageUrl={displayImages[maskEditIndex]?.preview || ''}
                  onMaskChange={(maskData) => handleMaskChange(maskEditIndex, maskData)}
                  className="w-full"
                />
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={closeMaskEditor}
                  className="px-4 py-2 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full hover:from-indigo-600 hover:to-purple-700 focus:outline-none shadow-md"
                >
                  Guardar y cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}); 