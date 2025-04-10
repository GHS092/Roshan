'use client';

import React, { useState, useRef, useEffect } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { FaImage, FaPaperPlane, FaUpload, FaTrash, FaDownload, FaMagic, FaRocket, FaRedo, FaEdit, FaCheck, FaObjectGroup } from 'react-icons/fa';
import { RiLoaderLine, RiMagicLine, RiChatSmile2Line, RiImageEditLine, RiRefreshLine, RiSendPlaneFill, RiDeleteBin6Line, RiEditBoxLine } from 'react-icons/ri';
import { BsCamera, BsImageAlt, BsPalette, BsBox } from 'react-icons/bs';
import { realTimeChatWithImage } from '../lib/gemini';
import ImageDisplay from './ImageDisplay';
import { analyzeImage, generateCreativePrompt, generateCompositionPrompt, CategorizedImages, ImageCategory } from '../lib/imageAnalyzer';

type MessageType = {
  id: string;
  role: 'user' | 'model';
  text?: string;
  imageUrl?: string;
  timestamp: Date;
  isEditing?: boolean;
};

type ChatHistoryType = Array<{
  role: string;
  parts: Array<{
    text?: string;
    inlineData?: { mimeType: string; data: string };
  }>;
}>;

// Sugerencias preestablecidas para ayudar al usuario
const SUGERENCIAS = [
  "Coloca un sombrero azul en esta persona",
  "Cambia el fondo a un paisaje montañoso",
  "Añade un cielo con estrellas",
  "Convierte esta imagen a estilo acuarela",
  "Transforma esta foto en estilo anime",
  "Añade un perro husky junto a la persona"
];

// Constante para definir el límite máximo de mensajes en el historial
const MAX_CHAT_HISTORY_LENGTH = 10; // Ajustable según necesidades

