import { GoogleGenerativeAI, GenerateContentResult, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Usar variables de entorno para la API key
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyBcYsacd3Ml2wlduHZRzkFzHLtgOcylOhQ';

export const genAI = new GoogleGenerativeAI(API_KEY);

// Almacenar instancias de modelos para poder limpiarlas
let modelInstances: any[] = [];

// Definimos un valor de semilla global para consistencia entre generaciones
export let globalGenerationSeed = Date.now() % 10000;
let seedLocked = false;  // Variable para controlar si la semilla está bloqueada

// Función para reiniciar la semilla de generación
export function resetGenerationSeed(lock?: boolean) {
  if (lock !== undefined) {
    seedLocked = lock;
  }
  
  // Si la semilla está bloqueada y no se está forzando un reinicio explícito,
  // simplemente devolver la semilla actual
  if (seedLocked && lock === undefined) {
    console.log(`Semilla bloqueada, manteniendo: ${globalGenerationSeed}`);
    return globalGenerationSeed;
  }
  
  // Generar una nueva semilla
  globalGenerationSeed = Date.now() % 10000;
  console.log(`Nueva semilla de generación: ${globalGenerationSeed}`);
  
  // Emitir un evento para notificar a los componentes interesados
  if (typeof window !== 'undefined') {
    try {
      const seedChangedEvent = new CustomEvent('seedChanged', {
        detail: { seed: globalGenerationSeed }
      });
      window.dispatchEvent(seedChangedEvent);
      console.log("Evento de cambio de semilla emitido:", globalGenerationSeed);
    } catch (e) {
      console.error("Error al emitir evento de cambio de semilla:", e);
    }
  }
  
  return globalGenerationSeed;
}

// Función para verificar si la semilla está bloqueada
export function isSeedLocked(): boolean {
  return seedLocked;
}

// Función para establecer el estado de bloqueo de la semilla
export function setSeedLocked(locked: boolean): void {
  seedLocked = locked;
  console.log(`Estado de bloqueo de semilla: ${locked ? 'Bloqueada' : 'Desbloqueada'}`);
}

// Función para limpiar la memoria y reiniciar las instancias de modelos
export function clearModelCache() {
  try {
    console.log('Limpiando caché de modelos de Gemini...');
    // Limpiar array de instancias
    modelInstances = [];
    
    // Ya no intentamos reasignar genAI (¡esto causaba el error!)
    // Marcamos en sessionStorage que necesitamos un nuevo contexto
    const timestamp = Date.now();
    
    // Si estamos en el navegador, limpiar cualquier dato almacenado
    if (typeof window !== 'undefined') {
      // Guardar un identificador de sesión único para forzar nuevas solicitudes
      sessionStorage.setItem('gemini_session_id', `session_${timestamp}`);
      
      // Limpiar sessionStorage y localStorage relacionados con contexto
      sessionStorage.removeItem('gemini_last_prompt');
      sessionStorage.removeItem('gemini_last_response');
      sessionStorage.removeItem('gemini_context');
      
      localStorage.removeItem('gemini_recent_prompts');
      localStorage.removeItem('gemini_image_cache');
      localStorage.removeItem('gemini_instructions');
      
      // Limpiar cualquier caché del navegador relacionada con API
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            if (name.includes('gemini') || name.includes('generative')) {
              caches.delete(name);
            }
          });
        });
      }
      
      // También puedes agregar un método para limpiar desde window
      (window as any).clearGeminiCache = clearModelCache;
    }
    
    return true;
  } catch (error) {
    console.error('Error al limpiar caché de modelos:', error);
    return false;
  }
}

// Exponer la función de limpieza al objeto window si estamos en el navegador
if (typeof window !== 'undefined') {
  (window as any).genAI = genAI;
  (window as any).genAI.clearCache = clearModelCache;
}

// Función para obtener un modelo con un ID de sesión único si está disponible
function getSessionAwareModel(modelName: string) {
  // Obtener el ID de sesión si existe
  const timestamp = Date.now().toString();
  
  // Simplemente usar el modelo estándar, pero guardarlo en nuestro array para referencia
  const model = genAI.getGenerativeModel({ 
    model: modelName 
  });
  
  // Guardar la instancia para referencia futura
  modelInstances.push(model);
  
  // Forzar una nueva instancia cada vez agregando un timestamp al log
  console.log(`Creando nueva instancia de modelo ${modelName} [${timestamp}]`);
  
  return model;
}

