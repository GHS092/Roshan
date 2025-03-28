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

// Función mejorada para normalizar y estandarizar los valores de color RGB para una integración natural
function standardizeColors(base64Image: string, colorMap?: Map<string, number[]>): Promise<string> {
  return processImageWithCanvas(base64Image, async (ctx, width, height) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Primer paso: Análisis de la imagen para detectar regiones artificiales
    const regions = analyzeImageRegions(data, width, height);
    
    // Segundo paso: Procesamiento adaptativo basado en las regiones detectadas
    if (regions.artificialEdges.length > 0) {
      console.log(`Detectadas ${regions.artificialEdges.length} regiones con bordes artificiales, aplicando suavizado`);
      applyAdaptiveBlending(data, width, height, regions.artificialEdges);
    }
    
    // Tercer paso: Procesar colores y contrastes para una integración natural
    // Esto mejora la armonización con el entorno
    for (let i = 0; i < data.length; i += 4) {
      // Solo procedemos si el píxel tiene opacidad completa
      if (data[i+3] > 250) {
        // Mejorar blancos y reflejos
        if (data[i] > 245 && data[i+1] > 245 && data[i+2] > 245) {
          // Blancos puros - mantener consistentes pero naturales
          data[i] = 253;
          data[i+1] = 253;
          data[i+2] = 253;
        }
        
        // Mejorar sombras profundas para eliminar compresión y blockiness
        else if (data[i] < 30 && data[i+1] < 30 && data[i+2] < 30) {
          // Evitar negro absoluto para mayor naturalidad
          data[i] = Math.max(5, data[i] - 2);
          data[i+1] = Math.max(5, data[i+1] - 2);
          data[i+2] = Math.max(5, data[i+2] - 2);
        }
        
        // Mejorar colores amarillos/dorados para mayor consistencia
        else if (data[i] > 200 && data[i+1] > 150 && data[i+2] < 100) {
          // Refinar tonos amarillos para mayor naturalidad
          data[i] = Math.min(255, data[i] + 3);
          data[i+1] = Math.min(255, data[i+1] + 2);
        }
        
        // Mejorar colores verdes para mayor naturalidad en vegetación
        else if (data[i] < 100 && data[i+1] > 120 && data[i+2] < 100 &&
                data[i+1] > data[i] && data[i+1] > data[i+2]) {
          // Refinar tonos verdes, añadir ligera variación
          data[i] = Math.max(data[i] - 2, Math.min(data[i] + 2, data[i]));
          data[i+1] = Math.max(data[i+1] - 1, Math.min(data[i+1] + 1, data[i+1]));
          data[i+2] = Math.max(data[i+2] - 2, Math.min(data[i+2] + 2, data[i+2]));
        }
        
        // Mejorar tonos de piel para mayor naturalidad
        else if (data[i] > 180 && data[i] < 240 && 
                data[i+1] > 140 && data[i+1] < 200 && 
                data[i+2] > 110 && data[i+2] < 170) {
          // Suavizar tonos de piel sin cambiarlos drásticamente
          const avg = (data[i] + data[i+1] + data[i+2]) / 3;
          data[i] = Math.floor(data[i] * 0.97 + avg * 0.03);
          data[i+1] = Math.floor(data[i+1] * 0.97 + avg * 0.03);
          data[i+2] = Math.floor(data[i+2] * 0.97 + avg * 0.03);
        }
      }
    }
    
    // Cuarto paso: Aplicar reducción de artefactos de compresión y mejora de detalles
    applyDetailEnhancement(data, width, height);
    
    // Aplicar todos los cambios al contexto del canvas
    ctx.putImageData(imageData, 0, 0);
  });
}

// Función auxiliar para analizar regiones de la imagen
function analyzeImageRegions(data: Uint8ClampedArray, width: number, height: number) {
  // Detectar bordes artificiales (possible signos de recorte y pegado)
  const artificialEdges: Array<{x: number, y: number, radius: number}> = [];
  
  // Umbral para detectar cambios abruptos en color/contraste
  const edgeThreshold = 35;
  
  // Buscar regiones con transiciones artificiales
  for (let y = 2; y < height - 2; y += 2) {
    for (let x = 2; x < width - 2; x += 2) {
      const idx = (y * width + x) * 4;
      
      // Examinar píxeles vecinos para detectar bordes abruptos
      const centerR = data[idx];
      const centerG = data[idx + 1];
      const centerB = data[idx + 2];
      
      // Comparar con píxeles circundantes para detectar bordes
      let abruptChanges = 0;
      const directions = [
        {dx: -1, dy: 0}, {dx: 1, dy: 0}, {dx: 0, dy: -1}, {dx: 0, dy: 1},
        {dx: -1, dy: -1}, {dx: 1, dy: -1}, {dx: -1, dy: 1}, {dx: 1, dy: 1}
      ];
      
      for (const dir of directions) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        
        // Saltar si está fuera de límites
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        
        const nidx = (ny * width + nx) * 4;
        const neighborR = data[nidx];
        const neighborG = data[nidx + 1];
        const neighborB = data[nidx + 2];
        
        // Calcular la diferencia de color
        const diffR = Math.abs(centerR - neighborR);
        const diffG = Math.abs(centerG - neighborG);
        const diffB = Math.abs(centerB - neighborB);
        
        // Si la diferencia es mayor que el umbral, contar como cambio abrupto
        if (diffR > edgeThreshold && diffG > edgeThreshold && diffB > edgeThreshold) {
          abruptChanges++;
        }
      }
      
      // Si hay suficientes cambios abruptos, considerarlo un borde artificial
      if (abruptChanges >= 3) {
        artificialEdges.push({x, y, radius: 3});
      }
    }
  }
  
  return {
    artificialEdges
  };
}

