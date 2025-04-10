import { genAI } from './gemini';
import { HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Define los tipos para las categorías de imágenes
export type ImageCategory = 'asunto' | 'escena' | 'estilo' | 'elementos';

// Define la estructura para almacenar imágenes categorizadas
export type CategorizedImages = {
  asunto?: string;
  escena?: string;
  estilo?: string;
  elementos?: string;
  asuntoDescripcion?: string;
  escenaDescripcion?: string;
  estiloDescripcion?: string;
  elementosDescripcion?: string;
};

/**
 * Analiza una imagen usando Gemini y devuelve una descripción detallada según su categoría
 * @param imageData - La imagen en formato base64
 * @param category - La categoría de la imagen (asunto, escena, estilo)
 * @returns Promesa con la descripción generada
 */
export async function analyzeImage(imageData: string, category: ImageCategory): Promise<string> {
  try {
    // Obtener el modelo de Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Separar el header del base64 si existe
    let base64Data = imageData;
    let mimeType = 'image/jpeg';
    
    if (imageData.startsWith('data:')) {
      const parts = imageData.split(',');
      mimeType = parts[0].split(':')[1].split(';')[0];
      base64Data = parts[1];
    }
    
    // Configurar las instrucciones específicas según la categoría
    let promptText = '';
    
    switch (category) {
      case 'asunto':
        promptText = `
You are a professional image analyzer specialized in identifying and describing SUBJECTS in images for Whisk system.

Analyze this image and provide an extremely detailed description of the MAIN SUBJECT with the following structure:

## Primary Identification
- Identify precisely what the main subject is (person, object, animal, product, etc.)
- Include any specific classification, species, brand, model, or type
- Note the exact position and prominence in the frame

## Physical Characteristics (exhaustive details)
- Colors: Primary, secondary, tertiary, patterns, finishes (metallic, matte, glossy)
- Materials & Textures: What it's made of, texture qualities (rough, smooth, etc.)
- Shapes & Dimensions: Overall shape, proportions, distinctive contours
- Surface details: Patterns, marks, weathering, wear, reflectivity
- Distinguishing features that make this subject unique

## For living subjects (if applicable)
- Age approximation, gender if apparent
- Clothing/accessories in detail (style, color, fit, materials)
- Facial features/expressions in detail
- Pose, gesture, or action being performed
- Distinguishing characteristics (scars, tattoos, unique features)

## Contextual positioning
- How the subject relates to its immediate surroundings
- Any interaction with other elements
- Scale relative to the environment

IMPORTANT: Generate a meticulous, extremely specific description with precise terminology. Use 250-350 words minimum for comprehensive detail. Do not include your analysis process - provide only the detailed description itself.
`;
        break;
      case 'escena':
        promptText = `
You are a professional image analyzer specialized in identifying and describing SCENES/ENVIRONMENTS in images for Whisk system.

Analyze this image and provide an extremely detailed description of the SCENE/ENVIRONMENT with the following structure:

## Setting Identification
- Precise location type (urban, rural, indoor, outdoor, fantasy, abstract, etc.)
- Time period (contemporary, historical, futuristic, timeless)
- Time of day and environmental conditions (lighting, weather, season)
- Geographic or architectural style if identifiable

## Spatial Composition & Depth
- Foreground elements and their arrangement
- Middle-ground elements and their arrangement
- Background elements and their arrangement
- Sense of scale and dimension
- Perspective and viewing angle (eye-level, aerial, etc.)

## Environmental Elements (exhaustive details)
- Natural elements: terrain, vegetation, geological features, water bodies, sky
- Built structures: architecture, infrastructure, furniture, manufactured objects
- Atmosphere: air quality, presence of particles (dust, fog, mist)
- Weather effects and their visual impact

## Lighting Characteristics
- Light sources (natural, artificial, implied)
- Quality of light (harsh, soft, diffused, directional)
- Color temperature and tints
- Shadows and their characteristics
- Reflections, highlights, and how light interacts with surfaces

## Visual Mood & Atmosphere
- The emotional quality conveyed by the environment
- Visual tension, harmony, or drama created by the scene
- Cultural or symbolic elements that set the scene's context

IMPORTANT: Generate a meticulous, extremely specific description with precise terminology. Use 250-350 words minimum for comprehensive detail. Do not include your analysis process - provide only the detailed description itself.
`;
        break;
      case 'elementos':
        promptText = `
You are a professional image analyzer specialized in identifying and describing ELEMENTS TO TRANSFER with high fidelity in images for our Composition system.

Analyze this image and provide an extremely detailed description of the ELEMENT TO TRANSFER with the following structure:

## Element Identification
- Identify precisely what the element is (product, logo, box, object, text, etc.)
- Include exact brand names, text content, and product identifiers 
- Describe its exact purpose and function

## Visual Details (with extreme precision)
- Colors: Exact colors using specific terminology (not just "red" but "crimson red", "coral", etc.)
- Text Content: ALL text visible on the element, including small print, exactly as written
- Logo Details: Precise description of any logos, including their position, size, and appearance
- Physical Structure: Exact shape, dimensions, and materials
- Distinctive Features: Any unique visual elements that make this item recognizable

## Transfer Instructions
- Critical Visual Elements: List of elements that MUST be preserved exactly (logo, text, colors, proportions)
- Spatial Requirements: How this element should be positioned relative to other elements
- Scale Information: The appropriate size relative to human subjects or other objects
- Interaction Details: How people would typically hold, touch, or interact with this element

CRITICAL: This description will be used to transfer this exact element with high fidelity. Be extremely precise about ALL text content, logos, colors, and visual details. Nothing should be approximated or generalized. Describe the element as if you're providing instructions to perfectly recreate it.

Use 250-350 words minimum for comprehensive detail. Do not include your analysis process - provide only the detailed description itself.
`;
        break;
      case 'estilo':
        promptText = `
You are a professional image analyzer specialized in identifying and describing VISUAL STYLES in images for Whisk system.

Analyze this image and provide an extremely detailed description of the VISUAL STYLE with the following structure:

## Style Categorization
- Primary artistic/visual style (photorealistic, illustration, painting, digital art, etc.)
- Specific genre or movement (impressionism, pop art, cyberpunk, etc.)
- Era or period influences
- Cultural or technical references

## Color Analysis
- Dominant color palette (specific colors, not general terms)
- Color harmony approach (complementary, analogous, monochromatic, etc.)
- Color temperature and mood
- Contrast levels and implementation
- Saturation and vibrance qualities
- Color gradients or transitions
- Use of color for emphasis, symbolism, or direction

## Technical Execution
- Medium identification (digital, oil paint, photography, mixed media, etc.)
- Technique characteristics (brushwork, rendering method, filters, etc.)
- Texture approach (smooth, impasto, grainy, etc.)
- Level of detail and complexity
- Edge treatment (hard, soft, blurred, etc.)
- Notable visual effects or processing techniques

## Composition & Design Elements
- Compositional approach (rule of thirds, symmetry, golden ratio, etc.)
- Visual weight distribution
- Use of negative space
- Rhythm and movement
- Perspective treatment
- Depth of field and focus techniques
- Stylistic distortions or exaggerations

## Visual Language & Impact
- Symbolism or visual metaphors
- Emotional tone or aesthetic feeling
- Unique stylistic elements that define this image

IMPORTANT: Generate a meticulous, extremely specific description with precise terminology. Use 250-350 words minimum for comprehensive detail. Incorporate appropriate art/design terminology. Do not include your analysis process - provide only the detailed description itself.
`;
        break;
    }
    
    // Configuración de seguridad (para permitir análisis amplio)
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
    
    // Configuración de generación
    const generationConfig = {
      temperature: 0.2,
      topK: 32,
      topP: 0.95,
      maxOutputTokens: 1200,
    };
    
    // Enviar solicitud al modelo
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      }],
      safetySettings,
      generationConfig
    });
    
    const response = await result.response;
    const description = response.text().trim();
    
    return description;
  } catch (error) {
    console.error('Error al analizar la imagen:', error);
    return 'No se pudo analizar la imagen. Intenta con otra imagen o inténtalo más tarde.';
  }
}