export async function generateImageFromPrompt(
  imageData: string[] | string,
  prompt: string,
  masks?: Record<number, string>
): Promise<string> {
  try {
    // Verificar si el prompt contiene referencias a águilas o aves
    // y solo proceder si el usuario lo ha solicitado explícitamente
    const eagleRelatedTerms = ['aguila', 'águila', 'eagle', 'hawk', 'ave', 'bird', 'pájaro', 'pajaro', 'loro', 'parrot'];
    const promptLowerCase = prompt.toLowerCase();
    
    const containsEagleTerms = eagleRelatedTerms.some(term => promptLowerCase.includes(term));
    
    // Si el prompt NO contiene referencias a águilas o pájaros, asegurarse de que no se generen
    if (!containsEagleTerms) {
      prompt = `${prompt} (NO incluir ni añadir águilas, aves, ni pájaros de ningún tipo, a menos que yo lo pida explícitamente)`;
    }
    
    // Eliminar la parte del UID del prompt visible - en su lugar la agregaremos a la configuración
    // Forzar que cada solicitud sea única añadiendo semilla para consistencia
    console.log('Enviando prompt con semilla:', globalGenerationSeed);
    
    // Obtener el modelo específico para generación de imágenes con conciencia de sesión
    const model = getSessionAwareModel('gemini-2.0-flash-exp');
    
    // Comprobar si hay máscaras definidas para ajustar los parámetros
    const hasMasks = masks && Object.keys(masks).length > 0;
    
    // Verificar si el prompt contiene instrucciones de transferencia entre imágenes
    const containsTransferInstructions = 
      promptLowerCase.includes('coloca') || 
      promptLowerCase.includes('poner') || 
      promptLowerCase.includes('pon') || 
      promptLowerCase.includes('añade') || 
      promptLowerCase.includes('añadir') || 
      promptLowerCase.includes('agrega') || 
      (promptLowerCase.includes('logo') && 
       (promptLowerCase.includes('imagen 1') || promptLowerCase.includes('imagen 2')));
    
    // Configuración más precisa para edición entre imágenes
    let generationConfig = {
      responseModalities: ['Text', 'Image'],
      temperature: hasMasks ? 0.05 : 0.2,
      topP: hasMasks ? 0.65 : 0.8,
      topK: hasMasks ? 15 : 35,
      maxOutputTokens: 8192,
      seed: globalGenerationSeed
    };
    
    // Si contiene instrucciones de transferencia, ajustar parámetros para mayor precisión
    if (containsTransferInstructions && Array.isArray(imageData) && imageData.length > 1) {
      generationConfig.temperature = 0.02; // Valor más bajo para mayor precisión
      generationConfig.topP = 0.55;
      generationConfig.topK = 10;
    }
    
    // Configuración de seguridad
    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ];
    
    // Preparar las solicitudes basadas en la cantidad de imágenes
    let contents = [];
    
    if (Array.isArray(imageData) && imageData.length > 1) {
      // Tener múltiples imágenes - usamos un enfoque basado en roles similar al ejemplo en Python
      
      // Primera solicitud: Usuario enviando la imagen principal a modificar
      let mainImageText = `Esta es la imagen principal (IMAGEN 1) que quiero modificar según las instrucciones que proporcionaré más adelante. 
IMPORTANTE - REQUISITOS DE CALIDAD Y PRECISIÓN:
1. Mantener la calidad original en TODA la imagen.
2. Preservar con extrema precisión los rasgos faciales si hay personas. Ojos, nariz, boca y proporciones faciales deben permanecer exactamente como en el original.
3. Evitar cualquier deformación, especialmente en características como los ojos.
4. Preservar la nitidez, definición, textura y resolución de la imagen original.
5. NO aplicar suavizado ni compresión a la imagen.
6. Mantener EXACTAMENTE los mismos valores de color, brillo, contraste y saturación que el original.
7. CRÍTICO: Asegurar que cada elemento añadido mantenga su color natural y original en TODAS las generaciones, sin variación entre intentos.`;
      
      // Si hay una máscara para la imagen principal, mencionarla en el texto
      if (masks && masks[0]) {
        mainImageText += " IMPORTANTE: He seleccionado áreas específicas en rojo en esta imagen que quiero que modifiques. Por favor, aplica tus cambios SOLO a estas áreas seleccionadas y mantén intacto el resto de la imagen. CRÍTICO: Mantener la misma calidad y nitidez en TODA la imagen, incluso en áreas no modificadas.";
      }
      
      contents.push({
        role: 'user',
        parts: [
          { text: mainImageText },
          {
            inlineData: {
              data: imageData[0],
              mimeType: 'image/jpeg',
            }
          }
        ]
      });
      
      // Si hay una máscara para la imagen principal, la enviamos también
      if (masks && masks[0]) {
        contents.push({
          role: 'user',
          parts: [
            {
              text: `Esta es la máscara para la imagen principal. Las áreas en rojo indican dónde debes aplicar los cambios solicitados. Mantén intactas las áreas que no están marcadas en rojo.`
            },
            {
              inlineData: {
                data: masks[0].split(',')[1], // Eliminar el prefijo data:image/png;base64,
                mimeType: 'image/png',
              }
            }
          ]
        });
      }
      
      // Segundo contenido: Para cada imagen de referencia
      for (let i = 1; i < imageData.length; i++) {
        let refImageText = `Esta es la imagen de referencia #${i} (IMAGEN ${i+1}). `;
        
        // Si es la segunda imagen y hay una referencia a un "logo" en el prompt
        if (i === 1 && promptLowerCase.includes('logo')) {
          refImageText += `ATENCIÓN: Esta imagen contiene un LOGO que necesitas transferir a la IMAGEN 1. Identifica claramente el logo en esta imagen y colócalo exactamente según las instrucciones que daré más adelante. Es ESENCIAL que utilices el logo de esta imagen exactamente como aparece, sin modificar su diseño ni colores.`;
        } else {
          refImageText += `Puedes usarla como inspiración para la modificación.`;
        }
        
        // Si hay una máscara para esta imagen de referencia, mencionarla en el texto
        if (masks && masks[i]) {
          refImageText += ` He seleccionado áreas específicas en rojo en esta imagen de referencia. Por favor, toma SOLO estas áreas seleccionadas como referencia para aplicarlas a la imagen principal.`;
        }
        
        contents.push({
          role: 'user',
          parts: [
            { text: refImageText },
            {
              inlineData: {
                data: imageData[i],
                mimeType: 'image/jpeg',
              }
            }
          ]
        });
        
        // Si hay una máscara para esta imagen de referencia, la enviamos también
        if (masks && masks[i]) {
          contents.push({
            role: 'user',
            parts: [
              {
                text: `Esta es la máscara para la imagen de referencia #${i}. Las áreas en rojo indican las partes que quiero que tomes como referencia para aplicar a la imagen principal.`
              },
              {
                inlineData: {
                  data: masks[i].split(',')[1], // Eliminar el prefijo data:image/png;base64,
                  mimeType: 'image/png',
                }
              }
            ]
          });
        }
      }
      
      // Instrucciones de transferencia mejoradas si se detecta que es necesario
      let finalInstructions = '';
      
      if (containsTransferInstructions) {
        finalInstructions = `INSTRUCCIONES PRECISAS DE TRANSFERENCIA: ${prompt}. 
        
INSTRUCCIONES CRÍTICAS ADICIONALES:
1. Modifica ÚNICAMENTE la PRIMERA imagen (IMAGEN 1) aplicando los cambios solicitados.
2. Identifica con precisión los elementos mencionados en mis instrucciones.
3. El resultado debe ser fotorrealista y mantener la calidad original de la imagen.
4. Si se menciona un "logo" en la imagen 2, DEBES transferirlo exactamente a la ubicación especificada en la imagen 1.
5. La ubicación para colocar elementos debe seguir exactamente mis instrucciones (como "en el polo").
6. Mantén la misma calidad, nitidez y resolución en TODA la imagen.
7. NO introduzcas elementos no solicitados ni cambies otros aspectos de la imagen.`;
      } else {
        finalInstructions = `Instrucciones finales: ${prompt}. IMPORTANTE: Modifica ÚNICAMENTE la PRIMERA imagen que te mostré, aplicando los cambios solicitados. NO modifiques las imágenes de referencia. Las imágenes de referencia son solo para inspiración o fuente de elementos si el prompt lo requiere.`;
      }
      
      // Si hay máscaras, enfatizar su uso
      if (masks && Object.keys(masks).length > 0) {
        finalInstructions += ` Recuerda respetar las máscaras proporcionadas. Solo modifica las áreas marcadas en rojo en la imagen principal, y solo toma como referencia las áreas marcadas en rojo en las imágenes de referencia. IMPORTANTE: Mantén la misma calidad, nitidez y resolución en TODA la imagen, tanto en áreas modificadas como en el resto de la imagen.`;
      }
      
      contents.push({
        role: 'user',
        parts: [
          { text: finalInstructions }
        ]
      });
    } else {
      // Solo una imagen - enfoque simple
      const singleImage = Array.isArray(imageData) ? imageData[0] : imageData;
      
      contents = [
        {
          role: 'user',
          parts: [
            {
              text: `Modifica esta imagen según las siguientes instrucciones: ${prompt}
              
IMPORTANTE - REQUISITOS DE CALIDAD:
1. Mantener exactamente la misma calidad de imagen en todas las áreas, tanto modificadas como no modificadas.
2. Preservar con precisión todos los rasgos faciales si hay personas.
3. Mantener la nitidez, definición y textura de la imagen original.
4. No aplicar suavizado ni compresión que reduzca la calidad.
5. Mantener los mismos valores de color, brillo y contraste del original.`
            },
            {
              inlineData: {
                data: singleImage,
                mimeType: 'image/jpeg',
              }
            }
          ]
        }
      ];
      
      // Si hay una máscara, añadir esa información
      if (masks && masks[0]) {
        contents.push({
          role: 'user',
          parts: [
            {
              text: `Esta es la máscara que indica las áreas a modificar. Por favor, aplica los cambios SOLO en las áreas marcadas en rojo y mantén el resto exactamente igual.`
            },
            {
              inlineData: {
                data: masks[0].split(',')[1],
                mimeType: 'image/png',
              }
            }
          ]
        });
        
        // Añadir un recordatorio final sobre las máscaras
        contents.push({
          role: 'user',
          parts: [
            {
              text: `RECORDATORIO FINAL: Modifica la imagen ÚNICAMENTE en las áreas marcadas en rojo según mis instrucciones: "${prompt}". Mantén intacto el resto de la imagen con la misma calidad y nitidez.`
            }
          ]
        });
      }
    }
    
    console.log('Enviando solicitud a Gemini...');
    
    // Generar la imagen
    const result = await model.generateContent({
      contents,
      generationConfig,
      safetySettings
    });
    
    // Procesar la respuesta
    const response = await result.response;
    
    // Verificar si hay candidatos en la respuesta
    if (response.candidates && response.candidates[0]) {
      // Buscar partes de imagen en la respuesta
      for (const part of response.candidates[0].content?.parts || []) {
        if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
          console.log("Gemini generó una imagen correctamente");
          
          // Guardar los datos de la imagen en formato base64
          const generatedImageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          
          try {
            // Aplicar estandarización de colores para mantener consistencia
            const standardizedImage = await standardizeColors(generatedImageData);
            return standardizedImage;
          } catch (colorError) {
            console.error("Error al estandarizar colores:", colorError);
            return generatedImageData;
          }
        }
      }
      
      // Si no se encontró una imagen en la respuesta
      console.error("No se encontró una imagen en la respuesta del modelo");
      throw new Error("No se pudo generar una imagen. La respuesta del modelo no contenía datos de imagen.");
    } else {
      // Si no hay candidatos válidos en la respuesta
      console.error("No hay candidatos válidos en la respuesta del modelo");
      throw new Error("No se pudo generar una imagen. La respuesta del modelo no es válida.");
    }
  } catch (error) {
    console.error("Error al generar la imagen:", error);
    throw error;
  }
}

