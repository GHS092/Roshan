'use client';

import React, { useState, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { FaImage, FaTrash, FaBroom, FaDownload, FaCog, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { generateImageFromText } from '../lib/gemini';
import { getOptimizedRostroParams } from '../lib/rostroPrompts';
import { prepareImagesForGemini } from '../lib/imageUtils';
import { Slider } from '../components/Slider';
import ImageDisplay from './ImageDisplay';
import AdvancedSettings from './AdvancedSettings';

// Estilos de imagen predefinidos
const ESTILOS_IMAGEN = [
  { id: 'none', nombre: 'Ninguno' },
  { id: 'photo', nombre: 'Fotografía' },
  { id: 'realistic', nombre: 'Realista' },
  { id: 'digital-art', nombre: '3D Digital Art' },
  { id: 'painting', nombre: 'Pintura' },
  { id: 'watercolor', nombre: 'Acuarela' },
  { id: 'cartoon', nombre: 'Caricatura' },
  { id: 'anime', nombre: 'Anime' },
  { id: 'cinematic', nombre: 'Cinematográfico' },
];

export default function TextToImageGenerator() {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [creativity, setCreativity] = useState(0.4);
  const [isHighResolution, setIsHighResolution] = useState(true);
  const [realismLevel, setRealismLevel] = useState(0.8);
  const [selectedStyle, setSelectedStyle] = useState('none');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  
  // Estados para los ajustes avanzados
  const [advancedSettings, setAdvancedSettings] = useState({
    estiloFotografico: 'digital',
    texturaPiel: 'media',
    iluminacion: 'natural',
    postProcesado: 'moderado',
    nivelDetalle: 0.7,
    saturacionColor: 0.5,
    profundidadSombras: 0.5,
    nitidezDetalles: 0.6,
    imagenReferencia: null as string | null,
    // Nuevos campos para rostro persistente
    rostroPersistente: false,
    imagenesRostro: [] as string[]
  });
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  };

  const handleCreativityChange = (value: number) => {
    setCreativity(value);
  };
  
  const handleRealismChange = (value: number) => {
    setRealismLevel(value);
  };

  const handleAdvancedSettingsChange = (newSettings: any) => {
    setAdvancedSettings({...advancedSettings, ...newSettings});
  };

  const handleGenerateImage = async () => {
    if (!prompt.trim()) {
      toast.error('Por favor, escribe una descripción para generar la imagen');
      return;
    }

    try {
      setGenerating(true);
      toast.loading('Generando imagen, por favor espera...', { id: 'generating' });

      // Preparar las opciones base
      const optionsBase = {
        temperature: creativity,
        highResolution: isHighResolution,
        realism: realismLevel,
        style: selectedStyle !== 'none' ? selectedStyle : undefined,
        seed: Math.floor(Math.random() * 100000), // Generar una semilla aleatoria en cada llamada
        topK: 32, // Valor por defecto para topK
        topP: 0.8, // Valor por defecto para topP
      };

      // Opciones avanzadas (si están habilitadas)
      let advancedOpts = {};
      if (showAdvancedSettings) {
        const { imagenesRostro, imagenReferencia, ...otherSettings } = advancedSettings;
        
        advancedOpts = {
          ...otherSettings,
          rostroPersistente: advancedSettings.rostroPersistente,
        };
        
        // Convertir imagen de referencia si existe
        if (imagenReferencia) {
          try {
            toast('Preparando imagen de referencia...', { duration: 1000 });
            const compatibleRefImage = await prepareImagesForGemini([imagenReferencia]);
            if (compatibleRefImage.length > 0) {
              advancedOpts = { ...advancedOpts, imagenReferencia: compatibleRefImage[0] };
            }
          } catch (error) {
            console.error('Error al convertir imagen de referencia:', error);
            toast.error('Problema con el formato de la imagen de referencia');
          }
        }
        
        // Convertir imágenes de rostro si existen
        if (advancedSettings.rostroPersistente && imagenesRostro.length > 0) {
          try {
            toast('Preparando imágenes de rostro...', { duration: 2000 });
            const compatibleFaceImages = await prepareImagesForGemini(imagenesRostro);
            if (compatibleFaceImages.length > 0) {
              advancedOpts = { 
                ...advancedOpts, 
                imagenesRostro: compatibleFaceImages,
                rostroPersistente: true
              };
              
              // Mostrar cuántas imágenes se procesaron correctamente
              console.log(`Procesadas ${compatibleFaceImages.length} imágenes de rostro en formato compatible`);
            } else {
              toast.error('No se pudieron convertir las imágenes de rostro a un formato compatible');
            }
          } catch (error) {
            console.error('Error al convertir imágenes de rostro:', error);
            toast.error('Problema con el formato de las imágenes de rostro');
          }
        }
      }

      // Combinar opciones base con avanzadas
      const options: any = {
        ...optionsBase,
        ...(showAdvancedSettings ? advancedOpts : {})
      };

      // Optimizar parámetros para rostro persistente cuando hay imágenes disponibles
      if (options.rostroPersistente && options.imagenesRostro && options.imagenesRostro.length > 0) {
        const numImages = options.imagenesRostro.length;
        
        // Utilizar la función optimizada para ajustar parámetros según número de imágenes
        const optimizedParams = getOptimizedRostroParams(numImages, creativity, 32);
        
        // Aplicar parámetros optimizados
        options.temperature = optimizedParams.temperature;
        options.topK = optimizedParams.topK;
        options.topP = optimizedParams.topP;
        
        if (numImages >= 4) {
          toast.success(`Optimizando para ${numImages} imágenes de rostro (T: ${options.temperature.toFixed(2)}, K: ${options.topK})`);
        } else {
          toast(`Rostro persistente activo con ${numImages} imágenes. Para resultados óptimos, sube 4-6 imágenes.`, {
            icon: '🔍',
            duration: 3000
          });
        }
      }

      const generatedImageData = await generateImageFromText(prompt, options);
      setGeneratedImages(prev => [generatedImageData, ...prev]);
      toast.success('¡Imagen generada con éxito!', { id: 'generating' });
    } catch (error) {
      console.error('Error al generar la imagen:', error);
      toast.error(`Error al generar la imagen: ${error instanceof Error ? error.message : 'Intenta con otro formato de imagen'}`, { id: 'generating' });
    } finally {
      setGenerating(false);
    }
  };

  const handleClearHistory = () => {
    setGeneratedImages([]);
    toast.success('Historial de imágenes limpiado');
  };

  const handleDownloadImage = (imageUrl: string, index: number) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `imagen-generada-${Date.now()}-${index}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Imagen descargada');
  };

  return (
    <div className="relative">
      <Toaster position="top-right" />
      
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
          Generador de Imágenes con IA
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Escribe una descripción detallada de la imagen que deseas crear y la inteligencia artificial la generará para ti.
        </p>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Descripción detallada
          </label>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={handlePromptChange}
            className="w-full px-3 py-2 text-gray-700 dark:text-white bg-white dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
            rows={4}
            placeholder="Ej: crea una casa moderna con piscina un un jardín enorme"
          />
        </div>
        
        {/* Controles de calidad y estilo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Creatividad: {creativity.toFixed(1)}
                </label>
                <div className="text-xs text-gray-500 flex items-center">
                  <span className="mr-8">Más precisión</span>
                  <span>Más creatividad</span>
                </div>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.1}
                value={creativity}
                onChange={handleCreativityChange}
              />
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Realismo: {realismLevel.toFixed(1)}
                </label>
                <div className="text-xs text-gray-500 flex items-center">
                  <span className="mr-8">Estilizado</span>
                  <span>Fotorrealista</span>
                </div>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.1}
                value={realismLevel}
                onChange={handleRealismChange}
              />
            </div>
          </div>
          
          <div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Estilo de imagen
              </label>
              <select
                value={selectedStyle}
                onChange={(e) => setSelectedStyle(e.target.value)}
                className="w-full px-3 py-2 text-gray-700 dark:text-white bg-white dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
              >
                {ESTILOS_IMAGEN.map(estilo => (
                  <option key={estilo.id} value={estilo.id}>
                    {estilo.nombre}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="highResolution"
                checked={isHighResolution}
                onChange={(e) => setIsHighResolution(e.target.checked)}
                className="mr-2 h-4 w-4 text-purple-600 focus:ring-purple-600 border-gray-300 rounded"
              />
              <label htmlFor="highResolution" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Alta resolución (FHD 1920x1080)
              </label>
            </div>
          </div>
        </div>
        
        {/* Botón de ajustes avanzados */}
        <div className="mb-6">
          <button
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            <FaCog className="text-gray-600 dark:text-gray-300" />
            Ajustes Avanzados
            {showAdvancedSettings ? <FaChevronUp /> : <FaChevronDown />}
          </button>
        </div>
        
        {/* Panel de ajustes avanzados */}
        {showAdvancedSettings && (
          <div className="mb-6 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-4">
              Ajustes Avanzados
            </h3>
            
            <AdvancedSettings 
              values={advancedSettings}
              onChange={handleAdvancedSettingsChange}
            />
          </div>
        )}
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleGenerateImage}
            disabled={generating || !prompt.trim()}
            className={`flex items-center justify-center px-4 py-2 text-white bg-purple-600 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-600 ${
              (generating || !prompt.trim()) && 'opacity-50 cursor-not-allowed'
            }`}
          >
            <FaImage className="mr-2" />
            Generar Imagen
          </button>
          
          <button
            onClick={handleClearHistory}
            disabled={generating || generatedImages.length === 0}
            className={`flex items-center justify-center px-4 py-2 text-white bg-gray-600 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600 ${
              (generating || generatedImages.length === 0) && 'opacity-50 cursor-not-allowed'
            }`}
          >
            <FaBroom className="mr-2" />
            Limpiar Historial
          </button>
        </div>
      </div>
      
      {generatedImages.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
            Imágenes Generadas ({generatedImages.length})
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {generatedImages.map((imageUrl, index) => (
              <div key={index} className="relative">
                <div className="group relative rounded-lg overflow-hidden shadow-md border border-gray-200 dark:border-gray-700">
                  <div className="relative aspect-w-16 aspect-h-9">
                    <ImageDisplay src={imageUrl} alt={`Imagen generada ${index + 1}`} />
                  </div>
                  
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDownloadImage(imageUrl, index)}
                      className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
                      aria-label="Descargar imagen"
                    >
                      <FaDownload className="text-purple-600" />
                    </button>
                  </div>
                  
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
                    <p className="text-white text-sm truncate">
                      #{index + 1} - {new Date().toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 