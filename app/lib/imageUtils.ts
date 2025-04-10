/**
 * Utilidades para procesamiento de imágenes y compatibilidad con la API de Gemini
 */

// Formatos de imagen compatibles con la API de Gemini
export const COMPATIBLE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Verifica si un Data URL es de un formato de imagen compatible con Gemini
 */
export function isCompatibleImageFormat(dataUrl: string): boolean {
  const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,/);
  if (!matches || matches.length !== 2) return false;
  
  const mimeType = matches[1];
  return COMPATIBLE_MIME_TYPES.includes(mimeType);
}

/**
 * Convierte cualquier formato de imagen a JPEG (compatible con Gemini)
 * @param imageDataUrl URL de datos de la imagen en formato Base64
 * @returns Promesa con la imagen convertida a JPEG
 */
export async function convertToJpeg(imageDataUrl: string): Promise<string> {
  // Si ya es compatible, devolver sin cambios
  if (isCompatibleImageFormat(imageDataUrl)) return imageDataUrl;
  
  console.log("Convirtiendo imagen a formato compatible (JPEG)...");
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error("No se pudo crear contexto de canvas");
        return reject(new Error("Error al convertir imagen: no se pudo crear contexto de canvas"));
      }
      
      // Dibujar la imagen en el canvas
      ctx.drawImage(img, 0, 0);
      
      // Convertir a JPEG (formato compatible garantizado)
      try {
        const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        console.log("Imagen convertida exitosamente a JPEG");
        resolve(jpegDataUrl);
      } catch (error) {
        console.error("Error al convertir a JPEG:", error);
        reject(error);
      }
    };
    
    img.onerror = (err) => {
      console.error("Error al cargar imagen para conversión:", err);
      reject(new Error("Error al cargar imagen para conversión de formato"));
    };
    
    img.src = imageDataUrl;
  });
}

/**
 * Prepara imágenes para enviar a la API de Gemini, asegurando formato compatible
 * @param images Array de imágenes en formato Data URL
 * @returns Promesa con array de imágenes en formato compatible
 */
export async function prepareImagesForGemini(images: string[]): Promise<string[]> {
  const compatibleImages: string[] = [];
  
  for (const image of images) {
    try {
      const compatibleImage = await convertToJpeg(image);
      compatibleImages.push(compatibleImage);
    } catch (error) {
      console.error("Error al preparar imagen para Gemini:", error);
      // Si hay error, no incluir la imagen
    }
  }
  
  return compatibleImages;
}

/**
 * Pre-procesa una imagen específicamente para transformación al estilo Ghibli,
 * mejorando el contraste y resaltando al sujeto principal para asegurar su preservación
 * @param imageDataUrl URL de datos de la imagen original
 * @returns Promesa con la imagen procesada
 */