// Función para aplicar mezcla adaptativa en bordes artificiales
function applyAdaptiveBlending(data: Uint8ClampedArray, width: number, height: number, 
                               artificialEdges: Array<{x: number, y: number, radius: number}>) {
  // Para cada borde artificial detectado
  for (const edge of artificialEdges) {
    const {x, y, radius} = edge;
    
    // Aplicar un kernel de suavizado solo en los bordes artificiales
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        
        // Verificar límites
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        
        // Distancia al centro
        const distance = Math.sqrt(dx*dx + dy*dy);
        if (distance > radius) continue;
        
        // Fuerza del suavizado basada en la distancia (más fuerte en el centro)
        const blendFactor = 0.3 * (1 - distance / radius);
        
        // Calcular el color promedio de los vecinos para suavizar
        const nidx = (ny * width + nx) * 4;
        let sumR = 0, sumG = 0, sumB = 0;
        let count = 0;
        
        // Kernel 3x3 para calcular promedio
        for (let by = -1; by <= 1; by++) {
          for (let bx = -1; bx <= 1; bx++) {
            const bnx = nx + bx;
            const bny = ny + by;
            
            if (bnx < 0 || bnx >= width || bny < 0 || bny >= height) continue;
            
            const bidx = (bny * width + bnx) * 4;
            sumR += data[bidx];
            sumG += data[bidx + 1];
            sumB += data[bidx + 2];
            count++;
          }
        }
        
        // Calcular color promedio
        const avgR = sumR / count;
        const avgG = sumG / count;
        const avgB = sumB / count;
        
        // Aplicar suavizado
        data[nidx] = Math.round(data[nidx] * (1 - blendFactor) + avgR * blendFactor);
        data[nidx + 1] = Math.round(data[nidx + 1] * (1 - blendFactor) + avgG * blendFactor);
        data[nidx + 2] = Math.round(data[nidx + 2] * (1 - blendFactor) + avgB * blendFactor);
      }
    }
  }
}

// Función para mejorar detalles y textura
function applyDetailEnhancement(data: Uint8ClampedArray, width: number, height: number) {
  // Copiar datos originales para referencia
  const originalData = new Uint8ClampedArray(data);
  
  // Aplicar un algoritmo simple de mejora de detalle
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // Calcular la luminancia del píxel
      const luminance = 0.299 * originalData[idx] + 0.587 * originalData[idx + 1] + 0.114 * originalData[idx + 2];
      
      // Calcular luminancia promedio de vecinos
      let sumLuminance = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue; // Saltar píxel central
          
          const nx = x + dx;
          const ny = y + dy;
          const nidx = (ny * width + nx) * 4;
          
          const nLuminance = 0.299 * originalData[nidx] + 0.587 * originalData[nidx + 1] + 0.114 * originalData[nidx + 2];
          sumLuminance += nLuminance;
        }
      }
      
      const avgLuminance = sumLuminance / 8;
      
      // Calcular diferencia de detalle
      const detailDiff = luminance - avgLuminance;
      
      // Aplicar mejora de detalle sutilmente
      const enhancementFactor = 0.1; // Factor sutil para no exagerar
      
      // Aplicar mejora a cada canal
      for (let c = 0; c < 3; c++) {
        // Mejorar detalle basado en la diferencia de luminancia
        data[idx + c] = Math.max(0, Math.min(255, 
          originalData[idx + c] + detailDiff * enhancementFactor
        ));
      }
    }
  }
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
    
    // Ajuste de temperaturas - Todas muy bajas para mantener precisión y evitar elementos adicionales
    let fidelityTemp = 0.01;  // Temperatura extremadamente baja para alta fidelidad
    let balancedTemp = 0.05;  // Temperatura muy baja para balance
    
    if (containsTransferInstructions && Array.isArray(imageData) && imageData.length > 1) {
      console.log("Detectadas instrucciones de transferencia entre imágenes. Ajustando parámetros.");
      fidelityTemp = 0.01;
      balancedTemp = 0.03;
    }
    
    // Generar variaciones de forma secuencial pero con mejor manejo de errores
    const variations: string[] = [];
    let hasSuccessfulGeneration = false;
    
    // Primera variación: Alta fidelidad (EXACTAMENTE lo que pide el usuario, sin añadidos)
    console.log(`Generando variación 1/${variationCount} (modo: fidelidad alta)`);
    try {
      const fidelityVariation = await generateVariation(imageData, prompt, masks, {
        temperature: fidelityTemp,
        topP: 0.5,
        topK: 5,
        variationMode: "fidelity"
      });
      
      if (fidelityVariation) {
        variations.push(fidelityVariation);
        hasSuccessfulGeneration = true;
        console.log("Variación 1 generada con éxito");
      } else {
        throw new Error("La generación de variación de alta fidelidad devolvió un resultado vacío");
      }
    } catch (error) {
      console.error("No se pudo generar la variación de alta fidelidad:", error);
      try {
        console.log("Intentando con método alternativo para variación 1...");
        const fallbackVariation = await generateHighQualityImage(imageData, prompt, masks);
        variations.push(fallbackVariation);
        hasSuccessfulGeneration = true;
        console.log("Variación 1 generada con método alternativo");
      } catch (fallbackError) {
        console.error("Método alternativo también falló:", fallbackError);
        variations.push("");
      }
    }
    
    // Segunda variación: Alta fidelidad con semilla modificada
    if (variationCount >= 2) {
      console.log(`Generando variación 2/${variationCount} (modo: fidelidad alta - semilla alternativa)`);
      try {
        // Usar la misma configuración de alta fidelidad pero con seed+1
        const fidelityVariation2 = await generateVariation(imageData, prompt, masks, {
          temperature: fidelityTemp,
          topP: 0.5,
          topK: 5,
          variationMode: "fidelity_alt" // Uso interno para diferenciar la semilla
        });
        
        if (fidelityVariation2) {
          variations.push(fidelityVariation2);
          hasSuccessfulGeneration = true;
          console.log("Variación 2 generada con éxito");
        } else {
          throw new Error("La generación de variación de alta fidelidad alternativa devolvió un resultado vacío");
        }
      } catch (error) {
        console.error("No se pudo generar la segunda variación de alta fidelidad:", error);
        if (hasSuccessfulGeneration) {
          // Usar la primera variación exitosa como respaldo
          if (variations[0]) {
            variations.push(variations[0]);
            console.log("Usando variación 1 como respaldo para variación 2");
          } else {
            console.error("No hay variaciones exitosas para usar como respaldo");
            variations.push("");
          }
        } else {
          try {
            console.log("Intentando con método alternativo para variación 2...");
            const fallbackVariation = await generateHighQualityImage(imageData, prompt, masks);
            variations.push(fallbackVariation);
            hasSuccessfulGeneration = true;
            console.log("Variación 2 generada con método alternativo");
          } catch (fallbackError) {
            console.error("Método alternativo también falló:", fallbackError);
            variations.push("");
          }
        }
      }
    }
    
    // Tercera variación: Balanceada pero con parámetros muy conservadores
    if (variationCount >= 3) {
      console.log(`Generando variación 3/${variationCount} (modo: ligeramente balanceado)`);
      try {
        const balancedVariation = await generateVariation(imageData, prompt, masks, {
          temperature: balancedTemp,
          topP: 0.6,
          topK: 10,
          variationMode: "balanced"
        });
        
        if (balancedVariation) {
          variations.push(balancedVariation);
          hasSuccessfulGeneration = true;
          console.log("Variación 3 generada con éxito");
        } else {
          throw new Error("La generación de variación balanceada devolvió un resultado vacío");
        }
      } catch (error) {
        console.error("No se pudo generar la variación balanceada:", error);
        if (hasSuccessfulGeneration) {
          // Usar una variación anterior exitosa como respaldo
          const validVariations = variations.filter(v => v);
          if (validVariations.length > 0) {
            const randomIndex = Math.floor(Math.random() * validVariations.length);
            variations.push(validVariations[randomIndex]);
            console.log(`Usando variación ${randomIndex + 1} como respaldo para variación 3`);
          } else {
            console.error("No hay variaciones exitosas para usar como respaldo");
            variations.push("");
          }
        } else {
          try {
            console.log("Intentando con método alternativo para variación 3...");
            const fallbackVariation = await generateHighQualityImage(imageData, prompt, masks);
            variations.push(fallbackVariation);
            hasSuccessfulGeneration = true;
            console.log("Variación 3 generada con método alternativo");
          } catch (fallbackError) {
            console.error("Método alternativo también falló:", fallbackError);
            variations.push("");
          }
        }
      }
    }
    
    // Filtrar variaciones vacías
    const filteredVariations = variations.filter(v => v);
    
    // Si no hay variaciones válidas, intentar un último recurso
    if (filteredVariations.length === 0) {
      console.log("No se pudo generar ninguna variación válida. Intentando último recurso...");
      try {
        // Intentar un último enfoque más simple
        const lastResortImage = await generateImageFromPrompt(imageData, prompt, masks);
        filteredVariations.push(lastResortImage);
        console.log("Generada imagen de último recurso");
      } catch (lastError) {
        console.error("Todos los métodos fallaron:", lastError);
        throw new Error("No se pudo generar ninguna variación de imagen");
      }
    }
    
    // Completar las variaciones faltantes duplicando las existentes
    while (filteredVariations.length < variationCount) {
      const randomIndex = Math.floor(Math.random() * filteredVariations.length);
      filteredVariations.push(filteredVariations[randomIndex]);
      console.log(`Duplicando variación ${randomIndex + 1} para completar el conjunto`);
    }
    
    console.log(`Generadas ${filteredVariations.length} variaciones`);
    return filteredVariations;
  } catch (error) {
    console.error("Error crítico en generateImageVariations:", error);
    
    // Último intento desesperado: generar una sola imagen muy básica
    try {
      console.log("Intento de rescate final...");
      const rescueImage = await generateImageFromPrompt(imageData, "modificar imagen", masks);
      return [rescueImage, rescueImage, rescueImage]; // Devolver la misma imagen tres veces
    } catch (finalError) {
      console.error("Error final catastrófico:", finalError);
      throw error; // Si todo falla, propagar el error original
    }
  }
}

