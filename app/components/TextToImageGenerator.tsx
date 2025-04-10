'use client';

import React, { useState, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { FaImage, FaTrash, FaBroom, FaDownload, FaCog, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { generateImageFromText } from '../lib/gemini';
import { 
  prepareImagesForGemini, 
  prepareImageForGhibliTransform, 
  prepareImageForAnimeTransform,
  processMultipleReferenceImages,
  generateMultiReferenceInstructions
} from '../lib/imageUtils';
import { Slider } from '../components/Slider';
import ImageDisplay from './ImageDisplay';
import AdvancedSettings from './AdvancedSettings';
import { FiX, FiPlusCircle, FiLoader, FiImage } from 'react-icons/fi';

// Estilos de imagen predefinidos
const ESTILOS_IMAGEN = [
  { id: 'none', nombre: 'Ninguno' },
  { id: 'photo', nombre: 'Fotografía' },
  { id: 'realistic', nombre: 'Realista' },
  { id: 'digital-art', nombre: '3D Digital Art' },
  { id: 'painting', nombre: 'Pintura' },
  { id: 'watercolor', nombre: 'Acuarela' },
  { id: 'cartoon', nombre: 'Caricatura' },
  { id: 'anime', nombre: 'Anime' },
  { id: 'cinematic', nombre: 'Cinematográfico' },
  { id: 'ghibli', nombre: 'Studio Ghibli' },
];

// Sugerencias para el estilo Ghibli
const SUGERENCIAS_GHIBLI = [
  "Retrato de una joven con sombrero en un campo de flores",
  "Niño explorando un bosque mágico con pequeñas criaturas",
  "Paisaje con casa rural junto a un lago al atardecer",
  "Persona en bicicleta por un camino rodeado de árboles",
  "Ciudad antigua con canales y edificios coloridos",
  "Familia disfrutando de un picnic bajo un gran árbol"
];

// Elementos icónicos de Studio Ghibli que se pueden añadir a los prompts
const ELEMENTOS_GHIBLI = [
  { nombre: "Totoro", descripcion: "Criatura espiritual del bosque gris y grande" },
  { nombre: "Catbus", descripcion: "Gato-autobús mágico con múltiples patas" },
  { nombre: "No-Face", descripcion: "Espíritu con máscara blanca de El Viaje de Chihiro" },
  { nombre: "Soot Sprites", descripcion: "Pequeñas bolitas de hollín negras" },
  { nombre: "Haku", descripcion: "Dragón blanco-azulado y joven de El Viaje de Chihiro" },
  { nombre: "Calcifer", descripcion: "Demonio de fuego del Castillo Ambulante" },
  { nombre: "Kodamas", descripcion: "Espíritus del bosque blancos de La Princesa Mononoke" },
  { nombre: "Ponyo", descripcion: "Niña-pez roja de la película Ponyo" },
  { nombre: "Robot jardinero", descripcion: "Robot guardián del Castillo en el Cielo" },
  { nombre: "Ohmu", descripcion: "Insectos gigantes de Nausicaä del Valle del Viento" }
];

export default function TextToImageGenerator() {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [creativity, setCreativity] = useState(0.4);
  const [isHighResolution, setIsHighResolution] = useState(true);
  const [realismLevel, setRealismLevel] = useState(0.8);
  const [selectedStyle, setSelectedStyle] = useState('none');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  
  // Estado para elementos Ghibli seleccionados
  const [selectedGhibliElements, setSelectedGhibliElements] = useState<string[]>([]);
  
  // Estado para las imágenes personales para transformaciones de estilo
  // Modificado para soportar múltiples imágenes
  const [sourceImages, setSourceImages] = useState<string[]>([]);
  const [transformMode, setTransformMode] = useState(false);
  const [styleTransformActive, setStyleTransformActive] = useState(false);
  
  // Para compatibilidad con código anterior, mantenemos también el estado sourceImage
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  
  // Estado para la imagen personal para el estilo Ghibli (mantenido por compatibilidad)
  const [ghibliSourceImage, setGhibliSourceImage] = useState<string | null>(null);
  const [ghibliTransformMode, setGhibliTransformMode] = useState(false);
  
  // Estados para los ajustes avanzados
  const [advancedSettings, setAdvancedSettings] = useState({
    estiloFotografico: 'digital',
    texturaPiel: 'media',
    iluminacion: 'natural',
    postProcesado: 'moderado',
    nivelDetalle: 0.7,
    saturacionColor: 0.5,
    profundidadSombras: 0.5,
    nitidezDetalles: 0.6,
    imagenReferencia: null as string | null
  });
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  };

  const handleCreativityChange = (value: number) => {
    setCreativity(value);
  };
  
  const handleRealismChange = (value: number) => {
    setRealismLevel(value);
  };

  const handleAdvancedSettingsChange = (newSettings: any) => {
    setAdvancedSettings({...advancedSettings, ...newSettings});
  };

  // Función para añadir un elemento de Ghibli al prompt actual
  const addGhibliElementToPrompt = (elemento: string) => {
    setPrompt((prevPrompt) => {
      const trimmedPrompt = prevPrompt.trim();
      return trimmedPrompt ? `${trimmedPrompt} con ${elemento}` : elemento;
    });
    
    toast(`¡${elemento} añadido!`, {
      icon: '✨',
      duration: 1500,
      style: {
        borderRadius: '10px',
        background: 'linear-gradient(to right, #4f46e5, #818cf8)',
        color: '#fff',
        fontWeight: '500',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      },
    });
    
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };
  
  // Función para manejar la selección de elementos Ghibli con checkboxes
  const handleGhibliElementToggle = (elemento: string) => {
    setSelectedGhibliElements(prev => {
      // Si ya está seleccionado, quitarlo de la lista
      if (prev.includes(elemento)) {
        // Movemos el toast fuera de la función de actualización de estado
        setTimeout(() => {
          toast(`${elemento} eliminado`, {
            icon: '❌',
            duration: 1500,
            style: {
              borderRadius: '10px',
              background: 'linear-gradient(to right, #4f46e5, #818cf8)',
              color: '#fff',
              fontWeight: '500',
            },
          });
        }, 0);
        return prev.filter(item => item !== elemento);
      } 
      // Si no está seleccionado, añadirlo a la lista
      else {
        // Movemos el toast fuera de la función de actualización de estado
        setTimeout(() => {
          toast(`¡${elemento} añadido!`, {
            icon: '✨',
            duration: 1500,
            style: {
              borderRadius: '10px',
              background: 'linear-gradient(to right, #4f46e5, #818cf8)',
              color: '#fff',
              fontWeight: '500',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            },
          });
        }, 0);
        return [...prev, elemento];
      }
    });
  };

  const handleGenerateImage = async () => {
    // Comprobar si tenemos todo lo necesario para generar
    if (!transformMode && !prompt.trim()) {
      toast.error('Por favor, escribe una descripción para generar la imagen');
      return;
    }

    if (transformMode && sourceImages.length === 0) {
      toast.error('Por favor, sube al menos una imagen para transformarla');
      return;
    }

    try {
      setGenerating(true);
      toast.loading('Generando imagen, por favor espera...', { id: 'generating' });

      // Preparar las opciones base
      const optionsBase = {
        temperature: creativity,
        highResolution: isHighResolution,
        realism: realismLevel,
        style: selectedStyle !== 'none' ? selectedStyle : undefined,
        seed: Math.floor(Math.random() * 100000), // Generar una semilla aleatoria en cada llamada
        topK: 32, // Valor por defecto para topK
        topP: 0.8, // Valor por defecto para topP
      };

      // Variable para almacenar opciones específicas de transformación
      let transformOptions = {};

      // Procesamiento especial para el estilo seleccionado
      let finalPrompt = prompt;
      const estiloActual = selectedStyle !== 'none' ? selectedStyle : 'none';
      
      // Ajustar parámetros según el estilo seleccionado
      switch (estiloActual) {
        case 'ghibli':
          // Mantener lógica existente para Ghibli
          optionsBase.temperature = 0.3;
          optionsBase.topK = 40;
          optionsBase.topP = 0.85;
          optionsBase.realism = 0.4;
          break;
        case 'anime':
          optionsBase.temperature = 0.25;
          optionsBase.topK = 30;
          optionsBase.topP = 0.7;
          optionsBase.realism = 0.25;
          break;
        case 'cartoon':
          optionsBase.temperature = 0.4;
          optionsBase.topK = 35;
          optionsBase.topP = 0.8;
          optionsBase.realism = 0.35;
          break;
        case 'watercolor':
          optionsBase.temperature = 0.3;
          optionsBase.topK = 42;
          optionsBase.topP = 0.75;
          optionsBase.realism = 0.5;
          break;
        case 'painting':
          optionsBase.temperature = 0.35;
          optionsBase.topK = 45;
          optionsBase.topP = 0.8;
          optionsBase.realism = 0.6;
          break;
        case 'digital-art':
          optionsBase.temperature = 0.4;
          optionsBase.topK = 50;
          optionsBase.topP = 0.85;
          optionsBase.realism = 0.7;
          break;
        case 'realistic':
          optionsBase.temperature = 0.25;
          optionsBase.topK = 30;
          optionsBase.topP = 0.7;
          optionsBase.realism = 0.9;
          break;
        case 'photo':
          optionsBase.temperature = 0.2;
          optionsBase.topK = 25;
          optionsBase.topP = 0.6;
          optionsBase.realism = 1.0;
          break;
        case 'cinematic':
          optionsBase.temperature = 0.3;
          optionsBase.topK = 40;
          optionsBase.topP = 0.8;
          optionsBase.realism = 0.8;
          break;
        default:
          // Mantener valores predeterminados para "none" o estilos no reconocidos
          break;
      }

      // Si estamos en modo transformación de imagen personal
      if (transformMode && sourceImages.length > 0) {
        try {
          // Comprobar si tenemos múltiples imágenes
          const hasMultipleImages = sourceImages.length > 1;
          
          // Usar nueva función para procesar múltiples imágenes si es el caso
          let processedImages;
          let additionalInstructions = "";
          
          if (hasMultipleImages) {
            // Procesar múltiples imágenes para extraer características comunes
            const { mainImage, secondaryImages, featuresMetadata } = 
              await processMultipleReferenceImages(sourceImages);
            
            // Preparar las imágenes para Gemini
            const mainImageForModel = await prepareImagesForGemini([mainImage]);
            const secondaryImagesForModel = await prepareImagesForGemini(secondaryImages);
            
            // Combinar en una sola lista, con la principal primero
            processedImages = [...mainImageForModel, ...secondaryImagesForModel];
            
            // Generar instrucciones específicas para múltiples imágenes
            additionalInstructions = generateMultiReferenceInstructions(sourceImages.length);
            
            console.log(`Procesando ${sourceImages.length} imágenes con extracción de características comunes`);
            
            // Notificar al usuario
            toast('Analizando características comunes de múltiples imágenes...', {
              duration: 2000,
              icon: '🔍',
              style: {
                borderRadius: '10px',
                background: 'linear-gradient(to right, #4f46e5, #818cf8)',
                color: '#fff',
              }
            });
          } else {
            // Caso de una sola imagen (comportamiento anterior)
            // Seleccionar la función de preprocesamiento adecuada según el estilo
            let preprocessedImage;
            if (estiloActual === 'anime') {
              // Usar el preprocesamiento específico para anime
              preprocessedImage = await prepareImageForAnimeTransform(sourceImages[0]);
              console.log("Aplicando preprocesamiento optimizado para anime");
            } else if (estiloActual === 'ghibli') {
              // Usar el preprocesamiento específico para Ghibli
              preprocessedImage = await prepareImageForGhibliTransform(sourceImages[0]);
              console.log("Aplicando preprocesamiento optimizado para Ghibli");
            } else {
              // Para otros estilos, usar el preprocesamiento de Ghibli por ahora
              // ya que funciona bien para resaltar al sujeto principal
              preprocessedImage = await prepareImageForGhibliTransform(sourceImages[0]);
            }
            
            // Convertir a formato compatible con Gemini
            processedImages = await prepareImagesForGemini([preprocessedImage]);
          }
          
          if (!processedImages || processedImages.length === 0) {
            throw new Error("No se pudo preparar la imagen para la transformación");
          }
          
          // Configuración base para cualquier transformación de imagen personal
          optionsBase.temperature = 0.15; // Temperatura baja para maximizar adherencia a la imagen original
          optionsBase.topK = 12; // Valor bajo para mayor consistencia y menos creatividad
          optionsBase.topP = 0.6; // Reducido para mejor preservación de elementos críticos
          
          // Para dar más variedad a transformaciones repetidas, ajustar ligeramente los parámetros
          // pero manteniéndolos restrictivos para preservar al personaje
          if (generatedImages.length > 0) {
            // Ligero incremento pero manteniendo restricciones para preservar identidad
            optionsBase.temperature = 0.22;
            optionsBase.seed = Math.floor(Math.random() * 100000); // Nueva semilla para variación
            optionsBase.topK = 18; // Mantener restrictivo para preservar identidad
          }
          
          // Ajustes específicos según el estilo seleccionado
          if (estiloActual === 'ghibli') {
            // Para Ghibli usamos valores más restrictivos para máxima preservación
            optionsBase.temperature = 0.12;
            optionsBase.topK = 8;
            optionsBase.topP = 0.5;
            
            if (generatedImages.length > 0) {
              optionsBase.temperature = 0.18;
              optionsBase.topK = 12;
            }
          } else if (['realistic', 'photo'].includes(estiloActual)) {
            // Para estilos fotorrealistas, valores muy restrictivos
            optionsBase.temperature = 0.10;
            optionsBase.topK = 6;
            optionsBase.topP = 0.4;
            
            if (generatedImages.length > 0) {
              optionsBase.temperature = 0.15;
              optionsBase.topK = 10;
            }
          } else if (estiloActual === 'anime') {
            // Parámetros específicos optimizados para transformación a anime
            optionsBase.temperature = 0.20;
            optionsBase.topK = 15;
            optionsBase.topP = 0.6;
            
            // Para transformaciones repetidas, mantener la restricción para consistencia
            if (generatedImages.length > 0) {
              optionsBase.temperature = 0.22;
              optionsBase.topK = 18;
            }
          }
          
          // Configurar las opciones de transformación con las imágenes procesadas
          if (hasMultipleImages) {
            // Para múltiples imágenes, usamos un enfoque diferente
            transformOptions = {
              imagenReferencia: processedImages[0], // La primera imagen es la principal
              imagenesAdicionales: processedImages.slice(1) // El resto son secundarias
            };
          } else {
            // Para una sola imagen, mantener el comportamiento anterior
            transformOptions = {
              imagenReferencia: processedImages[0],
              imagenesAdicionales: [processedImages[0], processedImages[0]] // Triplicar para reforzar
            };
          }
          
          // Instrucciones específicas para mantener elementos de la imagen original
          const estiloProcesadoNombre = ESTILOS_IMAGEN.find(e => e.id === estiloActual)?.nombre || estiloActual;
          
          // Base común para todos los prompts de transformación
          let basePrompt = `Transforma esta foto al estilo ${estiloProcesadoNombre}. 

INSTRUCCIONES CRÍTICAS Y ABSOLUTAMENTE OBLIGATORIAS (DEBEN SEGUIRSE AL PIE DE LA LETRA):
- ES IMPRESCINDIBLE MOSTRAR AL PERSONAJE PRINCIPAL DE LA FOTOGRAFÍA ORIGINAL
- BAJO NINGUNA CIRCUNSTANCIA generar una imagen sin el personaje principal de la foto
- El personaje debe ocupar EXACTAMENTE la misma posición, tamaño y orientación que en la foto original
- PROHIBIDO alterar, sustituir o eliminar al personaje principal
- Mantén con MÁXIMA PRECISIÓN todos los rasgos faciales, postura corporal, vestimenta y accesorios
- Preserva PERFECTAMENTE todos los detalles del rostro, expresión y características físicas distintivas
- La IDENTIDAD del personaje debe ser 100% reconocible y preservada en cada detalle
- Conserva la composición exacta y las proporciones del personaje respecto al fondo
- El personaje DEBE ser el elemento principal y focal de la imagen`;

          // Si estamos usando múltiples imágenes, añadir instrucciones específicas
          if (hasMultipleImages) {
            basePrompt += additionalInstructions;
          }

          // Incorporar el prompt del usuario si no está vacío
          if (prompt && prompt.trim() !== '') {
            basePrompt = `Transforma esta foto al estilo ${estiloProcesadoNombre} ${prompt.trim()}. 

INSTRUCCIONES CRÍTICAS Y ABSOLUTAMENTE OBLIGATORIAS (DEBEN SEGUIRSE AL PIE DE LA LETRA):
- ES IMPRESCINDIBLE MOSTRAR AL PERSONAJE PRINCIPAL DE LA FOTOGRAFÍA ORIGINAL
- BAJO NINGUNA CIRCUNSTANCIA generar una imagen sin el personaje principal de la foto
- El personaje debe ocupar EXACTAMENTE la misma posición, tamaño y orientación que en la foto original
- PROHIBIDO alterar, sustituir o eliminar al personaje principal
- Mantén con MÁXIMA PRECISIÓN todos los rasgos faciales, postura corporal, vestimenta y accesorios
- Preserva PERFECTAMENTE todos los detalles del rostro, expresión y características físicas distintivas
- La IDENTIDAD del personaje debe ser 100% reconocible y preservada en cada detalle
- Conserva la composición exacta y las proporciones del personaje respecto al fondo
- El personaje DEBE ser el elemento principal y focal de la imagen
- INTEGRA PERFECTAMENTE el contexto: "${prompt.trim()}" al fondo o escena, manteniendo al personaje como elemento principal`;
          }

          // Añadir instrucciones específicas según el estilo
          switch (estiloActual) {
            case 'ghibli':
              basePrompt += `
- Aplica ÚNICAMENTE el estilo visual de anime Studio Ghibli (colores, líneas, texturas)
- Mantén la misma escena y elementos principales, solo cambia el estilo visual

REQUISITOS TÉCNICOS OBLIGATORIOS:
- Usa líneas limpias típicas de Ghibli para delinear al personaje
- Aplica la paleta de colores característicos de Studio Ghibli (tonos pastel, contrastes suaves)
- Mantén los ojos con el estilo Ghibli pero CONSERVANDO la mirada y expresión original
- Conserva TODOS los detalles de cabello, ropa y accesorios del personaje
- Preserva meticulosamente la posición de brazos, piernas y postura corporal`;
              break;
            
            case 'anime':
              basePrompt += `
- Aplica ÚNICAMENTE el estilo visual de anime japonés auténtico (como en series populares)
- Mantén la misma escena y elementos principales, solo cambia el estilo visual
- El resultado debe ser indiscutiblemente reconocible como anime japonés

REQUISITOS TÉCNICOS OBLIGATORIOS PARA ESTILO ANIME:
- Ojos grandes y expresivos (25-30% del rostro) con brillos y reflejos característicos
- Nariz pequeña y simplificada, generalmente representada con líneas mínimas
- Boca pequeña pero expresiva que cambia de forma según la emoción
- Líneas de contorno limpias, definidas y uniformes de grosor consistente
- Cabello con mechones definidos y colores vibrantes con sombras por secciones
- Proporciones de anime: cabeza ligeramente más grande, ojos más separados, mentón afilado
- Sombras en bloques definidos sin degradados excesivos (cell shading)
- Colores planos y vibrantes con alto contraste y paleta limitada
- Simplificación de detalles complejos pero manteniendo elementos distintivos
- Expresiones exageradas típicas del anime (ojos muy abiertos, gotas de sudor, etc.)
- Si hay fondos, estos deben tener perspectiva y profundidad al estilo anime japonés
- CONSERVA EXACTAMENTE los rasgos faciales principales que permiten identificar al personaje
- El personaje debe ser INMEDIATAMENTE RECONOCIBLE como la misma persona de la foto original pero en estilo anime`;
              break;
            
            case 'cartoon':
              basePrompt += `
- Aplica ÚNICAMENTE el estilo visual de caricatura (líneas distintivas, colores planos)
- Mantén la misma escena y elementos principales, solo cambia el estilo visual

REQUISITOS TÉCNICOS OBLIGATORIOS:
- Usa líneas gruesas y distintivas típicas de caricatura para delinear al personaje
- Aplica colores planos y vibrantes con sombras simplificadas
- Exagera ligeramente las expresiones pero CONSERVANDO la misma emoción original
- Conserva TODOS los detalles de cabello, ropa y accesorios del personaje
- Simplifica detalles complejos pero mantén todas las características distintivas`;
              break;
            
            case 'watercolor':
              basePrompt += `
- Aplica ÚNICAMENTE el estilo visual de acuarela (bordes suaves, colores translúcidos)
- Mantén la misma escena y elementos principales, solo cambia el estilo visual

REQUISITOS TÉCNICOS OBLIGATORIOS:
- Usa técnica de acuarela con bordes suaves y difuminados
- Aplica colores translúcidos y aguados con mezclas sutiles
- Mantén la textura del papel visible en partes de la imagen
- Conserva TODOS los detalles de cabello, ropa y accesorios del personaje
- Asegúrate que el rostro mantenga todos los detalles distintivos con técnica de acuarela precisa`;
              break;
            
            case 'painting':
              basePrompt += `
- Aplica ÚNICAMENTE el estilo visual de pintura al óleo (textura, pinceladas visibles)
- Mantén la misma escena y elementos principales, solo cambia el estilo visual

REQUISITOS TÉCNICOS OBLIGATORIOS:
- Usa técnica de pintura al óleo con pinceladas visibles
- Aplica colores ricos y profundos con mezclas características de óleo
- Añade textura de lienzo y pinceladas con dirección y propósito
- Conserva TODOS los detalles de cabello, ropa y accesorios del personaje
- Asegúrate que el rostro mantenga todos los detalles distintivos con pinceladas precisas`;
              break;
            
            case 'digital-art':
              basePrompt += `
- Aplica ÚNICAMENTE el estilo visual de arte digital 3D (iluminación volumétrica, texturas 3D)
- Mantén la misma escena y elementos principales, solo cambia el estilo visual

REQUISITOS TÉCNICOS OBLIGATORIOS:
- Usa técnicas de renderizado 3D con iluminación tridimensional
- Aplica texturas detalladas y subsurface scattering para la piel
- Añade efectos de iluminación volumétrica y reflejos
- Conserva TODOS los detalles de cabello, ropa y accesorios del personaje
- Mantén la misma expresión facial con renderizado 3D de alta fidelidad`;
              break;
            
            case 'realistic':
              basePrompt += `
- Aplica ÚNICAMENTE el estilo visual realista (detalles fotográficos, iluminación natural)
- Mantén la misma escena y elementos principales, solo mejora el realismo

REQUISITOS TÉCNICOS OBLIGATORIOS:
- Usa técnicas fotorrealistas con atención meticulosa a detalles
- Aplica iluminación natural con sombras y reflejos precisos
- Añade texturas realistas para piel, cabello y ropa
- Conserva TODOS los detalles faciales, posturales y de vestimenta
- Mantén exactamente la misma expresión e identidad con calidad fotorrealista`;
              break;
            
            case 'photo':
              basePrompt += `
- Aplica ÚNICAMENTE estilo de fotografía profesional (nitidez, iluminación óptima)
- Mantén la misma escena y elementos principales, solo mejora la calidad fotográfica

REQUISITOS TÉCNICOS OBLIGATORIOS:
- Usa calidad fotográfica de alta resolución con nitidez excepcional
- Aplica iluminación profesional con ratio luz:sombra equilibrado
- Ajusta balance de color y exposición a niveles óptimos
- Conserva TODOS los detalles faciales, posturales y de vestimenta
- Mantén exactamente la misma expresión e identidad con calidad fotográfica premium`;
              break;
            
            case 'cinematic':
              basePrompt += `
- Aplica ÚNICAMENTE el estilo visual cinematográfico (composición dramática, iluminación de cine)
- Mantén la misma escena y elementos principales, solo añade calidad cinematográfica

REQUISITOS TÉCNICOS OBLIGATORIOS:
- Usa lenguaje visual cinematográfico con ratio de aspecto de cine
- Aplica iluminación dramática tipo Hollywood con contraste definido
- Añade tonalidad de color consistente como en películas profesionales
- Conserva TODOS los detalles faciales, posturales y de vestimenta
- Mantén exactamente la misma expresión e identidad con calidad de película`;
              break;
            
            default:
              // Estilo genérico para cualquier otra opción
              basePrompt += `
- Aplica ÚNICAMENTE el nuevo estilo visual manteniendo la fidelidad al personaje
- Mantén la misma escena y elementos principales, solo cambia el aspecto visual

REQUISITOS TÉCNICOS OBLIGATORIOS:
- Conserva TODOS los detalles faciales, posturales y de vestimenta
- Mantén exactamente la misma expresión e identidad sin alteraciones`;
              break;
          }

          // Sección común para todos los estilos
          basePrompt += `\n\nEXTREMADAMENTE IMPORTANTE (CRÍTICO):
- La persona/personaje de la foto DEBE ser el centro de atención en la imagen generada
- El estilo ${estiloProcesadoNombre} se aplica A LA PERSONA, no se reemplaza la persona con otros elementos
- Si la foto muestra un primer plano del rostro, MANTÉN el primer plano del mismo rostro
- El personaje debe ser INMEDIATAMENTE RECONOCIBLE como la misma persona de la foto original
- BAJO NINGÚN CONCEPTO omitir, reducir o sustituir al personaje de la foto original`;
  
          basePrompt += `\n\nREQUERIMIENTO FINAL DE MÁXIMA PRIORIDAD:
- EL PERSONAJE HUMANO DE LA FOTO ORIGINAL DEBE APARECER EN LA IMAGEN GENERADA
- La transformación consiste en aplicar SOLO el estilo visual ${estiloProcesadoNombre} al personaje y entorno
- MANTENER 100% al personaje como elemento central y protagónico`;
  
          finalPrompt = basePrompt;
          
          // Para el caso específico de Ghibli, añadir elementos seleccionados
          if (estiloActual === 'ghibli' && selectedGhibliElements.length > 0) {
            finalPrompt += `\n\nIncluye los siguientes elementos de Ghibli ÚNICAMENTE EN EL FONDO O ALREDEDOR del personaje principal (NUNCA como sustitutos del personaje): ${selectedGhibliElements.join(', ')}`;
          }
        } catch (error) {
          console.error("Error al preparar imagen:", error);
          toast.error("Error al procesar la imagen");
          setGenerating(false);
          return;
        }
      }
      // Si estamos en modo generación normal con Ghibli
      else if (selectedStyle === 'ghibli' && !transformMode) {
        // Añadir elementos Ghibli seleccionados al prompt final (no visible para el usuario)
        let elementosSeleccionados = '';
        if (selectedGhibliElements.length > 0) {
          elementosSeleccionados = ' con ' + selectedGhibliElements.join(' y ');
        }

        // Enriquecer el prompt con instrucciones específicas para el estilo Ghibli
        const ghibliPrompt = `Transforma en estilo de anime Studio Ghibli: ${prompt}${elementosSeleccionados}. 
Utiliza el estilo característico de las películas de Hayao Miyazaki con colores suaves pero vivos, 
líneas limpias, ojos expresivos más grandes, fondos detallados con aspecto acuarela, y elementos 
de la naturaleza como flores, plantas o paisajes. Mantén la esencia cálida y nostálgica de las 
películas de Studio Ghibli como "Mi vecino Totoro", "El viaje de Chihiro" o "La princesa Mononoke".`;
        
        finalPrompt = ghibliPrompt;
        
        // Mostrar toast indicando el estilo especial
        const elementosMsg = selectedGhibliElements.length > 0 
          ? ` con ${selectedGhibliElements.length} elemento(s) Ghibli` 
          : '';
          
        toast(`Aplicando estilo Studio Ghibli${elementosMsg}...`, {
          icon: '🎨',
          duration: 2000,
          style: {
            borderRadius: '10px',
            background: 'linear-gradient(to right, #4f46e5, #818cf8)',
            color: '#fff',
            fontWeight: '500',
          },
        });
      }
      // Si estamos en modo normal (no transformación) pero con un estilo específico
      else if (selectedStyle !== 'none' && !transformMode) {
        const estiloProcesadoNombre = ESTILOS_IMAGEN.find(e => e.id === selectedStyle)?.nombre || selectedStyle;
        
        // Ajustar el prompt según el estilo seleccionado
        finalPrompt = `Crea una imagen en estilo ${estiloProcesadoNombre} de: ${prompt}. 
Utiliza todas las características visuales propias del estilo ${estiloProcesadoNombre} 
y asegúrate de aplicarlas correctamente a todos los elementos de la imagen.`;
        
        // Mostrar toast indicando el estilo aplicado
        toast(`Aplicando estilo ${estiloProcesadoNombre}...`, {
          icon: '🎨',
          duration: 2000,
          style: {
            borderRadius: '10px',
            background: 'linear-gradient(to right, #4f46e5, #818cf8)',
            color: '#fff',
            fontWeight: '500',
          },
        });
      }

      // Opciones avanzadas (si están habilitadas)
      let advancedOpts = {};
      if (showAdvancedSettings) {
        const { imagenReferencia, ...otherSettings } = advancedSettings;
        
        advancedOpts = {
          ...otherSettings
        };
        
        // Convertir imagen de referencia si existe
        if (imagenReferencia) {
          try {
            toast('Preparando imagen de referencia...', { duration: 1000 });
            const compatibleRefImage = await prepareImagesForGemini([imagenReferencia]);
            if (compatibleRefImage.length > 0) {
              advancedOpts = { ...advancedOpts, imagenReferencia: compatibleRefImage[0] };
            }
          } catch (error) {
            console.error('Error al convertir imagen de referencia:', error);
            toast.error('Problema con el formato de la imagen de referencia');
          }
        }
      }

      // Combinar opciones base con avanzadas
      const options: any = {
        ...optionsBase,
        ...(showAdvancedSettings ? advancedOpts : {})
      };

      // Para el caso de transformación, añadir las opciones específicas
      if (transformMode && sourceImages.length > 0) {
        Object.assign(options, transformOptions);
      }

      const generatedImageData = await generateImageFromText(finalPrompt, options);
      setGeneratedImages(prev => [generatedImageData, ...prev]);
      
      // Obtener el nombre del estilo para mostrar en mensajes
      const estiloProcesadoNombre = ESTILOS_IMAGEN.find(e => e.id === selectedStyle)?.nombre || selectedStyle;
      
      if (transformMode && sourceImages.length > 0) {
        // Contabilizar cuántas transformaciones se han realizado con esta imagen
        const nuevaTransformacion = generatedImages.length === 0;
        const multipleImages = sourceImages.length > 1;
        
        toast.success(nuevaTransformacion 
          ? `¡${multipleImages ? 'Tus imágenes han' : 'Tu imagen ha'} sido transformada${multipleImages ? 's' : ''} al estilo ${estiloProcesadoNombre} con preservación avanzada del personaje!${multipleImages ? ' Se usaron características comunes de todas las imágenes.' : ''}` 
          : `¡Nueva variación en estilo ${estiloProcesadoNombre} generada con preservación del personaje!${multipleImages ? ' Usando características comunes de todas las imágenes.' : ''}`, 
        { 
          id: 'generating',
          icon: nuevaTransformacion ? '✨' : '🔄',
          style: {
            borderRadius: '12px',
            background: 'linear-gradient(to right, #4f46e5, #818cf8)',
            color: '#fff',
            fontWeight: '500',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          },
          duration: 5000
        });
      } else if (selectedStyle !== 'none') {
        toast.success(`¡Imagen en estilo ${estiloProcesadoNombre} generada con éxito!`, { 
          id: 'generating',
          icon: '🏞️',
          style: {
            borderRadius: '12px',
            background: 'linear-gradient(to right, #4f46e5, #818cf8)',
            color: '#fff',
            fontWeight: '500',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          },
          duration: 3000
        });
      } else {
        toast.success('¡Imagen generada con éxito!', { id: 'generating' });
      }
    } catch (error) {
      console.error('Error al generar la imagen:', error);
      toast.error(`Error al generar la imagen: ${error instanceof Error ? error.message : 'Intenta con otro formato de imagen'}`, { id: 'generating' });
    } finally {
      setGenerating(false);
    }
  };

  const handleClearHistory = () => {
    setGeneratedImages([]);
    toast.success('Historial de imágenes limpiado');
  };

  const handleDownloadImage = (imageUrl: string, index: number) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `imagen-generada-${Date.now()}-${index}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Imagen descargada');
  };

  // Función para manejar el cambio de estilo
  const handleStyleChange = (style: string) => {
    const oldStyle = selectedStyle;
    
    // Si estamos cambiando de/a Ghibli, limpiar los elementos seleccionados
    if (oldStyle === 'ghibli' || style === 'ghibli') {
      // Usamos setTimeout para asegurarnos de que esta actualización de estado
      // no ocurra durante el renderizado
      setTimeout(() => {
        setSelectedGhibliElements([]);
      }, 0);
    }
    
    // Actualizar el estilo seleccionado
    setSelectedStyle(style);
    
    // Si tenemos una imagen de origen cargada y cambiamos de estilo
    if (sourceImage) {
      // Si el nuevo estilo es Ghibli, sincronizar con los estados específicos de Ghibli
      if (style === 'ghibli') {
        setGhibliSourceImage(sourceImage);
        setGhibliTransformMode(transformMode);
      }
      
      // Si cambiamos a "ninguno", desactivar la transformación
      if (style === 'none') {
        setStyleTransformActive(false);
      } else {
        // Para cualquier otro estilo, asegurarse de que la transformación está activa
        setStyleTransformActive(true);
      }
      
      // Notificar al usuario sobre el cambio de estilo para su imagen
      if (style !== 'none') {
        const estiloNombre = ESTILOS_IMAGEN.find(e => e.id === style)?.nombre || style;
        
        setTimeout(() => {
          toast(`Imagen lista para transformar al estilo ${estiloNombre}`, {
            icon: '🔄',
            duration: 2000,
            style: {
              borderRadius: '10px',
              background: 'linear-gradient(to right, #4f46e5, #818cf8)',
              color: '#fff',
            }
          });
        }, 100);
      } else {
        // Si se selecciona "Ninguno", avisar que se desactiva la transformación
        setTimeout(() => {
          toast('Se ha desactivado el modo de transformación', { 
            icon: '⚠️',
            duration: 2000
          });
        }, 100);
      }
    }
  };

  // Función para limpiar la imagen de origen para el estilo Ghibli
  const clearGhibliSourceImage = () => {
    setGhibliSourceImage(null);
    setGhibliTransformMode(false);
    
    // También limpiar los estados generales para mantener consistencia
    setSourceImage(null);
    setSourceImages([]);
    setTransformMode(false);
    setStyleTransformActive(false);
  };

  // Función para limpiar la imagen de origen para cualquier transformación de estilo
  const clearSourceImage = () => {
    setSourceImage(null);
    setSourceImages([]);
    setTransformMode(false);
    setStyleTransformActive(false);
  };

  // Función auxiliar para procesar una sola imagen
  const processSingleImage = (file: File) => {
    // Verificar tipo y tamaño
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecciona un archivo de imagen válido');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen es demasiado grande. Máximo 5MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const imageData = event.target.result.toString();
        console.log("Imagen cargada con éxito");
        
        // Comprobar si ya hay imágenes cargadas
        const currentImages = [...sourceImages];
        
        // Si ya tenemos 6 imágenes, mostramos un error
        if (currentImages.length >= 6) {
          toast.error('Ya has alcanzado el límite máximo de 6 imágenes. Elimina alguna antes de añadir más.');
          return;
        }
        
        // Añadir la nueva imagen al array existente
        const updatedImages = [...currentImages, imageData];
        
        // Actualizar los estados
        setSourceImages(updatedImages);
        setSourceImage(updatedImages[0]); // La primera imagen sigue siendo la principal
        setTransformMode(true);
        setStyleTransformActive(true);
        
        // Si el estilo seleccionado es Ghibli, actualizar también los estados específicos de Ghibli
        // para mantener compatibilidad con el código existente
        if (selectedStyle === 'ghibli') {
          setGhibliSourceImage(updatedImages[0]);
          setGhibliTransformMode(true);
        }
        
        const estiloActual = ESTILOS_IMAGEN.find(e => e.id === selectedStyle)?.nombre || 'personalizado';
        const imageCount = updatedImages.length;
        
        if (imageCount === 1) {
          toast.success(`¡Imagen cargada! Ahora puedes transformarla al estilo ${estiloActual} o añadir hasta 2 imágenes más.`, {
            duration: 4000,
            icon: '🖼️',
            style: {
              borderRadius: '10px',
              background: 'linear-gradient(to right, #4f46e5, #818cf8)',
              color: '#fff',
            }
          });
        } else {
          const remaining = 6 - imageCount;
          const remainingText = remaining > 0 
            ? `Puedes añadir ${remaining} imagen${remaining > 1 ? 'es' : ''} más.` 
            : 'Has alcanzado el límite de imágenes.';
          
          toast.success(`¡${imageCount} imágenes cargadas! La primera imagen se usará como referencia principal. ${remainingText}`, {
            duration: 4000,
            icon: '🖼️',
            style: {
              borderRadius: '10px',
              background: 'linear-gradient(to right, #4f46e5, #818cf8)',
              color: '#fff',
            }
          });
        }
      } else {
        console.error("Error: El resultado de la lectura del archivo es null");
      }
    };
    reader.onerror = (error: ProgressEvent<FileReader>) => {
      console.error("Error al leer el archivo:", error);
      toast.error("Error al leer el archivo seleccionado");
    };
    reader.readAsDataURL(file);
  };

  // Función para manejar la carga de imágenes para cualquier transformación de estilo
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Log detallado para diagnóstico del problema
    console.log("=== DIAGNÓSTICO DE CARGA DE IMÁGENES ===");
    console.log("Tipo de evento:", e.type);
    console.log("Navegador:", navigator.userAgent);
    console.log("Files API disponible:", !!window.File && !!window.FileReader && !!window.FileList);
    console.log("Target:", e.target);
    console.log("Files:", e.target.files);
    
    try {
      const files = e.target.files;
      if (!files || files.length === 0) {
        console.log("No se seleccionaron archivos");
        return;
      }
      
      // Convertir FileList a Array para manipulación más fácil
      const filesArray = Array.from(files);
      console.log(`Seleccionados ${filesArray.length} archivo(s)`);
      
      // Verificar si hay múltiples archivos
      if (filesArray.length > 1) {
        console.log(`Detectados ${filesArray.length} archivos múltiples, procesando...`);
        // Usar FileList directamente para evitar problemas de conversión
        handleMultipleImagesUpload(files);
      } else {
        console.log(`Procesando un solo archivo: ${filesArray[0].name}`);
        // Procesar un solo archivo
        processSingleImage(filesArray[0]);
      }
    } catch (error) {
      console.error("Error en handleImageUpload:", error);
      toast.error("Error al procesar la selección de archivos. Por favor, intenta de nuevo.");
    }
  };
  
  // Nueva función para manejar múltiples imágenes
  const handleMultipleImagesUpload = (files: FileList) => {
    // Verificar número máximo de imágenes
    const maxImages = 6;
    let validFiles = [];
    
    // Si se seleccionaron más de maxImages, mostrar advertencia
    if (files.length > maxImages) {
      toast.error(`Se han seleccionado ${files.length} imágenes. Solo se procesarán las primeras ${maxImages}.`, {
        duration: 4000,
        icon: '⚠️',
        style: {
          background: '#FFF3CD',
          color: '#856404',
          borderRadius: '10px',
        }
      });
    }
    
    const numImagesToProcess = Math.min(files.length, maxImages);
    console.log(`Procesando ${numImagesToProcess} imágenes de ${files.length} seleccionadas`);
    
    // Array para almacenar promesas de lectura de archivos
    const fileReadPromises: Promise<string>[] = [];
    
    // Mostrar toast informativo
    toast.loading(`Procesando ${numImagesToProcess} imágenes...`, { id: 'processing-images' });
    
    // Comprobar que hay al menos una imagen válida
    let hasValidImages = false;
    
    // Procesar cada archivo
    for (let i = 0; i < numImagesToProcess; i++) {
      const file = files[i];
      
      // Verificar tipo y tamaño
      if (!file.type.startsWith('image/')) {
        toast.error(`La imagen #${i+1} no es un formato válido`, { duration: 3000 });
        continue;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`La imagen #${i+1} es demasiado grande. Máximo 5MB`, { duration: 3000 });
        continue;
      }
      
      hasValidImages = true;
      console.log(`Iniciando proceso de lectura de imagen ${i+1}: ${file.name} (${file.type}, ${Math.round(file.size/1024)} KB)`);
      
      // Crear promesa para leer el archivo
      const filePromise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (event) => {
          if (event.target?.result) {
            console.log(`Imagen ${i+1} leída con éxito`);
            resolve(event.target.result.toString());
          } else {
            console.error(`Error al leer la imagen #${i+1}: resultado vacío`);
            reject(new Error(`Error al leer la imagen #${i+1}`));
          }
        };
        
        reader.onerror = (error: ProgressEvent<FileReader>) => {
          console.error(`Error al procesar la imagen #${i+1}:`, error);
          reject(new Error(`Error al procesar la imagen #${i+1}`));
        };
        
        reader.readAsDataURL(file);
      });
      
      fileReadPromises.push(filePromise);
    }
    
    // Si no hay imágenes válidas, mostrar error y salir
    if (!hasValidImages) {
      toast.error('No se han encontrado imágenes válidas para procesar', { id: 'processing-images' });
      return;
    }
    
    // Procesar todas las promesas
    Promise.all(fileReadPromises)
      .then(imageDataArray => {
        if (imageDataArray.length === 0) {
          console.error('No se pudieron procesar las imágenes');
          toast.error('No se pudieron procesar las imágenes', { id: 'processing-images' });
          return;
        }
        
        console.log(`Procesadas con éxito ${imageDataArray.length} imágenes`);
        
        // Actualizar estados
        setSourceImages(imageDataArray);
        setSourceImage(imageDataArray[0]); // Para compatibilidad
        setTransformMode(true);
        setStyleTransformActive(true);
        
        // Actualizar estados de Ghibli para compatibilidad
        if (selectedStyle === 'ghibli') {
          setGhibliSourceImage(imageDataArray[0]);
          setGhibliTransformMode(true);
        }
        
        const estiloActual = ESTILOS_IMAGEN.find(e => e.id === selectedStyle)?.nombre || 'personalizado';
        
        if (imageDataArray.length === 1) {
          toast.success(`¡Imagen cargada con éxito! Lista para transformar al estilo ${estiloActual}.`, {
            id: 'processing-images',
            duration: 4000,
            icon: '🖼️',
            style: {
              borderRadius: '10px',
              background: 'linear-gradient(to right, #4f46e5, #818cf8)',
              color: '#fff',
            }
          });
        } else {
          toast.success(`¡${imageDataArray.length} imágenes cargadas! La primera imagen se usará como referencia principal para la transformación al estilo ${estiloActual}.`, {
            id: 'processing-images',
            duration: 5000,
            icon: '🖼️',
            style: {
              borderRadius: '10px',
              background: 'linear-gradient(to right, #4f46e5, #818cf8)',
              color: '#fff',
            }
          });
        }
      })
      .catch(error => {
        console.error('Error al procesar imágenes:', error);
        toast.error('Error al procesar las imágenes: ' + error.message, { id: 'processing-images' });
      });
  };

  // Función para modificar handleGhibliImageUpload para permitir carga secuencial
  const handleGhibliImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      console.log("No se seleccionaron archivos para Ghibli");
      return;
    }
    
    console.log(`Seleccionados ${files.length} archivo(s) para transformación Ghibli`);
    
    // Si hay múltiples archivos, usar la nueva función
    if (files.length > 1) {
      console.log(`Detectados múltiples archivos (${files.length}) para Ghibli, estableciendo estilo y redirigiendo`);
      // Establecer el estilo a Ghibli primero
      setSelectedStyle('ghibli');
      
      // Luego procesar las imágenes
      setTimeout(() => {
        handleMultipleImagesUpload(files);
      }, 100); // Pequeño retraso para asegurar que el cambio de estilo se aplique primero
      return;
    }
    
    const file = files[0];
    console.log(`Procesando un solo archivo para Ghibli: ${file.name}`);
    
    // Verificar tipo y tamaño
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecciona un archivo de imagen válido');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen es demasiado grande. Máximo 5MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const imageData = event.target.result.toString();
        console.log("Imagen para Ghibli cargada con éxito");
        
        // Comprobar si ya hay imágenes cargadas
        const currentImages = [...sourceImages];
        
        // Si ya tenemos 6 imágenes, mostramos un error
        if (currentImages.length >= 6) {
          toast.error('Ya has alcanzado el límite máximo de 6 imágenes. Elimina alguna antes de añadir más.');
          return;
        }
        
        // Añadir la nueva imagen al array existente
        const updatedImages = [...currentImages, imageData];
        
        setGhibliSourceImage(updatedImages[0]); // La primera imagen es la principal para Ghibli
        setGhibliTransformMode(true);
        
        // También actualizar los estados generales de transformación
        setSourceImage(updatedImages[0]);
        setSourceImages(updatedImages);
        setTransformMode(true);
        setStyleTransformActive(true);
        
        // Establecer el estilo a Ghibli
        setSelectedStyle('ghibli');
        
        const imageCount = updatedImages.length;
        
        if (imageCount === 1) {
          toast.success('¡Imagen cargada! Ahora puedes transformarla al estilo Studio Ghibli o añadir hasta 2 imágenes más.', {
            duration: 4000,
            icon: '🖼️',
            style: {
              borderRadius: '10px',
              background: 'linear-gradient(to right, #4f46e5, #818cf8)',
              color: '#fff',
            }
          });
        } else {
          const remaining = 6 - imageCount;
          const remainingText = remaining > 0 
            ? `Puedes añadir ${remaining} imagen${remaining > 1 ? 'es' : ''} más.` 
            : 'Has alcanzado el límite de imágenes.';
          
          toast.success(`¡${imageCount} imágenes cargadas! La primera imagen se usará como referencia principal. ${remainingText}`, {
            duration: 4000,
            icon: '🖼️',
            style: {
              borderRadius: '10px',
              background: 'linear-gradient(to right, #4f46e5, #818cf8)',
              color: '#fff',
            }
          });
        }
      } else {
        console.error("Error: El resultado de la lectura del archivo Ghibli es null");
      }
    };
    reader.onerror = (error: ProgressEvent<FileReader>) => {
      console.error("Error al leer el archivo para Ghibli:", error);
      toast.error("Error al leer el archivo seleccionado para transformación Ghibli");
    };
    reader.readAsDataURL(file);
  };

  // Función para eliminar una imagen específica
  const handleRemoveImage = (index: number) => {
    // Crear una copia del array de imágenes
    const newImages = [...sourceImages];
    // Eliminar la imagen en el índice especificado
    newImages.splice(index, 1);
    
    if (newImages.length === 0) {
      // Si no quedan imágenes, limpiamos todo
      clearSourceImage();
      toast.success('Todas las imágenes han sido eliminadas');
    } else {
      // Actualizamos los arrays con las imágenes restantes
      setSourceImages(newImages);
      setSourceImage(newImages[0]); // La primera imagen sigue siendo la principal
      
      // Si el estilo seleccionado es Ghibli, actualizar también
      if (selectedStyle === 'ghibli') {
        setGhibliSourceImage(newImages[0]);
      }
      
      toast.success('Imagen eliminada correctamente');
    }
  };

  return (
    <div className="relative">
      <Toaster position="top-right" />
      
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
          Generador de Imágenes con IA
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Escribe una descripción detallada de la imagen que deseas crear y la inteligencia artificial la generará para ti.
        </p>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Descripción detallada
          </label>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={handlePromptChange}
            className="w-full px-3 py-2 text-gray-700 dark:text-white bg-white dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
            rows={4}
            placeholder="Ej: crea una casa moderna con piscina un un jardín enorme"
          />
        </div>
        
        {/* Control de carga y transformación de imágenes */}
        <div className="mt-4 flex flex-wrap gap-2">
          {transformMode ? (
            <>
              <button
                onClick={handleGenerateImage}
                disabled={generating || (!transformMode && !prompt.trim())}
                className={`flex items-center justify-center px-4 py-2 text-white ${
                  transformMode && sourceImages.length > 0
                    ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-600'
                    : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-600'
                } rounded-md focus:outline-none focus:ring-2 ${
                  (generating || (!transformMode && !prompt.trim())) && 'opacity-50 cursor-not-allowed'
                }`}
              >
                {generating ? (
                  <>
                    <FiLoader className="mr-2 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <FaImage className="mr-2" />
                    {sourceImages.length > 1 
                      ? `Transformar ${sourceImages.length} Imágenes`
                      : "Transformar Imagen"}
                  </>
                )}
              </button>
              
              {/* Botón para añadir más imágenes - siempre visible si hay menos de 6 */}
              {sourceImages.length < 6 && (
                <div className="relative">
                  <label
                    htmlFor="image-upload"
                    className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md transition-colors duration-200 flex items-center gap-2"
                  >
                    <FiPlusCircle />
                    Añadir más imágenes ({sourceImages.length}/6)
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
              
              <button
                onClick={clearSourceImage}
                className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-md transition-colors duration-200 flex items-center gap-2"
              >
                <FiX />
                Eliminar todas
              </button>
            </>
          ) : (
            <div className="relative">
              <label
                htmlFor="image-upload"
                className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md transition-colors duration-200 flex items-center gap-2"
              >
                <FiImage />
                Sube hasta 6 imágenes
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>
        
        {/* Controles de calidad y estilo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Creatividad: {creativity.toFixed(1)}
                </label>
                <div className="text-xs text-gray-500 flex items-center">
                  <span className="mr-8">Más precisión</span>
                  <span>Más creatividad</span>
                </div>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.1}
                value={creativity}
                onChange={handleCreativityChange}
              />
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Realismo: {realismLevel.toFixed(1)}
                </label>
                <div className="text-xs text-gray-500 flex items-center">
                  <span className="mr-8">Estilizado</span>
                  <span>Fotorrealista</span>
                </div>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.1}
                value={realismLevel}
                onChange={handleRealismChange}
              />
            </div>
          </div>
          
          <div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Estilo de imagen
              </label>
              <div className="grid grid-cols-3 gap-2">
                {ESTILOS_IMAGEN.map((estilo) => (
                  <button
                    key={estilo.id}
                    onClick={() => handleStyleChange(estilo.id)}
                    className={`px-3 py-2 rounded-md text-sm font-medium relative ${
                      selectedStyle === estilo.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {estilo.nombre}
                    {estilo.id === 'ghibli' && selectedGhibliElements.length > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 bg-indigo-500 rounded-full flex items-center justify-center text-[10px] text-white">
                        {selectedGhibliElements.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Sección para transformar imagen personal con cualquier estilo */}
            {selectedStyle !== 'none' && (
              <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-md border border-blue-100 dark:border-indigo-800/30 shadow-sm">
                <div className="flex items-center mb-2">
                  <span className="text-xl mr-2">🖼️</span>
                  <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                    Modo Transformación Personal
                  </h3>
                </div>
                
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
                  {selectedStyle === 'ghibli' 
                    ? "Transforma tus imágenes al estilo mágico de las películas de Hayao Miyazaki."
                    : `Transforma tus fotos personales al estilo ${ESTILOS_IMAGEN.find(e => e.id === selectedStyle)?.nombre}.`
                  }
                  <span className="inline-block mt-1 text-indigo-600 dark:text-indigo-400">
                    <span className="font-medium">Tip:</span> {selectedStyle === 'ghibli' 
                      ? "Incluye elementos naturales para mejores resultados." 
                      : "Usa imágenes claras con buena iluminación."}
                  </span>
                </p>
                
                <p className="text-xs text-indigo-500 dark:text-indigo-400 mb-3 bg-indigo-50 dark:bg-indigo-900/30 p-2 rounded border border-indigo-100 dark:border-indigo-800/30">
                  <span className="font-medium">✨ Nuevo:</span> Puedes subir <span className="underline font-bold">hasta 6 imágenes a la vez</span>. La primera imagen será la referencia principal, y las demás servirán para extraer características comunes del personaje. Con más imágenes (4-6) obtienes mayor precisión en el reconocimiento de rasgos distintivos y perspectivas en 3D.
                </p>
                
                {/* Opción para transformar una imagen existente */}
                <div className="mb-3 p-2 bg-indigo-100/50 dark:bg-indigo-900/20 rounded border border-indigo-200 dark:border-indigo-800/30">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                      Transforma tu foto personal al estilo {ESTILOS_IMAGEN.find(e => e.id === selectedStyle)?.nombre}
                    </p>
                    
                    <div className="flex items-center">
                      <div className="relative">
                        <input 
                          type="file"
                          id="imageUpload"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          multiple={true}
                          style={{fontSize: '0'}} // Para resolver problemas de compatibilidad
                        />
                        <button 
                          type="button"
                          onClick={() => document.getElementById('imageUpload')?.click()}
                          className="flex items-center text-xs px-3 py-1.5 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          {sourceImages.length === 0 
                            ? "Subir hasta 6 imágenes" 
                            : sourceImages.length < 6 
                              ? `Añadir más imágenes (${sourceImages.length}/6)` 
                              : "Límite de imágenes alcanzado"}
                        </button>
                      </div>
                      
                      {sourceImages.length > 0 && (
                        <button
                          onClick={clearSourceImage}
                          className="ml-2 text-xs px-2 py-1 bg-red-500/90 text-white rounded-md hover:bg-red-600 transition-colors"
                        >
                          Eliminar todas
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Mostrar imágenes cargadas si hay alguna */}
                  {sourceImages.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {sourceImages.map((img, index) => (
                        <div 
                          key={index} 
                          className={`relative rounded-md overflow-hidden border-2 ${
                            index === 0 
                              ? 'border-indigo-500 shadow-md' 
                              : 'border-indigo-200'
                          }`}
                          style={{ width: '100px', height: '100px' }}
                        >
                          <img 
                            src={img} 
                            alt={`Imagen ${index + 1}`} 
                            className="w-full h-full object-cover"
                          />
                          {index === 0 && (
                            <div className="absolute top-0 left-0 bg-indigo-500 text-white text-xs px-1 py-0.5">
                              Principal
                            </div>
                          )}
                          {index > 0 && (
                            <div className="absolute top-0 left-0 bg-gray-500 text-white text-xs px-1 py-0.5">
                              Ref. {index}
                            </div>
                          )}
                          <button
                            onClick={() => handleRemoveImage(index)}
                            className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600 p-0 text-xs"
                            aria-label={`Eliminar imagen ${index + 1}`}
                          >
                            <FiX size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Elementos específicos para estilo Ghibli */}
                {selectedStyle === 'ghibli' && (
                  <div className="space-y-2 text-xs">
                    <details className="group">
                      <summary className="flex cursor-pointer items-center text-indigo-700 dark:text-indigo-300 font-medium">
                        <svg className="h-4 w-4 mr-1 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        Sugerencias de prompts
                      </summary>
                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        {SUGERENCIAS_GHIBLI.map((sugerencia, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setPrompt(sugerencia);
                              // No llamamos a toast directamente aquí para evitar otro potencial error
                            }}
                            className="px-2 py-1.5 bg-indigo-100 dark:bg-indigo-800/40 rounded text-indigo-800 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-700/50 transition-colors text-left truncate"
                          >
                            {sugerencia}
                          </button>
                        ))}
                      </div>
                    </details>
                    
                    <details className="group">
                      <summary className="flex cursor-pointer items-center text-indigo-700 dark:text-indigo-300 font-medium">
                        <svg className="h-4 w-4 mr-1 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        Elementos icónicos de Ghibli
                      </summary>
                      <div className="mt-2">
                        <div className="bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-700 rounded p-2 max-h-40 overflow-y-auto">
                          {ELEMENTOS_GHIBLI.map((elemento, index) => (
                            <div key={index} className="flex items-start py-1 border-b border-indigo-100 dark:border-indigo-800 last:border-0">
                              <input
                                type="checkbox"
                                id={`ghibli-${index}`}
                                checked={selectedGhibliElements.includes(elemento.nombre)}
                                onChange={() => handleGhibliElementToggle(elemento.nombre)}
                                className="mt-0.5 h-4 w-4 text-indigo-600 border-indigo-300 rounded"
                              />
                              <label
                                htmlFor={`ghibli-${index}`}
                                className={`ml-2 text-xs cursor-pointer transition-all duration-200 ${
                                  selectedGhibliElements.includes(elemento.nombre)
                                    ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                <span className={`font-medium ${
                                  selectedGhibliElements.includes(elemento.nombre) 
                                    ? 'text-indigo-700 dark:text-indigo-300'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}>{elemento.nombre}</span>
                                <span className="text-gray-500 dark:text-gray-400 ml-1">- {elemento.descripcion}</span>
                              </label>
                            </div>
                          ))}
                        </div>
                        {selectedGhibliElements.length > 0 && (
                          <div className="mt-2 flex justify-between items-center">
                            <p className="text-xs text-indigo-600 dark:text-indigo-400">
                              {selectedGhibliElements.length} elemento(s) seleccionado(s)
                            </p>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                setSelectedGhibliElements([]);
                                setTimeout(() => {
                                  toast('Selección limpiada', { 
                                    icon: '🧹',
                                    duration: 1500,
                                    style: {
                                      borderRadius: '10px',
                                      background: 'linear-gradient(to right, #4f46e5, #818cf8)',
                                      color: '#fff',
                                    }
                                  });
                                }, 0);
                              }}
                              className="text-xs py-1 px-2 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-800/50 rounded"
                            >
                              Limpiar selección
                            </button>
                          </div>
                        )}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="highResolution"
                checked={isHighResolution}
                onChange={(e) => setIsHighResolution(e.target.checked)}
                className="mr-2 h-4 w-4 text-purple-600 focus:ring-purple-600 border-gray-300 rounded"
              />
              <label htmlFor="highResolution" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Alta resolución (FHD 1920x1080)
              </label>
            </div>
          </div>
        </div>
        
        {/* Botón de ajustes avanzados */}
        <div className="mb-6">
          <button
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            <FaCog className="text-gray-600 dark:text-gray-300" />
            Ajustes Avanzados
            {showAdvancedSettings ? <FaChevronUp /> : <FaChevronDown />}
          </button>
        </div>
        
        {/* Panel de ajustes avanzados */}
        {showAdvancedSettings && (
          <div className="mb-6 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-4">
              Ajustes Avanzados
            </h3>
            
            <AdvancedSettings 
              values={advancedSettings}
              onChange={handleAdvancedSettingsChange}
            />
          </div>
        )}
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleGenerateImage}
            disabled={generating || (!transformMode && !prompt.trim())}
            className={`flex items-center justify-center px-4 py-2 text-white ${
              transformMode && sourceImages.length > 0
                ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-600'
                : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-600'
            } rounded-md focus:outline-none focus:ring-2 ${
              (generating || (!transformMode && !prompt.trim())) && 'opacity-50 cursor-not-allowed'
            }`}
          >
            {transformMode && sourceImages.length > 0 ? (
              <>
                <FaImage className="mr-2" />
                {sourceImages.length > 1 
                  ? `Transformar ${sourceImages.length} Imágenes`
                  : "Transformar Imagen"}
              </>
            ) : (
              <>
                <FaImage className="mr-2" />
                Generar Imagen
              </>
            )}
          </button>
          
          <button
            onClick={handleClearHistory}
            disabled={generating || generatedImages.length === 0}
            className={`flex items-center justify-center px-4 py-2 text-white bg-gray-600 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600 ${
              (generating || generatedImages.length === 0) && 'opacity-50 cursor-not-allowed'
            }`}
          >
            <FaBroom className="mr-2" />
            Limpiar Historial
          </button>
        </div>
      </div>
      
      {generatedImages.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
            Imágenes Generadas ({generatedImages.length})
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {generatedImages.map((imageUrl, index) => (
              <div key={index} className="relative">
                <div className="group relative rounded-lg overflow-hidden shadow-md border border-gray-200 dark:border-gray-700">
                  <div className="relative aspect-w-16 aspect-h-9">
                    <ImageDisplay src={imageUrl} alt={`Imagen generada ${index + 1}`} />
                  </div>
                  
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDownloadImage(imageUrl, index)}
                      className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
                      aria-label="Descargar imagen"
                    >
                      <FaDownload className="text-purple-600" />
                    </button>
                  </div>
                  
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
                    <p className="text-white text-sm truncate">
                      #{index + 1} - {new Date().toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 