export async function prepareImageForGhibliTransform(imageDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error("No se pudo crear contexto de canvas"));
        }
        
        // 1. Dibujar la imagen original
        ctx.drawImage(img, 0, 0);
        
        // 2. Aplicar ajustes para resaltar al sujeto principal
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Técnica avanzada de procesamiento en múltiples etapas
        
        // Paso 1: Analizar la imagen para detectar rangos de color del sujeto
        let sumR = 0, sumG = 0, sumB = 0;
        const totalPixels = data.length / 4;
        
        // Calcular promedios de color para la imagen completa
        for (let i = 0; i < data.length; i += 4) {
          sumR += data[i];
          sumG += data[i + 1];
          sumB += data[i + 2];
        }
        
        const avgR = sumR / totalPixels;
        const avgG = sumG / totalPixels;
        const avgB = sumB / totalPixels;
        
        // Paso 2: Aplicar mejoras de contraste adaptativas basadas en la composición de la imagen
        for (let i = 0; i < data.length; i += 4) {
          // Obtener valores RGB actuales
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Calcular brillo y saturación originales
          const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const delta = (max - min) / 255;
          const saturation = max === 0 ? 0 : delta / max;
          
          // Calcular qué tan diferente es este pixel del promedio
          // (posible indicador de que es parte del sujeto principal)
          const diffFromAvg = Math.abs(r - avgR) + Math.abs(g - avgG) + Math.abs(b - avgB);
          
          // Factor de mejora adaptativo - mayor para píxeles que se destacan del promedio
          const enhanceFactor = 0.5 + (diffFromAvg / 255);
          
          // Aplicar mejora de contraste adaptativa
          const contrastFactor = 1.25 * enhanceFactor;
          const midPoint = 128;
          
          // Aplicar el ajuste de contraste
          let newR = Math.max(0, Math.min(255, (r - midPoint) * contrastFactor + midPoint));
          let newG = Math.max(0, Math.min(255, (g - midPoint) * contrastFactor + midPoint));
          let newB = Math.max(0, Math.min(255, (b - midPoint) * contrastFactor + midPoint));
          
          // Mejorar saturación para elementos que parecen ser parte del sujeto (áreas con alta saturación)
          if (saturation > 0.2 && diffFromAvg > 30) {
            // Calcular nuevos valores HSL y aumentar saturación
            const newSatFactor = 1.2;
            
            // Aplicar aumento de saturación preservando luminosidad
            const minNew = Math.min(newR, newG, newB);
            const maxNew = Math.max(newR, newG, newB);
            const deltaNew = maxNew - minNew;
            
            if (deltaNew > 0) {
              const targetDelta = Math.min(255 - maxNew, maxNew) * 2 * newSatFactor;
              const deltaFactor = targetDelta / deltaNew;
              
              if (maxNew === newR) {
                newG = maxNew - (maxNew - newG) * deltaFactor;
                newB = maxNew - (maxNew - newB) * deltaFactor;
              } else if (maxNew === newG) {
                newR = maxNew - (maxNew - newR) * deltaFactor;
                newB = maxNew - (maxNew - newB) * deltaFactor;
              } else {
                newR = maxNew - (maxNew - newR) * deltaFactor;
                newG = maxNew - (maxNew - newG) * deltaFactor;
              }
            }
          }
          
          // Asignar nuevos valores
          data[i] = Math.round(newR);
          data[i + 1] = Math.round(newG);
          data[i + 2] = Math.round(newB);
        }
        
        // Paso 3: Aplicar un ligero ajuste de nitidez para mejorar la definición de bordes
        const tempData = new Uint8ClampedArray(data);
        for (let y = 1; y < canvas.height - 1; y++) {
          for (let x = 1; x < canvas.width - 1; x++) {
            const idx = (y * canvas.width + x) * 4;
            
            // Implementar un filtro simple de nitidez para cada canal RGB
            for (let c = 0; c < 3; c++) {
              // Obtener valor del píxel actual y vecinos
              const current = tempData[idx + c];
              const top = tempData[idx - canvas.width * 4 + c];
              const bottom = tempData[idx + canvas.width * 4 + c];
              const left = tempData[idx - 4 + c];
              const right = tempData[idx + 4 + c];
              
              // Aplicar filtro de nitidez con kernel 3x3
              // Centro con peso positivo, vecinos con peso negativo
              const sharpened = 5 * current - top - bottom - left - right;
              
              // Aplicar nitidez pero con factor moderado (0.3)
              data[idx + c] = Math.max(0, Math.min(255, Math.round(current * 0.7 + sharpened * 0.3)));
            }
          }
        }
        
        // Aplicar los cambios
        ctx.putImageData(imageData, 0, 0);
        
        // 4. Añadir un sutil viñeteado para enfocar la atención en el sujeto central
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
        
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        
        // Crear un gradiente radial para el viñeteado
        const gradient = ctx.createRadialGradient(centerX, centerY, maxDist * 0.5, centerX, centerY, maxDist);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');  // Centro transparente
        gradient.addColorStop(0.85, 'rgba(255, 255, 255, 0.95)'); // Inicio sutil de oscurecimiento
        gradient.addColorStop(1, 'rgba(220, 220, 220, 0.85)');  // Bordes ligeramente oscurecidos
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        
        // 5. Convertir a formato compatible con calidad alta
        const processedImageUrl = canvas.toDataURL('image/jpeg', 0.98);
        console.log("Imagen pre-procesada con mejoras avanzadas para transformación Ghibli");
        resolve(processedImageUrl);
      } catch (error) {
        console.error("Error al pre-procesar imagen para estilo Ghibli:", error);
        // Si hay error, devolver la imagen original
        resolve(imageDataUrl);
      }
    };
    
    img.onerror = () => {
      console.error("Error al cargar imagen para pre-procesamiento");
      // Si hay error, devolver la imagen original
      resolve(imageDataUrl);
    };
    
    img.src = imageDataUrl;
  });
}

