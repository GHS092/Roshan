'use client';

import React, { useState, useRef, useEffect } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { FaImage, FaPaperPlane, FaUpload, FaTrash, FaDownload, FaMagic, FaRocket, FaRedo, FaEdit, FaCheck } from 'react-icons/fa';
import { RiLoaderLine, RiMagicLine, RiChatSmile2Line, RiImageEditLine, RiRefreshLine, RiSendPlaneFill, RiDeleteBin6Line, RiEditBoxLine } from 'react-icons/ri';
import { realTimeChatWithImage } from '../lib/gemini';
import ImageDisplay from './ImageDisplay';

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

export default function RealTimeChat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatHistoryType>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  
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
  
  const handleSendMessage = async () => {
    if (!input.trim() && !selectedImage) {
      toast.error('Por favor, escribe un mensaje o selecciona una imagen');
      return;
    }
    
    try {
      // Agregar mensaje del usuario a la interfaz
      const userMessageId = Date.now().toString();
      const userMessage: MessageType = {
        id: userMessageId,
        role: 'user',
        text: input,
        imageUrl: selectedImage || undefined,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setSelectedImage(null);
      setIsLoading(true);
      setSelectedSuggestion(null);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
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
        input,
        selectedImage || undefined,
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
      console.error('Error al enviar mensaje:', error);
      
      // Mejorar los mensajes de error para el usuario
      let errorMessage = 'Error al procesar tu mensaje. Por favor, intenta de nuevo.';
      let errorIcon = '❌';
      
      // Detectar tipos específicos de errores
      const errorStr = error instanceof Error 
        ? error.toString() 
        : typeof error === 'string' 
          ? error 
          : 'Error desconocido';
      
      if (errorStr.includes('[500]') && errorStr.includes('generativelanguage.googleapis.com')) {
        errorMessage = 'Error interno del servidor de IA. Esto puede ocurrir cuando:' +
                      '\n• Has realizado muchas regeneraciones consecutivas' +
                      '\n• El prompt es demasiado complejo' +
                      '\n• Hay problemas temporales con el servicio' +
                      '\n\nRecomendaciones:' +
                      '\n• Espera unos minutos y vuelve a intentarlo' +
                      '\n• Intenta con un prompt más simple' +
                      '\n• Comienza una nueva conversación';
        errorIcon = '🔄';
      } else if (errorStr.includes('timeout') || errorStr.includes('ETIMEDOUT')) {
        errorMessage = 'La conexión con el servidor de IA ha excedido el tiempo de espera. ' +
                      'Verifica tu conexión a internet e intenta de nuevo.';
        errorIcon = '⏱️';
      } else if (errorStr.includes('quota') || errorStr.includes('rate limit')) {
        errorMessage = 'Has alcanzado el límite de solicitudes a la API. ' +
                      'Espera unos minutos antes de intentar nuevamente.';
        errorIcon = '⚠️';
      }
      
      toast.error(errorMessage, {
        icon: errorIcon,
        duration: 7000, // Duración más larga para mensajes de error detallados
        style: {
          borderRadius: '12px',
          background: '#ef4444',
          color: '#fff',
          maxWidth: '500px', // Ancho mayor para mensajes más largos
          whiteSpace: 'pre-line' // Permite saltos de línea en el mensaje
        },
      });
      setIsLoading(false);
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
      
      // Mejorar los mensajes de error para el usuario
      let errorMessage = 'Error al regenerar la imagen. Por favor, intenta de nuevo.';
      let errorIcon = '❌';
      
      // Detectar tipos específicos de errores
      const errorStr = error instanceof Error 
        ? error.toString() 
        : typeof error === 'string' 
          ? error 
          : 'Error desconocido';
      
      if (errorStr.includes('[500]') && errorStr.includes('generativelanguage.googleapis.com')) {
        errorMessage = 'Error interno del servidor de IA. Esto puede ocurrir cuando:' +
                      '\n• Has realizado muchas regeneraciones consecutivas' +
                      '\n• El prompt es demasiado complejo' +
                      '\n• Hay problemas temporales con el servicio' +
                      '\n\nRecomendaciones:' +
                      '\n• Espera unos minutos y vuelve a intentarlo' +
                      '\n• Intenta con un prompt más simple' +
                      '\n• Comienza una nueva conversación';
        errorIcon = '🔄';
      } else if (errorStr.includes('timeout') || errorStr.includes('ETIMEDOUT')) {
        errorMessage = 'La conexión con el servidor de IA ha excedido el tiempo de espera. ' +
                      'Verifica tu conexión a internet e intenta de nuevo.';
        errorIcon = '⏱️';
      } else if (errorStr.includes('quota') || errorStr.includes('rate limit')) {
        errorMessage = 'Has alcanzado el límite de solicitudes a la API. ' +
                      'Espera unos minutos antes de intentar nuevamente.';
        errorIcon = '⚠️';
      }
      
      toast.error(errorMessage, {
        icon: errorIcon,
        duration: 7000, // Duración más larga para mensajes de error detallados
        style: {
          borderRadius: '12px',
          background: '#ef4444',
          color: '#fff',
          maxWidth: '500px', // Ancho mayor para mensajes más largos
          whiteSpace: 'pre-line' // Permite saltos de línea en el mensaje
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
      
      // Mejorar los mensajes de error para el usuario
      let errorMessage = 'Error al procesar tu mensaje. Por favor, intenta de nuevo.';
      let errorIcon = '❌';
      
      // Detectar tipos específicos de errores
      const errorStr = error instanceof Error 
        ? error.toString() 
        : typeof error === 'string' 
          ? error 
          : 'Error desconocido';
      
      if (errorStr.includes('[500]') && errorStr.includes('generativelanguage.googleapis.com')) {
        errorMessage = 'Error interno del servidor de IA. Esto puede ocurrir cuando:' +
                      '\n• Has realizado muchas regeneraciones consecutivas' +
                      '\n• El prompt es demasiado complejo' +
                      '\n• Hay problemas temporales con el servicio' +
                      '\n\nRecomendaciones:' +
                      '\n• Espera unos minutos y vuelve a intentarlo' +
                      '\n• Intenta con un prompt más simple' +
                      '\n• Comienza una nueva conversación';
        errorIcon = '🔄';
      } else if (errorStr.includes('timeout') || errorStr.includes('ETIMEDOUT')) {
        errorMessage = 'La conexión con el servidor de IA ha excedido el tiempo de espera. ' +
                      'Verifica tu conexión a internet e intenta de nuevo.';
        errorIcon = '⏱️';
      } else if (errorStr.includes('quota') || errorStr.includes('rate limit')) {
        errorMessage = 'Has alcanzado el límite de solicitudes a la API. ' +
                      'Espera unos minutos antes de intentar nuevamente.';
        errorIcon = '⚠️';
      }
      
      toast.error(errorMessage, {
        icon: errorIcon,
        duration: 7000, // Duración más larga para mensajes de error detallados
        style: {
          borderRadius: '12px',
          background: '#ef4444',
          color: '#fff',
          maxWidth: '500px', // Ancho mayor para mensajes más largos
          whiteSpace: 'pre-line' // Permite saltos de línea en el mensaje
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
    
    if (!messageToResend || !messageToResend.text) {
      toast.error('No se pudo reenviar el mensaje');
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
        messageToResend.text,
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
      
      // Mejorar los mensajes de error para el usuario
      let errorMessage = 'Error al procesar tu mensaje. Por favor, intenta de nuevo.';
      let errorIcon = '❌';
      
      // Detectar tipos específicos de errores
      const errorStr = error instanceof Error 
        ? error.toString() 
        : typeof error === 'string' 
          ? error 
          : 'Error desconocido';
      
      if (errorStr.includes('[500]') && errorStr.includes('generativelanguage.googleapis.com')) {
        errorMessage = 'Error interno del servidor de IA. Esto puede ocurrir cuando:' +
                      '\n• Has realizado muchas regeneraciones consecutivas' +
                      '\n• El prompt es demasiado complejo' +
                      '\n• Hay problemas temporales con el servicio' +
                      '\n\nRecomendaciones:' +
                      '\n• Espera unos minutos y vuelve a intentarlo' +
                      '\n• Intenta con un prompt más simple' +
                      '\n• Comienza una nueva conversación';
        errorIcon = '🔄';
      } else if (errorStr.includes('timeout') || errorStr.includes('ETIMEDOUT')) {
        errorMessage = 'La conexión con el servidor de IA ha excedido el tiempo de espera. ' +
                      'Verifica tu conexión a internet e intenta de nuevo.';
        errorIcon = '⏱️';
      } else if (errorStr.includes('quota') || errorStr.includes('rate limit')) {
        errorMessage = 'Has alcanzado el límite de solicitudes a la API. ' +
                      'Espera unos minutos antes de intentar nuevamente.';
        errorIcon = '⚠️';
      }
      
      toast.error(errorMessage, {
        icon: errorIcon,
        duration: 7000, // Duración más larga para mensajes de error detallados
        style: {
          borderRadius: '12px',
          background: '#ef4444',
          color: '#fff',
          maxWidth: '500px', // Ancho mayor para mensajes más largos
          whiteSpace: 'pre-line' // Permite saltos de línea en el mensaje
        },
      });
      setIsLoading(false);
    }
  };
  
  return (
    <>
      <div className="flex flex-col h-full">
        <Toaster position="top-right" />
        
        <div className="flex-1 bg-gradient-to-b from-indigo-600 to-violet-700 rounded-2xl shadow-xl overflow-hidden flex flex-col">
          {/* Encabezado con estilo moderno */}
          <div className="p-6 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-black opacity-10 rounded-b-[50%] scale-150 -translate-y-1/2"></div>
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-purple-400 rounded-full opacity-20"></div>
            <div className="absolute -left-10 -bottom-14 w-40 h-40 bg-indigo-300 rounded-full opacity-20"></div>
            
            <div className="relative z-10 flex items-center">
              <div className="flex justify-center items-center w-12 h-12 bg-white bg-opacity-20 rounded-xl mr-4 backdrop-blur-sm">
                <RiChatSmile2Line className="text-2xl text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Chat Visual Interactivo</h2>
                <p className="text-indigo-100 text-sm mt-1">
                  Conversa y edita imágenes en tiempo real con IA
                </p>
              </div>
            </div>
          </div>
          
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
      
      {/* Estilos para ocultar la barra de desplazamiento y personalizar scrollbars */}
      <style jsx global>{`
        /* Para Chrome, Safari y Opera */
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        /* Para IE, Edge y Firefox */
        .scrollbar-hide {
          -ms-overflow-style: none;  /* IE y Edge */
          scrollbar-width: none;  /* Firefox */
        }
        
        /* Personalización de scrollbars delgadas */
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.3);
          border-radius: 20px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background-color: rgba(156, 163, 175, 0.5);
        }
        
        /* Para Firefox */
        .scrollbar-thin {
          scrollbar-width: thin;
          scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
        }
      `}</style>
    </>
  );
}