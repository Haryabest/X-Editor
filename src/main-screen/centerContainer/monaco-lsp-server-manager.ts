/**
 * Monaco LSP Server Manager
 * 
 * Управление языковыми серверами LSP, запуск их через WebSocket или Worker
 */

// @ts-nocheck
import { invoke } from '@tauri-apps/api/core';

// Тип для хранения состояния сервера
interface LanguageServerState {
  id: string;
  name: string;
  running: boolean;
  pid?: number;
  port?: number;
  serverPath: string;
  startTime?: Date;
  connectionUrl?: string;
}

// Интерфейс для WebSocket соединения с сервером
interface LSPWebSocketConnection {
  socket: WebSocket;
  isConnected: boolean;
  messageQueue: string[];
  nextRequestId: number;
  pendingRequests: Map<string, { resolve: (value: any) => void; reject: (reason: any) => void }>;
}

/**
 * Интерфейс для языкового сервера
 */
export interface LanguageServer {
  id: string;
  name: string;
  command?: string;
  args?: string[];
  url?: string;
  supportedLanguages: string[];
}

/**
 * Класс для управления языковыми серверами
 */
class LanguageServerManager {
  private servers: Map<string, LanguageServer> = new Map();
  private connections: Map<string, any> = new Map();
  private isNative: boolean = false;
  private isInitialized: boolean = false;
  
  constructor() {
    // Проверяем, запущено ли приложение в нативном режиме (Tauri)
    this.isNative = typeof window !== 'undefined' && 
                   typeof window.__TAURI__ !== 'undefined';
    
    console.log(`LSP Server Manager создан, режим: ${this.isNative ? 'нативный' : 'браузер'}`);
  }
  
  /**
   * Инициализация менеджера серверов
   */
  public initialize(): void {
    if (this.isInitialized) {
      console.log('LanguageServerManager уже был инициализирован');
      return;
    }
    
    // Регистрируем предопределенные серверы
    this.registerServer({
      id: 'typescript',
      name: 'TypeScript Language Server',
      supportedLanguages: ['typescript', 'javascript', 'typescriptreact', 'javascriptreact']
    });

    this.registerServer({
      id: 'html',
      name: 'HTML Language Server',
      supportedLanguages: ['html']
    });

    this.registerServer({
      id: 'css',
      name: 'CSS Language Server',
      supportedLanguages: ['css', 'scss', 'less']
    });

    this.registerServer({
      id: 'json',
      name: 'JSON Language Server',
      supportedLanguages: ['json']
    });
    
    this.isInitialized = true;
    console.log('LanguageServerManager инициализирован');
  }
  
  /**
   * Регистрация сервера
   */
  public registerServer(server: LanguageServer): void {
    this.servers.set(server.id, server);
    console.log(`Зарегистрирован языковой сервер: ${server.name}`);
    
    // Автоматически запускаем сервер при регистрации для демонстрационных целей
    this.startServer(server.id).catch(err => {
      console.warn(`Не удалось автозапустить сервер ${server.id}:`, err);
    });
  }
  
  /**
   * Запуск сервера
   */
  public async startServer(serverId: string): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (!server) {
      console.error(`Неизвестный языковой сервер: ${serverId}`);
      return false;
    }
    