/**
 * Pre-procesa una imagen específicamente para transformación al estilo anime,
 * mejorando la definición de los contornos y ajustando contraste para mejor adaptación
 * @param imageDataUrl URL de datos de la imagen original
 * @returns Promesa con la imagen procesada
 */
export async function prepareImageForAnimeTransform(imageDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error("No se pudo crear contexto de canvas"));
        }
        
        // 1. Dibujar la imagen original
        ctx.drawImage(img, 0, 0);
        
        // 2. Obtener los datos de la imagen
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // 3. Aplicar preprocesamiento específico para anime
        
        // Paso 1: Aumentar el contraste para facilitar la detección de bordes
        for (let i = 0; i < data.length; i += 4) {
          // Obtener valores RGB
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Calcular brillo
          const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
          
          // Aplicar un contraste más alto para hacer los bordes más definidos
          const contrastFactor = 1.3;
          const midPoint = 128;
          
          data[i] = Math.max(0, Math.min(255, ((r - midPoint) * contrastFactor) + midPoint));
          data[i + 1] = Math.max(0, Math.min(255, ((g - midPoint) * contrastFactor) + midPoint));
          data[i + 2] = Math.max(0, Math.min(255, ((b - midPoint) * contrastFactor) + midPoint));
        }
        
        // Paso 2: Aplicar un filtro de nitidez para acentuar los bordes
        const tempData = new Uint8ClampedArray(data);
        for (let y = 1; y < canvas.height - 1; y++) {
          for (let x = 1; x < canvas.width - 1; x++) {
            const idx = (y * canvas.width + x) * 4;
            
            // Aplicar kernel de nitidez
            for (let c = 0; c < 3; c++) {
              const current = tempData[idx + c];
              const top = tempData[idx - canvas.width * 4 + c];
              const bottom = tempData[idx + canvas.width * 4 + c];
              const left = tempData[idx - 4 + c];
              const right = tempData[idx + 4 + c];
              
              // Kernel de nitidez 3x3
              const sharpened = 5 * current - top - bottom - left - right;
              
              // Aplicar nitidez con un factor alto para anime (0.5)
              data[idx + c] = Math.max(0, Math.min(255, Math.round(current * 0.5 + sharpened * 0.5)));
            }
          }
        }
        
        // Paso 3: Opcional - Simplificación de colores para efecto "cell shading"
        for (let i = 0; i < data.length; i += 4) {
          // Discretizar colores para tener menos tonalidades (efecto anime)
          const levels = 6; // Número de niveles de color
          
          data[i] = Math.round(data[i] / (255 / levels)) * (255 / levels);
          data[i + 1] = Math.round(data[i + 1] / (255 / levels)) * (255 / levels);
          data[i + 2] = Math.round(data[i + 2] / (255 / levels)) * (255 / levels);
        }
        
        // Aplicar los cambios
        ctx.putImageData(imageData, 0, 0);
        
        // 4. Convertir a formato compatible con calidad alta
        const processedImageUrl = canvas.toDataURL('image/jpeg', 0.95);
        console.log("Imagen pre-procesada con optimización para anime");
        resolve(processedImageUrl);
      } catch (error) {
        console.error("Error al pre-procesar imagen para estilo anime:", error);
        // Si hay error, devolver la imagen original
        resolve(imageDataUrl);
      }
    };
    
    img.onerror = () => {
      console.error("Error al cargar imagen para pre-procesamiento anime");
      // Si hay error, devolver la imagen original
      resolve(imageDataUrl);
    };
    
    img.src = imageDataUrl;
  });
}

/**
 * Procesa múltiples imágenes para extraer características comunes
 * La primera imagen se considera la referencia principal y las demás son complementarias
 * @param images Array de imágenes en formato Data URL (la primera es la principal)
 * @returns Promesa con un objeto que contiene la imagen principal procesada y metadata de características comunes
 */
