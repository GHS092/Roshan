'use client';

import React, { useState, useRef, useEffect } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { FaImage, FaPaperPlane, FaUpload, FaTrash, FaDownload } from 'react-icons/fa';
import { RiLoaderLine } from 'react-icons/ri';
import { realTimeChatWithImage } from '../lib/gemini';
import ImageDisplay from './ImageDisplay';

type MessageType = {
  id: string;
  role: 'user' | 'model';
  text?: string;
  imageUrl?: string;
  timestamp: Date;
};

type ChatHistoryType = Array<{
  role: string;
  parts: Array<{
    text?: string;
    inlineData?: { mimeType: string; data: string };
  }>;
}>;

export default function RealTimeChat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatHistoryType>([]);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
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
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
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
      
      setMessages(prev => [...prev, modelMessage]);
      setIsLoading(false);
      
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      toast.error('Error al procesar tu mensaje. Por favor, intenta de nuevo.');
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
    toast.success('Imagen descargada');
  };
  
  return (
    <div className="flex flex-col h-full">
      <Toaster position="top-right" />
      
      <div className="flex-1 bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden flex flex-col">
        <div className="p-4 bg-indigo-600 text-white">
          <h2 className="text-xl font-bold">Chat en Tiempo Real con AI</h2>
          <p className="text-sm opacity-80">
            Conversa e interactúa con imágenes en tiempo real
          </p>
        </div>
        
        {/* Área de mensajes */}
        <div className="flex-1 p-4 overflow-y-auto min-h-[50vh] max-h-[calc(100vh-250px)]">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
              <FaImage className="text-5xl mb-4 text-indigo-200" />
              <h3 className="text-xl font-medium mb-2">Bienvenido al Chat Visual</h3>
              <p className="max-w-md">
                Sube una imagen y escribe un mensaje para comenzar a conversar. 
                Puedes solicitar ediciones, variaciones o preguntar acerca de las imágenes.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg shadow p-3 ${
                      message.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-gray-100 dark:bg-gray-800 dark:text-white rounded-bl-none'
                    }`}
                  >
                    {message.text && <p className="mb-2">{message.text}</p>}
                    
                    {message.imageUrl && (
                      <div className="relative mt-2 rounded-lg overflow-hidden">
                        <ImageDisplay 
                          src={message.imageUrl} 
                          alt={`Imagen en mensaje de ${message.role === 'user' ? 'usuario' : 'AI'}`} 
                        />
                        
                        {message.role === 'model' && (
                          <button
                            onClick={() => handleDownloadImage(message.imageUrl!)}
                            className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-lg hover:bg-gray-100"
                            aria-label="Descargar imagen"
                          >
                            <FaDownload className="text-indigo-600" />
                          </button>
                        )}
                      </div>
                    )}
                    
                    <div className="text-xs opacity-70 mt-1 text-right">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg max-w-[80%] rounded-bl-none">
                    <div className="flex items-center space-x-2">
                      <RiLoaderLine className="animate-spin text-indigo-500" />
                      <span className="text-gray-500 dark:text-gray-300">
                        Generando respuesta...
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        
        {/* Área de previsualización de imagen */}
        {selectedImage && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <div className="relative w-24 h-24 rounded-md overflow-hidden">
              <img
                src={selectedImage}
                alt="Imagen seleccionada"
                className="w-full h-full object-cover"
              />
              <button
                onClick={handleRemoveImage}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md"
                aria-label="Eliminar imagen"
              >
                <FaTrash size={12} />
              </button>
            </div>
          </div>
        )}
        
        {/* Área de entrada */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-end space-x-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 bg-gray-100 dark:bg-gray-800 text-indigo-600 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              disabled={isLoading}
            >
              <FaUpload />
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
              />
            </button>
            
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Escribe un mensaje o instrucción..."
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-700 dark:text-white p-3 pr-12 resize-none"
                rows={2}
                disabled={isLoading}
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || (!input.trim() && !selectedImage)}
                className={`absolute right-3 bottom-3 p-1.5 rounded-full ${
                  isLoading || (!input.trim() && !selectedImage)
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                <FaPaperPlane className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 