// Función para convertir una imagen a blanco y negro
function convertToBlackAndWhite(base64Image: string, maskData?: string | null): Promise<string> {
  return processImageWithCanvas(base64Image, async (ctx, width, height) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Si tenemos una máscara, la cargamos
    let maskImageData: ImageData | null = null;
    if (maskData) {
      maskImageData = await getMaskImageData(maskData, width, height);
    }
    
    // Convertir a escala de grises
    for (let i = 0; i < data.length; i += 4) {
      // Si hay una máscara, verificamos si debemos procesar este píxel
      if (maskImageData) {
        const pixelIndex = i / 4;
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        const maskIndex = (y * width + x) * 4;
        
        // Solo procesamos píxeles dentro de la máscara (áreas rojas)
        // Usando el mismo criterio mejorado para detectar rojo
        if (maskImageData.data[maskIndex] > 180 && 
            maskImageData.data[maskIndex+1] < 80 && 
            maskImageData.data[maskIndex+2] < 80 &&
            maskImageData.data[maskIndex] > maskImageData.data[maskIndex+1] * 2 &&
            maskImageData.data[maskIndex] > maskImageData.data[maskIndex+2] * 2) {
          const gray = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
          data[i] = gray;     // Rojo
          data[i + 1] = gray; // Verde
          data[i + 2] = gray; // Azul
        }
      } else {
        // Sin máscara, procesamos toda la imagen
        const gray = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
        data[i] = gray;     // Rojo
        data[i + 1] = gray; // Verde
        data[i + 2] = gray; // Azul
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  });
}

// Función para invertir los colores de una imagen
function invertColors(base64Image: string, maskData?: string | null): Promise<string> {
  return processImageWithCanvas(base64Image, async (ctx, width, height) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Si tenemos una máscara, la cargamos
    let maskImageData: ImageData | null = null;
    if (maskData) {
      maskImageData = await getMaskImageData(maskData, width, height);
    }
    
    // Invertir colores (255 - valor)
    for (let i = 0; i < data.length; i += 4) {
      // Si hay una máscara, verificamos si debemos procesar este píxel
      if (maskImageData) {
        const pixelIndex = i / 4;
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        const maskIndex = (y * width + x) * 4;
        
        // Solo procesamos píxeles dentro de la máscara (áreas rojas)
        // Usando el mismo criterio mejorado para detectar rojo
        if (maskImageData.data[maskIndex] > 180 && 
            maskImageData.data[maskIndex+1] < 80 && 
            maskImageData.data[maskIndex+2] < 80 &&
            maskImageData.data[maskIndex] > maskImageData.data[maskIndex+1] * 2 &&
            maskImageData.data[maskIndex] > maskImageData.data[maskIndex+2] * 2) {
          data[i] = 255 - data[i];         // Rojo
          data[i + 1] = 255 - data[i + 1]; // Verde
          data[i + 2] = 255 - data[i + 2]; // Azul
        }
      } else {
        // Sin máscara, procesamos toda la imagen
        data[i] = 255 - data[i];         // Rojo
        data[i + 1] = 255 - data[i + 1]; // Verde
        data[i + 2] = 255 - data[i + 2]; // Azul
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  });
}

// Función para aplicar efecto sepia
function applySepia(base64Image: string, maskData?: string | null): Promise<string> {
  return processImageWithCanvas(base64Image, async (ctx, width, height) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Si tenemos una máscara, la cargamos
    let maskImageData: ImageData | null = null;
    if (maskData) {
      maskImageData = await getMaskImageData(maskData, width, height);
    }
    
    // Aplicar efecto sepia
    for (let i = 0; i < data.length; i += 4) {
      // Si hay una máscara, verificamos si debemos procesar este píxel
      if (maskImageData) {
        const pixelIndex = i / 4;
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        const maskIndex = (y * width + x) * 4;
        
        // Solo procesamos píxeles dentro de la máscara (áreas rojas)
        // Usando el mismo criterio mejorado para detectar rojo
        if (maskImageData.data[maskIndex] > 180 && 
            maskImageData.data[maskIndex+1] < 80 && 
            maskImageData.data[maskIndex+2] < 80 &&
            maskImageData.data[maskIndex] > maskImageData.data[maskIndex+1] * 2 &&
            maskImageData.data[maskIndex] > maskImageData.data[maskIndex+2] * 2) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));     // Rojo
          data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168)); // Verde
          data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131)); // Azul
        }
      } else {
        // Sin máscara, procesamos toda la imagen
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));     // Rojo
        data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168)); // Verde
        data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131)); // Azul
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  });
}

// Función para ajustar la saturación de una imagen
function adjustSaturation(base64Image: string, saturationFactor: number, maskData?: string | null): Promise<string> {
  return processImageWithCanvas(base64Image, async (ctx, width, height) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Si tenemos una máscara, la cargamos
    let maskImageData: ImageData | null = null;
    if (maskData) {
      maskImageData = await getMaskImageData(maskData, width, height);
    }
    
    for (let i = 0; i < data.length; i += 4) {
      // Si hay una máscara, verificamos si debemos procesar este píxel
      if (maskImageData) {
        const pixelIndex = i / 4;
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        const maskIndex = (y * width + x) * 4;
        
        // Solo procesamos píxeles dentro de la máscara (áreas rojas)
        // Usando el mismo criterio mejorado para detectar rojo
        if (maskImageData.data[maskIndex] > 180 && 
            maskImageData.data[maskIndex+1] < 80 && 
            maskImageData.data[maskIndex+2] < 80 &&
            maskImageData.data[maskIndex] > maskImageData.data[maskIndex+1] * 2 &&
            maskImageData.data[maskIndex] > maskImageData.data[maskIndex+2] * 2) {
          // Convertir RGB a HSL
          const r = data[i] / 255;
          const g = data[i + 1] / 255;
          const b = data[i + 2] / 255;
          
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          let h, s, l = (max + min) / 2;
          
          if (max === min) {
            h = s = 0; // Acromático
          } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
              case r: h = (g - b) / d + (g < b ? 6 : 0); break;
              case g: h = (b - r) / d + 2; break;
              case b: h = (r - g) / d + 4; break;
              default: h = 0;
            }
            
            h /= 6;
          }
          
          // Ajustar saturación
          s = Math.max(0, Math.min(1, s * saturationFactor));
          
          // Convertir HSL a RGB
          let r1, g1, b1;
          
          if (s === 0) {
            r1 = g1 = b1 = l; // Acromático
          } else {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            
            r1 = hueToRgb(p, q, h + 1/3);
            g1 = hueToRgb(p, q, h);
            b1 = hueToRgb(p, q, h - 1/3);
          }
          
          // Guardar valores RGB
          data[i] = r1 * 255;
          data[i + 1] = g1 * 255;
          data[i + 2] = b1 * 255;
        }
      } else {
        // Procesamiento sin máscara, mantener como está
        // Convertir RGB a HSL
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
          h = s = 0; // Acromático
        } else {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          
          switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
            default: h = 0;
          }
          
          h /= 6;
        }
        
        // Ajustar saturación
        s = Math.max(0, Math.min(1, s * saturationFactor));
        
        // Convertir HSL a RGB
        let r1, g1, b1;
        
        if (s === 0) {
          r1 = g1 = b1 = l; // Acromático
        } else {
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          
          r1 = hueToRgb(p, q, h + 1/3);
          g1 = hueToRgb(p, q, h);
          b1 = hueToRgb(p, q, h - 1/3);
        }
        
        // Guardar valores RGB
        data[i] = r1 * 255;
        data[i + 1] = g1 * 255;
        data[i + 2] = b1 * 255;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  });
}

// Función auxiliar para convertir de HSL a RGB
function hueToRgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1/6) return p + (q - p) * 6 * t;
  if (t < 1/2) return q;
  if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
  return p;
}