export async function processMultipleReferenceImages(images: string[]): Promise<{
  mainImage: string;
  secondaryImages: string[];
  featuresMetadata: {
    commonFeatures: boolean;
    primaryImageWeight: number;
  };
}> {
  if (!images.length) {
    throw new Error("No se proporcionaron imágenes para procesar");
  }

  // Si solo hay una imagen, simplemente la devolvemos procesada
  if (images.length === 1) {
    const processedMainImage = await prepareImageForGhibliTransform(images[0]);
    return {
      mainImage: processedMainImage,
      secondaryImages: [],
      featuresMetadata: {
        commonFeatures: false,
        primaryImageWeight: 1.0
      }
    };
  }

  // Procesar la imagen principal con el preprocesamiento estándar de Ghibli
  // para resaltar al sujeto principal
  const processedMainImage = await prepareImageForGhibliTransform(images[0]);
  
  // Procesar las imágenes secundarias con un preprocesamiento para resaltar características
  const processedSecondaryImages = await Promise.all(
    images.slice(1).map(async (img) => {
      // Aplicamos el mismo preprocesamiento pero con más énfasis en contrastes
      return await prepareImageForGhibliTransform(img);
    })
  );

  // Calcular el peso de la imagen principal basado en la cantidad de imágenes
  // A mayor número de imágenes, menor será el peso proporcional de la principal
  // pero siempre manteniendo su dominancia
  let primaryImageWeight = 0.7; // Valor predeterminado para 2-3 imágenes
  
  if (images.length > 3) {
    // Ajuste para 4-6 imágenes: mantener la imagen principal como dominante
    // pero dar más peso distributivo a las secundarias
    primaryImageWeight = Math.max(0.6, 0.8 - (images.length - 3) * 0.05);
    // Esto da aproximadamente: 4 imgs: 0.75, 5 imgs: 0.7, 6 imgs: 0.65
  }
  
  // Establecer metadata para el modelo
  const featuresMetadata = {
    commonFeatures: true,
    primaryImageWeight: primaryImageWeight,
  };

  return {
    mainImage: processedMainImage,
    secondaryImages: processedSecondaryImages,
    featuresMetadata
  };
}

/**
 * Genera instrucciones específicas para el modelo basadas en la cantidad de imágenes
 * @param imageCount Número de imágenes de referencia
 * @returns Instrucciones optimizadas para el modelo
 */
export function generateMultiReferenceInstructions(imageCount: number): string {
  if (imageCount <= 1) {
    return "";
  }

  // Instrucciones base para todas las cantidades de imágenes
  let baseInstructions = `
INSTRUCCIONES PARA MÚLTIPLES IMÁGENES DE REFERENCIA:
- Considera la PRIMERA imagen como la referencia PRINCIPAL
- Las demás imágenes son SECUNDARIAS y solo proporcionan información adicional
- Mantén TODOS los rasgos faciales y expresiones de la imagen PRINCIPAL
- Extrae características comunes del sujeto de todas las imágenes
- Conserva la pose y composición de la imagen PRINCIPAL
- NO combines estilos o accesorios diferentes de las imágenes secundarias
- Usa las imágenes secundarias ÚNICAMENTE para entender mejor al sujeto principal
- NUNCA reemplaces al sujeto de la imagen principal por elementos de las secundarias
- La imagen final debe ser claramente reconocible como el sujeto de la imagen PRINCIPAL pero en otro estilo
`;

  // Instrucciones adicionales para 4-6 imágenes
  if (imageCount >= 4) {
    baseInstructions += `
INSTRUCCIONES ADICIONALES PARA MÚLTIPLES IMÁGENES (${imageCount}):
- Asigna MAYOR PRIORIDAD a las primeras 3 imágenes para extraer características
- Las imágenes 4-${imageCount} deben usarse como REFERENCIAS COMPLEMENTARIAS
- Busca patrones de características que se repiten en MÚLTIPLES imágenes
- Identifica y extrae rasgos distintivos que aparecen consistentemente
- Utiliza las múltiples perspectivas para comprender mejor la estructura facial en 3D
- Mantén ABSOLUTA FIDELIDAD a la identidad del sujeto principal
- Ignora elementos inconsistentes o que solo aparecen en una imagen
- Da prioridad a las características faciales sobre ropa, fondo o accesorios
- Preserva las proporciones y estructura facial exactas de la imagen principal
`;
  }

  return baseInstructions;
} 