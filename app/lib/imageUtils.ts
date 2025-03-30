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