/**
 * Genera un prompt creativo basado en las imágenes categorizadas y el texto del usuario
 * @param categorizedImages - Las imágenes categorizadas con sus descripciones
 * @param userPrompt - El texto ingresado por el usuario
 * @returns Promesa con el prompt generado
 */
export async function generateCreativePrompt(
  categorizedImages: CategorizedImages,
  userPrompt: string
): Promise<string> {
  try {
    // Obtener el modelo de Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Construir el texto de contexto con las descripciones disponibles
    let contextText = 'Based on the following image descriptions:\n\n';
    
    if (categorizedImages.asuntoDescripcion) {
      contextText += `SUBJECT (main element): ${categorizedImages.asuntoDescripcion}\n\n`;
    }
    
    if (categorizedImages.escenaDescripcion) {
      contextText += `SCENE (environment/context): ${categorizedImages.escenaDescripcion}\n\n`;
    }
    
    if (categorizedImages.estiloDescripcion) {
      contextText += `STYLE (aesthetic/visual treatment): ${categorizedImages.estiloDescripcion}\n\n`;
    }
    
    // Agregar la solicitud del usuario
    contextText += `And following this user instruction: "${userPrompt}"\n\n`;
    
    // Crear prompt para generar instrucciones creativas siguiendo el estilo de Whisk
    const promptText = `${contextText}
Create a highly detailed, precise, and creative prompt in English for generating a new image that follows Whisk's high-quality standards:

1. ESSENTIAL: Output ONLY in English for optimal AI image generation results
2. Incorporate the SUBJECT with all its details and characteristics
3. Place it in the SCENE or context described
4. Apply the detailed STYLE visual aesthetic
5. Fulfill the user's specific instruction

Your output should:
- Be extremely detailed (400-600 words)
- Use descriptive and precise language
- Include specific visual elements like lighting, composition, perspective
- Mention colors, textures, materials, and atmosphere
- Use photography/art terminology when appropriate
- Structure the prompt in clear sections with paragraph breaks
- Organize details logically to create a cohesive visual concept

Examples of the level of detail required can be seen in these reference prompts:
1. "A green Tyrannosaurus Rex running through the desert wearing black and white cow-patterned cowboy boots..."
2. "Atop a churning sea of clouds, bathed in the golden glow of a setting sun, hangs the glorious..."
3. "This isn't a picture, but a *style* description for a picture in the spirit of an epic comic book..."

Respond ONLY with the generated English prompt without any explanations or additional text.`;
    
    // Configuración de generación
    const generationConfig = {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1500,
    };
    
    // Enviar solicitud al modelo
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [{ text: promptText }]
      }],
      generationConfig
    });
    
    const response = await result.response;
    const generatedPrompt = response.text().trim();
    
    return generatedPrompt;
  } catch (error) {
    console.error('Error al generar el prompt creativo:', error);
    return userPrompt; // Devolver el prompt original del usuario en caso de error
  }
}

