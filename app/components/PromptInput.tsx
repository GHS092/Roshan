'use client';

import { useState, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';

type PromptInputProps = {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
};

export type PromptInputRef = {
  getCurrentPrompt: () => string;
  clearPrompt: () => void;
};

// Función para traducir texto usando Lingva
const translateWithLingva = async (text: string, from = 'es', to = 'en') => {
  if (!text) return '';
  
  // Lista de instancias de Lingva en orden de preferencia
  const instances = [
    'https://lingva.thedaviddelta.com/api/v1',
    'https://lingva.pussthecat.org/api/v1',
    'https://lingva.garudalinux.org/api/v1',
    'https://lingva.ml/api/v1' // Mantener la original como última opción
  ];
  
  // Variable para almacenar el error más reciente
  let lastError;
  
  // Intentar con cada instancia hasta que una funcione
  for (const baseUrl of instances) {
    try {
      // Codificar el texto para la URL
      const encodedText = encodeURIComponent(text);
      // Construir la URL completa
      const url = `${baseUrl}/${from}/${to}/${encodedText}`;
      
      const response = await fetch(url);
      
      // Verificar si la respuesta fue exitosa
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Verificar que la respuesta tenga el formato esperado
      if (data && data.translation) {
        return data.translation;
      } else {
        throw new Error('Formato de respuesta inesperado');
      }
    } catch (error) {
      // Guardar el error y probar con la siguiente instancia
      lastError = error;
      console.warn(`Error con la instancia ${baseUrl}:`, error);
      continue;
    }
  }
  
  // Si llegamos aquí, todas las instancias fallaron
  console.error('Todas las instancias de Lingva fallaron:', lastError);
  
  // Retornar el texto original si la traducción falló
  return text;
};

const PromptInput = forwardRef<PromptInputRef, PromptInputProps>(
  ({ onSubmit, isLoading }, ref) => {
    const [prompt, setPrompt] = useState('');
    const [isTranslationEnabled, setIsTranslationEnabled] = useState(false);
    const [translatedPrompt, setTranslatedPrompt] = useState('');
    const [isTranslating, setIsTranslating] = useState(false);
    const [translationError, setTranslationError] = useState(false);
    
    // Función con debounce para no traducir con cada tecla
    const debounce = (func: Function, delay: number) => {
      let timeoutId: NodeJS.Timeout;
      return function(...args: any[]) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
      };
    };
    
    // Crear la función de traducción debounced
    const debouncedTranslate = useCallback(
      debounce(async (text: string) => {
        if (!text || !isTranslationEnabled) {
          setTranslatedPrompt('');
          setTranslationError(false);
          return;
        }
        
        setIsTranslating(true);
        setTranslationError(false);
        try {
          const translated = await translateWithLingva(text);
          // Si la traducción devuelve el mismo texto, es probable que haya fallado
          if (translated === text) {
            setTranslationError(true);
          }
          setTranslatedPrompt(translated);
        } catch (e) {
          console.error('Error durante la traducción:', e);
          setTranslationError(true);
        } finally {
          setIsTranslating(false);
        }
      }, 500),
      [isTranslationEnabled]
    );
    
    // Efecto para traducir cuando cambia el prompt
    useEffect(() => {
      debouncedTranslate(prompt);
    }, [prompt, isTranslationEnabled, debouncedTranslate]);

    useImperativeHandle(ref, () => ({
      getCurrentPrompt: () => isTranslationEnabled && translatedPrompt ? translatedPrompt : prompt,
      clearPrompt: () => {
        setPrompt('');
        setTranslatedPrompt('');
      }
    }));

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (prompt.trim() && !isLoading) {
        // Enviar el prompt traducido si la traducción está habilitada
        const finalPrompt = isTranslationEnabled && translatedPrompt ? translatedPrompt : prompt;
        onSubmit(finalPrompt);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="w-full space-y-5">
        <div>
          <div className="flex items-center justify-between mb-3">
            <label
              htmlFor="prompt"
              className="block text-sm font-medium text-gray-700 flex items-center"
            >
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
              Describe los cambios que quieres aplicar a la imagen
            </label>
            
            <div className="flex items-center">
              <label className="inline-flex items-center cursor-pointer mr-2 group">
                <input 
                  type="checkbox" 
                  checked={isTranslationEnabled} 
                  onChange={() => setIsTranslationEnabled(!isTranslationEnabled)} 
                  className="sr-only peer" 
                />
                <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-purple-600 shadow-sm group-hover:shadow transition-all duration-200"></div>
                <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 transition-colors duration-200">
                  Traducir al inglés
                  <span className="hidden sm:inline-block ml-1 text-xs text-gray-500">(mejores resultados)</span>
                </span>
              </label>
              {isTranslating && (
                <span className="text-xs text-gray-500 flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Traduciendo...
                </span>
              )}
            </div>
          </div>
          
          <div className="relative">
            <textarea
              id="prompt"
              rows={4}
              className="block w-full rounded-xl border-indigo-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border bg-white/80 backdrop-blur-sm transition-all duration-200 placeholder:text-indigo-300"
              placeholder="Ej: Convierte esta foto en un paisaje estilo acuarela"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isLoading}
            ></textarea>
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 scale-x-0 origin-left transition-transform duration-300 group-focus-within:scale-x-100" style={{ transform: prompt ? 'scaleX(1)' : 'scaleX(0)' }}></div>
          </div>
          
          {isTranslationEnabled && prompt && (
            <div className={`mt-2 p-2 ${translationError ? 'bg-rose-50 border-rose-100' : 'bg-indigo-50 border-indigo-100'} rounded-md text-sm`}>
              <div className="flex items-center mb-1">
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-1 ${translationError ? 'text-rose-500' : 'text-indigo-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {translationError ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  )}
                </svg>
                <p className={`text-xs ${translationError ? 'text-rose-700' : 'text-indigo-700'} font-medium`}>
                  {translationError ? 'Error de traducción:' : 'Se enviará en inglés:'}
                </p>
              </div>
              <p className="text-gray-800 pl-5">
                {isTranslating ? (
                  <span className="text-gray-400 italic">Traduciendo...</span>
                ) : translationError ? (
                  <span className="text-rose-600">
                    La traducción automática no está disponible en este momento. Se enviará en español.
                  </span>
                ) : translatedPrompt || (
                  <span className="text-gray-400 italic">Esperando traducción...</span>
                )}
              </p>
            </div>
          )}
          
          <div className="mt-2 flex items-center text-xs text-gray-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-1 text-indigo-400"
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
            {isTranslationEnabled 
              ? translationError 
                ? "La traducción no está disponible. Se usará el texto original."
                : "La traducción al inglés ayuda a obtener mejores resultados con la IA."
              : "Sé específico con lo que quieres lograr en la imagen."}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading || !prompt.trim() || (isTranslationEnabled && isTranslating)}
            className={`inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-full shadow-lg text-white ${
              isLoading || !prompt.trim() || (isTranslationEnabled && isTranslating)
                ? 'bg-gradient-to-r from-indigo-300 to-purple-300 opacity-70 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transform transition-transform hover:scale-105'
            }`}
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Procesando magia...
              </>
            ) : (
              <>
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
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                Generar imagen
              </>
            )}
          </button>
        </div>
      </form>
    );
  }
);

PromptInput.displayName = 'PromptInput';

export default PromptInput; 