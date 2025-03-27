# Generador de Imágenes con IA

Aplicación web que permite generar y editar imágenes con inteligencia artificial utilizando el modelo Gemini de Google.

## Características

- Generación de múltiples variaciones de imágenes con diferentes niveles de creatividad
- Edición de imágenes mediante máscaras y selección de áreas
- Transferencia de elementos entre imágenes (como logos o partes de una imagen a otra)
- Interfaz amigable y fácil de usar
- Instrucciones en español con traducción automática para el modelo

## Requisitos

- Node.js 18.17.0 o superior
- Cuenta en Google AI Studio para obtener una API Key de Gemini

## Configuración

1. Clona este repositorio:
```bash
git clone <url-del-repositorio>
cd <nombre-del-directorio>
```

2. Instala las dependencias:
```bash
npm install
```

3. Crea un archivo `.env.local` en la raíz del proyecto con el siguiente contenido:
```
NEXT_PUBLIC_GEMINI_API_KEY=tu-api-key-de-gemini
```

4. Ejecuta el servidor de desarrollo:
```bash
npm run dev
```

## Despliegue en Vercel

1. Crea una cuenta en [Vercel](https://vercel.com) si aún no tienes una.

2. Importa tu repositorio de GitHub, GitLab o Bitbucket en Vercel.

3. En la configuración del proyecto, añade la variable de entorno:
   - `NEXT_PUBLIC_GEMINI_API_KEY`: Tu API key de Gemini

4. Haz clic en "Deploy" y espera a que el proceso de despliegue termine.

5. Una vez completado, podrás acceder a tu aplicación a través de la URL proporcionada por Vercel.

## Uso

1. Sube una imagen o varias imágenes a la aplicación.
2. Opcionalmente, utiliza la herramienta de máscara para seleccionar áreas específicas.
3. Escribe un prompt describiendo qué cambios deseas realizar en la imagen.
4. Haz clic en "Generar" y espera a que el modelo procese tu solicitud.
5. Explora las diferentes variaciones generadas y elige la que más te guste.
6. Descarga la imagen resultante o realiza más ediciones según sea necesario.

## Tecnologías utilizadas

- Next.js
- React
- TypeScript
- Tailwind CSS
- Gemini API de Google

## Limitaciones

- El modelo Gemini tiene restricciones en cuanto al tipo de contenido que puede generar.
- Algunas operaciones complejas pueden requerir múltiples intentos para obtener resultados óptimos.
- La calidad de los resultados depende de la claridad del prompt y la calidad de las imágenes originales.

## Licencia

Este proyecto está licenciado bajo la licencia MIT. Ver el archivo LICENSE para más detalles.
