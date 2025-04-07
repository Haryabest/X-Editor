// Импортируем функцию для определения языка из правильного модуля
import { correctLanguageFromExtension } from './monaco-advanced-config';

// Функция для инициализации редактора
export function initializeEditor(filePath: string, editor: any) {
  // Определяем язык на основе расширения файла
  if (filePath) {
    try {
      // Вызываем функцию с обновленными параметрами
      correctLanguageFromExtension(filePath, editor);
    } catch (error) {
      console.error('Ошибка при определении языка файла:', error);
    }
  }
} 