'use client';

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Image as KonvaImage, Line } from 'react-konva';
import Konva from 'konva';

interface KonvaComponentsProps {
  image: HTMLImageElement | null;
  lines: { points: number[]; brushSize: number }[];
  isErasing: boolean;
  actualWidth: number;
  actualHeight: number;
  onMouseDown: (pos: { x: number; y: number }) => void;
  onMouseMove: (pos: { x: number; y: number }) => void;
  onMouseUp: () => void;
  onMaskChange?: (maskData: string) => void;
}

const KonvaComponents: React.FC<KonvaComponentsProps> = ({
  image,
  lines,
  isErasing,
  actualWidth,
  actualHeight,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMaskChange,
}) => {
  const stageRef = useRef<Konva.Stage>(null);
  const isPaintingRef = useRef(false);
  // Usar ref para llevar registro de la última lista de líneas procesada
  const lastLinesRef = useRef<number>(0);
  // Ref para controlar si estamos generando una máscara
  const isGeneratingMaskRef = useRef(false);
  // Timestamp de la última generación de máscara
  const lastMaskGenTimeRef = useRef(0);

  // Memorizar la función generadora de máscara para evitar recreaciones
  const generateMask = useCallback(() => {
    const now = Date.now();
    // Evitar generaciones de máscara demasiado frecuentes o si estamos ya generando
    if (!stageRef.current || !onMaskChange || isGeneratingMaskRef.current || now - lastMaskGenTimeRef.current < 200) {
      return;
    }
    
    // Solo generar la máscara si hay líneas
    if (lines.length > 0) {
      isGeneratingMaskRef.current = true;
      lastMaskGenTimeRef.current = now;
      
      // Usar requestAnimationFrame para asegurar que se genera la máscara en el momento adecuado
      requestAnimationFrame(() => {
        if (stageRef.current) {
          try {
            // Primero creamos una copia del escenario con calidad mejorada
            const stage = stageRef.current;
            
            // Crear un canvas temporal para mejorar la máscara
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = stage.width() * 2; // Doble resolución para mayor calidad
            tempCanvas.height = stage.height() * 2;
            
            // Obtener el contexto y establecer configuración para mayor calidad
            const tempContext = tempCanvas.getContext('2d');
            if (!tempContext) {
              throw new Error('No se pudo obtener el contexto del canvas');
            }
            
            // Dibujar el escenario en el canvas temporal con mayor calidad
            const dataURL = stage.toDataURL({
              pixelRatio: 2, // Mayor resolución
              mimeType: 'image/png',
              quality: 1
            });
            
            // Cargar la imagen en el canvas temporal
            const img: HTMLImageElement = new window.Image();
            img.onload = () => {
              // Dibujar la imagen en el canvas temporal
              tempContext.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
              
              // Procesar el canvas para mejorar el contraste de las máscaras rojas
              const imageData = tempContext.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
              const data = imageData.data;
              const width = tempCanvas.width;
              const height = tempCanvas.height;
              
              // Primero identificamos los píxeles rojos según nuestro criterio
              const isRed = new Array(data.length / 4).fill(false);
              
              // Mejorar el contraste de las áreas rojas
              for (let i = 0; i < data.length; i += 4) {
                // Si es un píxel rojizo (R alto, G y B bajos)
                // Hacemos la detección más precisa para evitar falsos positivos
                if (data[i] > 180 && data[i+1] < 80 && data[i+2] < 80 && 
                    data[i] > data[i+1] * 2 && data[i] > data[i+2] * 2) {
                  
                  // Marcar como rojo
                  isRed[i/4] = true;
                }
                // Para el resto de píxeles, los hacemos más blancos en lugar de aumentar todos los colores
                else if (data[i+3] > 0) { // Si no es un píxel transparente
                  // Hacer más blanco en lugar de solo más claro
                  data[i] = Math.min(255, data[i] + 50);     // R
                  data[i+1] = Math.min(255, data[i+1] + 50); // G
                  data[i+2] = Math.min(255, data[i+2] + 50); // B
                }
              }
              
              // Eliminar píxeles rojos aislados (ruido)
              for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                  const idx = y * width + x;
                  
                  if (isRed[idx]) {
                    // Contar cuántos vecinos son rojos
                    let redNeighbors = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                      for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue; // Saltar el píxel actual
                        const neighborIdx = (y + dy) * width + (x + dx);
                        if (isRed[neighborIdx]) redNeighbors++;
                      }
                    }
                    
                    // Si tiene menos de 2 vecinos rojos, es un píxel aislado y lo eliminamos
                    if (redNeighbors < 2) {
                      const i = idx * 4;
                      isRed[idx] = false;
                      data[i] = Math.min(255, data[i] + 50);     // Hacerlo más blanco
                      data[i+1] = Math.min(255, data[i+1] + 50);
                      data[i+2] = Math.min(255, data[i+2] + 50);
                    }
                  }
                }
              }
              
              // Antes de aplicar el rojo intenso, vamos a verificar que no estemos afectando 
              // áreas de color similares que deberían preservarse
              for (let i = 0; i < data.length; i += 4) {
                if (isRed[i/4]) {
                  // Verificar si podría tratarse de colores naturales que queremos preservar
                  // como tonos de piel, colores de animales, etc.
                  const pixelIndex = i / 4;
                  const x = pixelIndex % width;
                  const y = Math.floor(pixelIndex / width);
                  
                  // Detectar si este píxel es parte de un trazo definido por el usuario
                  // o si podría ser un falso positivo
                  let isPartOfStroke = false;
                  
                  // Comprobar si hay trazos cercanos (verificar vecinos en área más amplia)
                  let redNeighborsCount = 0;
                  const checkRadius = 5; // Radio de verificación más amplio
                  
                  for (let dy = -checkRadius; dy <= checkRadius; dy++) {
                    for (let dx = -checkRadius; dx <= checkRadius; dx++) {
                      if (dx === 0 && dy === 0) continue;
                      
                      const nx = x + dx;
                      const ny = y + dy;
                      
                      // Verificar límites
                      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const neighborIdx = ny * width + nx;
                        if (isRed[neighborIdx]) {
                          redNeighborsCount++;
                        }
                      }
                    }
                  }
                  
                  // Si tiene suficientes vecinos rojos, es parte de un trazo
                  isPartOfStroke = redNeighborsCount >= 10;
                  
                  // Solo aplicamos el rojo si estamos seguros de que es parte de un trazo
                  if (isPartOfStroke) {
                    data[i] = 255;      // R - Rojo máximo
                    data[i+1] = 0;      // G - Verde eliminado
                    data[i+2] = 0;      // B - Azul eliminado
                    data[i+3] = 255;    // Alpha máximo
                  } else {
                    // Si no estamos seguros, lo descartamos como falso positivo
                    isRed[i/4] = false;
                    // Restaurar a un color más neutral para evitar afectar la imagen
                    data[i] = Math.min(255, data[i] + 50);
                    data[i+1] = Math.min(255, data[i+1] + 50);
                    data[i+2] = Math.min(255, data[i+2] + 50);
                  }
                }
              }
              
              // Aplicar los cambios al canvas
              tempContext.putImageData(imageData, 0, 0);
              
              // Convertir el canvas mejorado a data URL
              const enhancedDataURL = tempCanvas.toDataURL('image/png', 1.0);
              
              // Notificar el cambio de máscara a través del callback
              if (onMaskChange) {
                onMaskChange(enhancedDataURL);
              }
              
              // Liberar la bandera después de un retraso
              setTimeout(() => {
                isGeneratingMaskRef.current = false;
              }, 100);
            };
            
            img.onerror = () => {
              console.error('Error al cargar la imagen en el canvas temporal');
              isGeneratingMaskRef.current = false;
            };
            
            img.src = dataURL;
          } catch (error) {
            console.error('Error al generar la máscara:', error);
            isGeneratingMaskRef.current = false;
          }
        } else {
          isGeneratingMaskRef.current = false;
        }
      });
    }
  }, [onMaskChange, lines]);

  // Actualizar máscara cuando cambian las líneas, pero evitando llamadas repetidas
  useEffect(() => {
    // Solo procesar si la cantidad de líneas cambió para evitar bucles
    if (lines.length !== lastLinesRef.current) {
      lastLinesRef.current = lines.length;
      
      // Solo ejecutar si hay líneas
      if (lines.length > 0) {
        // Usar un retraso para evitar múltiples actualizaciones seguidas
        const timeoutId = setTimeout(() => {
          generateMask();
        }, 300);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [lines, generateMask]);

  // Crear manejadores de eventos de forma memoizada para evitar recreaciones
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    e.evt.preventDefault();
    isPaintingRef.current = true;
    const pos = e.target.getStage()?.getPointerPosition();
    if (pos) {
      onMouseDown({ x: pos.x, y: pos.y });
    }
  }, [onMouseDown]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    e.evt.preventDefault();
    // Solo procesar el movimiento si estamos pintando
    if (!isPaintingRef.current) return;
    
    const stage = e.target.getStage();
    if (!stage) return;
    
    const point = stage.getPointerPosition();
    if (point) {
      onMouseMove({ x: point.x, y: point.y });
    }
  }, [onMouseMove]);

  // Cuando el usuario termina de dibujar
  const handleMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    e.evt.preventDefault();
    isPaintingRef.current = false;
    onMouseUp();
  }, [onMouseUp]);

  // Renderizar líneas de forma memoizada para evitar re-renderizados innecesarios
  const linesLayer = useMemo(() => (
    <Layer>
      {lines.map((line, i) => (
        <Line
          key={`line-${i}-${line.points.length}`}
          points={line.points}
          stroke={isErasing ? 'rgba(255,255,255,0.9)' : 'rgba(255,0,0,0.9)'} // Rojo más intenso
          strokeWidth={line.brushSize}
          tension={0.5}
          lineCap="round"
          lineJoin="round"
          globalCompositeOperation={
            isErasing ? 'destination-out' : 'source-over'
          }
        />
      ))}
    </Layer>
  ), [lines, isErasing]);

  // Efecto para generar máscara al terminar de dibujar una línea
  useEffect(() => {
    if (!isPaintingRef.current && lines.length > 0) {
      // Generar máscara después de un breve retraso
      const timeoutId = setTimeout(generateMask, 200);
      return () => clearTimeout(timeoutId);
    }
  }, [isPaintingRef.current, lines, generateMask]);

  return (
    <div className="konva-container" style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <Stage
        width={actualWidth}
        height={actualHeight}
        onMouseDown={handleMouseDown}
        onMousemove={handleMouseMove}
        onMouseup={handleMouseUp}
        onTouchstart={handleMouseDown}
        onTouchmove={handleMouseMove}
        onTouchend={handleMouseUp}
        ref={stageRef}
        className="border rounded-lg overflow-hidden shadow-md mx-auto"
        style={{ display: 'block', maxWidth: '100%', objectFit: 'contain' }}
      >
        <Layer>
          {image && (
            <KonvaImage
              image={image}
              width={actualWidth}
              height={actualHeight}
              x={0}
              y={0}
            />
          )}
        </Layer>
        {linesLayer}
      </Stage>
    </div>
  );
};

export default React.memo(KonvaComponents); 