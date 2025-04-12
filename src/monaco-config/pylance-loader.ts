/**
 * Загрузчик Pylance для Monaco Editor
 * 
 * Этот модуль отвечает за загрузку Pylance из CDN и инициализацию его для работы с Monaco Editor
 */

// Интерфейс для Pylance API
export interface PylanceAPI {
  provideCompletionItems: (model: any, position: any) => Promise<any>;
  provideHover: (model: any, position: any) => Promise<any>;
  provideDefinition: (model: any, position: any) => Promise<any>;
  onDiagnostics: (callback: (uri: string, diagnostics: any[]) => void) => void;
  dispose: () => void;
}

// URL для загрузки Pylance
const PYLANCE_CDN_URL = 'https://cdn.jsdelivr.net/npm/vscode-pylance@latest/dist/bundled/web/main.js';

/**
 * Загружает Pylance из CDN и подготавливает его для работы с Monaco
 * @returns Promise с API для Pylance
 */
export async function loadPylanceFromCDN(): Promise<PylanceAPI | null> {
  try {
    console.log('Загружаем Pylance из CDN...');
    
    // Загружаем скрипт через Promise
    const pylanceLoaded = await new Promise<boolean>((resolve, reject) => {
      // Проверяем, не загружен ли уже
      if ((window as any).pylanceAPI) {
        console.log('Pylance уже загружен');
        resolve(true);
        return;
      }
      
      // Создаем элемент скрипта
      const script = document.createElement('script');
      script.src = PYLANCE_CDN_URL;
      script.async = true;
      
      // Обработчики событий
      script.onload = () => {
        console.log('Pylance успешно загружен из CDN');
        resolve(true);
      };
      
      script.onerror = (error) => {
        console.error('Ошибка при загрузке Pylance из CDN:', error);
        reject(new Error('Не удалось загрузить Pylance'));
      };
      
      // Добавляем скрипт на страницу
      document.head.appendChild(script);
    });
    
    if (!pylanceLoaded) {
      console.warn('Не удалось загрузить Pylance');
      return null;
    }
    
    // Инициализируем Pylance
    if (!(window as any).pylance) {
      console.warn('Pylance загружен, но API недоступен');
      return null;
    }
    
    // Создаем адаптер для Monaco
    return createPylanceAdapter();
  } catch (error) {
    console.error('Ошибка при загрузке Pylance:', error);
    return null;
  }
}

/**
 * Создает адаптер для взаимодействия с Pylance
 */
function createPylanceAdapter(): PylanceAPI {
  const pylance = (window as any).pylance;
  
  let diagnosticsCallback: ((uri: string, diagnostics: any[]) => void) | null = null;
  
  // Регистрируем обработчик диагностики
  pylance.onDiagnostics = (uri: string, diagnostics: any[]) => {
    console.log(`Получены диагностики от Pylance для ${uri}:`, diagnostics.length);
    if (diagnosticsCallback) {
      diagnosticsCallback(uri, diagnostics);
    }
  };
  
  // Создаем API для взаимодействия
  return {
    provideCompletionItems: async (model: any, position: any) => {
      try {
        return await pylance.provideCompletionItems(model, position);
      } catch (error) {
        console.error('Ошибка при получении автодополнений от Pylance:', error);
        return { suggestions: [] };
      }
    },
    
    provideHover: async (model: any, position: any) => {
      try {
        return await pylance.provideHover(model, position);
      } catch (error) {
        console.error('Ошибка при получении hover от Pylance:', error);
        return null;
      }
    },
    
    provideDefinition: async (model: any, position: any) => {
      try {
        return await pylance.provideDefinition(model, position);
      } catch (error) {
        console.error('Ошибка при получении определения от Pylance:', error);
        return null;
      }
    },
    
    onDiagnostics: (callback: (uri: string, diagnostics: any[]) => void) => {
      diagnosticsCallback = callback;
    },
    
    dispose: () => {
      try {
        if (pylance && pylance.dispose) {
          pylance.dispose();
        }
      } catch (error) {
        console.error('Ошибка при освобождении ресурсов Pylance:', error);
      }
    }
  };
} 