// Función para preparar un prompt con reglas de posicionamiento físico e integración visual
function preparePromptWithPhysicalRules(originalPrompt: string, mode: string = 'balanced'): string {
  // Verificar si el prompt ya menciona reglas de posicionamiento
  const promptLower = originalPrompt.toLowerCase();
  
  // Lista amplia de términos que indican posición específica
  const positioningTerms = [
    'posici', 'coloca', 'poner', 'pon', 'situar', 'ubicar', 
    'sobre', 'encima', 'debajo', 'junto', 'al lado', 'frente'
  ];
  
  // Lista amplia de términos que indican adición de elementos
  const additionTerms = [
    'añade', 'añadir', 'agregar', 'agrega', 'pon', 'poner', 'coloca',
    'incluye', 'incluir', 'inserta', 'insertar', 'incorpora'
  ];
  
  // Lista amplia de sujetos comunes que pueden ser añadidos
  const commonSubjects = [
    // Animales
    'perro', 'gato', 'caballo', 'vaca', 'oveja', 'cerdo', 'conejo', 'pájaro', 'ave', 'pato',
    'gallina', 'pollo', 'animal', 'mascota', 'rata', 'ratón', 'ardilla', 'zorro', 'lobo',
    'tigre', 'león', 'jirafa', 'elefante', 'oso', 'koala', 'canguro', 'serpiente', 'lagarto',
    // Personas
    'persona', 'hombre', 'mujer', 'niño', 'niña', 'bebé', 'adulto', 'anciano', 'anciana',
    // Objetos
    'coche', 'auto', 'camión', 'moto', 'bicicleta', 'silla', 'mesa', 'cama', 'sofá', 'armario',
    'computadora', 'ordenador', 'teléfono', 'móvil', 'reloj', 'ventana', 'puerta', 'lámpara',
    'planta', 'árbol', 'flor', 'roca', 'piedra', 'montaña', 'lago', 'mar', 'río', 'playa',
    'edificio', 'casa', 'objeto', 'elemento', 'logo', 'texto', 'letrero', 'cartel'
  ];
  
  // Verificar si el prompt contiene términos de posicionamiento explícito
  const containsPositioningTerms = positioningTerms.some(term => promptLower.includes(term));
  
  // Verificar si el prompt indica adición de algún elemento
  const additionTermFound = additionTerms.some(term => promptLower.includes(term));
  
  // Identificar qué sujeto o elemento está siendo añadido
  let subjectFound = false;
  let subjectType = '';
  
  if (additionTermFound) {
    for (const subject of commonSubjects) {
      if (promptLower.includes(subject)) {
        subjectFound = true;
        subjectType = subject;
        break;
      }
    }
  }
  
  // Si no encontramos un sujeto específico pero hay términos de adición,
  // asumimos que se está añadiendo un elemento genérico
  if (additionTermFound && !subjectFound) {
    subjectType = 'elemento';
  }
  
  // Preparar el prompt mejorado
  let enhancedPrompt = originalPrompt;
  
  // Si se está añadiendo algo y no hay instrucciones de posicionamiento explícitas
  if (additionTermFound && !containsPositioningTerms) {
    // Detección de contexto para animales (cuadrúpedos vs. otros tipos)
    if (['perro', 'gato', 'caballo', 'vaca', 'oveja', 'cerdo', 'conejo', 'tigre', 'león', 'zorro', 'lobo', 'oso'].includes(subjectType)) {
      // Instrucciones para animales cuadrúpedos
      enhancedPrompt += `. El ${subjectType} debe estar firmemente apoyado en el suelo u otra superficie sólida, con todas sus patas tocando la superficie. Debe parecer que está soportando naturalmente su peso con la postura típica del animal.`;
    } 
    else if (['pájaro', 'ave', 'pato', 'gallina', 'pollo'].includes(subjectType)) {
      // Instrucciones para aves
      enhancedPrompt += `. El ${subjectType} debe estar posado en una superficie apropiada o volando de manera natural. Si está posado, sus patas deben agarrar firmemente la superficie.`;
    }
    else if (['persona', 'hombre', 'mujer', 'niño', 'niña', 'bebé', 'adulto', 'anciano', 'anciana'].includes(subjectType)) {
      // Instrucciones para personas
      enhancedPrompt += `. La ${subjectType} debe estar de pie, sentada o en una postura natural sobre una superficie sólida. La posición debe ser física y anatómicamente correcta.`;
    }
    else {
      // Instrucciones para objetos genéricos o no identificados
      enhancedPrompt += `. Coloca este ${subjectType || 'elemento'} respetando las leyes físicas naturales. Debe estar firmemente apoyado sobre una superficie sólida (no flotando), con una posición estable y coherente con el entorno.`;
    }
  }
  
  // Preparar las reglas físicas según el modo de generación
  let physicsRules = `\n\nREGLAS FÍSICAS Y DE INTEGRACIÓN VISUAL OBLIGATORIAS:\n`;
  
  // Reglas generales según el modo - simplificando a sólo dos modos, ambos conservadores
  if (mode === 'fidelity') {
    physicsRules += `
- SIGUE LITERALMENTE lo que dice el prompt, sin añadir elementos no solicitados
- SOLO añade EXACTAMENTE lo solicitado, nada más
- Mantén alta fidelidad a la imagen original
- Preserva todos los elementos existentes intactos
- No alteres el fondo ni la iluminación original
- NO AÑADAS elementos adicionales que no se solicitan en el prompt`;
  } else { // modo balanced o cualquier otro
    physicsRules += `
- SIGUE LITERALMENTE lo que dice el prompt, sin añadir elementos no solicitados
- SOLO añade EXACTAMENTE lo solicitado, nada más
- Equilibra la fidelidad con naturalidad
- Preserva los elementos principales de la imagen
- Integra lo solicitado de manera armoniosa
- Permite ajustes mínimos para mejorar la coherencia
- NO AÑADAS elementos adicionales que no se solicitan en el prompt`;
  }
  
  // ... existing code ...
  
  // Agregar un recordatorio especial para NO añadir elementos extra
  physicsRules += `

IMPORTANTE: NUNCA añadas elementos no solicitados. Si el prompt pide "añade un perro", SOLO añade UN PERRO y nada más. NO añadas pájaros, personas u otros animales a menos que el prompt lo solicite explícitamente.`;
  
  // Combinar el prompt original con las reglas
  return enhancedPrompt + physicsRules;
}

