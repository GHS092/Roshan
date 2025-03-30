'use client';

import React, { useState, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { FaQuestionCircle, FaUpload, FaTrash } from 'react-icons/fa';
import { Slider } from './Slider';

// Tipos para los ajustes avanzados
export type AdvancedSettingsValues = {
  estiloFotografico: string;
  texturaPiel: string;
  iluminacion: string;
  postProcesado: string;
  nivelDetalle: number;
  saturacionColor: number;
  profundidadSombras: number;
  nitidezDetalles: number;
  imagenReferencia: string | null;
  rostroPersistente: boolean;
  imagenesRostro: string[];
};

export type AdvancedSettingsProps = {
  values: AdvancedSettingsValues;
  onChange: (newValues: Partial<AdvancedSettingsValues>) => void;
};

// Opciones para los selectores
const ESTILOS_FOTOGRAFICOS = [
  { id: 'digital', nombre: 'Fotografía Digital' },
  { id: 'analogica', nombre: 'Fotografía Analógica' },
  { id: 'retrato', nombre: 'Retrato de Estudio' },
  { id: 'editorial', nombre: 'Editorial/Revista' },
  { id: 'documentalista', nombre: 'Documentalista' },
  { id: 'cine', nombre: 'Cinematográfica' },
];

const TEXTURAS_PIEL = [
  { id: 'alta', nombre: 'Alta Definición (Poros Visibles)' },
  { id: 'media', nombre: 'Media Definición (Equilibrada)' },
  { id: 'baja', nombre: 'Baja Definición (Suavizada)' },
  { id: 'natural', nombre: 'Natural (Sin Retoques)' },
];

const TIPOS_ILUMINACION = [
  { id: 'natural', nombre: 'Natural (Luz de Día)' },
  { id: 'estudio', nombre: 'Estudio Profesional' },
  { id: 'ambiente', nombre: 'Ambiental (Interior)' },
  { id: 'dramatica', nombre: 'Dramática (Alto Contraste)' },
  { id: 'cinematica', nombre: 'Cinematográfica' },
  { id: 'exterior', nombre: 'Exterior Natural' },
];

const TIPOS_POSTPROCESADO = [
  { id: 'ninguno', nombre: 'Ninguno (Imagen Cruda)' },
  { id: 'minimo', nombre: 'Mínimo (Ajustes Básicos)' },
  { id: 'moderado', nombre: 'Moderado (Profesional)' },
  { id: 'alto', nombre: 'Alto (Estilo Revista)' },
  { id: 'artistico', nombre: 'Artístico (Creativo)' },
];

export default function AdvancedSettings({ values, onChange }: AdvancedSettingsProps) {
  const [tooltips, setTooltips] = useState({
    estiloFotografico: false,
    texturaPiel: false,
    iluminacion: false,
    postProcesado: false,
    nivelDetalle: false,
    saturacionColor: false,
    profundidadSombras: false,
    nitidezDetalles: false,
    imagenReferencia: false,
    rostroPersistente: false,
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rostroInputRef = useRef<HTMLInputElement>(null);
  
  const toggleTooltip = (tooltip: keyof typeof tooltips) => {
    setTooltips({ ...tooltips, [tooltip]: !tooltips[tooltip] });
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Verificar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar los 5MB');
      return;
    }
    
    // Verificar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toast.error('El archivo debe ser una imagen');
      return;
    }
    
    try {
      // Usar la misma función de conversión para asegurar formato compatible
      const compatibleImage = await convertToCompatibleFormat(file);
      
      onChange({ imagenReferencia: compatibleImage });
      toast.success('Imagen de referencia convertida y cargada');
    } catch (error) {
      console.error('Error al convertir imagen de referencia:', error);
      toast.error('Error al procesar la imagen. Intenta con otra imagen.');
    }
  };
  
  const handleRemoveReference = () => {
    onChange({ imagenReferencia: null });
    // Limpiar el input file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast.success('Imagen de referencia eliminada');
  };
  
  // Función para convertir imagen a formato compatible con Gemini
  const convertToCompatibleFormat = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Crear un objeto URL para la imagen
      const url = URL.createObjectURL(file);
      const img = new Image();
      
      img.onload = () => {
        // Crear un canvas para convertir la imagen
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Dibujar la imagen en el canvas
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('No se pudo crear el contexto del canvas'));
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        
        // Convertir a JPEG (formato compatible con Gemini)
        try {
          const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
          URL.revokeObjectURL(url);
          resolve(jpegDataUrl);
        } catch (error) {
          URL.revokeObjectURL(url);
          reject(error);
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Error al cargar la imagen'));
      };
      
      img.src = url;
    });
  };

  const handleRostroImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Limitar a máximo 6 imágenes
    if (values.imagenesRostro.length + files.length > 6) {
      toast.error('Máximo 6 imágenes de rostro permitidas');
      return;
    }
    
    // Convertir FileList a Array para poder iterarlo
    Array.from(files).forEach(async (file) => {
      // Verificar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`La imagen ${file.name} supera los 5MB`);
        return;
      }
      
      // Verificar tipo de archivo
      if (!file.type.startsWith('image/')) {
        toast.error(`El archivo ${file.name} debe ser una imagen`);
        return;
      }
      
      try {
        // Convertir a formato compatible (JPEG) independientemente del formato original
        const compatibleImage = await convertToCompatibleFormat(file);
        
        onChange({ 
          imagenesRostro: [...values.imagenesRostro, compatibleImage],
          rostroPersistente: true
        });
        
        toast.success(`Imagen de rostro ${values.imagenesRostro.length + 1} convertida y cargada`);
      } catch (error) {
        console.error('Error al convertir imagen:', error);
        toast.error(`Error al procesar ${file.name}. Intenta con otra imagen.`);
      }
    });
  };
  
  const handleRemoveRostroImage = (index: number) => {
    const newImagenes = [...values.imagenesRostro];
    newImagenes.splice(index, 1);
    onChange({ 
      imagenesRostro: newImagenes,
      rostroPersistente: newImagenes.length > 0
    });
    toast.success('Imagen de rostro eliminada');
  };
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Selector de Estilo Fotográfico */}
        <div className="relative">
          <div className="flex items-center mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Estilo Fotográfico
            </label>
            <button 
              className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              onClick={() => toggleTooltip('estiloFotografico')}
              aria-label="Más información sobre estilos fotográficos"
            >
              <FaQuestionCircle size={14} />
            </button>
          </div>
          {tooltips.estiloFotografico && (
            <div className="absolute z-10 p-2 bg-white dark:bg-gray-700 rounded shadow-lg text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 max-w-xs">
              Define el estilo general de la fotografía, afectando colores, contraste y acabado.
            </div>
          )}
          <select
            value={values.estiloFotografico}
            onChange={(e) => onChange({ estiloFotografico: e.target.value })}
            className="w-full px-3 py-2 text-gray-700 dark:text-white bg-white dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
          >
            {ESTILOS_FOTOGRAFICOS.map(estilo => (
              <option key={estilo.id} value={estilo.id}>
                {estilo.nombre}
              </option>
            ))}
          </select>
        </div>
        
        {/* Selector de Textura de Piel */}
        <div className="relative">
          <div className="flex items-center mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Textura de Piel
            </label>
            <button 
              className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              onClick={() => toggleTooltip('texturaPiel')}
              aria-label="Más información sobre texturas de piel"
            >
              <FaQuestionCircle size={14} />
            </button>
          </div>
          {tooltips.texturaPiel && (
            <div className="absolute z-10 p-2 bg-white dark:bg-gray-700 rounded shadow-lg text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 max-w-xs">
              Controla el nivel de detalle en la piel, desde muy detallada con poros visibles hasta suavizada como en revistas.
            </div>
          )}
          <select
            value={values.texturaPiel}
            onChange={(e) => onChange({ texturaPiel: e.target.value })}
            className="w-full px-3 py-2 text-gray-700 dark:text-white bg-white dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
          >
            {TEXTURAS_PIEL.map(textura => (
              <option key={textura.id} value={textura.id}>
                {textura.nombre}
              </option>
            ))}
          </select>
        </div>
        
        {/* Selector de Iluminación */}
        <div className="relative">
          <div className="flex items-center mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Iluminación
            </label>
            <button 
              className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              onClick={() => toggleTooltip('iluminacion')}
              aria-label="Más información sobre iluminación"
            >
              <FaQuestionCircle size={14} />
            </button>
          </div>
          {tooltips.iluminacion && (
            <div className="absolute z-10 p-2 bg-white dark:bg-gray-700 rounded shadow-lg text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 max-w-xs">
              Define cómo se ilumina la escena, afectando la dirección de la luz, sombras y ambiente general.
            </div>
          )}
          <select
            value={values.iluminacion}
            onChange={(e) => onChange({ iluminacion: e.target.value })}
            className="w-full px-3 py-2 text-gray-700 dark:text-white bg-white dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
          >
            {TIPOS_ILUMINACION.map(iluminacion => (
              <option key={iluminacion.id} value={iluminacion.id}>
                {iluminacion.nombre}
              </option>
            ))}
          </select>
        </div>
        
        {/* Selector de Post-Procesado */}
        <div className="relative">
          <div className="flex items-center mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Post-Procesado
            </label>
            <button 
              className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              onClick={() => toggleTooltip('postProcesado')}
              aria-label="Más información sobre post-procesado"
            >
              <FaQuestionCircle size={14} />
            </button>
          </div>
          {tooltips.postProcesado && (
            <div className="absolute z-10 p-2 bg-white dark:bg-gray-700 rounded shadow-lg text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 max-w-xs">
              Determina el nivel de edición aplicado a la imagen final, desde ninguno hasta artístico creativo.
            </div>
          )}
          <select
            value={values.postProcesado}
            onChange={(e) => onChange({ postProcesado: e.target.value })}
            className="w-full px-3 py-2 text-gray-700 dark:text-white bg-white dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
          >
            {TIPOS_POSTPROCESADO.map(postProcesado => (
              <option key={postProcesado.id} value={postProcesado.id}>
                {postProcesado.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Controles deslizantes para ajustes numéricos */}
      <div className="space-y-4">
        {/* Nivel de Detalle */}
        <div className="relative">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Nivel de Detalle: {(values.nivelDetalle * 100).toFixed(0)}%
              </label>
              <button 
                className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                onClick={() => toggleTooltip('nivelDetalle')}
                aria-label="Más información sobre nivel de detalle"
              >
                <FaQuestionCircle size={14} />
              </button>
            </div>
            <div className="text-xs text-gray-500 flex items-center">
              <span className="mr-8">Menos</span>
              <span>Más</span>
            </div>
          </div>
          {tooltips.nivelDetalle && (
            <div className="absolute z-10 p-2 bg-white dark:bg-gray-700 rounded shadow-lg text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 max-w-xs">
              Controla la cantidad de micro-detalles en toda la imagen, como texturas, patrones y elementos finos.
            </div>
          )}
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={values.nivelDetalle}
            onChange={(value) => onChange({ nivelDetalle: value })}
          />
        </div>
        
        {/* Saturación de Color */}
        <div className="relative">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Saturación de Color: {(values.saturacionColor * 100).toFixed(0)}%
              </label>
              <button 
                className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                onClick={() => toggleTooltip('saturacionColor')}
                aria-label="Más información sobre saturación de color"
              >
                <FaQuestionCircle size={14} />
              </button>
            </div>
            <div className="text-xs text-gray-500 flex items-center">
              <span className="mr-8">Menos</span>
              <span>Más</span>
            </div>
          </div>
          {tooltips.saturacionColor && (
            <div className="absolute z-10 p-2 bg-white dark:bg-gray-700 rounded shadow-lg text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 max-w-xs">
              Ajusta la intensidad de los colores, desde más natural y apagado hasta muy vibrante y saturado.
            </div>
          )}
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={values.saturacionColor}
            onChange={(value) => onChange({ saturacionColor: value })}
          />
        </div>
        
        {/* Profundidad de Sombras */}
        <div className="relative">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Profundidad de Sombras: {(values.profundidadSombras * 100).toFixed(0)}%
              </label>
              <button 
                className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                onClick={() => toggleTooltip('profundidadSombras')}
                aria-label="Más información sobre profundidad de sombras"
              >
                <FaQuestionCircle size={14} />
              </button>
            </div>
            <div className="text-xs text-gray-500 flex items-center">
              <span className="mr-8">Menos</span>
              <span>Más</span>
            </div>
          </div>
          {tooltips.profundidadSombras && (
            <div className="absolute z-10 p-2 bg-white dark:bg-gray-700 rounded shadow-lg text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 max-w-xs">
              Controla qué tan oscuras y definidas son las sombras, afectando la sensación de volumen y profundidad.
            </div>
          )}
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={values.profundidadSombras}
            onChange={(value) => onChange({ profundidadSombras: value })}
          />
        </div>
        
        {/* Nitidez de Detalles */}
        <div className="relative">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Nitidez: {(values.nitidezDetalles * 100).toFixed(0)}%
              </label>
              <button 
                className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                onClick={() => toggleTooltip('nitidezDetalles')}
                aria-label="Más información sobre nitidez"
              >
                <FaQuestionCircle size={14} />
              </button>
            </div>
            <div className="text-xs text-gray-500 flex items-center">
              <span className="mr-8">Suave</span>
              <span>Nítido</span>
            </div>
          </div>
          {tooltips.nitidezDetalles && (
            <div className="absolute z-10 p-2 bg-white dark:bg-gray-700 rounded shadow-lg text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 max-w-xs">
              Ajusta la claridad y definición de los bordes y detalles en la imagen.
            </div>
          )}
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={values.nitidezDetalles}
            onChange={(value) => onChange({ nitidezDetalles: value })}
          />
        </div>
      </div>
      
      {/* Sección de Rostro Persistente */}
      <div className="pt-4 mt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Rostro Persistente (Experimental)
          </label>
          <button 
            className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            onClick={() => toggleTooltip('rostroPersistente')}
            aria-label="Más información sobre rostro persistente"
          >
            <FaQuestionCircle size={14} />
          </button>
        </div>
        
        {tooltips.rostroPersistente && (
          <div className="relative z-10 p-3 mb-4 bg-white dark:bg-gray-700 rounded shadow-lg text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 max-w-lg">
            <p className="mb-2 font-medium">Esta función <strong>experimental</strong> intenta mantener características faciales consistentes en la imagen generada.</p>
            <p className="mb-2">Para resultados óptimos:</p>
            <ul className="list-disc pl-4 mb-2 space-y-1">
              <li>Proporciona 4-6 imágenes de alta calidad del mismo rostro</li>
              <li>Incluye vistas frontal, perfil y ángulos intermedios</li>
              <li>Asegúrate que las fotos tengan buena iluminación y definición</li>
              <li>Evita elementos que obstruyan el rostro como gafas de sol, sombreros o máscaras</li>
              <li>Procura que las imágenes muestren expresiones neutras o similares</li>
              <li>Si es posible, incluye fotos con fondos simples o uniformes</li>
            </ul>
            <p className="mt-2 text-amber-500 dark:text-amber-400 font-medium">Nota: Este sistema aún está en fase experimental. A mayor número y calidad de imágenes de referencia, mejores resultados se obtendrán.</p>
          </div>
        )}
        
        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            id="enableRostroPersistente"
            checked={values.rostroPersistente}
            onChange={(e) => onChange({ rostroPersistente: e.target.checked })}
            className="mr-2 h-4 w-4 text-purple-600 focus:ring-purple-600 border-gray-300 rounded"
          />
          <label htmlFor="enableRostroPersistente" className="text-sm text-gray-700 dark:text-gray-300">
            Activar rostro persistente
          </label>
        </div>
        
        {values.rostroPersistente && (
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800/30">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Sube entre 4-6 fotos de la misma persona desde diferentes ángulos para obtener mejores resultados. 
                Cuantas más fotos de calidad proporciones, mayor precisión tendrá el modelo para preservar el rostro.
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-400">
                <li>Incluye diferentes ángulos: frontal, perfil izquierdo/derecho y 3/4</li>
                <li>Asegúrate que las fotos tengan buena iluminación y el rostro sea claramente visible</li>
                <li>Evita expresiones muy distintas entre fotos</li>
                <li>Si deseas resultados más precisos, utiliza fotos en contextos similares al que deseas generar</li>
              </ul>
            </div>
            
            <div className="flex flex-col items-start space-y-3">
              <input
                ref={rostroInputRef}
                type="file"
                accept="image/*"
                onChange={handleRostroImageUpload}
                className="hidden"
                id="rostroImageInput"
                multiple
              />
              
              <div className="flex flex-wrap gap-3">
                <label
                  htmlFor="rostroImageInput"
                  className={`flex items-center justify-center px-4 py-2 text-gray-700 bg-gray-100 dark:text-white dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none cursor-pointer border border-gray-300 dark:border-gray-600 ${values.imagenesRostro.length >= 6 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <FaUpload className="mr-2" />
                  {values.imagenesRostro.length === 0 ? 'Subir imágenes de rostro' : 'Añadir más imágenes'}
                </label>
                
                {values.imagenesRostro.length > 0 && (
                  <button
                    onClick={() => onChange({ imagenesRostro: [], rostroPersistente: false })}
                    className="flex items-center justify-center px-4 py-2 text-red-700 bg-red-100 dark:text-red-200 dark:bg-red-900/30 rounded-md hover:bg-red-200 dark:hover:bg-red-800/50 focus:outline-none"
                  >
                    <FaTrash className="mr-2" />
                    Eliminar todas
                  </button>
                )}
              </div>
              
              {values.imagenesRostro.length > 0 && (
                <div className="mt-3 w-full">
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                    Imágenes de rostro ({values.imagenesRostro.length}/6):
                  </p>
                  <div className="flex flex-wrap gap-4">
                    {values.imagenesRostro.map((imagen, index) => (
                      <div key={index} className="relative group">
                        <div className="w-24 h-24 rounded-md overflow-hidden border border-gray-300 dark:border-gray-600">
                          <img 
                            src={imagen} 
                            alt={`Rostro ${index + 1}`} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          onClick={() => handleRemoveRostroImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Eliminar imagen de rostro"
                        >
                          <FaTrash size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Imagen de Referencia */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Imagen de Referencia
          </label>
          <button 
            className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            onClick={() => toggleTooltip('imagenReferencia')}
            aria-label="Más información sobre imagen de referencia"
          >
            <FaQuestionCircle size={14} />
          </button>
        </div>
        {tooltips.imagenReferencia && (
          <div className="relative z-10 p-2 mb-2 bg-white dark:bg-gray-700 rounded shadow-lg text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
            Sube una imagen para que el modelo use su estilo como referencia. Útil para lograr un look específico.
          </div>
        )}
        
        <div className="flex flex-col items-start space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            id="referenceImageInput"
          />
          
          <div className="flex flex-wrap gap-3">
            <label
              htmlFor="referenceImageInput"
              className="flex items-center justify-center px-4 py-2 text-gray-700 bg-gray-100 dark:text-white dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none cursor-pointer border border-gray-300 dark:border-gray-600"
            >
              <FaUpload className="mr-2" />
              Subir imagen
            </label>
            
            {values.imagenReferencia && (
              <button
                onClick={handleRemoveReference}
                className="flex items-center justify-center px-4 py-2 text-red-700 bg-red-100 dark:text-red-200 dark:bg-red-900/30 rounded-md hover:bg-red-200 dark:hover:bg-red-800/50 focus:outline-none"
              >
                <FaTrash className="mr-2" />
                Eliminar
              </button>
            )}
          </div>
          
          {values.imagenReferencia && (
            <div className="mt-3 relative w-full max-w-xs border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
              <img 
                src={values.imagenReferencia} 
                alt="Imagen de referencia" 
                className="w-full h-auto object-contain"
                style={{ maxHeight: '150px' }}
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all duration-200"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 