// Función auxiliar para cargar una máscara y obtener sus datos de imagen
function getMaskImageData(maskData: string, width: number, height: number): Promise<ImageData | null> {
  if (typeof document === 'undefined') {
    console.error('No se puede cargar la máscara en un entorno sin DOM');
    return Promise.resolve(null);
  }
  
  // Definir la interfaz para las regiones rojas
  interface RedRegion {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    pixels: Array<{x: number, y: number, index: number}>;
    centerX?: number;
    centerY?: number;
  }
  
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error('No se pudo obtener el contexto de renderizado 2D');
      return Promise.resolve(null);
    }
    
    const img = new Image();
    img.src = maskData;
    
    // Crear función de carga síncrona para garantizar que la imagen está cargada
    return new Promise<ImageData>((resolve, reject) => {
      img.onload = () => {
        // Dibujar la máscara en un canvas temporal
        ctx.drawImage(img, 0, 0, width, height);
        
        // Obtener los datos de la imagen de la máscara
        const imageData = ctx.getImageData(0, 0, width, height);
        
        // Mejorar la visibilidad de las máscaras rojas
        const data = imageData.data;
        
        // Primero, realizar un análisis de las áreas rojas para mejorar la consistencia
        let redRegions: RedRegion[] = [];
        let currentRegion: RedRegion | null = null;
        
        // Primera pasada: identificar regiones rojas y sus límites
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const pixelIndex = (y * width + x) * 4;
            
            // Criterio mejorado para detectar rojo
            if (data[pixelIndex] > 180 && 
                data[pixelIndex+1] < 80 && 
                data[pixelIndex+2] < 80 &&
                data[pixelIndex] > data[pixelIndex+1] * 2 && 
                data[pixelIndex] > data[pixelIndex+2] * 2) {
                
              // Si es un píxel rojo, agregarlo a la región actual o crear una nueva
              if (!currentRegion) {
                currentRegion = { minX: x, maxX: x, minY: y, maxY: y, pixels: [] };
                redRegions.push(currentRegion);
              } else {
                currentRegion.minX = Math.min(currentRegion.minX, x);
                currentRegion.maxX = Math.max(currentRegion.maxX, x);
                currentRegion.minY = Math.min(currentRegion.minY, y);
                currentRegion.maxY = Math.max(currentRegion.maxY, y);
              }
              
              currentRegion.pixels.push({ x, y, index: pixelIndex });
            } else if (currentRegion) {
              // Si no es rojo y hay una región activa, cerrarla
              currentRegion = null;
            }
          }
          // Cerrar la región al final de cada fila
          if (currentRegion) {
            currentRegion = null;
          }
        }
        
        // Si hay regiones rojas, calcular su centroide (punto central)
        if (redRegions.length > 0) {
          redRegions.forEach(region => {
            // Calcular centroide
            region.centerX = Math.floor((region.minX + region.maxX) / 2);
            region.centerY = Math.floor((region.minY + region.maxY) / 2);
            
            // Guardar información relevante en sessionStorage para uso futuro
            if (typeof sessionStorage !== 'undefined') {
              try {
                const regionInfo = {
                  minX: region.minX,
                  maxX: region.maxX,
                  minY: region.minY,
                  maxY: region.maxY,
                  centerX: region.centerX,
                  centerY: region.centerY,
                  width: region.maxX - region.minX,
                  height: region.maxY - region.minY
                };
                
                const existingRegions = JSON.parse(sessionStorage.getItem('maskRedRegions') || '[]');
                existingRegions.push(regionInfo);
                sessionStorage.setItem('maskRedRegions', JSON.stringify(existingRegions));
              } catch (e) {
                console.error('Error guardando información de regiones rojas:', e);
              }
            }
          });
        }
        
        // Segunda pasada: procesar los píxeles
        for (let i = 0; i < data.length; i += 4) {
          // Si es un píxel rojizo, aumentar su intensidad para mejor detección
          if (data[i] > 180 && data[i+1] < 80 && data[i+2] < 80 && 
              data[i] > data[i+1] * 2 && data[i] > data[i+2] * 2) {
            data[i] = 255;      // Rojo al máximo
            data[i+1] = 0;      // Verde al mínimo
            data[i+2] = 0;      // Azul al mínimo
            data[i+3] = 255;    // Opacidad completa
          } else if (data[i+3] > 0) { // Para los no-rojos con transparencia
            // Hacer totalmente transparentes los píxeles no-rojos para evitar confusiones
            data[i+3] = 0;
          }
        }
        
        ctx.putImageData(imageData, 0, 0);
        resolve(imageData);
      };
      
      img.onerror = () => {
        reject(null);
      };
    });
  } catch (error) {
    console.error('Error al procesar la máscara:', error);
    return Promise.resolve(null);
  }
}

// Función para procesar una imagen con canvas
function processImageWithCanvas(
  base64Image: string, 
  processingFunction: (ctx: CanvasRenderingContext2D, width: number, height: number) => void | Promise<void>
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      console.error('No se puede procesar la imagen en un entorno sin DOM');
      reject(new Error('No se puede procesar la imagen en un entorno sin DOM'));
      return;
    }
    
    try {
      // Obtener datos base64 sin el prefijo
      let imageData = base64Image;
      if (base64Image.includes(',')) {
        imageData = base64Image.split(',')[1];
      }
      
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo obtener el contexto de renderizado 2D'));
          return;
        }
        
        // Dibujar la imagen original en el canvas
        ctx.drawImage(img, 0, 0);
        
        // Aplicar la función de procesamiento (ahora puede ser async)
        try {
          await processingFunction(ctx, img.width, img.height);
          // Devolver la imagen procesada como URL de datos
          resolve(canvas.toDataURL('image/jpeg', 0.98));
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Error al cargar la imagen'));
      };
      
      // Establecer la fuente de la imagen
      img.src = base64Image.startsWith('data:') 
        ? base64Image 
        : `data:image/jpeg;base64,${base64Image}`;
    } catch (error) {
      console.error('Error en processImageWithCanvas:', error);
      reject(error);
    }
  });
}

// Nueva función para normalizar y estandarizar los valores de color RGB
function standardizeColors(base64Image: string, colorMap?: Map<string, number[]>): Promise<string> {
  return processImageWithCanvas(base64Image, async (ctx, width, height) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Si no hay un mapa de colores proporcionado, analizar la imagen para crear uno
    if (!colorMap) {
      // Este paso es opcional - ajusta los colores para mayor consistencia
      // en futuras generaciones de imágenes similares
      for (let i = 0; i < data.length; i += 4) {
        // Solo procedemos si el píxel tiene opacidad
        if (data[i+3] > 200) {
          // Mejorar contraste general de la imagen
          if (data[i] > 230 && data[i+1] > 230 && data[i+2] > 230) {
            // Mejorar blancos
            data[i] = 255;
            data[i+1] = 255;
            data[i+2] = 255;
          }
          
          // Mejorar oscuros
          else if (data[i] < 80 && data[i] > 40 && 
                  data[i+1] < 60 && data[i+1] > 20 && 
                  data[i+2] < 40 && data[i+2] > 10) {
            // Tonos oscuros más definidos
            data[i] = Math.max(30, data[i] - 10);
            data[i+1] = Math.max(20, data[i+1] - 10); 
            data[i+2] = Math.max(10, data[i+2] - 10);
          }
          
          // Mejorar colores vivos
          else if (data[i] > 200 && data[i+1] > 150 && data[i+2] < 100) {
            // Amarillos y dorados más vibrantes
            data[i] = Math.min(255, data[i] + 5);
            data[i+1] = Math.min(255, data[i+1] + 5);
          }
        }
      }
    } else {
      // Si se proporciona un mapa de colores, úsalo para aplicar colores consistentes
      // (Implementación futura para casos de uso más complejos)
    }
    
    ctx.putImageData(imageData, 0, 0);
  });
}