/**
 * Genera un prompt específico para composición con transferencia de elementos
 * @param categorizedImages - Las imágenes categorizadas con sus descripciones
 * @param userPrompt - El texto ingresado por el usuario
 * @returns Promesa con el prompt generado para composición
 */
export async function generateCompositionPrompt(
  categorizedImages: CategorizedImages,
  userPrompt: string
): Promise<string> {
  try {
    // Obtener el modelo de Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Construir el texto de contexto con las descripciones disponibles
    let contextText = 'COMPOSITION TRANSFER TASK - Using the following precise descriptions:\n\n';
    
    if (categorizedImages.asuntoDescripcion) {
      contextText += `MAIN SUBJECT: ${categorizedImages.asuntoDescripcion}\n\n`;
    }
    
    if (categorizedImages.elementosDescripcion) {
      contextText += `ELEMENT TO TRANSFER (HIGH FIDELITY REQUIRED): ${categorizedImages.elementosDescripcion}\n\n`;
    }
    
    if (categorizedImages.escenaDescripcion) {
      contextText += `BACKGROUND/SCENE: ${categorizedImages.escenaDescripcion}\n\n`;
    }
    
    if (categorizedImages.estiloDescripcion) {
      contextText += `VISUAL STYLE: ${categorizedImages.estiloDescripcion}\n\n`;
    }
    
    // Agregar la solicitud del usuario
    contextText += `USER INSTRUCTIONS: "${userPrompt}"\n\n`;
    
    // Crear prompt para generar instrucciones específicas de transferencia
    const promptText = `${contextText}
Create a detailed image generation prompt in English focused on precise object transfer and composition. The prompt must ensure:

1. CRITICAL - EXACT VISUAL FIDELITY of the ELEMENT TO TRANSFER
   - Preserve the EXACT typography, text content, colors, and logo details
   - Maintain precise proportions, materials, and distinctive features
   - Ensure that all text is legible and positioned correctly

2. ACCURATE SUBJECT REPRESENTATION
   - Maintain the subject's identity, appearance, and key characteristics
   - Ensure natural interaction between the subject and transferred element

3. PRECISE COMPOSITION BASED ON USER INSTRUCTIONS
   - Follow the specific positioning/action described by the user
   - Create a natural integration between elements

4. REALISTIC INTERACTION AND SCALE
   - Ensure proper scale relationship between subject and transferred element
   - Create realistic physics and interaction (how objects are held, placed, etc.)

Your output MUST be in this format:
1. First paragraph: Detailed subject description with precise appearance
2. Second paragraph: EXACT description of the element to transfer with ALL text, logos, and visual details
3. Third paragraph: Composition instructions for how these elements interact
4. Fourth paragraph: Lighting, environment, and perspective details

CRITICAL TRANSFER INSTRUCTION: When describing the element to transfer, include the EXACT text content, brand names, color specifications, and visual details. Nothing should be approximate.

Respond ONLY with the detailed transfer prompt in English. Start directly with the prompt.`;
    
    // Configuración de generación - Baja temperatura para mayor precisión
    const generationConfig = {
      temperature: 0.2, // Más bajo para mayor consistencia y precisión
      topK: 20,
      topP: 0.8,
      maxOutputTokens: 1500,
    };
    
    // Enviar solicitud al modelo
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [{ text: promptText }]
      }],
      generationConfig
    });
    
    const response = await result.response;
    const generatedPrompt = response.text().trim();
    
    // Añadir una instrucción final para enfatizar la transferencia exacta
    return generatedPrompt + "\n\nCRITICAL: This is a precision transfer task - maintain EXACT fidelity of all logos, text, and visual elements as described.";
  } catch (error) {
    console.error('Error al generar el prompt de composición:', error);
    return userPrompt + " (con transferencia exacta de elementos)"; // Devolver un prompt básico en caso de error
  }
} 