// Modificamos generateVariation para usar la nueva función
async function generateVariation(
  imageData: string[] | string,
  prompt: string,
  masks?: Record<number, string>,
  options?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    variationMode?: "fidelity" | "balanced" | "fidelity_alt" | "creative";
  }
): Promise<string> {
  try {
    // Configurar opciones con valores predeterminados
    const temperature = options?.temperature ?? 0.05; // Reducido de 0.25 a 0.05
    const topP = options?.topP ?? 0.6; // Reducido de 0.7 a 0.6
    const topK = options?.topK ?? 10; // Reducido de 20 a 10
    const variationMode = options?.variationMode ?? "fidelity"; // Cambiado de "balanced" a "fidelity"
    
    console.log(`Generando variación con modo: ${variationMode}, temp: ${temperature}, topP: ${topP}, topK: ${topK}`);
    
    // Detectar si el prompt requiere integración de elementos
    const promptLower = prompt.toLowerCase();
    
    // Lista de términos que indican adición
    const additionTerms = [
      'añade', 'añadir', 'agregar', 'agrega', 'pon', 'poner', 'coloca',
      'incluye', 'incluir', 'inserta', 'insertar', 'incorpora'
    ];
    
    // Verificar si el prompt indica adición de algún elemento
    const requiresIntegration = additionTerms.some(term => promptLower.includes(term));
    
    // Ajuste de parámetros para prompts que requieren integración física
    let adjustedTemperature = temperature;
    let adjustedTopP = topP;
    let adjustedTopK = topK;
    
    if (requiresIntegration) {
      // Reducir temperatura para mayor coherencia en integración física
      if (variationMode === "fidelity" || variationMode === "fidelity_alt") {
        // Para fidelidad alta, priorizar exactitud con temperatura muy baja
        adjustedTemperature = 0.01; 
        adjustedTopP = 0.5;
        adjustedTopK = 5;
      } else if (variationMode === "balanced") {
        // Para balance, reducir ligeramente los parámetros pero mantener conservador
        adjustedTemperature = 0.03;
        adjustedTopP = 0.55;
        adjustedTopK = 8;
      }
      
      console.log(`Ajustando parámetros para integración física: temp=${adjustedTemperature}, topP=${adjustedTopP}, topK=${adjustedTopK}`);
    }
    
    // Verificar si el prompt contiene instrucciones de transferencia entre imágenes
    const containsTransferInstructions = 
      promptLower.includes('coloca') || 
      promptLower.includes('poner') || 
      promptLower.includes('pon') || 
      promptLower.includes('añade') || 
      promptLower.includes('añadir') || 
      promptLower.includes('agrega') || 
      (promptLower.includes('logo') && 
       (promptLower.includes('imagen 1') || promptLower.includes('imagen 2')));
    
    // Ajustes adicionales para transferencia entre imágenes (mantener muy conservador)
    if (containsTransferInstructions && Array.isArray(imageData) && imageData.length > 1) {
      if (variationMode === "fidelity" || variationMode === "fidelity_alt") {
        adjustedTemperature = 0.01;
        adjustedTopP = 0.5;
        adjustedTopK = 5;
      } else if (variationMode === "balanced") {
        adjustedTemperature = 0.03;
        adjustedTopP = 0.55;
        adjustedTopK = 8;
      }
    }
    
    // Mejorar el prompt con reglas físicas e integración visual detalladas
    const enhancedPrompt = preparePromptWithPhysicalRules(prompt, variationMode === "fidelity_alt" ? "fidelity" : variationMode);
    
    // Obtener el modelo específico para generación de imágenes
    const model = getSessionAwareModel('gemini-2.0-flash-exp');
    
    // Comprobar si hay máscaras definidas
    const hasMasks = masks && Object.keys(masks).length > 0;
    
    // Crear la configuración de generación
    const generationConfig = {
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: adjustedTemperature,
      topP: adjustedTopP,
      topK: adjustedTopK,
      maxOutputTokens: 8192,
      // Para fidelity_alt usamos globalGenerationSeed+3 para tener más variedad
      seed: globalGenerationSeed + (variationMode === "balanced" ? 1 : variationMode === "fidelity_alt" ? 3 : 0)
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
    
    // Preparar los contenidos para enviar al modelo
    let contents = [];
    
    if (Array.isArray(imageData) && imageData.length > 1) {
      // Múltiples imágenes - procesar imágenes de referencia
      
      // Instrucciones para la imagen principal con énfasis en posicionamiento físico
      let mainImageText = requiresIntegration 
        ? "Imagen principal. SIGUE EXACTAMENTE lo que pide el prompt y NO añadas elementos adicionales no solicitados. Todo elemento añadido DEBE respetar las leyes físicas."
        : "Imagen principal a editar según instrucciones. NO añadir elementos no solicitados.";
      
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
      
      // Si hay una máscara para la imagen principal
      if (masks && masks[0]) {
        contents.push({
          role: 'user',
          parts: [
            {
              text: `Máscara que indica áreas a modificar. Modificar SOLO dentro de estas áreas.`
            },
            {
              inlineData: {
                data: masks[0].split(',')[1],
                mimeType: 'image/png',
              }
            }
          ]
        });
      }
      
      // Imágenes de referencia
      for (let i = 1; i < imageData.length; i++) {
        let refImageText = `Imagen de referencia ${i+1}.`;
        
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
        
        if (masks && masks[i]) {
          contents.push({
            role: 'user',
            parts: [
              {
                text: `Máscara de referencia ${i+1}.`
              },
              {
                inlineData: {
                  data: masks[i].split(',')[1],
                  mimeType: 'image/png',
                }
              }
            ]
          });
        }
      }
      
      // Instrucciones estrictas para NO añadir elementos no solicitados
      contents.push({
        role: 'user',
        parts: [{ 
          text: "INSTRUCCIÓN CRÍTICA: SOLO añade EXACTAMENTE lo que solicita el prompt. NO añadas elementos adicionales no solicitados (pájaros, animales, personas, etc.) bajo ninguna circunstancia."
        }]
      });
      
      // Si requiere integración, añadir instrucciones de posicionamiento prioritarias
      if (requiresIntegration) {
        const physicsInstructions = `
INSTRUCCIONES CRÍTICAS DE FÍSICA:
1. POSICIONAMIENTO FÍSICO OBLIGATORIO: Todos los elementos DEBEN estar firmemente apoyados sobre superficies físicas sólidas
2. GRAVEDAD OBLIGATORIA: Nada puede flotar en el aire - todo debe obedecer la gravedad
3. SOMBRAS OBLIGATORIAS: Todo elemento debe proyectar sombras realistas en la superficie donde se apoya
4. PESO VISUAL: Los elementos deben mostrar señales visuales de peso y masa

Si el elemento es un animal:
- TODAS sus patas deben estar FIRMEMENTE apoyadas en una superficie sólida
- Su postura debe ser ANATÓMICAMENTE CORRECTA
- El peso debe estar DISTRIBUIDO CORRECTAMENTE en sus patas`;

        contents.push({
          role: 'user',
          parts: [{ text: physicsInstructions }]
        });
      }
      
      // Instrucciones finales con el prompt mejorado
      contents.push({
        role: 'user',
        parts: [{ text: enhancedPrompt }]
      });
      
      // Reforzar una última vez la restricción de no añadir elementos adicionales
      contents.push({
        role: 'user',
        parts: [{ 
          text: "RECUERDA: SOLO añade EXACTAMENTE lo que pide el prompt. NO añadas elementos adicionales no solicitados."
        }]
      });
      
    } else {
      // Solo una imagen - enfoque para manipulación de una única imagen
      const singleImage = Array.isArray(imageData) ? imageData[0] : imageData;
      
      // Instrucción con el prompt mejorado
      contents = [
        {
          role: 'user',
          parts: [
            { text: "INSTRUCCIÓN CRÍTICA: SOLO añade EXACTAMENTE lo que solicita el prompt. NO añadas elementos adicionales no solicitados." },
            {
              inlineData: {
                data: singleImage,
                mimeType: 'image/jpeg',
              }
            }
          ]
        }
      ];
      
      if (masks && masks[0]) {
        contents.push({
          role: 'user',
          parts: [
            {
              text: `Máscara que indica áreas a modificar. Modificar SOLO dentro de estas áreas.`
            },
            {
              inlineData: {
                data: masks[0].split(',')[1],
                mimeType: 'image/png',
              }
            }
          ]
        });
      }
      
      // Añadir el prompt mejorado
      contents.push({
        role: 'user',
        parts: [{ text: enhancedPrompt }]
      });
      
      // Reforzar las reglas una última vez
      contents.push({
        role: 'user',
        parts: [{ 
          text: "RECUERDA: SOLO añade EXACTAMENTE lo que solicita el prompt. NO agregues elementos adicionales."
        }]
      });
    }
    
    console.log(`Enviando solicitud a Gemini (modo: ${variationMode})...`);
    
    // Generar la imagen
    let result;
    try {
      result = await model.generateContent({
        contents,
        generationConfig,
        safetySettings
      });
    } catch (modelError) {
      console.error("Error en la primera generación:", modelError);
      throw modelError; // Propagar error para manejarlo en el nivel superior
    }
    
    // Procesar la respuesta
    const response = await result.response;
    
    if (response.candidates && response.candidates[0]) {
      for (const part of response.candidates[0].content?.parts || []) {
        if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
          console.log(`Gemini generó una variación (modo: ${variationMode}) correctamente`);
          
          const generatedImageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          
          try {
            // Aplicar estandarización de colores para mejorar coherencia
            const standardizedImage = await standardizeColors(generatedImageData);
            return standardizedImage;
          } catch (colorError) {
            console.error("Error al estandarizar colores:", colorError);
            return generatedImageData;
          }
        }
      }
      
      // Si llegamos aquí, no se encontró una imagen en la respuesta
      console.error(`No se encontró una imagen en la respuesta (modo: ${variationMode})`);
      
      // Intentar un enfoque de respaldo con diferentes parámetros
      console.log("Intentando con enfoque alternativo...");
      return await fallbackGenerateImage(imageData, prompt, masks, options);
    } else {
      console.error(`No hay candidatos válidos en la respuesta (modo: ${variationMode})`);
      return await fallbackGenerateImage(imageData, prompt, masks, options);
    }
  } catch (error) {
    console.error(`Error al generar variación (${options?.variationMode || 'fidelity'}):`, error);
    
    try {
      return await fallbackGenerateImage(imageData, prompt, masks, options);
    } catch (fallbackError) {
      console.error("También falló el método de respaldo:", fallbackError);
      throw error;
    }
  }
}