// Función adicional inspirada en el código Python compartido
// Esta función utiliza un enfoque alternativo para preservar mejor la calidad
export async function generateHighQualityImage(
  imageData: string[] | string,
  prompt: string,
  masks?: Record<number, string>
): Promise<string> {
  try {
    // Verificar si el prompt contiene referencias a águilas o aves
    // y solo proceder si el usuario lo ha solicitado explícitamente
    const eagleRelatedTerms = ['aguila', 'águila', 'eagle', 'hawk', 'ave', 'bird', 'pájaro', 'pajaro', 'loro', 'parrot'];
    const promptLowerCase = prompt.toLowerCase();
    
    const containsEagleTerms = eagleRelatedTerms.some(term => promptLowerCase.includes(term));
    
    // Si el prompt NO contiene referencias a águilas, asegurarse de que no se generen
    if (!containsEagleTerms) {
      prompt = `${prompt} (NO incluir ni añadir águilas, aves, ni pájaros de ningún tipo, a menos que yo lo pida explícitamente)`;
    }
    
    // Eliminar referencia al UID en el prompt visible
    console.log('Enviando prompt de alta calidad con semilla:', globalGenerationSeed);
    
    // Obtener el modelo específico para generación de imágenes
    const model = getSessionAwareModel('gemini-2.0-flash-exp');
    
    // Comprobar si hay máscaras definidas para ajustar los parámetros
    const hasMasks = masks && Object.keys(masks).length > 0;
    
    // Crear la configuración optimizada para alta calidad
    const generationConfig = {
      responseModalities: ['Text', 'Image'],
      temperature: hasMasks ? 0.05 : 0.2,     // Temperatura aún más baja para consistencia
      topP: hasMasks ? 0.65 : 0.8,            // Reducir topP para máscaras
      topK: hasMasks ? 16 : 32,               // Reducir topK para máscaras
      maxOutputTokens: 8192,
      seed: globalGenerationSeed
    };
    
    // Configuración de seguridad
    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ];
    
    // Preparar la solicitud con un formato optimizado
    let contents = [];
    
    // Procesar la imagen principal
    const singleImage = Array.isArray(imageData) ? imageData[0] : imageData;
    
    // Separar la instrucción de la calidad para hacer mayor énfasis
    let promptText = `Mi instrucción: ${prompt}`;
    
    // Instrucciones de calidad extremadamente específicas
    const qualityInstructions = `
CRITICAL QUALITY INSTRUCTIONS:
1. PRESERVE THE ORIGINAL RESOLUTION of the image - DO NOT reduce quality under any circumstances
2. DO NOT apply blur, compression, or reduction of details
3. Keep edges sharp and well-defined
4. Preserve the texture and fine details exactly as in the original
5. If there are faces, preserve with EXTREME PRECISION the facial proportions, eyes, nose, and mouth
6. CRITICAL: Maintain EXACTLY the same color palette, RGB values, saturation, and brightness of all elements
7. For any new added element, ALWAYS use the same color palette, RGB values, and tones for that element
8. DO NOT allow variations in color or tone between different generations of the same element
9. Use consistent RGB values to represent specific colors in a natural and realistic way`;
    
    // Primera parte: enviar solo la imagen original con instrucciones generales
    contents.push({
      role: 'user',
      parts: [
        { text: `${promptText}\n\n${qualityInstructions}` },
        {
          inlineData: {
            data: singleImage,
            mimeType: 'image/jpeg',
          }
        }
      ]
    });
    
    // Segunda parte: si hay máscara, enviarla en un mensaje separado con instrucciones MUY específicas
    if (masks && masks[0]) {
      console.log("Procesando máscara para la imagen principal...");
      
      try {
        // Verificar si la máscara es válida
        const maskData = masks[0].split(',')[1]; // Eliminar el prefijo data:image/png;base64,
        if (!maskData || maskData.trim() === '') {
          console.warn("La máscara parece estar vacía o no válida");
        } else {
          console.log("Máscara válida encontrada, longitud:", maskData.length);
          
          contents.push({
            role: 'user',
            parts: [
              {
                text: `MASK INSTRUCTIONS:
This image is a MASK that indicates EXACTLY where to apply changes.
1. ONLY modify the areas marked in RED
2. The RED color in the mask SHOULD NOT appear in the final image
3. RED only indicates where to apply the requested changes, NOT a color to include
4. Any area NOT in RED must remain EXACTLY the same as the original image
5. This mask is ONLY a guide, it should not influence the final colors
6. Within the masked areas, apply ONLY the change: "${prompt}"
7. Respect 100% the areas outside the mask, keeping them identical to the original
8. CRITICAL: Maintain the SAME QUALITY, RESOLUTION and SHARPNESS in the ENTIRE image, both in the modified areas and outside them
9. DO NOT reduce the quality of any part of the image, either inside or outside the masked areas
10. DO NOT apply blur, defocus or smoothing effects to any part of the image
11. POSITIONING: If adding new elements (animals, objects, etc.), place them ENTIRELY WITHIN the red marked area
12. SIZE CONSTRAINTS: New elements must be sized to FIT COMPLETELY inside the red area - no parts should extend beyond
13. CENTERING: Position new elements in the CENTER of the red marked area unless specifically instructed otherwise
14. CONSISTENCY: When adding animals or objects, maintain EXACTLY the same type, species, color, and appearance in all generations
15. DIMENSIONS: New elements should be proportional to the size of the mask - larger masks should contain larger elements`
              },
              {
                inlineData: {
                  data: maskData,
                  mimeType: 'image/png',
                }
              }
            ]
          });
        }
      } catch (maskError) {
        console.error("Error al procesar la máscara:", maskError);
      }
    }
    
    // Instrucción final más específica para preservar calidad y manejar la máscara correctamente
    contents.push({
      role: 'user',
      parts: [
        {
          text: `FINAL INSTRUCTIONS:
1. Generate a modified version of the image EXACTLY like the original but applying the requested changes
2. Maintain the complete original resolution (same dimensions, no reduction)
3. Preserve all fine details, textures and sharpness of the original image
4. Do not introduce compression artifacts, blur or smoothing${masks && masks[0] ? `
5. ONLY modify the areas marked in RED in the mask
6. The RED color from the mask MUST NOT appear in the final image
7. Areas outside the red mask must remain IDENTICAL to the original 
8. CRITICAL - HIGH QUALITY: Maintain exactly the same quality, sharpness and texture in both the modified areas and the rest of the image
9. DO NOT apply any kind of blur or quality reduction to any part of the image
10. MASK PLACEMENT: If adding new elements, they MUST be FULLY CONTAINED within the red masked area
11. MASK CENTERING: Center new elements in the masked area unless specifically directed otherwise
12. CONSISTENCY BETWEEN GENERATIONS: When adding new elements like birds or animals, ALWAYS use the exact same species, size, and appearance
13. BIRDS AND ANIMALS: If adding birds or animals, use exactly the same species, color pattern, and posture in every generation` : ''}
14. CRITICAL - COLOR CONSISTENCY: The RGB values, hue, saturation and brightness of each element must be EXACTLY the same between generations
15. If you add elements, make sure they maintain their natural colors with consistent and realistic RGB values
16. APPLY EXACTLY what the prompt asks for, no more, no less.
17. DO NOT include the text of the prompt in the generated image.
18. DO NOT include any text, watermarks, or annotations in the final image.`
        }
      ]
    });
    
    console.log(`Enviando solicitud de alta calidad con ${contents.length} contenidos a Gemini`);
    
    // Generar contenido
    const result = await model.generateContent({
      contents: contents,
      generationConfig,
      safetySettings
    });
    
    const response = await result.response;
    
    // Verificar si hay partes en la respuesta
    if (response.candidates && 
        response.candidates[0] && 
        response.candidates[0].content && 
        response.candidates[0].content.parts) {
      
      // Buscar la parte que contiene la imagen
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
          // Estandarizar colores antes de devolver el resultado final
          const generatedImageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          console.log("Gemini devolvió una imagen de alta calidad, estandarizando colores");
          
          try {
            // Aplicar estandarización de colores para asegurar consistencia
            return await standardizeColors(generatedImageData);
          } catch (colorError) {
            console.error("Error al estandarizar colores:", colorError);
            // Si hay error en la estandarización, devolver la imagen original de Gemini
            return generatedImageData;
          }
        }
      }
    }
    
    // Si no se pudo generar con este método, usar el método estándar
    console.log("Método de alta calidad falló, usando método estándar");
    return generateImageFromPrompt(imageData, prompt, masks);
    
  } catch (error) {
    console.error("Error en el método de alta calidad:", error);
    // En caso de error, intentar con el método estándar
    return generateImageFromPrompt(imageData, prompt, masks);
  }
}

