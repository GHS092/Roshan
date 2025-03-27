'use client';

import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { generateImageFromText, resetGenerationSeed, isSeedLocked, globalGenerationSeed } from '../lib/gemini';
import SeedControl from './SeedControl';

export default function TextToImageGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [temperatureValue, setTemperatureValue] = useState(0.4);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  const handleGenerateImage = async () => {
    if (!prompt || prompt.trim() === '') {
      toast.error('Por favor, escribe una descripción para generar la imagen');
      return;
    }

    setIsGenerating(true);
    try {
      // Si la semilla no está bloqueada, generar una nueva para esta generación
      if (!isSeedLocked()) {
        const newSeed = resetGenerationSeed();
        toast.loading(`Generando imagen con nueva semilla: ${newSeed}...`, { id: 'generating-image' });
      } else {
        // Si está bloqueada, notificar que se está usando la misma semilla
        const currentSeed = globalGenerationSeed || 0;
        toast.loading(`Generando imagen manteniendo la semilla ${currentSeed}...`, { id: 'generating-image' });
      }

      // Configuración para la generación
      const options = {
        temperature: temperatureValue,
        seed: globalGenerationSeed,
      };

      // Generar la imagen desde el prompt
      const generatedImageData = await generateImageFromText(prompt, options);
      
      // Actualizar el estado con la nueva imagen generada
      setGeneratedImages(prevImages => [generatedImageData, ...prevImages].slice(0, 10));
      
      toast.dismiss('generating-image');
      toast.success('¡Imagen generada exitosamente!');
    } catch (error) {
      console.error('Error al generar la imagen:', error);
      
      toast.dismiss('generating-image');
      
      // Mensajes de error personalizados
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('timed out')) {
          toast.error('La generación tardó demasiado tiempo. Intenta con un prompt más simple.');
        } else if (error.message.includes('rate limit') || error.message.includes('ratelimit')) {
          toast.error('Has excedido el límite de solicitudes. Espera un momento e intenta de nuevo.');
        } else if (error.message.includes('content filtered') || error.message.includes('safety')) {
          toast.error('Tu solicitud fue filtrada por políticas de contenido. Modifica tu prompt e intenta de nuevo.');
        } else {
          toast.error(`Error: ${error.message}`);
        }
      } else {
        toast.error('Ocurrió un error desconocido. Intenta de nuevo más tarde.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearHistory = () => {
    setGeneratedImages([]);
    toast.success('Historial de imágenes borrado');
  };

  const handleDownloadImage = (imageUrl: string, index: number) => {
    try {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `imagen-generada-${index + 1}-${new Date().getTime()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error al descargar la imagen:', error);
      toast.error('No se pudo descargar la imagen');
    }
  };

  return (
    <div className="w-full">
      <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-indigo-100/50 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Generador de Imágenes con IA</h2>
        <p className="text-gray-600 mb-6">
          Escribe una descripción detallada de la imagen que deseas crear y la inteligencia artificial la generará para ti.
        </p>
        
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="prompt-input" className="block text-sm font-medium text-gray-700">
              Descripción detallada
            </label>
            <SeedControl 
              className="ml-auto" 
              onLockChange={(locked) => {
                if (locked) {
                  toast.success('Semilla bloqueada. Mantendrá el mismo estilo entre generaciones.');
                } else {
                  toast.success('Semilla desbloqueada. Variará el estilo en cada generación.');
                }
              }}
            />
          </div>
          
          <textarea
            ref={promptInputRef}
            id="prompt-input"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 min-h-[120px] text-gray-800"
            placeholder="Describe la imagen que quieres crear. Por ejemplo: Un paisaje de montañas con un lago al atardecer, cielo naranja con nubes, reflejo en el agua cristalina..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Creatividad: {temperatureValue}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={temperatureValue}
            onChange={(e) => setTemperatureValue(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Más precisión</span>
            <span>Más creatividad</span>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleGenerateImage}
            disabled={isGenerating}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-full shadow-lg text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transform transition-transform hover:scale-105 ${
              isGenerating ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generando...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Generar Imagen
              </>
            )}
          </button>
          
          {generatedImages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="flex-1 sm:flex-none inline-flex items-center justify-center px-5 py-2.5 border border-gray-300 text-sm font-medium rounded-full shadow-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Limpiar Historial
            </button>
          )}
        </div>
      </div>
      
      {isGenerating && (
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-indigo-100/50 mb-6 flex justify-center items-center">
          <div className="flex flex-col items-center">
            <div className="relative w-20 h-20">
              <div className="absolute top-0 left-0 w-full h-full rounded-full border-4 border-indigo-200 opacity-25"></div>
              <div className="absolute top-0 left-0 w-full h-full rounded-full border-t-4 border-l-4 border-indigo-600 animate-spin"></div>
            </div>
            <p className="mt-6 text-indigo-700 font-medium">Creando tu imagen mágica...</p>
            <p className="text-gray-500 text-sm mt-2">Esto puede tardar hasta un minuto</p>
          </div>
        </div>
      )}
      
      {generatedImages.length > 0 && (
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-indigo-100/50">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Imágenes Generadas ({generatedImages.length})</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {generatedImages.map((imageUrl, index) => (
              <div key={index} className="border rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-indigo-50/30 relative group shadow-lg hover:shadow-indigo-200/40 transition-all duration-300">
                <div className="aspect-w-16 aspect-h-9">
                  <img
                    src={imageUrl}
                    alt={`Imagen generada #${index + 1}`}
                    className="w-full h-full object-contain cursor-pointer"
                    onClick={() => window.open(imageUrl, '_blank')}
                  />
                </div>
                <div className="absolute top-2 left-2 bg-black/50 text-white py-1 px-3 rounded-full text-xs font-medium backdrop-blur-sm">
                  #{index + 1}
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex justify-center">
                  <button
                    onClick={() => handleDownloadImage(imageUrl, index)}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-full text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Descargar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 