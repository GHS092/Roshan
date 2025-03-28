'use client';

import { useState, useRef, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import ImageUploader from './components/ImageUploader';
import PromptInput, { PromptInputRef } from './components/PromptInput';
import GeneratedImage, { GeneratedImageVariant } from './components/GeneratedImage';
import Switch from './components/Switch';
import SeedControl from './components/SeedControl';
import MaskInfo from './components/MaskInfo';
import TabSwitcher from './components/TabSwitcher';
import TextToImageGenerator from './components/TextToImageGenerator';
import RealTimeChat from './components/RealTimeChat';
import { 
  generateImageFromPrompt, 
  generateHighQualityImage, 
  generateImageVariations,
  clearModelCache, 
  resetGenerationSeed, 
  isSeedLocked, 
  globalGenerationSeed 
} from './lib/gemini';

// Función para traducir el prompt a inglés de manera simple pero preservando instrucciones críticas
const translateToEnglish = (prompt: string): string => {
  // Detectar instrucciones de transferencia entre imágenes
  const promptLower = prompt.toLowerCase();
  const containsTransferInstructions = 
      promptLower.includes('coloca') || 
      promptLower.includes('poner') || 
      promptLower.includes('pon') || 
      promptLower.includes('añade') || 
      promptLower.includes('añadir') || 
      promptLower.includes('agrega') || 
      (promptLower.includes('logo') && 
       (promptLower.includes('imagen 1') || promptLower.includes('imagen 2')));
  
  // Si contiene instrucciones de transferencia, hacer una traducción más cuidadosa
  if (containsTransferInstructions) {
    // Traducir explícitamente términos de transferencia
    let modifiedPrompt = prompt;
    
    // Términos de ubicación específica
    modifiedPrompt = modifiedPrompt
      .replace(/\bimagen 1\b/gi, "IMAGE 1")
      .replace(/\bimagen 2\b/gi, "IMAGE 2")
      .replace(/\bimagen 3\b/gi, "IMAGE 3")
      .replace(/\bprimera imagen\b/gi, "IMAGE 1")
      .replace(/\bsegunda imagen\b/gi, "IMAGE 2")
      .replace(/\btercera imagen\b/gi, "IMAGE 3")
      .replace(/\blogo\b/gi, "LOGO")
      .replace(/\bpolo\b/gi, "SHIRT")
      .replace(/\bcamisa\b/gi, "SHIRT")
      .replace(/\bplayera\b/gi, "TSHIRT")
      .replace(/\bcamiseta\b/gi, "TSHIRT")
      .replace(/\bde el\b/gi, "of the")
      .replace(/\bdel\b/gi, "of the")
      .replace(/\ben el\b/gi, "on the")
      .replace(/\ben la\b/gi, "on the")
      .replace(/\bsobre\b/gi, "on");
    
    // Verbos de acción específicos
    if (promptLower.includes("coloca")) {
      modifiedPrompt = modifiedPrompt.replace(/\bcoloca\b/gi, "PLACE");
    }
    if (promptLower.includes("pon")) {
      modifiedPrompt = modifiedPrompt.replace(/\bpon\b/gi, "PUT");
    }
    if (promptLower.includes("poner")) {
      modifiedPrompt = modifiedPrompt.replace(/\bponer\b/gi, "PUT");
    }
    if (promptLower.includes("añade")) {
      modifiedPrompt = modifiedPrompt.replace(/\bañade\b/gi, "ADD");
    }
    if (promptLower.includes("añadir")) {
      modifiedPrompt = modifiedPrompt.replace(/\bañadir\b/gi, "ADD");
    }
    if (promptLower.includes("agrega")) {
      modifiedPrompt = modifiedPrompt.replace(/\bagrega\b/gi, "ADD");
    }
    
    // Instrucción final específica para operaciones de transferencia
    const transferPrefix = "TRANSFER INSTRUCTION: ";
    const transferSuffix = " (CRITICAL: Identify the LOGO or element in the second image and transfer it EXACTLY to the specified location in the first image. Maintain all original proportions, colors, and details. THIS IS A PRECISE TRANSFER OPERATION.)";
    
    return transferPrefix + modifiedPrompt + transferSuffix;
  }
  
  // Traducciones comunes en generación de imágenes
  const translations: Record<string, string> = {
    // Animales
    'gato': 'cat',
    'perro': 'dog',
    'caballo': 'horse',
    'pájaro': 'bird',
    'pez': 'fish',
    'conejo': 'rabbit',
    'león': 'lion',
    'tigre': 'tiger',
    'elefante': 'elephant',
    'jirafa': 'giraffe',
    'oso': 'bear',
    'lobo': 'wolf',
    'zorro': 'fox',
    'mono': 'monkey',
    
    // Colores
    'rojo': 'red',
    'azul': 'blue',
    'verde': 'green',
    'amarillo': 'yellow',
    'negro': 'black',
    'blanco': 'white',
    'naranja': 'orange',
    'púrpura': 'purple',
    'morado': 'purple',
    'violeta': 'violet',
    'marrón': 'brown',
    'gris': 'gray',
    'plateado': 'silver',
    'dorado': 'gold',
    'rosa': 'pink',
    'turquesa': 'turquoise',
    'cian': 'cyan',
    'magenta': 'magenta',
    
    // Adjetivos comunes
    'grande': 'big',
    'pequeño': 'small',
    'alto': 'tall',
    'bajo': 'short',
    'ancho': 'wide',
    'estrecho': 'narrow',
    'grueso': 'thick',
    'delgado': 'thin',
    'pesado': 'heavy',
    'ligero': 'light',
    'brillante': 'bright',
    'oscuro': 'dark',
    'claro': 'light',
    'más': 'more',
    'menos': 'less',
    'hermoso': 'beautiful',
    'feo': 'ugly',
    'fuerte': 'strong',
    'débil': 'weak',
    'nuevo': 'new',
    'viejo': 'old',
    'joven': 'young',
    'antiguo': 'ancient',
    'moderno': 'modern',
    'caliente': 'hot',
    'frío': 'cold',
    'triste': 'sad',
    'feliz': 'happy',
    'enojado': 'angry',
    'sorprendido': 'surprised',
    'asustado': 'scared',
    'asombrado': 'amazed',
    
    // Verbos de edición
    'añade': 'add',
    'añadir': 'add',
    'elimina': 'remove',
    'quita': 'remove',
    'quitar': 'remove',
    'eliminar': 'remove',
    'coloca': 'place',
    'colocar': 'place',
    'pon': 'put',
    'poner': 'put',
    'cambia': 'change',
    'cambiar': 'change',
    'modifica': 'modify',
    'modificar': 'modify',
    'transforma': 'transform',
    'transformar': 'transform',
    'convierte': 'convert',
    'convertir': 'convert',
    'reemplaza': 'replace',
    'reemplazar': 'replace',
    'sustituye': 'replace',
    'sustituir': 'replace',
    'ajusta': 'adjust',
    'ajustar': 'adjust',
    'redimensiona': 'resize',
    'redimensionar': 'resize',
    'rota': 'rotate',
    'rotar': 'rotate',
    'gira': 'rotate',
    'girar': 'rotate',
    'voltea': 'flip',
    'voltear': 'flip',
    'invierte': 'invert',
    'invertir': 'invert',
    'mezcla': 'blend',
    'mezclar': 'blend',
    'fusiona': 'merge',
    'fusionar': 'merge',
    'colorea': 'color',
    'colorear': 'color',
    'pinta': 'paint',
    'pintar': 'paint',
    'dibuja': 'draw',
    'dibujar': 'draw',
    'borra': 'erase',
    'borrar': 'erase',
    'desdibuja': 'blur',
    'desdibujar': 'blur',
    'enfoca': 'focus',
    'enfocar': 'focus',
    
    // Elementos comunes
    'color': 'color',
    'estilo': 'style',
    'fondo': 'background',
    'cielo': 'sky',
    'agua': 'water',
    'montaña': 'mountain',
    'árbol': 'tree',
    'flor': 'flower',
    'planta': 'plant',
    'casa': 'house',
    'edificio': 'building',
    'persona': 'person',
    'gente': 'people',
    'hombre': 'man',
    'mujer': 'woman',
    'niño': 'child',
    'niña': 'girl',
    'niños': 'children',
    'bebé': 'baby',
    'adulto': 'adult',
    'cabello': 'hair',
    'pelo': 'hair',
    'ojos': 'eyes',
    'boca': 'mouth',
    'nariz': 'nose',
    'orejas': 'ears',
    'cara': 'face',
    'rostro': 'face',
    'gorro': 'cap',
    'ropa': 'clothes',
    'pantalón': 'pants',
    'vestido': 'dress',
    'traje': 'suit',
    'auto': 'car',
    'coche': 'car',
    'bicicleta': 'bicycle',
    'moto': 'motorcycle',
    'motocicleta': 'motorcycle',
    'avión': 'airplane',
    'barco': 'boat',
    'tren': 'train',
    'sol': 'sun',
    'luna': 'moon',
    'estrella': 'star',
    'estrellas': 'stars',
    'día': 'day',
    'noche': 'night',
    'lluvia': 'rain',
    'nieve': 'snow',
    'nube': 'cloud',
    'nubes': 'clouds',
    'fuego': 'fire',
    'hielo': 'ice',
    'tierra': 'earth',
    'suelo': 'ground',
    'arena': 'sand',
    'playa': 'beach',
    'mar': 'sea',
    'océano': 'ocean',
    'río': 'river',
    'lago': 'lake',
    'bosque': 'forest',
    'selva': 'jungle',
    'desierto': 'desert',
    'montañas': 'mountains',
    'ciudad': 'city',
    'pueblo': 'town',
    'campo': 'countryside',
    'barba': 'beard',
    'bigote': 'mustache',
    'sonrisa': 'smile',
    
    // Términos de efectos
    'borroso': 'blurry',
    'nítido': 'sharp',
    'desenfocado': 'unfocused',
    'transparente': 'transparent',
    'opaco': 'opaque',
    'brillo': 'brightness',
    'contraste': 'contrast',
    'saturación': 'saturation',
    'tono': 'hue',
    'sombra': 'shadow',
    'reflejo': 'reflection',
    'textura': 'texture',
    'patrón': 'pattern',
    'degradado': 'gradient',
    'efecto': 'effect',
    'filtro': 'filter',
    'marco': 'frame',
    'borde': 'border',
    'collage': 'collage',
    'mosaico': 'mosaic',
    'ilustración': 'illustration',
    'realista': 'realistic',
    'artístico': 'artistic',
    'abstracto': 'abstract',
    'cartoon': 'cartoon',
    'caricatura': 'cartoon',
    'cómic': 'comic',
    'dibujo': 'drawing',
    'acuarela': 'watercolor',
    'óleo': 'oil painting',
    'paisaje': 'landscape',
    'retrato': 'portrait',
    'silueta': 'silhouette',
    'miniatura': 'thumbnail',
    'panorámica': 'panoramic',
    'blanco y negro': 'black and white',
    'sepia': 'sepia',
    'vintage': 'vintage',
    'retro': 'retro',
    'futurista': 'futuristic',
    'hiperrealista': 'hyperrealistic',
    'surrealista': 'surrealistic',
    'minimalista': 'minimalist',
    'estilizado': 'stylized',
    'baja resolución': 'low resolution',
    'alta resolución': 'high resolution',
    'hdr': 'hdr',
    'baja calidad': 'low quality',
    'alta calidad': 'high quality',
    
    // Términos específicos para elementos de imágenes
    'logo': 'logo',
    'logotipo': 'logo',
    'emblema': 'emblem',
    'insignia': 'badge',
    'símbolo': 'symbol',
    'marca': 'brand',
    'polo': 'polo shirt',
    'camiseta': 't-shirt',
    'playera': 't-shirt',
    'camisa': 'shirt',
    'sudadera': 'sweatshirt',
    'chamarra': 'jacket',
    'chaqueta': 'jacket',
    'pantalones': 'pants',
    'jeans': 'jeans',
    'vaqueros': 'jeans',
    'cinturón': 'belt',
    'calcetines': 'socks',
    'medias': 'socks',
    'zapatos': 'shoes',
    'botas': 'boots',
    'tenis': 'sneakers',
    'zapatillas': 'sneakers',
    'chanclas': 'flip flops',
    'sandalias': 'sandals',
    'pulsera': 'bracelet',
    'reloj': 'watch',
    'collar': 'necklace',
    'anillo': 'ring',
    'pendientes': 'earrings',
    'aretes': 'earrings',
    'mochila': 'backpack',
    'bolso': 'bag',
    'bolsa': 'bag',
    'cartera': 'wallet',
    'billetera': 'wallet',
    'paraguas': 'umbrella',
    'sombrero': 'hat',
    'gorra': 'cap',
    'guantes': 'gloves',
    'bufanda': 'scarf',
    'gafas': 'glasses',
    'lentes': 'glasses'
  };
  
  // Convertir a minúsculas para la comparación
  let lowerPrompt = prompt.toLowerCase();
  
  // Reemplazar palabras conocidas
  for (const [spanish, english] of Object.entries(translations)) {
    // Usar regex para reemplazar palabras completas
    const regex = new RegExp(`\\b${spanish}\\b`, 'gi');
    lowerPrompt = lowerPrompt.replace(regex, english);
  }
  
  // Mantener mayúsculas/minúsculas originales mientras sea posible
  // pero asegurarnos de que la traducción se aplicó
  return `${lowerPrompt} (Prompt original en español: ${prompt})`;
};

export default function Home() {
  // Estado para controlar qué pestaña está activa
  const [activeTab, setActiveTab] = useState('edit'); // 'edit' o 'generate' o 'realtime'
  
  // Estados existentes
  const [images, setImages] = useState<string[]>([]);
  const [masks, setMasks] = useState<Record<number, string> | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImageVariants, setGeneratedImageVariants] = useState<GeneratedImageVariant[]>([]);
  const [previousMasks, setPreviousMasks] = useState<Record<number, string> | undefined>(undefined);
  const [keepMasks, setKeepMasks] = useState<boolean>(false);
  const promptInputRef = useRef<PromptInputRef>(null);

  const handleImagesUpload = (images: string[], masks?: Record<number, string>) => {
    setImages(images);
    
    // Si keepMasks está activado y tenemos máscaras previas, mantenerlas
    // Solo usamos las nuevas máscaras si existen
    if (keepMasks && previousMasks && (!masks || Object.keys(masks).length === 0)) {
      setMasks(previousMasks);
    } else {
      setMasks(masks);
      // Guardamos las máscaras actuales como previas para posible uso futuro
      if (masks && Object.keys(masks).length > 0) {
        setPreviousMasks(masks);
      }
    }
  };

  const handleKeepMasksToggle = (value: boolean) => {
    setKeepMasks(value);
    
    if (value) {
      // Si activamos la opción:
      // 1. Si hay máscaras actuales, guardarlas como previas para futuras generaciones
      if (masks && Object.keys(masks).length > 0) {
        setPreviousMasks(masks);
      }
      // 2. Si no hay máscaras actuales pero hay previas, restaurarlas
      else if (previousMasks && Object.keys(previousMasks).length > 0) {
        setMasks(previousMasks);
      }
    } else {
      // Si desactivamos la opción, guardar las máscaras actuales como previas
      // pero no las eliminamos, solo se eliminarán en la próxima generación
      if (masks && Object.keys(masks).length > 0) {
        setPreviousMasks(masks);
      }
    }
  };

  const handleReset = () => {
    // Limpiar estados
    setImages([]);
    setMasks(undefined);
    setGeneratedImageVariants([]);
    
    // Limpiar el prompt
    if (promptInputRef.current) {
      promptInputRef.current.clearPrompt();
    }
    
    // Limpiar caché del modelo de Gemini
    clearModelCache();
    
    // Notificar al usuario que se está reiniciando
    toast.success('Reiniciando completamente la aplicación...');
    
    // Forzar la recarga de la página después de un breve retraso
    // Esto eliminará cualquier caché en memoria
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handlePromptSubmit = async (prompt: string) => {
    if (!images || images.length === 0) {
      toast.error('Por favor, sube al menos una imagen');
      return;
    }

    setIsLoading(true);
    try {
      // Si la semilla no está bloqueada, generar una nueva para esta generación
      if (!isSeedLocked()) {
        const newSeed = resetGenerationSeed();
        toast.loading(`Generando imágenes con nueva semilla: ${newSeed}...`, { id: 'generating-image' });
      } else {
        // Si está bloqueada, notificar que se está usando la misma semilla
        const currentSeed = globalGenerationSeed || 0; // Importar globalGenerationSeed
        toast.loading(`Generando imágenes manteniendo la semilla ${currentSeed}...`, { id: 'generating-image' });
      }
      
      // Verificar que las imágenes estén en el orden correcto
      let processedImages = [...images];
      
      // Comprobar si hay máscaras definidas
      const hasMasks = masks && Object.keys(masks).length > 0;
      
      // Si hay máscaras, mostrar un mensaje adicional indicando que se están usando
      if (hasMasks) {
        toast.loading('Aplicando máscaras a las áreas seleccionadas...', { id: 'applying-masks' });
      }
      
      // Traducir el prompt a inglés para mejorar los resultados
      const translatedPrompt = translateToEnglish(prompt);
      console.log('Prompt original:', prompt);
      console.log('Prompt traducido:', translatedPrompt);
      
      // Generar variaciones de la imagen
      toast.loading('Generando múltiples variaciones...', { id: 'generating-variations' });
      
      // Intentar generar 3 variaciones de imagen
      const results = await generateImageVariations(
        processedImages, 
        translatedPrompt, 
        hasMasks ? masks : undefined,
        3 // número de variaciones
      );
      
      // Cerrar todos los toasts de carga
      toast.dismiss('generating-image');
      toast.dismiss('applying-masks');
      toast.dismiss('generating-variations');
      
      if (results && results.length > 0) {
        // Crear objetos de variante para cada imagen resultante
        const variants: GeneratedImageVariant[] = results.map((imageUrl, index) => {
          let label = '';
          if (index === 0) label = 'Original';
          else if (index === 1) label = 'Balance';
          else if (index === 2) label = 'Creativa';
          
          return {
            imageUrl,
            variationLabel: label
          };
        });
        
        setGeneratedImageVariants(variants);
        toast.success(`¡${results.length} variaciones generadas exitosamente!`);
        
        // Guardar máscaras actuales como previas antes de procesarlas
        if (hasMasks && keepMasks) {
          setPreviousMasks(masks);
        }
        
        // Solo limpiar las máscaras si keepMasks está desactivado
        if (hasMasks && !keepMasks) {
          setMasks(undefined);
        }
      } else {
        toast.error('No se pudieron generar variaciones, intenta con otro prompt');
      }
    } catch (error) {
      console.error('Error al generar las variaciones:', error);
      
      // Mensajes de error específicos según el error
      if (error instanceof Error) {
        if (error.message.includes("timeout") || error.message.includes("timed out")) {
          toast.error('La generación tardó demasiado tiempo. Intenta con un prompt más simple o sin máscaras.');
        } else if (error.message.includes("rate limit") || error.message.includes("ratelimit")) {
          toast.error('Has excedido el límite de solicitudes. Espera un momento e intenta de nuevo.');
        } else if (error.message.includes("content filtered") || error.message.includes("safety")) {
          toast.error('Tu solicitud fue filtrada por políticas de contenido. Modifica tu prompt e intenta de nuevo.');
        } else {
          toast.error(`Error: ${error.message}`);
        }
      } else {
        toast.error('Ocurrió un error desconocido. Intenta de nuevo más tarde.');
      }
      
      // Cerrar todos los toasts de carga
      toast.dismiss('generating-image');
      toast.dismiss('applying-masks');
      toast.dismiss('generating-variations');
    } finally {
      setIsLoading(false);
      
      // Limpiar el caché del modelo para evitar problemas en futuras generaciones
      try {
        // Una versión más segura que no intenta reasignar constantes
        if (typeof window !== 'undefined') {
          // Generar un nuevo ID de sesión para evitar caché en la próxima solicitud
          const newSessionId = `session_${Date.now()}`;
          sessionStorage.setItem('gemini_session_id', newSessionId);
          console.log('Nuevo ID de sesión generado para la próxima solicitud:', newSessionId);
          
          // Limpiar posibles datos persistentes
          sessionStorage.removeItem('gemini_last_prompt');
          sessionStorage.removeItem('gemini_last_response');
          sessionStorage.removeItem('gemini_context');
        }
      } catch (e) {
        console.warn('No se pudo actualizar el ID de sesión:', e);
      }
    }
  };

  const handleEditGeneratedImage = (variantIndex: number = 0) => {
    if (!generatedImageVariants || generatedImageVariants.length === 0) return;
    
    // Obtener la variante seleccionada
    const selectedVariant = generatedImageVariants[variantIndex];
    
    // Extraer el base64 de la URL de datos
    let base64Data = selectedVariant.imageUrl;
    if (base64Data.startsWith('data:')) {
      base64Data = base64Data.split(',')[1];
    }
    
    // Usar la imagen seleccionada como la nueva imagen principal
    setImages([base64Data]);
    
    // Guardar las máscaras actuales como previas si keepMasks está activado
    if (keepMasks && masks && Object.keys(masks).length > 0) {
      setPreviousMasks(masks);
    }
    
    // Solo limpiar máscaras si keepMasks está desactivado
    if (!keepMasks) {
      setMasks(undefined);
    }
    
    // Notificar al usuario
    toast.success(`Variante "${selectedVariant.variationLabel || `#${variantIndex+1}`}" lista para editar. Escribe un nuevo prompt para continuar.`);
  };

  const handleRegenerateImage = async () => {
    if (!promptInputRef.current || !images || images.length === 0) return;
    
    const currentPrompt = promptInputRef.current.getCurrentPrompt();
    
    if (!currentPrompt.trim()) {
      toast.error('Por favor, escribe un prompt para regenerar la imagen');
      return;
    }
    
    // Si la semilla no está bloqueada, generar una nueva para esta regeneración
    if (!isSeedLocked()) {
      const newSeed = resetGenerationSeed();
      toast.loading(`Regenerando variaciones con nueva semilla: ${newSeed}...`, { id: 'regenerating' });
    } else {
      // Si está bloqueada, notificar que se está usando la misma semilla
      const currentSeed = globalGenerationSeed || 0;
      toast.loading(`Regenerando variaciones manteniendo la semilla ${currentSeed}...`, { id: 'regenerating' });
    }
    
    setIsLoading(true);
    try {
      // Verificar que las imágenes estén en el orden correcto
      let processedImages = [...images];
      
      // Comprobar si hay máscaras definidas
      const hasMasks = masks && Object.keys(masks).length > 0;
      
      // Traducir el prompt a inglés para mejorar los resultados
      const translatedPrompt = translateToEnglish(currentPrompt);
      
      // Generar variaciones de la imagen
      toast.loading('Regenerando múltiples variaciones...', { id: 'generating-variations' });
      
      // Intentar generar 3 variaciones de imagen
      const results = await generateImageVariations(
        processedImages, 
        translatedPrompt, 
        hasMasks ? masks : undefined,
        3 // número de variaciones
      );
      
      // Cerrar todos los toasts de carga
      toast.dismiss('regenerating');
      toast.dismiss('generating-variations');
      
      if (results && results.length > 0) {
        // Crear objetos de variante para cada imagen resultante
        const variants: GeneratedImageVariant[] = results.map((imageUrl, index) => {
          let label = '';
          if (index === 0) label = 'Original';
          else if (index === 1) label = 'Balance';
          else if (index === 2) label = 'Creativa';
          
          return {
            imageUrl,
            variationLabel: label
          };
        });
        
        setGeneratedImageVariants(variants);
        toast.success(`¡${results.length} variaciones regeneradas exitosamente!`);
        
        // Guardar máscaras actuales como previas si keepMasks está activado
        if (hasMasks && keepMasks) {
          setPreviousMasks(masks);
        }
        
        // Solo limpiar máscaras si keepMasks está desactivado
        if (hasMasks && !keepMasks) {
          setMasks(undefined);
        }
      } else {
        toast.error('No se pudieron regenerar las variaciones, intenta con otro prompt');
      }
    } catch (error) {
      console.error('Error al regenerar las variaciones:', error);
      toast.error('Error al regenerar las variaciones. Por favor, intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Definición de las pestañas
  const tabs = [
    {
      id: 'edit',
      label: 'Editar Imágenes',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      )
    },
    {
      id: 'generate',
      label: 'Generar Imágenes',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      id: 'realtime',
      label: 'Chat en Tiempo Real',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100">
      <Toaster position="top-right" />
      
      {/* Fondo con formas decorativas */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl"></div>
        <div className="absolute top-1/4 -left-24 w-80 h-80 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl"></div>
        <div className="absolute bottom-0 right-1/3 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl"></div>
      </div>
      
      <div className="relative max-w-7xl mx-auto py-6 sm:py-10 md:py-16 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 md:mb-16">
          <h1 className="relative text-4xl sm:text-5xl font-extrabold mb-4 md:mb-6 tracking-tight">
            <span className="title-gradient">Generador de Imágenes con IA</span>
          </h1>
          <p className="text-base sm:text-xl text-gray-700 max-w-3xl mx-auto font-medium">
            Transforma o genera imágenes utilizando inteligencia artificial. 
            Elige entre editar imágenes existentes o crear nuevas a partir de texto.
          </p>
          <div className="mt-6">
            <button 
              onClick={handleReset}
              className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-full shadow-lg text-white bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transform transition-transform hover:scale-105"
            >
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
              Reiniciar todo
            </button>
          </div>
        </div>

        {/* Selector de pestañas */}
        <TabSwitcher 
          tabs={tabs} 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
        />

        {activeTab === 'edit' ? (
          // Contenido existente para edición de imágenes
        <div className="grid gap-8 lg:gap-12 md:grid-cols-2">
          <div className="space-y-8">
            <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-indigo-100/50 transform transition-all hover:shadow-indigo-200/40">
              <div className="flex items-center mb-5">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold mr-3 shadow-md">
                  1
                </div>
                <h2 className="text-xl font-bold text-gray-800">
                  Sube tus imágenes
                </h2>
              </div>
              <p className="text-sm text-gray-600 mb-5 ml-14">
                La <span className="font-bold text-indigo-600">primera imagen</span> es la que será modificada según tus instrucciones. Las demás imágenes servirán como referencia.
              </p>
                <div className="mb-4 flex justify-between items-center">
                  <Switch 
                    label="Mantener máscaras entre generaciones" 
                    tooltip="Activa esta opción para conservar las máscaras que has dibujado en las futuras generaciones de imágenes"
                    initialValue={keepMasks}
                    onChange={handleKeepMasksToggle}
                  />
                  
                  <SeedControl 
                    className="ml-auto" 
                    onLockChange={(locked) => {
                      // Notificar al usuario sobre el estado del bloqueo
                      if (locked) {
                        toast.success('Semilla bloqueada. Se mantendrá constante entre generaciones.');
                      } else {
                        toast.success('Semilla desbloqueada. Cambiará automáticamente en cada generación.');
                      }
                    }}
                  />
                </div>
              <ImageUploader 
                onImagesUpload={handleImagesUpload} 
                  uploadedImages={images}
                  previousMasks={previousMasks}
                  keepMasks={keepMasks}
              />
              
                {masks && Object.keys(masks).length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200">
                  <div className="flex items-center text-green-700">
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
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                      />
                    </svg>
                    <span className="text-sm font-medium">
                        Máscaras de selección aplicadas: {Object.keys(masks).length}
                    </span>
                  </div>
                </div>
              )}
                
                <MaskInfo masks={masks} className="mt-4" />
            </div>

            <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-indigo-100/50 transform transition-all hover:shadow-indigo-200/40">
              <div className="flex items-center mb-5">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold mr-3 shadow-md">
                  2
                </div>
                <h2 className="text-xl font-bold text-gray-800">
                  Describe la transformación
                </h2>
              </div>
              <PromptInput 
                ref={promptInputRef}
                onSubmit={handlePromptSubmit} 
                isLoading={isLoading} 
              />
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-indigo-100/50 transform transition-all hover:shadow-indigo-200/40">
            <h2 className="text-xl font-bold text-gray-800 mb-5 flex items-center">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-7 w-7 mr-2 text-indigo-500" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
                />
              </svg>
              Resultado
            </h2>
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="flex flex-col items-center">
                  <div className="relative w-20 h-20">
                    <div className="absolute top-0 left-0 w-full h-full rounded-full border-4 border-indigo-200 opacity-25"></div>
                    <div className="absolute top-0 left-0 w-full h-full rounded-full border-t-4 border-l-4 border-indigo-600 animate-spin"></div>
                  </div>
                    <p className="mt-6 text-indigo-700 font-medium">Creando tus variaciones mágicas...</p>
                  </div>
                </div>
              ) : generatedImageVariants && generatedImageVariants.length > 0 ? (
              <GeneratedImage 
                  imageVariants={generatedImageVariants}
                onEditImage={handleEditGeneratedImage}
                onRegenerateImage={handleRegenerateImage}
              />
            ) : (
              <div className="flex flex-col justify-center items-center h-64 bg-gradient-to-br from-gray-50 to-indigo-50/30 rounded-xl border-2 border-dashed border-indigo-200">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-16 w-16 text-indigo-300 mb-4" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
                  />
                </svg>
                <p className="text-indigo-600 font-medium text-lg">
                    Tus variaciones aparecerán aquí
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  Sube una imagen y describe cómo quieres transformarla
                </p>
              </div>
            )}
          </div>
        </div>
        ) : activeTab === 'generate' ? (
          // Contenido para generación de imágenes desde texto
          <TextToImageGenerator />
        ) : (
          // Nuevo contenido para chat en tiempo real
          <RealTimeChat />
        )}

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="footer-text-subtle">
            Crea y edita imágenes fácilmente con inteligencia artificial.
            Esta aplicación utiliza la tecnología de Google y desarrollado por Luis GHS
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes shimmer {
          0% {
            background-position: -200% center;
          }
          100% {
            background-position: 200% center;
          }
        }
        
        .animate-shimmer {
          background-size: 200% auto;
          animation: shimmer 3s linear infinite;
          text-shadow: 0 0 8px rgba(255, 255, 255, 0.4);
          letter-spacing: 0.5px;
        }
        
        .title-text {
          -webkit-text-stroke: 0.7px rgba(79, 70, 229, 0.2); /* Indigo color with low opacity */
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
          letter-spacing: -0.5px;
          padding-bottom: 4px; /* Space for the descenders like 'g' */
        }
        
        .title-gradient {
          background: linear-gradient(to right, #4f46e5, #9333ea); /* from-indigo-600 to-purple-600 */
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          display: inline-block;
          filter: drop-shadow(0px 2px 2px rgba(0, 0, 0, 0.1));
          -webkit-text-fill-color: transparent;
          -webkit-box-decoration-break: clone;
          position: relative;
          padding: 0.05em 0;
          line-height: 1.2;
        }
        
        .footer-text-subtle {
          font-size: 0.9rem;
          font-weight: 500;
          position: relative;
          display: inline-block;
          padding: 0.5em 1.2em;
          letter-spacing: 0.5px;
          color: #6b7280;
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          border-radius: 6px;
          border: 1px solid rgba(209, 213, 219, 0.5);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          transition: all 0.2s ease;
        }
        
        .footer-text-subtle span {
          font-weight: 600;
          color: #4f46e5;
        }
        
        @media (hover: hover) {
          .footer-text-subtle:hover {
            background: rgba(255, 255, 255, 0.9);
            border-color: rgba(79, 70, 229, 0.3);
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.08);
            transform: translateY(-1px);
          }
        }
      `}</style>
    </div>
  );
}