// Función de respaldo para generación de imágenes
async function fallbackGenerateImage(
  imageData: string[] | string,
  prompt: string,
  masks?: Record<number, string>,
  options?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    variationMode?: "fidelity" | "balanced" | "fidelity_alt" | "creative";
  }
): Promise<string> {
  console.log("Ejecutando método de respaldo para generación de imagen");
  
  try {
    const variationMode = options?.variationMode || "fidelity";
    
    // Detectar si el prompt requiere integración de elementos
    const promptLower = prompt.toLowerCase();
    
    // Lista de términos que indican adición
    const additionTerms = [
      'añade', 'añadir', 'agregar', 'agrega', 'pon', 'poner', 'coloca',
      'incluye', 'incluir', 'inserta', 'insertar', 'incorpora'
    ];
    
    // Verificar si el prompt indica adición de algún elemento
    const requiresIntegration = additionTerms.some(term => promptLower.includes(term));
    
    // Modificar el prompt para enfatizar las reglas físicas y NO AÑADIR ELEMENTOS EXTRAS
    let enhancedPrompt = `${prompt}

INSTRUCCIONES OBLIGATORIAS:
* AÑADE SOLAMENTE lo que solicita el prompt, NADA MÁS
* NO añadas elementos adicionales no solicitados (pájaros, animales, personas, etc.)
* Todo elemento añadido DEBE estar FIRMEMENTE APOYADO sobre una superficie sólida
* Nada puede flotar en el aire - TODO debe obedecer la GRAVEDAD
* Los elementos añadidos DEBEN proyectar SOMBRAS realistas sobre las superficies
* Debe haber señales visibles de CONTACTO FÍSICO entre el elemento y la superficie`;

    if (requiresIntegration) {
      enhancedPrompt += `
* Si añades un animal:
  - TODAS sus patas deben estar firmemente apoyadas en la superficie
  - Su postura debe ser anatómicamente correcta y natural
  - El peso debe estar distribuido correctamente según la especie`;
    }
    
    enhancedPrompt += `

IMPORTANTE: NO AÑADAS ELEMENTOS QUE NO SE SOLICITAN EN EL PROMPT ORIGINAL.`;
    
    // Intentar con el modelo estable primero, que puede ser más consistente
    const model = getSessionAwareModel('gemini-2.0-flash');
    
    // Configuración optimizada para respetar reglas físicas
    const generationConfig = {
      responseModalities: ['IMAGE'],
      temperature: 0.05,  // Temperatura muy baja para mayor precisión
      topP: 0.5,          // topP bajo para más consistencia
      topK: 5,            // topK bajo para resultados más predecibles
      maxOutputTokens: 8192,
      seed: globalGenerationSeed + (variationMode === "balanced" ? 1 : variationMode === "fidelity_alt" ? 3 : 0)
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
    
    // Preparar contenido simplificado pero con instrucciones claras sobre física
    const singleImage = Array.isArray(imageData) ? imageData[0] : imageData;
    
    // Contenido base con la imagen y el prompt mejorado
    const contents = [
      {
        role: 'user',
        parts: [
          { text: "INSTRUCCIÓN CRÍTICA: SOLO añade EXACTAMENTE lo que solicita el prompt. NO añadas elementos adicionales no solicitados." },
          {
            inlineData: {
              data: singleImage,
              mimeType: 'image/jpeg',
            }
          }
        ]
      }
    ];
    
    // Si hay máscara, incluirla con instrucciones claras
    if (masks && masks[0]) {
      contents.push({
        role: 'user',
        parts: [
          {
            text: `Máscara para áreas a modificar. Aplica las modificaciones SOLO dentro de estas áreas.`
          },
          {
            inlineData: {
              data: masks[0].split(',')[1],
              mimeType: 'image/png',
            }
          }
        ]
      });
    }
    
    // Añadir el prompt mejorado
    contents.push({
      role: 'user',
      parts: [{ text: enhancedPrompt }]
    });
    
    // Para casos que requieren integración, enfatizar reglas físicas una vez más
    contents.push({
      role: 'user',
      parts: [
        { 
          text: `RECORDATORIO FINAL CRÍTICO: SOLO añade EXACTAMENTE lo que solicita el prompt. NO añadas elementos adicionales. Todo elemento añadido DEBE estar FIRMEMENTE apoyado sobre una superficie sólida.`
        }
      ]
    });
    
    console.log("Enviando solicitud de respaldo a Gemini...");
    
    // Generar la imagen
    let result;
    try {
      result = await model.generateContent({
        contents,
        generationConfig,
        safetySettings
      });
    } catch (error) {
      console.error("Error en generación con modelo estable:", error);
      
      // Si falla, intentar con el modelo experimental
      console.log("Intentando con modelo experimental...");
      const expModel = getSessionAwareModel('gemini-2.0-flash-exp');
      result = await expModel.generateContent({
        contents,
        generationConfig,
        safetySettings
      });
    }
    
    // Procesar la respuesta
    const response = await result.response;
    
    if (response.candidates && response.candidates[0]) {
      for (const part of response.candidates[0].content?.parts || []) {
        if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
          console.log("Método de respaldo generó una imagen correctamente");
          
          const generatedImageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          
          try {
            // Aplicar procesamiento adicional para mejorar integración
            console.log("Aplicando procesamiento post-generación para mejorar integración...");
            const enhancedImage = await standardizeColors(generatedImageData);
            return enhancedImage;
          } catch (enhancementError) {
            console.error("Error en procesamiento post-generación:", enhancementError);
            return generatedImageData;
          }
        }
      }
    }
    
    // Si todo falla, intentar con el método de alta calidad como última opción
    console.log("Método de respaldo falló, intentando con método de alta calidad");
    return await generateHighQualityImage(imageData, prompt, masks);
  } catch (error) {
    console.error("Error en el método de respaldo:", error);
    return await generateHighQualityImage(imageData, prompt, masks);
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
    highResolution?: boolean;  // Nuevo parámetro para solicitar alta resolución
    style?: string;            // Parámetro opcional para estilo específico
    realism?: number;          // Nivel de realismo (0-1)
  }
): Promise<string> {
  try {
    // Valores por defecto para los parámetros de generación
    const temperature = options?.temperature ?? 0.4;
    const topP = options?.topP ?? 0.8;
    const topK = options?.topK ?? 32;
    // Asegurarnos de usar una semilla única en cada llamada si no se proporciona
    const seed = options?.seed ?? Math.floor(Math.random() * 100000);
    const highResolution = options?.highResolution ?? true; // Por defecto activado
    const realism = options?.realism ?? 0.8; // Por defecto alto realismo
    const style = options?.style || '';
    
    console.log(`Generando imagen desde texto con prompt: "${prompt}"`);
    console.log(`Parámetros: temperatura=${temperature}, topP=${topP}, topK=${topK}, semilla=${seed}, altaResolución=${highResolution}, realismo=${realism}`);
    
    // Obtener el modelo específico para generación de imágenes
    // Usar el modelo experimental que soporta generación de imágenes
    const model = getSessionAwareModel('gemini-2.0-flash-exp');
    
    // Configuración optimizada para generación de imágenes de alta calidad
    const generationConfig = {
      responseModalities: ['TEXT', 'IMAGE'], // Formato correcto para este modelo
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
    
    // Mejoramos el prompt para solicitar específicamente mayor resolución y realismo
    // Construir un prompt optimizado basado en las opciones del usuario
    let enhancedPrompt = prompt;
    
    // Añadir modificadores para alta resolución si se solicita
    if (highResolution) {
      enhancedPrompt = `Imagen de ALTA RESOLUCIÓN (1920x1080): ${enhancedPrompt}`;
    }
    
    // Añadir estilo si se especifica
    if (style) {
      enhancedPrompt = `${enhancedPrompt}, estilo ${style}`;
    }
    
    // Construir el contenido para enviar al modelo con indicaciones mejoradas para calidad
    const prompt_text = `Crea una imagen de calidad profesional de: ${enhancedPrompt}

INSTRUCCIONES CRUCIALES DE CALIDAD:
- Resolución máxima posible (1920x1080 o superior)
- Fotorrealismo extremo (${realism * 100}% de realismo)
- Texturas detalladas y palpables
- Iluminación volumétrica y sombreado avanzado
- Reflejos y sombras físicamente precisos
- Profundidad de campo cinematográfica
- Nitidez extrema en todos los detalles
- Colores vibrantes y saturación natural
- Sin distorsiones ni artefactos
- Sin texto ni marcas de agua
- Renderizado 3D de alta fidelidad
- Proporciones y perspectiva precisas
- CRÍTICO: Generar la imagen con el más alto nivel de detalle posible`;

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
          console.log("Gemini generó una imagen desde texto correctamente con calidad mejorada");
          
          // Intentar mejorar la calidad de imagen mediante standardizeColors 
          try {
            return await standardizeColors(generatedImageData);
          } catch (colorError) {
            console.error("Error al estandarizar colores:", colorError);
            return generatedImageData;
          }
        }
      }
      
      // Si no encontramos una imagen, intentar con otra configuración
      console.log("No se encontró imagen en la respuesta. Intentando con configuración alternativa...");
      
      // Pasar las opciones de alta resolución y realismo al método alternativo
      return await generateImageFromTextAlternative(prompt, {
        ...options,
        highResolution,
        realism
      });
    }
    
    // Si no hay candidatos válidos, intentar con respaldo
    console.log("No hay candidatos válidos en la respuesta. Intentando con configuración alternativa...");
    return await generateImageFromTextAlternative(prompt, {
      ...options,
      highResolution,
      realism
    });
  } catch (error) {
    console.error("Error al generar imagen desde texto:", error);
    
    // Intentar con configuración alternativa como respaldo
    try {
      console.log("Intentando generación con configuración alternativa...");
      return await generateImageFromTextAlternative(prompt, options);
    } catch (fallbackError) {
      console.error("Error en generación de respaldo:", fallbackError);
      throw error;
    }
  }
}

