/**
 * rostroPrompts.ts
 * Funciones optimizadas para generación de prompts para rostro persistente
 * con diferentes niveles de detalle según el número de imágenes de referencia
 */

/**
 * Genera un prompt optimizado para preservación de identidad facial
 * @param numImagenes Número de imágenes de rostro proporcionadas
 * @param realism Nivel de realismo deseado (0-1)
 * @returns Prompt optimizado con instrucciones detalladas
 */
export function getOptimizedRostroPrompt(numImagenes: number, realism: number): string {
  // Optimizar nivel de detalle según cantidad de imágenes
  const nivelOptimizacion = numImagenes >= 5 ? "MÁXIMA" : 
                           numImagenes >= 4 ? "ULTRA-ALTA" : 
                           numImagenes >= 3 ? "ALTA" : "ESTÁNDAR";
                          
  // Instrucciones adicionales para cantidad óptima de imágenes
  const instruccionesExtras = numImagenes >= 4 ? `
TÉCNICAS AVANZADAS DE PRESERVACIÓN FACIAL:
- Análisis multidimensional de ${numImagenes} perspectivas faciales distintas
- Reconstrucción biométrica completa basada en múltiples ángulos
- Triangulación matemática de características faciales desde diferentes vistas
- Preservación de micro-texturas y patrones de pigmentación específicos
- Mapeo facial completo para mantener exactitud milimétrica
- Análisis de variación de rasgos bajo diferentes condiciones de iluminación` : "";

  return `
INSTRUCCIONES CRÍTICAS PARA CLONACIÓN EXACTA DE ROSTRO (${nivelOptimizacion}):

OBJETIVO PRINCIPAL: Reproducir con precisión fotográfica absoluta el rostro exacto de las ${numImagenes} imágenes de referencia.

CARACTERÍSTICAS FACIALES A PRESERVAR CON EXACTITUD TOTAL:
- Geometría precisa: forma específica de ojos, nariz, boca, cejas, pómulos y mandíbula
- Distancias proporcionales entre todos los rasgos faciales
- Coloración exacta: tono de piel, ojos, labios con sus variaciones naturales
- Textura de piel con sus características específicas (poros, brillo natural)
- Marcas distintivas: todos los lunares, pecas, cicatrices, líneas de expresión
- Estructura ósea facial completa con sus ángulos tridimensionales exactos
- Expresión característica y microexpresiones faciales

PROHIBICIONES ABSOLUTAS (CRÍTICO PARA LA CALIDAD):
- NO idealizar, "mejorar" o alterar ningún aspecto del rostro
- NO modificar edad, género o características raciales bajo ninguna circunstancia
- NO eliminar o suavizar características faciales distintivas
- NO aplicar filtros de belleza o homogeneización
- NO alterar proporciones faciales por motivos estéticos

${instruccionesExtras}

ESTÁNDAR DE EVALUACIÓN: El rostro generado debe ser INMEDIATAMENTE IDENTIFICABLE como la misma persona de las imágenes de referencia. La precisión facial tiene máxima prioridad sobre cualquier otra consideración.

REQUISITOS TÉCNICOS:
- Resolución fotográfica máxima (${realism * 100}% de realismo)
- Iluminación fotorrealista que preserve fielmente los rasgos faciales
- Todas las características faciales reconocibles incluso con cambios de ángulo o iluminación`;
}

/**
 * Optimiza los parámetros de generación según la cantidad de imágenes
 * @param numImagenes Número de imágenes de rostro proporcionadas
 * @param baseTemp Temperatura base a ajustar
 * @param baseTopK TopK base a ajustar
 * @returns Objeto con parámetros optimizados
 */
export function getOptimizedRostroParams(numImagenes: number, baseTemp: number, baseTopK: number) {
  // A más imágenes, menor temperatura para mayor fidelidad
  const optimizedTemp = numImagenes >= 5 ? Math.max(0.1, baseTemp - 0.3) :
                       numImagenes >= 4 ? Math.max(0.2, baseTemp - 0.2) :
                       numImagenes >= 3 ? Math.max(0.25, baseTemp - 0.15) :
                       Math.max(0.3, baseTemp - 0.1);
                       
  // A más imágenes, mayor topK para considerar más opciones
  const optimizedTopK = numImagenes >= 4 ? Math.min(64, baseTopK + 16) :
                       numImagenes >= 3 ? Math.min(48, baseTopK + 8) :
                       baseTopK;
                       
  return {
    temperature: optimizedTemp,
    topK: optimizedTopK,
    // A más imágenes, menor topP para mayor precisión
    topP: numImagenes >= 4 ? 0.7 : 0.8
  };
} 