// Función para generar múltiples variaciones de una imagen
export async function generateImageVariations(
  imageData: string[] | string,
  prompt: string,
  masks?: Record<number, string>,
  variationCount: number = 3
): Promise<string[]> {
  try {
    console.log(`Generando ${variationCount} variaciones de imagen para: "${prompt}"`);
    
    // Verificar si el prompt contiene instrucciones de transferencia entre imágenes
    const promptLowerCase = prompt.toLowerCase();
    const containsTransferInstructions = 
      promptLowerCase.includes('coloca') || 
      promptLowerCase.includes('poner') || 
      promptLowerCase.includes('pon') || 
      promptLowerCase.includes('añade') || 
      promptLowerCase.includes('añadir') || 
      promptLowerCase.includes('agrega') || 
      (promptLowerCase.includes('logo') && 
       (promptLowerCase.includes('imagen 1') || promptLowerCase.includes('imagen 2')));
    
    // Para instrucciones de transferencia, ajustar las temperaturas para mayor precisión
    let fidelityTemp = 0.05;
    let balancedTemp = 0.2;
    let creativeTemp = 0.5;
    
    if (containsTransferInstructions && Array.isArray(imageData) && imageData.length > 1) {
      console.log("Detectadas instrucciones de transferencia entre imágenes. Ajustando parámetros para mayor precisión.");
      fidelityTemp = 0.01;  // Extremadamente bajo para máxima precisión
      balancedTemp = 0.1;   // Bajo para precisión con ligera variación
      creativeTemp = 0.3;   // Moderado para permitir creatividad pero mantener la instrucción principal
    }
    
    // Para evitar problemas de inconsistencia, forzar la generación secuencial
    const variations: string[] = [];
    
    // Generar primera variación con alta fidelidad (más similar a la original)
    console.log(`Generando variación 1/${variationCount} (modo: fidelidad alta)`);
    try {
      const fidelityVariation = await generateVariation(imageData, prompt, masks, {
        temperature: fidelityTemp,
        topP: 0.5,
        topK: 10,
        variationMode: "fidelity"
      });
      variations.push(fidelityVariation);
    } catch (error) {
      console.error("Error al generar variación de alta fidelidad:", error);
      // Intentar con el método de alta calidad como respaldo
      try {
        const fallbackVariation = await generateHighQualityImage(imageData, prompt, masks);
        variations.push(fallbackVariation);
      } catch (fallbackError) {
        console.error("También falló el método de respaldo:", fallbackError);
        // Si falla el respaldo, crear una variación vacía
        variations.push("");
      }
    }
    
    // Generar segunda variación con balance (compromiso entre fidelidad y creatividad)
    if (variationCount >= 2) {
      console.log(`Generando variación 2/${variationCount} (modo: balanceado)`);
      try {
        const balancedVariation = await generateVariation(imageData, prompt, masks, {
          temperature: balancedTemp,
          topP: 0.7,
          topK: 20,
          variationMode: "balanced"
        });
        variations.push(balancedVariation);
      } catch (error) {
        console.error("Error al generar variación balanceada:", error);
        // Si la primera variación fue exitosa, duplicarla como respaldo
        if (variations[0]) {
          variations.push(variations[0]);
        } else {
          // Intentar con el método estándar
          try {
            const fallbackVariation = await generateImageFromPrompt(imageData, prompt, masks);
            variations.push(fallbackVariation);
          } catch (fallbackError) {
            console.error("También falló el método de respaldo:", fallbackError);
            variations.push("");
          }
        }
      }
    }
    
    // Generar tercera variación con enfoque creativo (más libertad interpretativa)
    if (variationCount >= 3) {
      console.log(`Generando variación 3/${variationCount} (modo: creativo)`);
      try {
        const creativeVariation = await generateVariation(imageData, prompt, masks, {
          temperature: creativeTemp,
          topP: 0.8,
          topK: 30,
          variationMode: "creative"
        });
        variations.push(creativeVariation);
      } catch (error) {
        console.error("Error al generar variación creativa:", error);
        // Si alguna de las variaciones anteriores fue exitosa, duplicarla
        if (variations[0]) {
          variations.push(variations[0]);
        } else if (variations[1]) {
          variations.push(variations[1]);
        } else {
          variations.push("");
        }
      }
    }
    
    // Generar variaciones adicionales si se solicitaron más de 3
    for (let i = 3; i < variationCount; i++) {
      console.log(`Generando variación ${i+1}/${variationCount} (modo: aleatorio)`);
      try {
        // Para variaciones adicionales, alternar entre modos con parámetros ligeramente diferentes
        const mode = i % 3 === 0 ? "fidelity" : i % 3 === 1 ? "balanced" : "creative";
        const temp = i % 3 === 0 ? fidelityTemp * 1.2 : i % 3 === 1 ? balancedTemp * 1.2 : creativeTemp * 1.2;
        
        const additionalVariation = await generateVariation(imageData, prompt, masks, {
          temperature: temp,
          topP: 0.7 + (i % 4) * 0.05,
          topK: 20 + (i % 5) * 5,
          variationMode: mode
        });
        variations.push(additionalVariation);
      } catch (error) {
        console.error(`Error al generar variación adicional ${i+1}:`, error);
        // Si alguna de las variaciones anteriores fue exitosa, duplicarla
        const validVariations = variations.filter(v => v);
        if (validVariations.length > 0) {
          // Usar una variación existente al azar
          const randomIndex = Math.floor(Math.random() * validVariations.length);
          variations.push(validVariations[randomIndex]);
        } else {
          variations.push("");
        }
      }
    }
    
    // Filtrar variaciones vacías y asegurar que se devuelva al menos una
    const filteredVariations = variations.filter(v => v);
    
    if (filteredVariations.length === 0) {
      throw new Error("No se pudo generar ninguna variación válida.");
    }
    
    // Si algunas variaciones fallaron pero otras no, completar con las exitosas
    while (filteredVariations.length < variationCount) {
      const randomIndex = Math.floor(Math.random() * filteredVariations.length);
      filteredVariations.push(filteredVariations[randomIndex]);
    }
    
    console.log(`Generadas con éxito ${filteredVariations.length} variaciones`);
    return filteredVariations;
  } catch (error) {
    console.error("Error al generar variaciones de imagen:", error);
    throw error;
  }
}