// Función alternativa para generar imágenes desde texto
async function generateImageFromTextAlternative(
  prompt: string,
  options?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    seed?: number;
    highResolution?: boolean;
    realism?: number;
    style?: string;
  }
): Promise<string> {
  try {
    const temperature = options?.temperature ?? 0.7; // Mayor temperatura para más creatividad
    const topP = options?.topP ?? 0.95;
    const topK = options?.topK ?? 64;
    // Usar la semilla proporcionada o generar una nueva, nunca usar globalGenerationSeed
    const seed = options?.seed ?? Math.floor(Math.random() * 100000);
    const highResolution = options?.highResolution ?? true;
    const realism = options?.realism ?? 0.7;
    const style = options?.style || '';
    
    console.log("Usando generación alternativa con optimización para mayor calidad");
    
    // Usar el modelo experimental que puede generar imágenes
    const model = getSessionAwareModel('gemini-2.0-flash-exp');
    
    const generationConfig = {
      // Especificar explícitamente que queremos una imagen
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: temperature,
      topP: topP,
      topK: topK,
      maxOutputTokens: 8192,
      seed: seed
    };
    
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
    
    // Construir un prompt mejorado con énfasis en resolución y realismo
    let enhancedPrompt = prompt;
    
    if (highResolution) {
      enhancedPrompt = `Imagen de ALTA RESOLUCIÓN FHD (1920x1080): ${enhancedPrompt}`;
    }
    
    if (style) {
      enhancedPrompt = `${enhancedPrompt}, estilo ${style}`;
    }
    
    // Instrucción muy específica para generar una imagen de alta calidad
    const prompt_text = `Genera una imagen fotorrealista de: ${enhancedPrompt}
    
CRÍTICO - REQUISITOS DE CALIDAD:
1. RESOLUCIÓN MÁXIMA - FHD 1920x1080 o superior
2. Fotorrealismo extremo (${realism * 100}% de realismo)
3. Iluminación volumétrica compleja con luces y sombras detalladas
4. Texturas realistas con micro-detalles visibles
5. Sin distorsiones ni artefactos de compresión
6. Profundidad de campo cinematográfica
7. Colores ricos y contrastados pero naturales
8. Renderizado de alta fidelidad de todos los elementos
9. No incluir texto ni marcas de agua`;

    // Usar la API con la estructura correcta y el prompt mejorado
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
    
    if (response.candidates && 
        response.candidates[0] && 
        response.candidates[0].content) {
      
      for (const part of response.candidates[0].content.parts || []) {
        if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
          const generatedImageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          console.log("Generación alternativa produjo imagen correctamente con calidad optimizada");
          
          // Aplicar estandarización de colores para mejorar aún más la calidad
          try {
            return await standardizeColors(generatedImageData);
          } catch (colorError) {
            console.error("Error al estandarizar colores:", colorError);
            return generatedImageData;
          }
        }
      }
    }
    
    throw new Error("La generación alternativa no produjo una imagen");
  } catch (error) {
    console.error("Error en la generación alternativa de imagen:", error);
    throw error;
  }
}

