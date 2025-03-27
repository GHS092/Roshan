import React from 'react';

export default function Version() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black text-white p-6">
      <div className="max-w-lg w-full space-y-8 text-center">
        <h1 className="text-3xl font-bold mb-4">Generador de Imágenes con IA</h1>
        <div className="bg-zinc-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-2">Información de versión</h2>
          <div className="space-y-3 mt-4">
            <p><span className="font-bold">Versión:</span> 1.1.0</p>
            <p><span className="font-bold">Fecha de actualización:</span> {new Date().toLocaleDateString()}</p>
            <p><span className="font-bold">Engine:</span> Gemini 2.0 Flash</p>
            <p><span className="font-bold">Características:</span></p>
            <ul className="text-left list-disc list-inside">
              <li>Generación de múltiples variaciones de imágenes</li>
              <li>Soporte para máscaras y edición selectiva</li>
              <li>Transferencia de elementos entre imágenes</li>
              <li>Instrucciones en español con traducción optimizada</li>
              <li>Alta calidad de generación con preservación de detalles</li>
            </ul>
          </div>
        </div>
        <div className="mt-8">
          <a 
            href="/"
            className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Volver al inicio
          </a>
        </div>
      </div>
    </div>
  );
} 