// Función auxiliar para generar una variante específica
async function generateVariation(
  imageData: string[] | string,
  prompt: string,
  masks?: Record<number, string>,
  options?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    variationMode?: "fidelity" | "balanced" | "creative";
  }
): Promise<string> {
  try {
    // Configurar opciones con valores predeterminados
    const temperature = options?.temperature ?? 0.25;
    const topP = options?.topP ?? 0.7;
    const topK = options?.topK ?? 20;
    const variationMode = options?.variationMode ?? "balanced";
    
    console.log(`Generando variación con modo: ${variationMode}, temp: ${temperature}, topP: ${topP}, topK: ${topK}`);
    
    // Verificar si el prompt contiene instrucciones de transferencia entre imágenes
    const promptLowerCase = prompt.toLowerCase();
    const containsTransferInstructions = 
      promptLowerCase.includes('coloca') || 
      promptLowerCase.includes('poner') || 
      promptLowerCase.includes('pon') || 
      promptLowerCase.includes('añade') || 
      promptLowerCase.includes('añadir') || 
      promptLowerCase.includes('agrega') || 
      (promptLowerCase.includes('logo') && 
       (promptLowerCase.includes('imagen 1') || promptLowerCase.includes('imagen 2')));
    
    // Si contiene instrucciones de transferencia, ajustar parámetros para mayor precisión
    let adjustedTemperature = temperature;
    let adjustedTopP = topP;
    let adjustedTopK = topK;
    
    if (containsTransferInstructions && Array.isArray(imageData) && imageData.length > 1) {
      if (variationMode === "fidelity") {
        adjustedTemperature = 0.01; // Extremadamente bajo para mayor precisión
        adjustedTopP = 0.5;
        adjustedTopK = 5;
      } else if (variationMode === "balanced") {
        adjustedTemperature = 0.05;
        adjustedTopP = 0.55;
        adjustedTopK = 10;
      } else if (variationMode === "creative") {
        adjustedTemperature = 0.2;
        adjustedTopP = 0.7;
        adjustedTopK = 20;
      }
    }
    
    // Obtener el modelo específico para generación de imágenes
    const model = getSessionAwareModel('gemini-2.0-flash-exp');
    
    // Comprobar si hay máscaras definidas
    const hasMasks = masks && Object.keys(masks).length > 0;
    
    // Crear la configuración de generación
    const generationConfig = {
      responseModalities: ['Text', 'Image'],
      temperature: adjustedTemperature,
      topP: adjustedTopP,
      topK: adjustedTopK,
      maxOutputTokens: 8192,
      seed: globalGenerationSeed + (variationMode === "balanced" ? 1 : variationMode === "creative" ? 2 : 0)
    };
    
    // Configuración de seguridad
    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ];
    
    // Preparar los contenidos basados en la cantidad de imágenes
    let contents = [];
    
    if (Array.isArray(imageData) && imageData.length > 1) {
      // Múltiples imágenes - enfoque de transferencia mejorado
      
      // Instrucciones para la imagen principal
      let mainImageText = `Esta es la imagen principal (IMAGEN 1) que quiero modificar según las instrucciones que proporcionaré más adelante.`;
      
      // Añadir instrucciones específicas según el modo de variación
      if (variationMode === "fidelity") {
        mainImageText += `\nMODO DE PRECISIÓN: Mantén una fidelidad muy alta a la imagen original. Realiza ÚNICAMENTE los cambios solicitados con extrema precisión, preservando todos los demás aspectos exactamente como en el original.`;
      } else if (variationMode === "balanced") {
        mainImageText += `\nMODO EQUILIBRADO: Realiza los cambios solicitados de manera equilibrada, permitiendo variaciones naturales mientras mantienes la esencia de la imagen original.`;
      } else if (variationMode === "creative") {
        mainImageText += `\nMODO CREATIVO: Puedes ser más interpretativo con los cambios solicitados, permitiendo mayor variación creativa en el resultado final mientras sigues la instrucción principal.`;
      }
      
      mainImageText += `\nIMPORTANTE - REQUISITOS DE CALIDAD Y PRECISIÓN:
1. Mantener la calidad original en TODA la imagen.
2. Preservar con extrema precisión los rasgos faciales si hay personas.
3. Evitar cualquier deformación, especialmente en características como los ojos.
4. Preservar la nitidez, definición, textura y resolución de la imagen original.
5. NO aplicar suavizado ni compresión a la imagen.
6. Mantener EXACTAMENTE los mismos valores de color, brillo, contraste y saturación que el original.`;
      
      // Si hay una máscara para la imagen principal, mencionarla en el texto
      if (masks && masks[0]) {
        mainImageText += "\nIMPORTANTE: He seleccionado áreas específicas en rojo en esta imagen que quiero que modifiques. Por favor, aplica tus cambios SOLO a estas áreas seleccionadas y mantén intacto el resto de la imagen.";
      }
      
      contents.push({
        role: 'user',
        parts: [
          { text: mainImageText },
          {
            inlineData: {
              data: imageData[0],
              mimeType: 'image/jpeg',
            }
          }
        ]
      });
      
      // Si hay una máscara para la imagen principal, la enviamos también
      if (masks && masks[0]) {
        contents.push({
          role: 'user',
          parts: [
            {
              text: `Esta es la máscara para la imagen principal. Las áreas en rojo indican dónde debes aplicar los cambios solicitados. Mantén intactas las áreas que no están marcadas en rojo.`
            },
            {
              inlineData: {
                data: masks[0].split(',')[1], // Eliminar el prefijo data:image/png;base64,
                mimeType: 'image/png',
              }
            }
          ]
        });
      }
      
      // Imágenes de referencia
      for (let i = 1; i < imageData.length; i++) {
        let refImageText = `Esta es la imagen de referencia #${i} (IMAGEN ${i+1}). `;
        
        // Si es la segunda imagen y hay una referencia a un "logo" en el prompt
        if (i === 1 && promptLowerCase.includes('logo')) {
          refImageText += `ATENCIÓN: Esta imagen contiene un LOGO que necesitas transferir a la IMAGEN 1. Identifica claramente el logo en esta imagen y colócalo exactamente según las instrucciones. Es ESENCIAL que utilices el logo de esta imagen exactamente como aparece, sin modificar su diseño ni colores.`;
        } else {
          refImageText += `Puedes usarla como inspiración para la modificación.`;
        }
        
        // Si hay una máscara para esta imagen de referencia, mencionarla en el texto
        if (masks && masks[i]) {
          refImageText += ` He seleccionado áreas específicas en rojo en esta imagen de referencia. Por favor, toma SOLO estas áreas seleccionadas como referencia para aplicarlas a la imagen principal.`;
        }
        
        contents.push({
          role: 'user',
          parts: [
            { text: refImageText },
            {
              inlineData: {
                data: imageData[i],
                mimeType: 'image/jpeg',
              }
            }
          ]
        });
        
        // Si hay una máscara para esta imagen de referencia, la enviamos también
        if (masks && masks[i]) {
          contents.push({
            role: 'user',
            parts: [
              {
                text: `Esta es la máscara para la imagen de referencia #${i}. Las áreas en rojo indican las partes que quiero que tomes como referencia para aplicar a la imagen principal.`
              },
              {
                inlineData: {
                  data: masks[i].split(',')[1], // Eliminar el prefijo data:image/png;base64,
                  mimeType: 'image/png',
                }
              }
            ]
          });
        }
      }
      
      // Instrucciones finales específicas basadas en el modo de variación
      let finalInstructions = '';
      
      if (containsTransferInstructions) {
        finalInstructions = `INSTRUCCIONES PRECISAS DE TRANSFERENCIA: ${prompt}.\n\n`;
        
        // Añadir instrucciones específicas según el modo de variación
        if (variationMode === "fidelity") {
          finalInstructions += `MODO DE PRECISIÓN: Mantén una fidelidad extremadamente alta. Realiza ÚNICAMENTE los cambios solicitados con la mayor precisión posible.\n\n`;
        } else if (variationMode === "balanced") {
          finalInstructions += `MODO EQUILIBRADO: Realiza los cambios solicitados de manera equilibrada, permitiendo ligeras variaciones mientras mantienes la esencia general de la instrucción.\n\n`;
        } else if (variationMode === "creative") {
          finalInstructions += `MODO CREATIVO: Puedes ser más interpretativo con los cambios solicitados, permitiendo mayor variación artística mientras sigues la instrucción principal.\n\n`;
        }
        
        finalInstructions += `INSTRUCCIONES CRÍTICAS ADICIONALES:
1. Modifica ÚNICAMENTE la PRIMERA imagen (IMAGEN 1) aplicando los cambios solicitados.
2. Identifica con precisión los elementos mencionados en mis instrucciones.
3. El resultado debe ser fotorrealista y mantener la calidad original de la imagen.
4. Si se menciona un "logo" en la imagen 2, DEBES transferirlo exactamente a la ubicación especificada en la imagen 1.
5. La ubicación para colocar elementos debe seguir exactamente mis instrucciones (como "en el polo").
6. Mantén la misma calidad, nitidez y resolución en TODA la imagen.
7. NO introduzcas elementos no solicitados ni cambies otros aspectos de la imagen.`;
      } else {
        finalInstructions = `Instrucciones finales: ${prompt}.\n\n`;
        
        // Añadir instrucciones específicas según el modo de variación
        if (variationMode === "fidelity") {
          finalInstructions += `MODO DE PRECISIÓN: Mantén una fidelidad extremadamente alta. Realiza ÚNICAMENTE los cambios solicitados con la mayor precisión posible.\n\n`;
        } else if (variationMode === "balanced") {
          finalInstructions += `MODO EQUILIBRADO: Realiza los cambios solicitados de manera equilibrada, permitiendo ligeras variaciones mientras mantienes la esencia general de la instrucción.\n\n`;
        } else if (variationMode === "creative") {
          finalInstructions += `MODO CREATIVO: Puedes ser más interpretativo con los cambios solicitados, permitiendo mayor variación artística mientras sigues la instrucción principal.\n\n`;
        }
        
        finalInstructions += `IMPORTANTE: Modifica ÚNICAMENTE la PRIMERA imagen que te mostré, aplicando los cambios solicitados. NO modifiques las imágenes de referencia. Las imágenes de referencia son solo para inspiración o fuente de elementos si el prompt lo requiere.`;
      }
      
      // Si hay máscaras, enfatizar su uso
      if (masks && Object.keys(masks).length > 0) {
        finalInstructions += `\n\nRecuerda respetar las máscaras proporcionadas. Solo modifica las áreas marcadas en rojo en la imagen principal, y solo toma como referencia las áreas marcadas en rojo en las imágenes de referencia. IMPORTANTE: Mantén la misma calidad, nitidez y resolución en TODA la imagen, tanto en áreas modificadas como en el resto de la imagen.`;
      }
      
      contents.push({
        role: 'user',
        parts: [
          { text: finalInstructions }
        ]
      });
    } else {
      // Solo una imagen - enfoque simple
      const singleImage = Array.isArray(imageData) ? imageData[0] : imageData;
      
      // Texto adaptado al modo de variación
      let mainText = `Modifica esta imagen según las siguientes instrucciones: ${prompt}\n\n`;
      
      // Añadir instrucciones específicas según el modo de variación
      if (variationMode === "fidelity") {
        mainText += `MODO DE PRECISIÓN: Mantén una fidelidad extremadamente alta. Realiza ÚNICAMENTE los cambios solicitados con la mayor precisión posible.\n\n`;
      } else if (variationMode === "balanced") {
        mainText += `MODO EQUILIBRADO: Realiza los cambios solicitados de manera equilibrada, permitiendo ligeras variaciones mientras mantienes la esencia general de la instrucción.\n\n`;
      } else if (variationMode === "creative") {
        mainText += `MODO CREATIVO: Puedes ser más interpretativo con los cambios solicitados, permitiendo mayor variación artística mientras sigues la instrucción principal.\n\n`;
      }
      
      mainText += `IMPORTANTE - REQUISITOS DE CALIDAD:
1. Mantener exactamente la misma calidad de imagen en todas las áreas, tanto modificadas como no modificadas.
2. Preservar con precisión todos los rasgos faciales si hay personas.
3. Mantener la nitidez, definición y textura de la imagen original.
4. No aplicar suavizado ni compresión que reduzca la calidad.
5. Mantener los mismos valores de color, brillo y contraste del original.`;
      
      contents = [
        {
          role: 'user',
          parts: [
            { text: mainText },
            {
              inlineData: {
                data: singleImage,
                mimeType: 'image/jpeg',
              }
            }
          ]
        }
      ];
      
      // Si hay una máscara, añadir esa información
      if (masks && masks[0]) {
        contents.push({
          role: 'user',
          parts: [
            {
              text: `Esta es la máscara que indica las áreas a modificar. Por favor, aplica los cambios SOLO en las áreas marcadas en rojo y mantén el resto exactamente igual.`
            },
            {
              inlineData: {
                data: masks[0].split(',')[1],
                mimeType: 'image/png',
              }
            }
          ]
        });
        
        // Añadir un recordatorio final sobre las máscaras, adaptado al modo de variación
        contents.push({
          role: 'user',
          parts: [
            {
              text: `RECORDATORIO FINAL: Modifica la imagen ÚNICAMENTE en las áreas marcadas en rojo según mis instrucciones: "${prompt}". Mantén intacto el resto de la imagen con la misma calidad y nitidez.`
            }
          ]
        });
      }
    }
    
    console.log(`Enviando solicitud para variación (modo: ${variationMode}) a Gemini...`);
    
    // Generar la imagen
    const result = await model.generateContent({
      contents,
      generationConfig,
      safetySettings
    });
    
    // Procesar la respuesta
    const response = await result.response;
    
    // Verificar si hay candidatos en la respuesta
    if (response.candidates && response.candidates[0]) {
      // Buscar partes de imagen en la respuesta
      for (const part of response.candidates[0].content?.parts || []) {
        if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
          console.log(`Gemini generó una variación (modo: ${variationMode}) correctamente`);
          
          // Guardar los datos de la imagen en formato base64
          const generatedImageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          
          try {
            // Aplicar estandarización de colores para mantener consistencia
            const standardizedImage = await standardizeColors(generatedImageData);
            return standardizedImage;
          } catch (colorError) {
            console.error("Error al estandarizar colores:", colorError);
            return generatedImageData;
          }
        }
      }
      
      // Si no se encontró una imagen en la respuesta
      console.error(`No se encontró una imagen en la respuesta del modelo (variación: ${variationMode})`);
      throw new Error(`No se pudo generar una variación (${variationMode}). La respuesta del modelo no contenía datos de imagen.`);
    } else {
      // Si no hay candidatos válidos en la respuesta
      console.error(`No hay candidatos válidos en la respuesta del modelo (variación: ${variationMode})`);
      throw new Error(`No se pudo generar una variación (${variationMode}). La respuesta del modelo no es válida.`);
    }
  } catch (error) {
    console.error(`Error al generar variación (${options?.variationMode || 'balanced'}):`, error);
    
    // Intentar usar el método estándar como fallback
    try {
      console.log("Intentando generar con método estándar como respaldo...");
      return await generateHighQualityImage(imageData, prompt, masks);
    } catch (fallbackError) {
      console.error("También falló el método de respaldo:", fallbackError);
      throw error; // Propagar el error original
    }
  }
}

