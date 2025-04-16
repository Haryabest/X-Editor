import { setupErrorDecorations, forceUpdateAllDecorations } from './register-errors';

// Экспортируем функции для использования в других модулях
export { setupErrorDecorations, forceUpdateAllDecorations };

// Добавляем типы для window
declare global {
  interface Window {
    setupErrorDecorations?: (editor: any) => void;
    forceUpdateAllDecorations?: () => void;
  }
}

// Регистрируем функции в глобальной области видимости
if (typeof window !== 'undefined') {
  window.setupErrorDecorations = setupErrorDecorations;
  window.forceUpdateAllDecorations = forceUpdateAllDecorations;
  console.log('✅ Зарегистрированы функции обработки ошибок в редакторе');
} 