export default function RealTimeChat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatHistoryType>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  
  // Nuevos estados para el modo Whisk
  const [whiskMode, setWhiskMode] = useState<boolean>(false);
  const [compositionMode, setCompositionMode] = useState<boolean>(false);
  const [categorizedImages, setCategorizedImages] = useState<CategorizedImages>({});
  const [analyzing, setAnalyzing] = useState<ImageCategory | null>(null);
  const [showWhiskHelp, setShowWhiskHelp] = useState<boolean>(false);
  const [showCompositionHelp, setShowCompositionHelp] = useState<boolean>(false);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll al último mensaje
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Verificar tipo y tamaño
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecciona un archivo de imagen');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen es demasiado grande. Máximo 5MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setSelectedImage(event.target.result.toString());
        toast.success('¡Imagen cargada! Ahora puedes editarla con instrucciones.', {
          icon: '🖼️',
          style: {
            borderRadius: '12px',
            background: '#4338ca',
            color: '#fff',
          },
        });
      }
    };
    reader.readAsDataURL(file);
  };
  
  const handleRemoveImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleUseSuggestion = (index: number) => {
    setSelectedSuggestion(index);
    setInput(SUGERENCIAS[index]);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };
  
  // Gestión de análisis de imagen por categoría
  const handleCategoryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: ImageCategory) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Verificar tipo y tamaño
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecciona un archivo de imagen');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen es demasiado grande. Máximo 5MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target?.result) {
        const imageData = event.target.result.toString();
        
        // Actualizar estado con la nueva imagen
        setCategorizedImages(prev => ({
          ...prev,
          [category]: imageData
        }));
        
        // Mostrar que estamos analizando la imagen
        setAnalyzing(category);
        
        // Notificar al usuario
        toast.loading(`Analizando imagen de ${getCategoryName(category)}...`, {
          id: `analyzing-${category}`,
          style: {
            borderRadius: '12px',
            background: '#4338ca',
            color: '#fff',
          },
        });
        
        try {
          // Analizar la imagen con la API
          const description = await analyzeImage(imageData, category);
          
          // Actualizar estado con la descripción
          setCategorizedImages(prev => ({
            ...prev,
            [`${category}Descripcion`]: description
          }));
          
          // Notificar éxito
          toast.success(`¡Análisis de ${getCategoryName(category)} completado!`, {
            id: `analyzing-${category}`,
            icon: getCategoryIcon(category),
            style: {
              borderRadius: '12px',
              background: '#4338ca',
              color: '#fff',
            },
          });
          
          // Si tenemos al menos una imagen y una descripción, añadir un mensaje del sistema
          const hasAnyDescription = 
            categorizedImages.asuntoDescripcion || 
            categorizedImages.escenaDescripcion || 
            categorizedImages.estiloDescripcion || 
            description;
          
          if (hasAnyDescription && !messages.some(m => m.role === 'model' && m.text?.includes('imágenes categorizadas'))) {
            // Añadir un mensaje del sistema explicando qué hacer
            setMessages(prev => [
              ...prev,
              {
                id: Date.now().toString(),
                role: 'model',
                text: `He analizado tus imágenes categorizadas. Ahora puedes escribir instrucciones específicas sobre qué crear o modificar, y usaré la información de las imágenes como contexto.`,
                timestamp: new Date()
              }
            ]);
          }
        } catch (error) {
          console.error('Error al analizar imagen:', error);
          toast.error(`Error al analizar la imagen de ${getCategoryName(category)}`, {
            id: `analyzing-${category}`,
          });
        } finally {
          setAnalyzing(null);
        }
      }
    };
    reader.readAsDataURL(file);
  };
  
  const handleRemoveCategoryImage = (category: ImageCategory) => {
    setCategorizedImages(prev => {
      const updated = {...prev};
      delete updated[category];
      delete updated[`${category}Descripcion`];
      return updated;
    });
    
    toast.success(`Imagen de ${getCategoryName(category)} eliminada`, {
      icon: '🗑️',
      style: {
        borderRadius: '12px',
        background: '#4338ca',
        color: '#fff',
      },
    });
  };
  
  const getCategoryName = (category: ImageCategory): string => {
    switch (category) {
      case 'asunto': return 'Asunto';
      case 'escena': return 'Escena';
      case 'estilo': return 'Estilo';
      case 'elementos': return 'Elementos';
      default: return 'Categoría';
    }
  };
  
  const getCategoryIcon = (category: ImageCategory): string => {
    switch (category) {
      case 'asunto': return '👤';
      case 'escena': return '🏞️';
      case 'estilo': return '🎨';
      case 'elementos': return '📦';
      default: return '✨';
    }
  };
  
  const toggleWhiskMode = () => {
    setWhiskMode(!whiskMode);
    if (!whiskMode) {
      // Si estamos activando el modo Whisk, desactivar el modo Composición
      if (compositionMode) {
        setCompositionMode(false);
      }
      
      toast('Modo Whisk activado. Sube imágenes en las tres categorías para crear combinaciones mágicas.', {
        icon: '✨',
        duration: 5000,
        style: {
          borderRadius: '12px',
          background: '#4338ca',
          color: '#fff',
        },
      });
      
      // Añadir un mensaje informativo sobre el uso de inglés en modo Whisk
      setMessages(prev => [
        ...prev, 
        {
          id: Date.now().toString(),
          role: 'model',
          text: 'Para obtener los mejores resultados en modo Whisk, te recomiendo escribir tus instrucciones en inglés. Whisk está optimizado para generar prompts detallados en inglés para aprovechar al máximo las capacidades de IA de imagen. Si prefieres seguir en español, yo traduciré tus instrucciones internamente.',
          timestamp: new Date()
        }
      ]);
    } else {
      // Si desactivamos el modo, limpiamos las imágenes categorizadas
      setCategorizedImages({});
    }
  };
  
  // Función para alternar el modo Composición
  const toggleCompositionMode = () => {
    setCompositionMode(!compositionMode);
    if (!compositionMode) {
      // Si estamos activando el modo Composición, desactivar el modo Whisk
      if (whiskMode) {
        setWhiskMode(false);
      }
      
      toast('Modo Composición activado. Sube un sujeto principal y los elementos a transferir con alta fidelidad.', {
        icon: '🎯',
        duration: 5000,
        style: {
          borderRadius: '12px',
          background: '#3b82f6',
          color: '#fff',
        },
      });
      
      // Añadir un mensaje informativo sobre el uso del modo Composición
      setMessages(prev => [
        ...prev, 
        {
          id: Date.now().toString(),
          role: 'model',
          text: 'Has activado el modo Composición, diseñado para transferir elementos con alta fidelidad visual. Sube una imagen del sujeto principal (persona, objeto) y otra imagen del elemento a transferir (caja, logo, producto). El sistema preservará la apariencia exacta de ambos en la composición final.',
          timestamp: new Date()
        }
      ]);
    } else {
      // Si desactivamos el modo, limpiamos las imágenes categorizadas
      setCategorizedImages({});
    }
  };
  
  const handleSendMessage = async () => {
    if (!input.trim() && !selectedImage && !Object.keys(categorizedImages).some(k => k in categorizedImages)) {
      toast.error('Por favor, escribe un mensaje o selecciona una imagen');
      return;
    }
    
    // Definir las variables fuera del try para que estén disponibles en el catch
    let finalPrompt = input;
    let imageToUse = selectedImage;
    
    try {
      setIsLoading(true);
      
      // Limitar el historial a un número máximo de mensajes para evitar errores
      if (chatHistory.length > MAX_CHAT_HISTORY_LENGTH) {
        // Mantener solo el primer mensaje (instrucciones) y los mensajes más recientes
        const newHistory = chatHistory.length > 0 
          ? [chatHistory[0], ...chatHistory.slice(chatHistory.length - (MAX_CHAT_HISTORY_LENGTH - 1))]
          : [];
        
        setChatHistory(newHistory);
        console.log(`Historial limitado a ${newHistory.length} mensajes para evitar errores`);
      }
      
      // Si estamos en modo Whisk y tenemos al menos una descripción, generar un prompt creativo
      const hasAnyDescription = 
        categorizedImages.asuntoDescripcion || 
        categorizedImages.escenaDescripcion || 
        categorizedImages.estiloDescripcion;
      
      // Si estamos en modo Composición y tenemos al menos la descripción del sujeto y los elementos
      const hasCompositionElements = 
        categorizedImages.asuntoDescripcion && 
        categorizedImages.elementosDescripcion;
      
      if (whiskMode && hasAnyDescription) {
        toast.loading('✨ Generando prompt creativo combinando tus imágenes...', {
          id: 'generating-prompt',
          style: {
            borderRadius: '12px',
            background: '#4338ca',
            color: '#fff',
          },
        });
        
        // Generar un prompt creativo basado en las imágenes y la entrada del usuario
        finalPrompt = await generateCreativePrompt(categorizedImages, input);
        
        // Mostrar información sobre el prompt generado
        console.log('Prompt creativo generado en inglés:', finalPrompt);
        
        toast.success('Prompt creativo generado', {
          id: 'generating-prompt',
        });
        
        // Usar la imagen principal como referencia si existe
        if (categorizedImages.asunto) {
          imageToUse = categorizedImages.asunto;
        } else if (categorizedImages.escena) {
          imageToUse = categorizedImages.escena;
        } else if (categorizedImages.estilo) {
          imageToUse = categorizedImages.estilo;
        }
      }
      // Si estamos en modo Composición y tenemos los elementos necesarios
      else if (compositionMode && hasCompositionElements) {
        toast.loading('🎯 Generando prompt de composición con transferencia precisa...', {
          id: 'generating-prompt',
          style: {
            borderRadius: '12px',
            background: '#3b82f6',
            color: '#fff',
          },
        });
        
        // Generar un prompt específico para composición con transferencia de elementos
        finalPrompt = await generateCompositionPrompt(categorizedImages, input);
        
        // Mostrar información sobre el prompt generado
        console.log('Prompt de composición generado:', finalPrompt);
        
        toast.success('Prompt de composición generado', {
          id: 'generating-prompt',
        });
        
        // Usar la imagen del sujeto como referencia principal
        if (categorizedImages.asunto) {
          imageToUse = categorizedImages.asunto;
        }
        
        // Enviar también la imagen del elemento como segunda imagen
        // Nota: Esta funcionalidad requeriría modificaciones en realTimeChatWithImage
        // para soportar múltiples imágenes, lo cual está fuera del alcance actual
      }
      
      // Agregar mensaje del usuario a la interfaz
      const userMessageId = Date.now().toString();
      const userMessage: MessageType = {
        id: userMessageId,
        role: 'user',
        text: input,
        imageUrl: whiskMode 
          ? undefined // En modo Whisk no mostramos las imágenes en el mensaje (ya están en los slots)
          : imageToUse || undefined,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, userMessage]);
      setInput('');
      
      if (!whiskMode) {
        setSelectedImage(null);
      }
      
      setSelectedSuggestion(null);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Mostrar toast animado durante el procesamiento
      toast.loading('🧙‍♂️ Creando magia con tus imágenes y texto...', {
        id: 'processing-request',
        style: {
          borderRadius: '12px',
          background: '#4338ca',
          color: '#fff',
        },
      });
      
      // Enviar al modelo y procesar respuesta
      const response = await realTimeChatWithImage(
        finalPrompt, // Usamos el prompt potencialmente modificado
        imageToUse || undefined,
        chatHistory
      );
      
      // Actualizar historial para futuras interacciones
      setChatHistory(response.history);
      
      // Agregar respuesta del modelo a la interfaz
      const modelMessage: MessageType = {
        id: Date.now().toString(),
        role: 'model',
        text: response.text,
        imageUrl: response.imageData,
        timestamp: new Date()
      };
      
      toast.dismiss('processing-request');
      setMessages(prev => [...prev, modelMessage]);
      setIsLoading(false);
      
      // Notificar al usuario que se ha completado
      if (response.imageData) {
        toast.success('¡Imagen generada con éxito!', {
          icon: '🎨',
          style: {
            borderRadius: '12px',
            background: '#4338ca',
            color: '#fff',
          },
        });
      } else {
        toast.success('Respuesta recibida', {
          icon: '🤖',
          style: {
            borderRadius: '12px',
            background: '#4338ca',
            color: '#fff',
          },
        });
      }
      
      // Scroll al nuevo mensaje
      setTimeout(scrollToBottom, 100);
      
    } catch (error) {
      setIsLoading(false);
      console.error('Error al enviar el mensaje:', error);
      
      // Mejorar el manejo de errores
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      // Si el error parece relacionado con el tamaño del historial o respuesta inválida
      if (errorMessage.includes('respuesta válida') || 
          errorMessage.includes('No se recibió una respuesta válida') ||
          errorMessage.includes('payload too large')) {
        
        // Reducir el historial a la mitad y reintentar automáticamente
        const originalLength = chatHistory.length;
        
        if (originalLength > 2) {
          toast.loading('Ajustando conversación para resolver el error...', {id: 'retry'});
          console.log(`Error detectado con el historial. Intentando reducir de ${originalLength} mensajes.`);
          
          // Mantener solo el primer mensaje y la mitad de los mensajes recientes
          const reducedHistory = originalLength > 0 
            ? [chatHistory[0], ...chatHistory.slice(Math.ceil(originalLength / 2))]
            : [];
          
          setChatHistory(reducedHistory);
          console.log(`Historial reducido a ${reducedHistory.length} mensajes.`);
          
          // Reintentar la solicitud con menos contexto
          try {
            // Reintentar la solicitud con el historial reducido
            const response = await realTimeChatWithImage(
              finalPrompt,
              imageToUse || undefined,
              reducedHistory
            );
            
            // Actualizar historial para futuras interacciones
            setChatHistory(response.history);
            
            // Agregar respuesta del modelo a la interfaz
            const modelMessage: MessageType = {
              id: Date.now().toString(),
              role: 'model',
              text: response.text,
              imageUrl: response.imageData,
              timestamp: new Date()
            };
            
            setMessages(prev => [...prev, modelMessage]);
            setIsLoading(false);
            
            toast.success('¡Problema resuelto!', {id: 'retry'});
            
            // Scroll al nuevo mensaje
            setTimeout(scrollToBottom, 100);
            return; // Terminar la ejecución si se resolvió con éxito
          } catch (retryError) {
            // Si aún falla, notificar al usuario
            console.error('Error en el segundo intento:', retryError);
            toast.error('No se pudo resolver automáticamente. Intenta limpiar el chat.', {id: 'retry'});
          }
        } else {
          toast.error('Error en la respuesta del modelo. Intenta limpiar el chat y comenzar de nuevo.');
        }
      } else {
        // Errores generales
        toast.error('Error al procesar tu solicitud: ' + 
                   (errorMessage.length > 50 ? errorMessage.substring(0, 50) + '...' : errorMessage));
      }
    }
  };
  
  const handleDownloadImage = (imageUrl: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `imagen-chat-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Imagen descargada', {
      icon: '💾',
      style: {
        borderRadius: '12px',
        background: '#4338ca',
        color: '#fff',
      },
    });
  };
  
  // Función para regenerar una imagen
  const handleRegenerateImage = async (messageId: string) => {
    // Encontrar el mensaje actual y el mensaje del usuario que lo generó
    const currentIndex = messages.findIndex(msg => msg.id === messageId);
    if (currentIndex <= 0 || messages[currentIndex].role !== 'model') {
      toast.error('No se puede regenerar esta imagen');
      return;
    }
    
    // Obtener el mensaje del usuario que generó esta imagen
    const userMessage = messages[currentIndex - 1];
    if (!userMessage || userMessage.role !== 'user') {
      toast.error('No se encontró el mensaje original');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Mostrar toast animado durante la regeneración
      toast.loading('🔄 Regenerando imagen con IA...', {
        style: {
          borderRadius: '12px',
          background: '#4338ca',
          color: '#fff',
        },
      });
      
      // Enviar al modelo con el mismo prompt e imagen original
      const response = await realTimeChatWithImage(
        userMessage.text || '',
        userMessage.imageUrl,
        // No enviamos el historial completo para forzar una nueva generación
        chatHistory.slice(0, -2)
      );
      
      // Actualizar historial para futuras interacciones
      setChatHistory(response.history);
      
      // Crear el mensaje regenerado
      const regeneratedMessage: MessageType = {
        id: Date.now().toString(),
        role: 'model',
        text: response.text,
        imageUrl: response.imageData,
        timestamp: new Date()
      };
      
      toast.dismiss();
      setMessages(prev => [...prev, regeneratedMessage]);
      setIsLoading(false);
      
      // Notificar al usuario
      if (response.imageData) {
        toast.success('¡Imagen regenerada con éxito!', {
          icon: '🎨',
          style: {
            borderRadius: '12px',
            background: '#4338ca',
            color: '#fff',
          },
        });
        
        // Scroll al nuevo mensaje
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.error('Error al regenerar imagen:', error);
      toast.error('Error al regenerar la imagen. Por favor, intenta de nuevo.', {
        style: {
          borderRadius: '12px',
          background: '#ef4444',
          color: '#fff',
        },
      });
      setIsLoading(false);
    }
  };
  
  // Función para eliminar la imagen de un mensaje
  const handleDeleteImage = (messageId: string) => {
    // Encontrar el índice del mensaje a eliminar
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    
    if (messageIndex === -1) {
      toast.error('No se pudo encontrar el mensaje');
      return;
    }
    
    // Eliminar completamente el mensaje que contiene la imagen
    const updatedMessages = [...messages];
    updatedMessages.splice(messageIndex, 1);
    setMessages(updatedMessages);
    
    // Actualizar el historial de chat para eliminar la referencia a la imagen
    if (chatHistory.length > 0) {
      // Encontrar y eliminar la entrada correspondiente en el historial
      // Asumimos que el mensaje del modelo está en una posición par en el historial (0-indexado)
      const historyIndex = messageIndex >= 1 ? Math.floor(messageIndex / 2) : 0;
      
      // Solo eliminamos si es un mensaje del modelo (role === 'model')
      if (historyIndex < chatHistory.length && chatHistory[historyIndex].role === 'model') {
        const updatedHistory = [...chatHistory];
        // Filtrar las partes del mensaje para eliminar cualquier inlineData (imágenes)
        updatedHistory[historyIndex].parts = updatedHistory[historyIndex].parts.filter(
          part => !part.inlineData
        );
        setChatHistory(updatedHistory);
      }
    }
    
    toast.success('Mensaje e imagen eliminados', {
      icon: '🗑️',
      style: {
        borderRadius: '12px',
        background: '#4338ca',
        color: '#fff',
      },
    });
  };
  
  // Función para eliminar un mensaje del usuario
  const handleDeleteUserMessage = (messageId: string) => {
    // Encontrar el índice del mensaje a eliminar
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    
    if (messageIndex === -1) {
      toast.error('No se pudo encontrar el mensaje');
      return;
    }
    
    // Verificar si hay un mensaje de modelo asociado (siguiente mensaje)
    const hasModelResponse = messageIndex + 1 < messages.length && 
                             messages[messageIndex + 1].role === 'model';
    
    // Eliminar el mensaje del usuario
    const updatedMessages = [...messages];
    updatedMessages.splice(messageIndex, 1);
    
    // Si hay respuesta del modelo, eliminarla también
    if (hasModelResponse) {
      updatedMessages.splice(messageIndex, 1); // El índice sigue siendo el mismo después de eliminar el primer mensaje
    }
    
    setMessages(updatedMessages);
    
    // Actualizar el historial de chat
    if (chatHistory.length > 0) {
      const updatedHistory = [...chatHistory];
      const historyIndex = Math.floor(messageIndex / 2);
      
      // Eliminar la entrada del usuario y posiblemente la respuesta del modelo
      if (hasModelResponse) {
        updatedHistory.splice(historyIndex, 2);
      } else {
        updatedHistory.splice(historyIndex, 1);
      }
      
      setChatHistory(updatedHistory);
    }
    
    toast.success('Mensaje eliminado', {
      icon: '🗑️',
      style: {
        borderRadius: '12px',
        background: '#4338ca',
        color: '#fff',
      },
    });
  };
  
  // Función para iniciar la edición de un mensaje
  const handleEditUserMessage = (messageId: string) => {
    // Encontrar el mensaje a editar
    const messageToEdit = messages.find(msg => msg.id === messageId);
    
    if (!messageToEdit) {
      toast.error('No se pudo encontrar el mensaje');
      return;
    }
    
    // Actualizar los mensajes para marcar este como en edición
    const updatedMessages = messages.map(msg => {
      if (msg.id === messageId) {
        return { ...msg, isEditing: true };
      }
      return { ...msg, isEditing: false };
    });
    
    setMessages(updatedMessages);
    setEditingMessageId(messageId);
  };
  
  // Función para guardar la edición de un mensaje
  const handleSaveEdit = async (messageId: string, newText: string) => {
    // Actualizar el mensaje editado
    const updatedMessages = messages.map(msg => {
      if (msg.id === messageId) {
        return { ...msg, text: newText, isEditing: false };
      }
      return msg;
    });
    
    setMessages(updatedMessages);
    setEditingMessageId(null);
    
    toast.success('Mensaje actualizado', {
      icon: '✏️',
      style: {
        borderRadius: '12px',
        background: '#4338ca',
        color: '#fff',
      },
    });
    
    // Enviar automáticamente el mensaje editado a la IA
    try {
      setIsLoading(true);
      
      // Mostrar toast animado durante el procesamiento
      toast.loading('✨ Procesando tu mensaje editado...', {
        style: {
          borderRadius: '12px',
          background: '#4338ca',
          color: '#fff',
        },
      });
      
      // Obtener el mensaje editado
      const editedMessage = updatedMessages.find(msg => msg.id === messageId);
      
      if (!editedMessage || !editedMessage.text) {
        toast.error('Error al procesar el mensaje editado');
        setIsLoading(false);
        return;
      }
      
      // Enviar al modelo y procesar respuesta
      const response = await realTimeChatWithImage(
        editedMessage.text,
        editedMessage.imageUrl,
        chatHistory
      );
      
      // Actualizar historial para futuras interacciones
      setChatHistory(response.history);
      
      // Agregar respuesta del modelo a la interfaz
      const modelMessage: MessageType = {
        id: Date.now().toString(),
        role: 'model',
        text: response.text,
        imageUrl: response.imageData,
        timestamp: new Date()
      };
      
      toast.dismiss();
      setMessages(prev => [...prev, modelMessage]);
      setIsLoading(false);
      
      // Notificar al usuario que se ha completado
      if (response.imageData) {
        toast.success('¡Imagen generada con éxito!', {
          icon: '🎨',
          style: {
            borderRadius: '12px',
            background: '#4338ca',
            color: '#fff',
          },
        });
      } else {
        toast.success('Respuesta recibida', {
          icon: '🤖',
          style: {
            borderRadius: '12px',
            background: '#4338ca',
            color: '#fff',
          },
        });
      }
      
      // Scroll al nuevo mensaje
      setTimeout(scrollToBottom, 100);
      
    } catch (error) {
      console.error('Error al procesar mensaje editado:', error);
      toast.error('Error al procesar tu mensaje. Por favor, intenta de nuevo.', {
        style: {
          borderRadius: '12px',
          background: '#ef4444',
          color: '#fff',
        },
      });
      setIsLoading(false);
    }
  };
  
  // Función para cancelar la edición
  const handleCancelEdit = () => {
    // Desmarcar todos los mensajes como en edición
    const updatedMessages = messages.map(msg => ({
      ...msg,
      isEditing: false
    }));
    
    setMessages(updatedMessages);
    setEditingMessageId(null);
  };
  
  // Función para reenviar un mensaje automáticamente
  const handleResendMessage = async (messageId: string) => {
    // Encontrar el mensaje a reenviar
    const messageToResend = messages.find(msg => msg.id === messageId);
    
    if (!messageToResend) {
      toast.error('No se pudo reenviar el mensaje');
      return;
    }
    
    // Verificar que haya texto o imagen para enviar
    if (!messageToResend.text && !messageToResend.imageUrl) {
      toast.error('No hay contenido para reenviar. Necesitas texto o imagen.');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Mostrar toast animado durante el procesamiento
      toast.loading('✨ Procesando tu solicitud con magia de IA...', {
        style: {
          borderRadius: '12px',
          background: '#4338ca',
          color: '#fff',
        },
      });
      
      // Enviar al modelo y procesar respuesta
      const response = await realTimeChatWithImage(
        messageToResend.text || "Analiza esta imagen", // Asegurar que siempre hay texto
        messageToResend.imageUrl,
        chatHistory
      );
      
      // Actualizar historial para futuras interacciones
      setChatHistory(response.history);
      
      // Agregar respuesta del modelo a la interfaz
      const modelMessage: MessageType = {
        id: Date.now().toString(),
        role: 'model',
        text: response.text,
        imageUrl: response.imageData,
        timestamp: new Date()
      };
      
      toast.dismiss();
      setMessages(prev => [...prev, modelMessage]);
      setIsLoading(false);
      
      // Notificar al usuario que se ha completado
      if (response.imageData) {
        toast.success('¡Imagen generada con éxito!', {
          icon: '🎨',
          style: {
            borderRadius: '12px',
            background: '#4338ca',
            color: '#fff',
          },
        });
      } else {
        toast.success('Respuesta recibida', {
          icon: '🤖',
          style: {
            borderRadius: '12px',
            background: '#4338ca',
            color: '#fff',
          },
        });
      }
      
      // Scroll al nuevo mensaje
      setTimeout(scrollToBottom, 100);
      
    } catch (error) {
      console.error('Error al reenviar mensaje:', error);
      toast.error('Error al procesar tu mensaje. Por favor, intenta de nuevo.', {
        style: {
          borderRadius: '12px',
          background: '#ef4444',
          color: '#fff',
        },
      });
      setIsLoading(false);
    }
  };
  
  // Función para limpiar completamente el historial de chat
  const handleClearChat = () => {
    // Mantener solo el primer mensaje si contiene instrucciones importantes
    setChatHistory(chatHistory.length > 0 ? [chatHistory[0]] : []);
    setMessages([]);
    toast.success('Chat limpiado correctamente', {
      icon: '🧹',
      style: {
        borderRadius: '12px',
        background: '#4338ca',
        color: '#fff',
      },
    });
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex flex-col p-4 md:p-6">
      <Toaster position="top-right" />
      
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-indigo-700">Chat en Tiempo Real</h1>
        
        <div className="flex space-x-2">
          <button
            onClick={handleClearChat}
            className="px-3 py-1.5 rounded-lg flex items-center text-sm font-medium bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
            title="Limpiar conversación"
          >
            <FaTrash className="mr-1.5" />
            Limpiar chat
          </button>
          
          <button
            onClick={toggleWhiskMode}
            className={`px-3 py-1.5 rounded-lg flex items-center text-sm font-medium transition-colors ${
              whiskMode 
                ? 'bg-indigo-600 text-white' 
                : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
            }`}
          >
            <FaMagic className="mr-1.5" />
            Modo Whisk
          </button>
          
          <button
            onClick={toggleCompositionMode}
            className={`px-3 py-1.5 rounded-lg flex items-center text-sm font-medium transition-colors ${
              compositionMode 
                ? 'bg-blue-600 text-white' 
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            <FaObjectGroup className="mr-1.5" />
            Modo Composición
          </button>
          
          <button
            onClick={() => setShowWhiskHelp(!showWhiskHelp)}
            className="p-2 rounded-full bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
            aria-label="Ayuda Whisk"
            title="Ayuda para modo Whisk"
          >
            ?
          </button>
          
          <button
            onClick={() => setShowCompositionHelp(!showCompositionHelp)}
            className="p-2 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200"
            aria-label="Ayuda Composición"
            title="Ayuda para modo Composición"
          >
            ?
          </button>
        </div>
      </div>
      
      {showWhiskHelp && (
        <div className="mb-4 p-4 bg-white rounded-xl shadow-md border border-indigo-100 text-sm">
          <h3 className="font-bold text-indigo-700 mb-2">¿Cómo funciona el Modo Whisk?</h3>
          <p className="mb-2">Inspirado en Whisk, esta herramienta te permite categorizar imágenes para crear magia:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li><b>Asunto:</b> Sube una imagen del elemento principal que quieres en tu creación</li>
            <li><b>Escena:</b> Sube una imagen del entorno o fondo que deseas</li>
            <li><b>Estilo:</b> Sube una imagen que represente el estilo visual que buscas</li>
            <li><b>Escribe instrucciones</b> y la IA combinará todo para crear algo único</li>
          </ol>
          <button
            onClick={() => setShowWhiskHelp(false)}
            className="mt-3 text-indigo-600 font-medium"
          >
            Entendido
          </button>
        </div>
      )}
      
      {showCompositionHelp && (
        <div className="mb-4 p-4 bg-white rounded-xl shadow-md border border-blue-100 text-sm">
          <h3 className="font-bold text-blue-700 mb-2">¿Cómo funciona el Modo Composición?</h3>
          <p className="mb-2">Este modo está diseñado para transferir elementos visuales con alta fidelidad:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li><b>Asunto:</b> Sube una imagen del sujeto principal (persona, objeto, etc.)</li>
            <li><b>Elementos:</b> Sube una imagen de los elementos a transferir con alta fidelidad (caja, logo, producto)</li>
            <li><b>Escena (opcional):</b> Sube una imagen del entorno donde se situará la composición</li>
            <li><b>Estilo (opcional):</b> Sube una imagen que represente el estilo visual deseado</li>
            <li><b>Escribe instrucciones específicas</b> sobre cómo quieres que interactúen estos elementos</li>
          </ol>
          <p className="mt-2 text-blue-700 font-medium">Este modo está optimizado para preservar los detalles visuales exactos de los elementos a transferir, como textos, logos, colores y diseños específicos.</p>
          <button
            onClick={() => setShowCompositionHelp(false)}
            className="mt-3 text-blue-600 font-medium"
          >
            Entendido
          </button>
        </div>
      )}
      
      {/* Panel de imágenes categorizadas - Solo visible en modo Whisk */}
      {(whiskMode || compositionMode) && (
        <div className="mb-4 p-4 bg-white rounded-xl shadow-md grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Asunto */}
          <div className="border border-indigo-100 rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-indigo-700 flex items-center">
                <BsCamera className="mr-1.5" /> Asunto
              </h3>
              {categorizedImages.asunto ? (
                <button
                  onClick={() => handleRemoveCategoryImage('asunto')}
                  className="p-1 rounded-full hover:bg-red-100 text-red-500"
                  aria-label="Eliminar imagen"
                >
                  <FaTrash size={14} />
                </button>
              ) : null}
            </div>
            
            {categorizedImages.asunto ? (
              <div className="relative">
                <img 
                  src={categorizedImages.asunto} 
                  alt="Imagen de asunto" 
                  className="w-full h-32 object-contain mb-2 rounded"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-indigo-200 rounded-lg bg-indigo-50 mb-2">
                <label className="cursor-pointer p-2 w-full h-full flex flex-col items-center justify-center">
                  <BsCamera size={24} className="text-indigo-300 mb-2" />
                  <span className="text-xs text-indigo-500">Subir imagen de asunto</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleCategoryImageUpload(e, 'asunto')}
                    className="hidden"
                  />
                </label>
              </div>
            )}
            
            {categorizedImages.asuntoDescripcion && (
              <div className="text-xs text-gray-500 max-h-20 overflow-y-auto p-2 bg-gray-50 rounded">
                {categorizedImages.asuntoDescripcion}
              </div>
            )}
          </div>
          
          {/* Si estamos en modo Composición, mostrar panel de Elementos */}
          {compositionMode && (
            <div className="border border-blue-100 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium text-blue-700 flex items-center">
                  <BsBox className="mr-1.5" /> Elementos
                </h3>
                {categorizedImages.elementos ? (
                  <button
                    onClick={() => handleRemoveCategoryImage('elementos')}
                    className="p-1 rounded-full hover:bg-red-100 text-red-500"
                    aria-label="Eliminar imagen"
                  >
                    <FaTrash size={14} />
                  </button>
                ) : null}
              </div>
              
              {categorizedImages.elementos ? (
                <div className="relative">
                  <img 
                    src={categorizedImages.elementos} 
                    alt="Imagen de elementos" 
                    className="w-full h-32 object-contain mb-2 rounded"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-blue-200 rounded-lg bg-blue-50 mb-2">
                  <label className="cursor-pointer p-2 w-full h-full flex flex-col items-center justify-center">
                    <BsBox size={24} className="text-blue-300 mb-2" />
                    <span className="text-xs text-blue-500">Subir elementos a transferir</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleCategoryImageUpload(e, 'elementos')}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
              
              {categorizedImages.elementosDescripcion && (
                <div className="text-xs text-gray-500 max-h-20 overflow-y-auto p-2 bg-gray-50 rounded">
                  {categorizedImages.elementosDescripcion}
                </div>
              )}
            </div>
          )}
          
          {/* Escena */}
          <div className="border border-indigo-100 rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-indigo-700 flex items-center">
                <BsImageAlt className="mr-1.5" /> Escena
              </h3>
              {categorizedImages.escena ? (
                <button
                  onClick={() => handleRemoveCategoryImage('escena')}
                  className="p-1 rounded-full hover:bg-red-100 text-red-500"
                  aria-label="Eliminar imagen"
                >
                  <FaTrash size={14} />
                </button>
              ) : null}
            </div>
            
            {categorizedImages.escena ? (
              <div className="relative">
                <img 
                  src={categorizedImages.escena} 
                  alt="Imagen de escena" 
                  className="w-full h-32 object-contain mb-2 rounded"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-indigo-200 rounded-lg bg-indigo-50 mb-2">
                <label className="cursor-pointer p-2 w-full h-full flex flex-col items-center justify-center">
                  <BsImageAlt size={24} className="text-indigo-300 mb-2" />
                  <span className="text-xs text-indigo-500">Subir imagen de escena</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleCategoryImageUpload(e, 'escena')}
                    className="hidden"
                  />
                </label>
              </div>
            )}
            
            {categorizedImages.escenaDescripcion && (
              <div className="text-xs text-gray-500 max-h-20 overflow-y-auto p-2 bg-gray-50 rounded">
                {categorizedImages.escenaDescripcion}
              </div>
            )}
          </div>
          
          {/* Estilo */}
          <div className="border border-indigo-100 rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-indigo-700 flex items-center">
                <BsPalette className="mr-1.5" /> Estilo
              </h3>
              {categorizedImages.estilo ? (
                <button
                  onClick={() => handleRemoveCategoryImage('estilo')}
                  className="p-1 rounded-full hover:bg-red-100 text-red-500"
                  aria-label="Eliminar imagen"
                >
                  <FaTrash size={14} />
                </button>
              ) : null}
            </div>
            
            {categorizedImages.estilo ? (
              <div className="relative">
                <img 
                  src={categorizedImages.estilo} 
                  alt="Imagen de estilo" 
                  className="w-full h-32 object-contain mb-2 rounded"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-indigo-200 rounded-lg bg-indigo-50 mb-2">
                <label className="cursor-pointer p-2 w-full h-full flex flex-col items-center justify-center">
                  <BsPalette size={24} className="text-indigo-300 mb-2" />
                  <span className="text-xs text-indigo-500">Subir estilo visual</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleCategoryImageUpload(e, 'estilo')}
                    className="hidden"
                  />
                </label>
              </div>
            )}
            
            {categorizedImages.estiloDescripcion && (
              <div className="text-xs text-gray-500 max-h-20 overflow-y-auto p-2 bg-gray-50 rounded">
                {categorizedImages.estiloDescripcion}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Resto del componente (chat, mensajes, etc.) */}
      <div className="flex-grow bg-white rounded-xl shadow-md overflow-hidden flex flex-col">
        {/* Área de mensajes con estilo mejorado */}
        <div 
          ref={chatContainerRef}
          className="flex-1 p-6 overflow-y-auto bg-white dark:bg-gray-900 min-h-[50vh] max-h-[calc(100vh-330px)]"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 p-6">
              <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
                <RiImageEditLine className="text-5xl text-indigo-500 dark:text-indigo-400" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-indigo-700 dark:text-indigo-300">¡Bienvenido al Chat Visual!</h3>
              <p className="max-w-md text-gray-600 dark:text-gray-400 mb-8">
                Carga una imagen y dinos cómo quieres modificarla. También puedes preguntar sobre la imagen o solicitar variaciones creativas.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
                >
                  <FaImage className="text-lg" />
                  Subir una imagen
                </button>
                <button 
                  onClick={() => setInput("¿Qué puedes hacer con mis imágenes?")}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
                >
                  <FaMagic className="text-lg" />
                  Explorar capacidades
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {/* Botones de acción para mensajes del usuario */}
                  {message.role === 'user' && (
                    <div className="flex flex-col mr-2 space-y-2 justify-center">
                      <button
                        onClick={() => handleEditUserMessage(message.id)}
                        className="p-2 bg-purple-500 text-white rounded-full shadow-lg hover:bg-purple-600 transition-all duration-200 hover:scale-110 hover:rotate-12"
                        aria-label="Editar mensaje"
                        disabled={isLoading || editingMessageId !== null}
                      >
                        <RiEditBoxLine className="text-white" size={16} />
                      </button>
                      <button
                        onClick={() => handleResendMessage(message.id)}
                        className="p-2 bg-emerald-500 text-white rounded-full shadow-lg hover:bg-emerald-600 transition-all duration-200 hover:scale-110 hover:rotate-12"
                        aria-label="Reenviar mensaje"
                        disabled={isLoading}
                      >
                        <RiSendPlaneFill className="text-white" size={16} />
                      </button>
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[80%] rounded-2xl shadow-md p-4 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-br-none relative'
                        : 'bg-gradient-to-br from-gray-100 to-white dark:from-gray-800 dark:to-gray-700 dark:text-white rounded-bl-none border border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    {/* Botón de eliminar dentro de la burbuja del mensaje del usuario */}
                    {message.role === 'user' && !message.isEditing && (
                      <button
                        onClick={() => handleDeleteUserMessage(message.id)}
                        className="absolute bottom-2 right-2 p-1.5 bg-red-500 bg-opacity-80 text-white rounded-full hover:bg-red-600 transition-all duration-200 hover:scale-110"
                        aria-label="Eliminar mensaje"
                        disabled={isLoading}
                      >
                        <RiDeleteBin6Line className="text-white" size={14} />
                      </button>
                    )}
                    
                    {message.isEditing ? (
                      <div className="relative">
                        <textarea
                          defaultValue={message.text}
                          className="w-full bg-indigo-700 border border-indigo-500 rounded-lg p-3 pr-24 text-white focus:ring-2 focus:ring-indigo-400 focus:outline-none min-h-[80px] scrollbar-hide"
                          rows={3}
                          autoFocus
                        />
                        <div className="absolute right-3 top-3 flex space-x-2">
                          <button
                            onClick={() => {
                              const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
                              handleSaveEdit(message.id, textarea.value);
                            }}
                            className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 shadow-md"
                            aria-label="Guardar edición"
                          >
                            <FaCheck size={14} />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-2 bg-gray-500 text-white rounded-full hover:bg-gray-600 shadow-md"
                            aria-label="Cancelar edición"
                          >
                            <FaTrash size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mb-3 leading-relaxed">{message.text}</p>
                    )}
                    
                    {message.imageUrl && (
                      <div className="relative mt-2 rounded-xl overflow-hidden shadow-lg">
                        <ImageDisplay 
                          src={message.imageUrl} 
                          alt={`Imagen en mensaje de ${message.role === 'user' ? 'usuario' : 'AI'}`} 
                        />
                        
                        {message.role === 'model' && message.imageUrl && (
                          <div className="absolute top-2 right-2 flex gap-2">
                            <button
                              onClick={() => handleRegenerateImage(message.id)}
                              className="p-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg hover:bg-indigo-100 transition-all duration-200 hover:scale-110"
                              aria-label="Regenerar imagen"
                              disabled={isLoading}
                            >
                              <RiRefreshLine className="text-emerald-600" />
                            </button>
                            <button
                              onClick={() => handleDownloadImage(message.imageUrl!)}
                              className="p-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg hover:bg-indigo-100 transition-all duration-200 hover:scale-110"
                              aria-label="Descargar imagen"
                            >
                              <FaDownload className="text-indigo-600" />
                            </button>
                            <button
                              onClick={() => handleDeleteImage(message.id)}
                              className="p-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg hover:bg-red-100 transition-all duration-200 hover:scale-110"
                              aria-label="Eliminar imagen"
                            >
                              <FaTrash className="text-red-600" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className={`text-xs mt-2 flex items-center ${
                      message.role === 'user' ? 'text-indigo-100 justify-start' : 'text-gray-500 dark:text-gray-400 justify-end'
                    }`}>
                      <span className="opacity-80">{message.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      {message.role === 'model' && (
                        <span className="ml-1 flex items-center">
                          <FaRocket className="ml-1 text-indigo-500 dark:text-indigo-400" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gradient-to-br from-gray-100 to-white dark:from-gray-800 dark:to-gray-700 p-4 rounded-2xl max-w-[80%] rounded-bl-none shadow-md border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center space-x-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <span className="text-gray-600 dark:text-gray-300 font-medium">
                        Creando magia visual...
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        
        {/* Sugerencias de prompts */}
        {messages.length > 0 && !isLoading && (
          <div className="bg-indigo-50 dark:bg-gray-800/70 px-4 py-3 border-t border-indigo-100 dark:border-gray-700 relative">
            <div className="flex items-center">
              <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300 whitespace-nowrap mr-3 flex-shrink-0">Sugerencias:</span>
              <div className="flex gap-2 overflow-x-auto py-1.5 px-0.5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-300/50 dark:scrollbar-thumb-gray-600/50 pr-6 md:pr-0">
                {SUGERENCIAS.map((sugerencia, index) => (
                  <button
                    key={index}
                    onClick={() => handleUseSuggestion(index)}
                    className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-all ${
                      selectedSuggestion === index
                        ? 'bg-indigo-600 text-white shadow-md scale-105'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-indigo-100 dark:hover:bg-gray-600 hover:shadow-sm'
                    } border border-indigo-200 dark:border-gray-600 flex-shrink-0`}
                  >
                    {sugerencia}
                  </button>
                ))}
              </div>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-gradient-to-l from-indigo-50 dark:from-gray-800/90 to-transparent w-6 h-8 pointer-events-none md:hidden"></div>
            </div>
          </div>
        )}
        
        {/* Área de previsualización de imagen */}
        {selectedImage && (
          <div className="p-3 border-t border-indigo-200 dark:border-gray-700 bg-indigo-50 dark:bg-gray-800/50">
            <div className="flex items-center">
              <div className="mr-3">
                <div className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-indigo-300 dark:border-indigo-700 shadow-md">
                  <img
                    src={selectedImage}
                    alt="Imagen seleccionada"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Imagen lista para editar</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Describe cómo quieres modificarla</p>
              </div>
              <button
                onClick={handleRemoveImage}
                className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full hover:bg-red-200 dark:hover:bg-red-800/30 transition-all"
                aria-label="Eliminar imagen"
              >
                <FaTrash size={14} />
              </button>
            </div>
          </div>
        )}
        
        {/* Área de entrada centrada y con mejor alineación de botones */}
        <div className="border-t border-indigo-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/80">
          <div className="bg-white dark:bg-gray-700 rounded-xl shadow-md flex items-center border border-gray-200 dark:border-gray-600">
            {/* Botón para subir imagen */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-600 rounded-lg transition-colors flex-shrink-0 self-stretch flex items-center"
              disabled={isLoading}
              title="Subir imagen"
              aria-label="Subir imagen"
            >
              <FaUpload size={18} />
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
              />
            </button>
            
            {/* Campo de texto con botón de envío */}
            <div className="flex-1 relative min-w-0">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Escribe un mensaje o instrucción para editar la imagen..."
                className="w-full border-0 focus:ring-0 bg-transparent text-gray-700 dark:text-white py-3 pl-2 pr-12 resize-none min-h-[48px] max-h-[80px] leading-tight scrollbar-hide"
                rows={1}
                disabled={isLoading}
              />
              
              {/* Botón de envío sobre el textarea */}
              <button
                onClick={handleSendMessage}
                disabled={isLoading || (!input.trim() && !selectedImage)}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${
                  isLoading || (!input.trim() && !selectedImage)
                    ? 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-md hover:from-indigo-700 hover:to-purple-700'
                }`}
                aria-label="Enviar mensaje"
              >
                <FaPaperPlane className="h-4 w-4" />
              </button>
            </div>
            
            {/* Botón para limpiar el texto */}
            <button
              onClick={() => setInput('')}
              className={`p-3 transition-colors flex-shrink-0 self-stretch flex items-center ${
                !input.trim() 
                  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' 
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg'
              }`}
              disabled={!input.trim()}
              title="Limpiar entrada"
              aria-label="Limpiar entrada"
            >
              <FaTrash size={16} />
            </button>
          </div>
          
          <div className="mt-2 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              💡 Puedes solicitar modificaciones específicas o hacer preguntas sobre las imágenes
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}