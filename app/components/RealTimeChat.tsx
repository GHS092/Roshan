'use client';

import React, { useState, useRef, useEffect } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { FaImage, FaPaperPlane, FaUpload, FaTrash, FaDownload, FaMagic, FaRocket, FaPencilAlt, FaRedo } from 'react-icons/fa';
import { RiLoaderLine, RiMagicLine, RiChatSmile2Line, RiImageEditLine } from 'react-icons/ri';
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
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  
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
      
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
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
  
  const handleEditMessage = (messageId: string) => {
    const messageToEdit = messages.find(m => m.id === messageId);
    if (messageToEdit) {
      // Si estamos editando un mensaje de usuario que tiene una respuesta
      const messageIndex = messages.findIndex(m => m.id === messageId);
      if (messageToEdit.role === 'user' && messageIndex < messages.length - 1 && messages[messageIndex + 1].role === 'model') {
        // También eliminamos la respuesta del modelo
        setMessages(prev => prev.filter(m => m.id !== messageId && m.id !== messages[messageIndex + 1].id));
        
        // Actualizar el historial para eliminar este intercambio
        const historyPairsToKeep = Math.floor(messageIndex / 2);
        if (historyPairsToKeep < chatHistory.length) {
          setChatHistory(chatHistory.slice(0, historyPairsToKeep));
        }
      } else {
        // Solo eliminamos el mensaje actual
        setMessages(prev => prev.filter(m => m.id !== messageId));
      }
      
      // Copiar el texto al input
      setInput(messageToEdit.text || '');
      // Si el mensaje tenía una imagen, también la recuperamos
      if (messageToEdit.imageUrl) {
        setSelectedImage(messageToEdit.imageUrl);
      }
    }
  };

  const handleResendMessage = async (messageId: string) => {
    const messageToResend = messages.find(m => m.id === messageId);
    if (messageToResend) {
      // Eliminar todos los mensajes después del mensaje seleccionado
      const messageIndex = messages.findIndex(m => m.id === messageId);
      setMessages(messages.slice(0, messageIndex + 1));
      
      // Configurar el mensaje para reenviar
      setInput(messageToResend.text || '');
      // Enviar automáticamente
      await handleSendMessage();
    }
  };

  // Nueva función para regenerar una imagen basada en un prompt existente
  const handleRegenerateImage = async (promptMessageId: string) => {
    // Buscar el mensaje con el prompt
    const promptIndex = messages.findIndex(m => m.id === promptMessageId);
    if (promptIndex >= 0 && promptIndex + 1 < messages.length) {
      // Encontrar el mensaje del usuario (prompt)
      const userMessage = messages[promptIndex];
      // Encontrar el mensaje de respuesta con la imagen generada
      const responseMessage = messages[promptIndex + 1];
      
      if (userMessage && responseMessage && responseMessage.role === 'model') {
        // Eliminar la imagen anterior
        setMessages(prev => prev.filter(m => m.id !== responseMessage.id));
        
        toast.loading('🔄 Regenerando imagen con IA...', {
          style: {
            borderRadius: '12px',
            background: '#4338ca',
            color: '#fff',
          },
        });
        
        setIsLoading(true);
        
        try {
          // Reutilizar el mismo prompt para generar una nueva imagen
          const response = await realTimeChatWithImage(
            userMessage.text || '',
            userMessage.imageUrl || undefined,
            chatHistory
          );
          
          // Actualizar historial para futuras interacciones
          setChatHistory(response.history);
          
          // Agregar la nueva respuesta del modelo
          const newModelMessage: MessageType = {
            id: Date.now().toString(),
            role: 'model',
            text: response.text,
            imageUrl: response.imageData,
            timestamp: new Date()
          };
          
          toast.dismiss();
          setMessages(prev => [...prev, newModelMessage]);
          setIsLoading(false);
          
          if (response.imageData) {
            toast.success('¡Nueva imagen generada!', {
              icon: '🎨',
              style: {
                borderRadius: '12px',
                background: '#4338ca',
                color: '#fff',
              },
            });
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
      }
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    // Encontrar el mensaje que se va a eliminar
    const messageToDelete = messages.find(m => m.id === messageId);
    
    // Obtener el índice del mensaje a eliminar
    const messageIndex = messages.findIndex(m => m.id === messageId);
    
    if (messageToDelete && messageToDelete.role === 'model' && messageToDelete.imageUrl) {
      // Si es un mensaje del modelo con imagen, también debemos eliminar
      // el mensaje del usuario que generó esta respuesta
      // y actualizar el historial de chat para que no influya en futuras generaciones
      
      // Si hay un mensaje anterior del usuario (prompt) y es el que generó esta imagen
      if (messageIndex > 0 && messages[messageIndex - 1].role === 'user') {
        // Identificamos que es una secuencia prompt-respuesta que queremos eliminar completamente
        const userPromptIndex = messageIndex - 1;
        
        // Calculamos cuántos pares de mensajes hay en el historial hasta este punto
        // Cada par es un intercambio usuario-modelo
        const historyPairsToKeep = Math.floor(userPromptIndex / 2);
        
        // Actualizar el historial para eliminar este intercambio del contexto
        if (historyPairsToKeep < chatHistory.length) {
          setChatHistory(chatHistory.slice(0, historyPairsToKeep));
        }
        
        // Eliminar tanto la respuesta del modelo como el prompt del usuario
        setMessages(prev => prev.filter(m => m.id !== messageId && m.id !== messages[userPromptIndex].id));
        
        toast.success('Imagen y contexto eliminados', {
          icon: '🗑️',
          style: {
            borderRadius: '12px',
            background: '#4338ca',
            color: '#fff',
          },
        });
        return;
      }
    }
    
    // Para otros tipos de mensajes, simplemente los eliminamos
    // pero también actualizamos el historial si es necesario
    if (messageToDelete) {
      if (messageToDelete.role === 'user') {
        // Si eliminamos un mensaje de usuario, también eliminamos su respuesta si existe
        if (messageIndex < messages.length - 1 && messages[messageIndex + 1].role === 'model') {
          // Eliminar tanto el mensaje como su respuesta
          const messagesToKeep = messages.filter(m => 
            m.id !== messageId && m.id !== messages[messageIndex + 1].id
          );
          setMessages(messagesToKeep);
          
          // Reconstruir el historial basado en los mensajes que quedan
          // Cada par de mensajes (usuario-modelo) forma un intercambio en el historial
          const newHistory: ChatHistoryType = [];
          for (let i = 0; i < messagesToKeep.length; i += 2) {
            if (i + 1 < messagesToKeep.length) {
              const userMsg = messagesToKeep[i];
              const modelMsg = messagesToKeep[i + 1];
              
              if (userMsg.role === 'user' && modelMsg.role === 'model') {
                newHistory.push({
                  role: 'user',
                  parts: [{
                    text: userMsg.text || '',
                    ...(userMsg.imageUrl ? { 
                      inlineData: { 
                        mimeType: 'image/jpeg', 
                        data: userMsg.imageUrl.split(',')[1] || ''
                      } 
                    } : {})
                  }]
                });
                
                newHistory.push({
                  role: 'model',
                  parts: [{
                    text: modelMsg.text || '',
                    ...(modelMsg.imageUrl ? { 
                      inlineData: { 
                        mimeType: 'image/jpeg', 
                        data: modelMsg.imageUrl.split(',')[1] || ''
                      } 
                    } : {})
                  }]
                });
              }
            }
          }
          
          setChatHistory(newHistory);
          
          toast.success('Mensaje y respuesta eliminados', {
            icon: '🗑️',
            style: {
              borderRadius: '12px',
              background: '#4338ca',
              color: '#fff',
            },
          });
          return;
        }
      }
      
      // Caso más simple: solo eliminar el mensaje actual
      setMessages(messages.filter(m => m.id !== messageId));
      
      // Reconstruir el historial de chat para asegurarnos de que está sincronizado
      const remainingMessages = messages.filter(m => m.id !== messageId);
      const newHistory: ChatHistoryType = [];
      
      // Reconstruir el historial solo con los pares completos de mensajes
      for (let i = 0; i < remainingMessages.length; i += 2) {
        if (i + 1 < remainingMessages.length) {
          const userMsg = remainingMessages[i];
          const modelMsg = remainingMessages[i + 1];
          
          if (userMsg.role === 'user' && modelMsg.role === 'model') {
            newHistory.push({
              role: 'user',
              parts: [{
                text: userMsg.text || '',
                ...(userMsg.imageUrl ? { 
                  inlineData: { 
                    mimeType: 'image/jpeg', 
                    data: userMsg.imageUrl.split(',')[1] || ''
                  } 
                } : {})
              }]
            });
            
            newHistory.push({
              role: 'model',
              parts: [{
                text: modelMsg.text || '',
                ...(modelMsg.imageUrl ? { 
                  inlineData: { 
                    mimeType: 'image/jpeg', 
                    data: modelMsg.imageUrl.split(',')[1] || ''
                  } 
                } : {})
              }]
            });
          }
        }
      }
      
      setChatHistory(newHistory);
      
      toast.success('Mensaje eliminado', {
        icon: '🗑️',
        style: {
          borderRadius: '12px',
          background: '#4338ca',
          color: '#fff',
        },
      });
    }
  };
  
  return (
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
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  onMouseEnter={() => setHoveredMessageId(message.id)}
                  onMouseLeave={() => setHoveredMessageId(null)}
                  onClick={() => {
                    // En dispositivos móviles, alternar la visibilidad de los botones
                    if (window.innerWidth <= 768) {
                      setHoveredMessageId(hoveredMessageId === message.id ? null : message.id);
                    }
                  }}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl shadow-md p-4 relative group ${
                      message.role === 'user'
                        ? 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-br-none'
                        : 'bg-gradient-to-br from-gray-100 to-white dark:from-gray-800 dark:to-gray-700 dark:text-white rounded-bl-none border border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    {message.text && <p className="mb-3 leading-relaxed">{message.text}</p>}
                    
                    {/* Botones interactivos que aparecen en hover/touch */}
                    {hoveredMessageId === message.id && message.role === 'user' && (
                      <div className="absolute -left-12 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditMessage(message.id);
                          }}
                          className="p-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg hover:bg-indigo-100 transition-all duration-200 hover:scale-110"
                          title="Editar mensaje"
                        >
                          <FaPencilAlt className="text-indigo-600 w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMessage(message.id);
                          }}
                          className="p-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg hover:bg-red-100 transition-all duration-200 hover:scale-110"
                          title="Eliminar mensaje"
                        >
                          <FaTrash className="text-red-600 w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {message.imageUrl && (
                      <div className="relative mt-2 rounded-xl overflow-hidden shadow-lg group">
                        <ImageDisplay 
                          src={message.imageUrl} 
                          alt={`Imagen en mensaje de ${message.role === 'user' ? 'usuario' : 'AI'}`} 
                        />
                        
                        {message.role === 'model' && hoveredMessageId === message.id && (
                          <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleDownloadImage(message.imageUrl!)}
                              className="p-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg hover:bg-indigo-100 transition-all duration-200 hover:scale-110"
                              aria-label="Descargar imagen"
                            >
                              <FaDownload className="text-indigo-600 w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                // Buscar el mensaje del usuario (prompt) que generó esta imagen
                                const currentIndex = messages.findIndex(m => m.id === message.id);
                                if (currentIndex > 0) {
                                  // El mensaje anterior debería ser el prompt del usuario
                                  const promptMessageId = messages[currentIndex - 1].id;
                                  handleRegenerateImage(promptMessageId);
                                }
                              }}
                              className="p-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg hover:bg-green-100 transition-all duration-200 hover:scale-110"
                              aria-label="Regenerar imagen"
                            >
                              <FaRedo className="text-green-600 w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(message.id)}
                              className="p-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg hover:bg-red-100 transition-all duration-200 hover:scale-110"
                              aria-label="Eliminar imagen"
                            >
                              <FaTrash className="text-red-600 w-4 h-4" />
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
              <div className="flex gap-2 overflow-x-auto py-1.5 px-0.5 scrollbar-thin scrollbar-thumb-indigo-300 dark:scrollbar-thumb-indigo-600 scrollbar-track-transparent pr-6 md:pr-0">
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
                className="w-full border-0 focus:ring-0 bg-transparent text-gray-700 dark:text-white py-3 pl-2 pr-12 resize-none min-h-[48px] max-h-[80px] leading-tight"
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