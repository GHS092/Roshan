/**
 * Optimiza el prompt para la generación de rostros
 * @param basePrompt Prompt base a optimizar
 * @returns Prompt optimizado
 */
export function getOptimizedRostroPrompt(basePrompt: string): string {
  // Añadir instrucciones específicas para rostros
  return `${basePrompt}
  
INSTRUCCIONES ESPECÍFICAS PARA ROSTROS:
- Mantener con extrema precisión los rasgos faciales y la identidad de la persona
- Preservar las proporciones exactas del rostro
- Conservar detalles específicos como peinado, vello facial, expresión, etc.
- No alterar la edad percibida de la persona
- Mantener la pose y mirada originales
- Preservar el género y características étnicas de la persona
`;
} 