// Función para mantener una conversación en tiempo real con imágenes
export async function realTimeChatWithImage(
  message: string,
  imageData?: string,
  history?: Array<{role: string, parts: Array<{text?: string, inlineData?: {mimeType: string, data: string}}>}>,
): Promise<{
  text?: string,
  imageData?: string,
  history: Array<{role: string, parts: Array<{text?: string, inlineData?: {mimeType: string, data: string}}>}>
}> {
  try {
    // Obtener el modelo adecuado para chat con imágenes
    const model = getSessionAwareModel('gemini-2.0-flash-exp-image-generation');
    
    // Configuración para generación de respuestas que pueden incluir imágenes
    const generationConfig = {
      responseModalities: ['TEXT', 'IMAGE'], // Especificar que queremos texto e imagen
      temperature: 0.4,
      topP: 0.8,
      topK: 35,
      maxOutputTokens: 8192,
      seed: Math.floor(Math.random() * 100000) // Semilla aleatoria para variedad
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
    
    // Preparar el historial de conversación o iniciarlo si no existe
    let chatHistory = history || [];
    
    // Preparar el mensaje del usuario
    let userMessageParts: Array<{text?: string, inlineData?: {mimeType: string, data: string}}> = [];
    
    // Si hay texto, añadirlo a las partes
    if (message) {
      userMessageParts.push({ text: message });
    }
    
    // Si hay imagen, añadirla a las partes
    if (imageData) {
      // Extraer el tipo MIME y los datos base64 de la cadena dataURL
      const matches = imageData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      
      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        
        userMessageParts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        });
      } else {
        console.error("Formato de datos de imagen no válido");
        throw new Error("Formato de datos de imagen no válido");
      }
    }
    
    // Añadir el mensaje del usuario al historial
    chatHistory.push({
      role: 'user',
      parts: userMessageParts
    });
    
    console.log("Enviando mensaje a Gemini con historial de", chatHistory.length, "mensajes");
    
    // Convertir el historial de chat al formato esperado por la API de Gemini
    const formattedContents = chatHistory.map(msg => ({
      role: msg.role,
      parts: msg.parts.map(part => {
        if (part.text) {
          return { text: part.text };
        } else if (part.inlineData) {
          return { 
            inlineData: { 
              mimeType: part.inlineData.mimeType, 
              data: part.inlineData.data 
            } 
          };
        }
        return { text: "" }; // Parte vacía por defecto
      })
    }));
    
    // Enviar el historial formateado al modelo
    const result = await model.generateContent({
      contents: formattedContents,
      generationConfig,
      safetySettings
    });
    
    const response = await result.response;
    
    // Verificar si hay contenido en la respuesta
    if (!response.candidates || !response.candidates[0] || !response.candidates[0].content) {
      throw new Error("No se recibió una respuesta válida del modelo");
    }
    
    // Extraer las partes de la respuesta del modelo
    const modelResponse = response.candidates[0].content;
    
    // Convertir las partes del modelo al formato de nuestro historial
    const modelResponseParts = modelResponse.parts.map(part => {
      if (part.text) {
        return { text: part.text };
      } else if (part.inlineData) {
        return {
          inlineData: {
            mimeType: part.inlineData.mimeType,
            data: part.inlineData.data
          }
        };
      }
      return { text: "" }; // Parte vacía por defecto
    });
    
    // Añadir la respuesta al historial
    chatHistory.push({
      role: 'model',
      parts: modelResponseParts
    });
    
    // Preparar el objeto de respuesta
    let responseObj: {
      text?: string,
      imageData?: string,
      history: typeof chatHistory
    } = {
      history: chatHistory
    };
    
    // Extraer texto e imagen de la respuesta
    for (const part of modelResponse.parts) {
      if (part.text) {
        responseObj.text = part.text;
      } else if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
        responseObj.imageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    console.log("Respuesta de Gemini procesada correctamente");
    return responseObj;
    
  } catch (error) {
    console.error("Error en la conversación en tiempo real:", error);
    throw error;
  }
}