// Función para generar una imagen desde cero usando solo un prompt
export async function generateImageFromText(
  prompt: string,
  options?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    seed?: number;
  }
): Promise<string> {
  try {
    // Valores por defecto para los parámetros de generación
    const temperature = options?.temperature ?? 0.4;
    const topP = options?.topP ?? 0.8;
    const topK = options?.topK ?? 32;
    const seed = options?.seed ?? globalGenerationSeed;
    
    console.log(`Generando imagen desde texto con prompt: "${prompt}"`);
    console.log(`Parámetros: temperatura=${temperature}, topP=${topP}, topK=${topK}, semilla=${seed}`);
    
    // Obtener el modelo específico para generación de imágenes
    const model = getSessionAwareModel('gemini-2.0-flash-exp');
    
    // Configuración optimizada para generación de imágenes de alta calidad
    const generationConfig = {
      responseModalities: ['Text', 'Image'],
      temperature: temperature,
      topP: topP,
      topK: topK,
      maxOutputTokens: 8192,
      seed: seed
    };
    
    // Configuración de seguridad
    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ];
    
    // Construir el contenido para enviar al modelo
    const prompt_text = `Generate a high quality image of: ${prompt}

INSTRUCTIONS FOR HIGH QUALITY IMAGE GENERATION:
1. Create a photorealistic, highly detailed image
2. Use high resolution, sharp details, and proper lighting
3. Ensure proper perspective, proportions and scale
4. Apply realistic textures, materials and reflections
5. Create natural shadows and highlights
6. Use a balanced composition with proper framing
7. Apply realistic color grading and contrast
8. DO NOT include any text, watermarks, or annotations in the image
9. DO NOT include anything that wasn't specifically requested in the prompt`;

    // Usar la API con la estructura correcta
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt_text }]
        }
      ],
      generationConfig,
      safetySettings
    });
    
    const response = await result.response;
    
    // Verificar si hay partes en la respuesta
    if (response.candidates && 
        response.candidates[0] && 
        response.candidates[0].content && 
        response.candidates[0].content.parts) {
      
      // Buscar la parte que contiene la imagen
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
          // Obtener la imagen en formato base64
          const generatedImageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          console.log("Gemini generó una imagen desde texto correctamente");
          
          try {
            // Aplicar estandarización de colores para mejor calidad visual
            return await standardizeColors(generatedImageData);
          } catch (colorError) {
            console.error("Error al estandarizar colores:", colorError);
            // Si hay error en la estandarización, devolver la imagen original
            return generatedImageData;
          }
        }
      }
      
      // Si se procesó la respuesta pero no se encontró una imagen
      const responseText = response.candidates[0].content.parts
        .filter(part => part.text)
        .map(part => part.text)
        .join("\n");
      
      console.warn("No se encontró imagen en la respuesta. Texto recibido:", responseText);
      throw new Error("No se pudo generar una imagen. Respuesta del modelo: " + responseText);
    }
    
    throw new Error("No se pudo generar una imagen desde el texto.");
  } catch (error) {
    console.error("Error al generar imagen desde texto:", error);
    throw error;
  }
}