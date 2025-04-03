/**
 * Преобразует числовой код ошибки в строковый для совместимости с IMarkerData
 * @param marker Исходный маркер
 * @returns Исправленный маркер с кодом в виде строки
 */
export function fixMarkerCode(marker: any): any {
  if (marker === null || typeof marker !== 'object') {
    return marker;
  }
  
  // Преобразуем числовой код в строку, если он существует
  if (marker.code !== undefined && typeof marker.code === 'number') {
    return {
      ...marker,
      code: marker.code.toString()
    };
  }

  return marker;
}

/**
 * Исправляет массив маркеров, преобразуя числовые коды в строки
 * @param markers Массив маркеров
 * @returns Исправленный массив маркеров
 */
export function fixMarkers(markers: any[]): any[] {
  if (!Array.isArray(markers)) {
    return markers;
  }
  
  return markers.map(fixMarkerCode);
}

/**
 * Безопасно устанавливает маркеры в модель, предварительно исправляя коды ошибок
 * @param monaco Экземпляр Monaco Editor
 * @param model Модель Monaco
 * @param owner Владелец маркеров
 * @param markers Массив маркеров
 */
export function safeSetModelMarkers(monaco: any, model: any, owner: string, markers: any[]): void {
  if (!monaco || !model || !monaco.editor || typeof monaco.editor.setModelMarkers !== 'function') {
    console.error('Monaco editor не инициализирован или не содержит метод setModelMarkers');
    return;
  }
  
  try {
    monaco.editor.setModelMarkers(model, owner, fixMarkers(markers));
  } catch (error) {
    console.error('Ошибка при установке маркеров:', error);
  }
} 