    try {
      console.log(`Имитация запуска сервера ${server.name}...`);
      
      // В реальном приложении здесь был бы код для запуска сервера
      
      // Создаем заглушку для соединения
      this.connections.set(serverId, {
        isConnected: true,
        capabilities: {
          completionProvider: { triggerCharacters: ['.', ':', '<', '"', '=', '/', '@'] },
          hoverProvider: true,
          definitionProvider: true
        }
      });
      
      console.log(`Сервер ${server.name} успешно запущен`);
      return true;
    } catch (error) {
      console.error(`Ошибка при запуске сервера ${server.name}:`, error);
      return false;
    }
  }
  
  /**
   * Остановка сервера
   */
  public async stopServer(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (connection) {
      this.connections.delete(serverId);
      console.log(`Сервер ${serverId} остановлен`);
    }
  }
  
  /**
   * Установка корневой директории для всех серверов
   */
  public setWorkspaceRoot(rootPath: string): void {
    console.log(`Установка корневой директории для LSP серверов: ${rootPath}`);
    // В реальном приложении здесь был бы код для установки корневой директории
  }
  
  /**
   * Отправка запроса серверу
   */
  public async sendRequest(serverId: string, method: string, params: any): Promise<any> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      console.error(`Нет соединения с сервером ${serverId}`);
      return null;
    }
    
    try {
      // Логируем запрос для отладки
      console.log(`Отправка запроса к серверу ${serverId}: ${method}`);
      
      // Эмулируем ответы на основе метода запроса
      switch (method) {
        case 'textDocument/completion':
          return this.mockCompletionResponse(params);
        case 'textDocument/hover':
          return this.mockHoverResponse(params);
        case 'textDocument/definition':
          return this.mockDefinitionResponse(params);
        default:
          console.log(`Метод ${method} не реализован в заглушке`);
          return null;
      }
    } catch (error) {
      console.error(`Ошибка при отправке запроса ${method} к серверу ${serverId}:`, error);
      return null;
    }
  }
  
  /**
   * Отправка уведомления серверу
   * @param serverId ID сервера
   * @param method Метод уведомления
   * @param params Параметры уведомления
   */
  public sendNotification(serverId: string, method: string, params: any): void {
    const connection = this.connections.get(serverId);
    if (!connection) {
      console.error(`Нет соединения с сервером ${serverId} для отправки уведомления`);
      return;
    }
    
    try {
      // Логируем уведомление для отладки
      console.log(`Отправка уведомления к серверу ${serverId}: ${method}`, params);
      
      // В реальном приложении здесь был бы код для отправки уведомления через WebSocket
      // В заглушке просто логируем информацию
      switch (method) {
        case 'textDocument/didOpen':
          console.log(`Уведомление об открытии документа: ${params.textDocument?.uri}`);
          break;
        case 'textDocument/didChange':
          console.log(`Уведомление об изменении документа: ${params.textDocument?.uri}`);
          break;
        case 'textDocument/didClose':
          console.log(`Уведомление о закрытии документа: ${params.textDocument?.uri}`);
          break;
        default:
          console.log(`Получено уведомление ${method}`);
      }
    } catch (error) {
      console.error(`Ошибка при отправке уведомления ${method} к серверу ${serverId}:`, error);
    }
  }
  
  /**
   * Заглушка для ответа на запрос автодополнения
   */
  private mockCompletionResponse(params: any): any {
    console.log('Создание заглушки для автодополнения');
    
    // Фиксированный набор автодополнений для демонстрации
    return {
      isIncomplete: false,
      items: [
        {
          label: 'console',
          kind: 6, // Variable
          detail: 'console object',
          documentation: 'The console object provides access to the browser\'s debugging console.'
        },
        {
          label: 'log',
          kind: 2, // Method
          detail: 'console.log method',
          documentation: 'Outputs a message to the web console.'
        },
        {
          label: 'document',
          kind: 6, // Variable
          detail: 'document object',
          documentation: 'The Document interface represents any web page loaded in the browser.'
        }
      ]
    };
  }
  
  /**
   * Заглушка для ответа на запрос hover
   */
  private mockHoverResponse(params: any): any {
    console.log('Генерация информации для hover');
    
    try {
      // Извлекаем URI и позицию из параметров
      const uri = params.textDocument?.uri || '';
      const position = params.position || { line: 0, character: 0 };
      
      // Получаем дополнительный контекст из запроса
      const context = params.context || {};
      const word = context.word || this.extractWordFromUri(uri, position); 
      const lineText = context.lineText || '';
      
      // Пытаемся определить тип файла из URI
      const fileType = this.getFileTypeFromUri(uri);
      
      // Используем контекст для определения более точной информации
      const hoverInfo = this.generateHoverContentWithContext(fileType, word, lineText, position);
      
      console.log(`Hover для "${word}" в файле типа ${fileType}`);
      
      return hoverInfo;
    } catch (error) {
      console.error('Ошибка при создании ответа hover:', error);
      return {
        contents: {
          kind: 'markdown',
          value: 'Ошибка при получении информации.'
        }
      };
    }
  }
  
  /**
   * Генерация содержимого подсказки hover с учетом контекста
   */
  private generateHoverContentWithContext(fileType: string, word: string, lineText: string, position: any): any {
    // Определяем специфические конструкции на основе контекста строки
    let specialType = this.detectSpecialTypeFromContext(word, lineText);
    
    // Типичные TypeScript/JavaScript сущности
    const tsJsInfo: Record<string, string> = {
      'import': '### import\nЗагружает модули или его части.\n```typescript\nimport { Component } from \'module\';\n```',
      'export': '### export\nЭкспортирует функции, объекты или значения для использования в других модулях.\n```typescript\nexport const myVar = 123;\n```',
      'const': '### const\nОбъявляет константу, доступную только для чтения.\n```typescript\nconst MAX_SIZE = 100;\n```',
      'let': '### let\nОбъявляет переменную с блочной областью видимости.\n```typescript\nlet counter = 0;\n```',
      'function': '### function\nОбъявляет функцию.\n```typescript\nfunction add(a: number, b: number): number {\n  return a + b;\n}\n```',
      'interface': '### interface\nОпределяет структуру объекта.\n```typescript\ninterface User {\n  id: number;\n  name: string;\n}\n```',
      'type': '### type\nСоздает псевдоним типа или определяет составной тип.\n```typescript\ntype ID = string | number;\n```',
      'class': '### class\nОбъявляет класс.\n```typescript\nclass Person {\n  name: string;\n  constructor(name: string) {\n    this.name = name;\n  }\n}\n```',
      'component': '### React Component\nКомпонент в React - это изолированная часть интерфейса.\n```tsx\nfunction Button(props: { label: string }) {\n  return <button>{props.label}</button>;\n}\n```',
      'useState': '### React.useState\nХук для добавления состояния в функциональные компоненты.\n```tsx\nconst [count, setCount] = useState(0);\n```',
      'useEffect': '### React.useEffect\nХук для выполнения побочных эффектов в функциональных компонентах.\n```tsx\nuseEffect(() => {\n  document.title = `Count: ${count}`;\n}, [count]);\n```',
      'App': '### App Component\nКорневой компонент React приложения.\n```tsx\nfunction App() {\n  return <div>Application Content</div>;\n}\n```',
      'props': '### props\nСвойства, передаваемые в React компоненты.\n```tsx\nfunction Greeting(props: { name: string }) {\n  return <h1>Hello, {props.name}!</h1>;\n}\n```',
      'identifier': '### Переменная или функция\nИдентификатор, который может представлять переменную, функцию или другую сущность в коде.\n'
    };
    
    // HTML элементы
    const htmlInfo: Record<string, string> = {
      'div': '### &lt;div&gt;\nОпределяет раздел в HTML документе.\n```html\n<div class="container">Content</div>\n```',
      'span': '### &lt;span&gt;\nОпределяет строчный контейнер для текста или элементов.\n```html\n<span class="highlight">Text</span>\n```',
      'a': '### &lt;a&gt;\nСоздает гиперссылку.\n```html\n<a href="https://example.com">Link</a>\n```',
      'p': '### &lt;p&gt;\nОпределяет параграф.\n```html\n<p>This is a paragraph.</p>\n```',
      'h1': '### &lt;h1&gt;\nЗаголовок первого уровня.\n```html\n<h1>Main heading</h1>\n```',
      'img': '### &lt;img&gt;\nВставляет изображение.\n```html\n<img src="image.jpg" alt="Description">\n```',
      'ul': '### &lt;ul&gt;\nНеупорядоченный список.\n```html\n<ul>\n  <li>Item 1</li>\n  <li>Item 2</li>\n</ul>\n```',
      'li': '### &lt;li&gt;\nЭлемент списка.\n```html\n<li>List item</li>\n```',
      'input': '### &lt;input&gt;\nПоле ввода формы.\n```html\n<input type="text" name="username">\n```',
      'button': '### &lt;button&gt;\nКнопка, на которую можно нажать.\n```html\n<button type="submit">Submit</button>\n```'
    };
    
    // CSS свойства
    const cssInfo: Record<string, string> = {
      'color': '### color\nЗадает цвет текста элемента.\n```css\ncolor: #3366FF;\n```',
      'background': '### background\nЗадает фон элемента.\n```css\nbackground: #f0f0f0 url("bg.png") no-repeat center;\n```',
      'margin': '### margin\nЗадает внешние отступы элемента.\n```css\nmargin: 10px 20px 15px 5px; /* top right bottom left */\n```',
      'padding': '### padding\nЗадает внутренние отступы элемента.\n```css\npadding: 10px;\n```',
      'display': '### display\nОпределяет тип отображения элемента.\n```css\ndisplay: flex;\n```',
      'position': '### position\nЗадает метод позиционирования элемента.\n```css\nposition: absolute;\ntop: 0;\nleft: 0;\n```',
      'font': '### font\nЗадает свойства шрифта.\n```css\nfont: italic bold 16px/1.5 Arial, sans-serif;\n```',
      'border': '### border\nЗадает границу элемента.\n```css\nborder: 1px solid #000;\n```'
    };
    
    // JSON свойства
    const jsonInfo: Record<string, string> = {
      'name': '### name\nИмя пакета в package.json или другое название.\n```json\n"name": "my-package"\n```',
      'version': '### version\nВерсия пакета в package.json.\n```json\n"version": "1.0.0"\n```',
      'dependencies': '### dependencies\nЗависимости пакета в package.json.\n```json\n"dependencies": {\n  "react": "^18.0.0"\n}\n```',
      'scripts': '### scripts\nСкрипты npm в package.json.\n```json\n"scripts": {\n  "start": "node server.js"\n}\n```'
    };
    
    // Выбираем информацию в зависимости от типа файла и специального типа
    let info = '';
    
    // Если определили специальный тип, используем его
    if (specialType) {
      // Например, если мы определили, что это импорт React
      if (specialType === 'react-import' && word === 'React') {
        return {
          contents: {
            kind: 'markdown',
            value: '### React\nБиблиотека для создания пользовательских интерфейсов.\n```typescript\nimport React from \'react\';\n```\n\nОсновные хуки:\n- useState - управление состоянием\n- useEffect - побочные эффекты\n- useContext - доступ к контексту\n- useReducer - сложная логика состояния\n- useCallback - мемоизация функций'
          }
        };
      }
      
      // Если это React компонент
      if (specialType === 'react-component') {
        return {
          contents: {
            kind: 'markdown',
            value: `### ${word}\nReact компонент.\n\nКомпоненты React позволяют разделить UI на независимые, повторно используемые части и работать с каждой частью отдельно.`
          }
        };
      }
      
      // Если это JSX элемент
      if (specialType === 'jsx-element') {
        return {
          contents: {
            kind: 'markdown',
            value: `### <${word}>\nJSX элемент.\n\nJSX позволяет писать HTML-подобные элементы в JavaScript/TypeScript, которые преобразуются в вызовы React.createElement().`
          }
        };
      }
    }
    
    // Если нет специального типа или специфической информации, используем наши словари
    return this.generateHoverContent(fileType, word, position);
  }
  
  /**
   * Определение специального типа на основе контекста строки
   */
  private detectSpecialTypeFromContext(word: string, lineText: string): string | null {
    if (!word || !lineText) return null;
    
    // Если строка содержит импорт React
    if (lineText.includes('import') && lineText.includes('react') && word === 'React') {
      return 'react-import';
    }
    
    // Если строка содержит определение React компонента
    if ((lineText.includes('function') || lineText.includes('class')) && 
        (lineText.includes('extends React.Component') || lineText.includes('=> {') || lineText.includes(' => (')) && 
        word.charAt(0) === word.charAt(0).toUpperCase()) {
      return 'react-component';
    }
    
    // Если строка содержит JSX
    if ((lineText.includes('<') && lineText.includes('/>')) || 
        (lineText.includes('<') && lineText.includes('>'))) {
      if (word.charAt(0) === word.charAt(0).toLowerCase()) {
        return 'jsx-element';
      } else {
        return 'react-component';
      }
    }
    
    // Если строка содержит useState
    if (lineText.includes('useState') && (word.startsWith('set') || lineText.includes('['))) {
      return 'react-state';
    }
    
    // Если строка содержит useEffect
    if (lineText.includes('useEffect') && (word === 'useEffect' || word === 'dependencies')) {
      return 'react-effect';
    }
    
    return null;
  }
  
  /**
   * Определение типа файла из URI
   */
  private getFileTypeFromUri(uri: string): string {
    if (!uri) return 'unknown';
    
    if (uri.endsWith('.ts')) return 'typescript';
    if (uri.endsWith('.tsx')) return 'typescriptreact';
    if (uri.endsWith('.js')) return 'javascript';
    if (uri.endsWith('.jsx')) return 'javascriptreact';
    if (uri.endsWith('.html') || uri.endsWith('.htm')) return 'html';
    if (uri.endsWith('.css')) return 'css';
    if (uri.endsWith('.json')) return 'json';
    
    return 'unknown';
  }
  
  /**
   * Извлечение предполагаемого слова из URI и позиции
   * Это просто заглушка, в настоящем LSP сервер получил бы текст файла
   */
  private extractWordFromUri(uri: string, position: any): string {
    // Для демонстрации возвращаем предполагаемое слово на основе URI
    if (uri.includes('component')) return 'component';
    if (uri.includes('App')) return 'App';
    if (uri.includes('index')) return 'index';
    if (uri.includes('main')) return 'main';
    if (uri.includes('utils')) return 'utils';
    
    // По умолчанию возвращаем слово на основе позиции 
    const column = position.character;
    if (column < 5) return 'import';
    if (column < 10) return 'const';
    if (column < 15) return 'function';
    if (column < 20) return 'interface';
    if (column < 25) return 'class';
    
    return 'identifier';
  }
  
  /**
   * Генерация содержимого подсказки hover на основе типа файла и слова
   */
  private generateHoverContent(fileType: string, word: string, position: any): any {
    // Типичные TypeScript/JavaScript сущности
    const tsJsInfo: Record<string, string> = {
      'import': '### import\nЗагружает модули или его части.\n```typescript\nimport { Component } from \'module\';\n```',
      'export': '### export\nЭкспортирует функции, объекты или значения для использования в других модулях.\n```typescript\nexport const myVar = 123;\n```',
      'const': '### const\nОбъявляет константу, доступную только для чтения.\n```typescript\nconst MAX_SIZE = 100;\n```',
      'let': '### let\nОбъявляет переменную с блочной областью видимости.\n```typescript\nlet counter = 0;\n```',
      'function': '### function\nОбъявляет функцию.\n```typescript\nfunction add(a: number, b: number): number {\n  return a + b;\n}\n```',
      'interface': '### interface\nОпределяет структуру объекта.\n```typescript\ninterface User {\n  id: number;\n  name: string;\n}\n```',
      'type': '### type\nСоздает псевдоним типа или определяет составной тип.\n```typescript\ntype ID = string | number;\n```',
      'class': '### class\nОбъявляет класс.\n```typescript\nclass Person {\n  name: string;\n  constructor(name: string) {\n    this.name = name;\n  }\n}\n```',
      'component': '### React Component\nКомпонент в React - это изолированная часть интерфейса.\n```tsx\nfunction Button(props: { label: string }) {\n  return <button>{props.label}</button>;\n}\n```',
      'useState': '### React.useState\nХук для добавления состояния в функциональные компоненты.\n```tsx\nconst [count, setCount] = useState(0);\n```',
      'useEffect': '### React.useEffect\nХук для выполнения побочных эффектов в функциональных компонентах.\n```tsx\nuseEffect(() => {\n  document.title = `Count: ${count}`;\n}, [count]);\n```',
      'App': '### App Component\nКорневой компонент React приложения.\n```tsx\nfunction App() {\n  return <div>Application Content</div>;\n}\n```',
      'props': '### props\nСвойства, передаваемые в React компоненты.\n```tsx\nfunction Greeting(props: { name: string }) {\n  return <h1>Hello, {props.name}!</h1>;\n}\n```',
      'identifier': '### Переменная или функция\nИдентификатор, который может представлять переменную, функцию или другую сущность в коде.\n'
    };
    
    // HTML элементы
    const htmlInfo: Record<string, string> = {
      'div': '### &lt;div&gt;\nОпределяет раздел в HTML документе.\n```html\n<div class="container">Content</div>\n```',
      'span': '### &lt;span&gt;\nОпределяет строчный контейнер для текста или элементов.\n```html\n<span class="highlight">Text</span>\n```',
      'a': '### &lt;a&gt;\nСоздает гиперссылку.\n```html\n<a href="https://example.com">Link</a>\n```',
      'p': '### &lt;p&gt;\nОпределяет параграф.\n```html\n<p>This is a paragraph.</p>\n```',
      'h1': '### &lt;h1&gt;\nЗаголовок первого уровня.\n```html\n<h1>Main heading</h1>\n```',
      'img': '### &lt;img&gt;\nВставляет изображение.\n```html\n<img src="image.jpg" alt="Description">\n```',
      'ul': '### &lt;ul&gt;\nНеупорядоченный список.\n```html\n<ul>\n  <li>Item 1</li>\n  <li>Item 2</li>\n</ul>\n```',
      'li': '### &lt;li&gt;\nЭлемент списка.\n```html\n<li>List item</li>\n```',
      'input': '### &lt;input&gt;\nПоле ввода формы.\n```html\n<input type="text" name="username">\n```',
      'button': '### &lt;button&gt;\nКнопка, на которую можно нажать.\n```html\n<button type="submit">Submit</button>\n```'
    };
    
    // CSS свойства
    const cssInfo: Record<string, string> = {
      'color': '### color\nЗадает цвет текста элемента.\n```css\ncolor: #3366FF;\n```',
      'background': '### background\nЗадает фон элемента.\n```css\nbackground: #f0f0f0 url("bg.png") no-repeat center;\n```',
      'margin': '### margin\nЗадает внешние отступы элемента.\n```css\nmargin: 10px 20px 15px 5px; /* top right bottom left */\n```',
      'padding': '### padding\nЗадает внутренние отступы элемента.\n```css\npadding: 10px;\n```',
      'display': '### display\nОпределяет тип отображения элемента.\n```css\ndisplay: flex;\n```',
      'position': '### position\nЗадает метод позиционирования элемента.\n```css\nposition: absolute;\ntop: 0;\nleft: 0;\n```',
      'font': '### font\nЗадает свойства шрифта.\n```css\nfont: italic bold 16px/1.5 Arial, sans-serif;\n```',
      'border': '### border\nЗадает границу элемента.\n```css\nborder: 1px solid #000;\n```'
    };
    
    // JSON свойства
    const jsonInfo: Record<string, string> = {
      'name': '### name\nИмя пакета в package.json или другое название.\n```json\n"name": "my-package"\n```',
      'version': '### version\nВерсия пакета в package.json.\n```json\n"version": "1.0.0"\n```',
      'dependencies': '### dependencies\nЗависимости пакета в package.json.\n```json\n"dependencies": {\n  "react": "^18.0.0"\n}\n```',
      'scripts': '### scripts\nСкрипты npm в package.json.\n```json\n"scripts": {\n  "start": "node server.js"\n}\n```'
    };
    
    // Выбираем информацию в зависимости от типа файла
    let info = '';
    if (['typescript', 'javascript', 'typescriptreact', 'javascriptreact'].includes(fileType)) {
      info = tsJsInfo[word] || `### ${word}\nИдентификатор в TypeScript/JavaScript`;
    } else if (fileType === 'html') {
      info = htmlInfo[word] || `### ${word}\nЭлемент или атрибут HTML`;
    } else if (fileType === 'css') {
      info = cssInfo[word] || `### ${word}\nСвойство или селектор CSS`;
    } else if (fileType === 'json') {
      info = jsonInfo[word] || `### ${word}\nКлюч в JSON объекте`;
    } else {
      info = `### ${word}\nИдентификатор в коде`;
    }
    
    return {
      contents: {
        kind: 'markdown',
        value: info
      }
    };
  }
  
  /**
   * Заглушка для ответа на запрос definition
   */
  private mockDefinitionResponse(params: any): any {
    console.log('Создание заглушки для definition');
    
    return {
      uri: params.textDocument?.uri || 'file:///demo.ts',
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 10 }
      }
    };
  }
  
  /**
   * Проверка, запущен ли сервер
   */
  public isServerRunning(serverId: string): boolean {
    if (!serverId) return false;
    
    try {
      const connection = this.connections.get(serverId);
      return connection !== undefined && connection.isConnected === true;
    } catch (error) {
      console.error(`Ошибка при проверке статуса сервера ${serverId}:`, error);
      return false;
    }
  }

  /**
   * Проверка, подключены ли мы к серверу
   */
  public isConnected(serverId: string): boolean {
    return this.isServerRunning(serverId);
  }
  
  /**
   * Получение сервера по идентификатору
   */
  public getServer(serverId: string): LanguageServer | undefined {
    return this.servers.get(serverId);
  }
  
  /**
   * Получение списка доступных серверов
   */
  public getServers(): LanguageServer[] {
    return Array.from(this.servers.values());
  }
  
  /**
   * Очистка ресурсов при уничтожении
   */
  public dispose(): void {
    // Остановка всех серверов
    for (const serverId of this.connections.keys()) {
      this.stopServer(serverId).catch(console.error);
    }
    
    this.servers.clear();
    this.connections.clear();
    console.log('LanguageServerManager resources disposed');
  }
}

// Экспортируем класс LanguageServerManager
export { LanguageServerManager };

// Создаем и экспортируем единственный экземпляр менеджера
export const languageServerManager = new LanguageServerManager();
languageServerManager.initialize(); 