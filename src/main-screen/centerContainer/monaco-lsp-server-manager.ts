/**
 * Monaco LSP Server Manager
 * 
 * Управление языковыми серверами LSP, запуск их через WebSocket или Worker
 */

// @ts-nocheck
import { invoke } from '@tauri-apps/api/core';
import * as monaco from 'monaco-editor';

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
    
    // Добавляем Python Language Server
    this.registerServer({
      id: 'python',
      name: 'Python Language Server',
      supportedLanguages: ['python']
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
          // Эмулируем отправку диагностики для Python файлов
          if (serverId === 'python' && params.textDocument?.uri.endsWith('.py')) {
            this.mockPythonDiagnostics(params.textDocument?.uri, params.textDocument?.text);
          }
          break;
        case 'textDocument/didChange':
          console.log(`Уведомление об изменении документа: ${params.textDocument?.uri}`);
          // Эмулируем отправку диагностики при изменении Python файлов
          if (serverId === 'python' && params.textDocument?.uri.endsWith('.py') && params.contentChanges) {
            const content = params.contentChanges[0]?.text || '';
            this.mockPythonDiagnostics(params.textDocument?.uri, content);
          }
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
   * Создает тестовую диагностику для Python файлов
   */
  private mockPythonDiagnostics(uri: string, content: string): void {
    console.log(`Создание тестовой диагностики для Python файла: ${uri}`);
    
    try {
      // Получаем хранилище диагностики для Python
      const diagnosticsStore = (window as any).pythonDiagnosticsStore;
      if (!diagnosticsStore) {
        console.warn('Хранилище диагностики Python не доступно');
        return;
      }
      
      // Если файл пустой или содержит только пробелы/табуляции, то не создаем предупреждений
      const trimmedContent = content ? content.trim() : '';
      if (!trimmedContent) {
        console.log('Файл пустой, очищаем все маркеры');
        try {
          // Получаем URI для файла
          let monacoUri;
          try {
            monacoUri = window.monaco.Uri.parse(uri);
          } catch (e) {
            if (uri.startsWith('file://')) {
              monacoUri = window.monaco.Uri.file(uri.substring(7).replace(/\\/g, '/'));
            } else {
              monacoUri = window.monaco.Uri.file(uri.replace(/\\/g, '/'));
            }
          }
          
          // Если есть модель, очищаем все маркеры
          const model = window.monaco.editor.getModel(monacoUri);
          if (model) {
            window.monaco.editor.setModelMarkers(model, 'python-lsp', []);
          }
          
          // Очищаем хранилище диагностики
          diagnosticsStore.clearMarkers(monacoUri.toString());
          
          // Уведомляем об обновлении маркеров
          document.dispatchEvent(new CustomEvent('markers-updated'));
        } catch (e) {
          console.error('Ошибка при очистке маркеров для пустого файла:', e);
        }
        return;
      }
      
      // Выполняем примитивный анализ кода Python
      const lines = content.split('\n');
      const markers: any[] = [];
      
      // Создаем простой контекст для проверки синтаксиса
      const context = {
        indentationLevel: 0,
        expectIndent: false,
        openParens: 0,
        openBrackets: 0,
        openBraces: 0,
        inMultilineString: false,
        defNames: new Set<string>(),
        varNames: new Set<string>(),
        lastDef: '',
        globalVars: new Set<string>()
      };
      
      console.log(`Анализ Python файла: ${uri} с ${lines.length} строками`);
      
      // Первый проход - собираем определения функций и переменных
      lines.forEach((line, lineIndex) => {
        const trimmedLine = line.trim();
        
        // Игнорируем пустые строки и комментарии
        if (trimmedLine === '' || trimmedLine.startsWith('#')) {
          return;
        }
        
        // Поиск определений функций
        const defMatch = trimmedLine.match(/^def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
        if (defMatch) {
          context.defNames.add(defMatch[1]);
        }
        
        // Поиск определений переменных и добавление в глобальные, если они вне функций
        const varMatch = trimmedLine.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
        if (varMatch) {
          context.varNames.add(varMatch[1]);
          
          // Если не внутри функции, это глобальная переменная
          if (trimmedLine.indexOf('def ') !== 0 && !trimmedLine.startsWith('class ')) {
            context.globalVars.add(varMatch[1]);
          }
        }
        
        // Находим глобальные объявления в функциях
        const globalMatch = trimmedLine.match(/global\s+([^#]+)/);
        if (globalMatch) {
          const globals = globalMatch[1].split(',').map(g => g.trim());
          globals.forEach(g => {
            context.globalVars.add(g);
          });
        }
      });
      
      console.log(`Найдено функций: ${context.defNames.size}, переменных: ${context.varNames.size}`);
      
      // Второй проход - анализ ошибок
      lines.forEach((line, lineIndex) => {
        const trimmedLine = line.trim();
        
        // Игнорируем пустые строки и комментарии
        if (trimmedLine === '' || trimmedLine.startsWith('#')) {
          return;
        }

        // Ошибка синтаксиса в строке с print из Python 2
        if (/^print\s+[^(]/.test(trimmedLine)) {
          markers.push({
            severity: window.monaco.MarkerSeverity.Error,
            message: 'В Python 3 функция print требует скобки',
            startLineNumber: lineIndex + 1,
            startColumn: line.indexOf('print') + 1,
            endLineNumber: lineIndex + 1,
            endColumn: line.indexOf('print') + 6,
            source: 'python-lsp'
          });
        }
        
        // Пропущенные ":" после блочных конструкций
        if (/^(if|elif|else|for|while|def|class|with|try|except|finally)\b.*[^:)]\s*$/.test(trimmedLine)) {
          markers.push({
            severity: window.monaco.MarkerSeverity.Error,
            message: 'Ожидается двоеточие ":" в конце блочной конструкции',
            startLineNumber: lineIndex + 1,
            startColumn: line.length,
            endLineNumber: lineIndex + 1,
            endColumn: line.length + 1,
            source: 'python-lsp'
          });
        }
        
        // Неверное имя функции (начинается с заглавной буквы)
        const badFunctionMatch = /^def\s+([A-Z][a-zA-Z0-9_]*)\s*\(/.exec(trimmedLine);
        if (badFunctionMatch) {
          markers.push({
            severity: window.monaco.MarkerSeverity.Warning,
            message: `Имя функции "${badFunctionMatch[1]}" начинается с заглавной буквы. По PEP 8 имена функций должны быть в нижнем регистре.`,
            startLineNumber: lineIndex + 1,
            startColumn: line.indexOf(badFunctionMatch[1]) + 1,
            endLineNumber: lineIndex + 1,
            endColumn: line.indexOf(badFunctionMatch[1]) + badFunctionMatch[1].length + 1,
            source: 'python-lsp'
          });
        }
        
        // Неверный отступ (не кратный 4 пробелам)
        const leadingSpaces = line.length - line.trimLeft().length;
        if (leadingSpaces > 0 && leadingSpaces % 4 !== 0 && !line.startsWith('\t')) {
          markers.push({
            severity: window.monaco.MarkerSeverity.Warning,
            message: `Отступ в ${leadingSpaces} пробелов не кратен 4. Рекомендуется использовать отступы кратные 4 пробелам.`,
            startLineNumber: lineIndex + 1,
            startColumn: 1,
            endLineNumber: lineIndex + 1,
            endColumn: leadingSpaces + 1,
            source: 'python-lsp'
          });
        }
        
        // Использование операторов is/is not с литералами
        if (/\bis\s+(["'].*?["']|\d+|True|False)/.test(trimmedLine) || 
            /\bis\s+not\s+(["'].*?["']|\d+|True|False)/.test(trimmedLine)) {
          markers.push({
            severity: window.monaco.MarkerSeverity.Warning,
            message: 'Оператор "is" проверяет идентичность объектов, а не значений. Для сравнения значений используйте "==" или "!=".',
            startLineNumber: lineIndex + 1,
            startColumn: 1,
            endLineNumber: lineIndex + 1,
            endColumn: line.length + 1,
            source: 'python-lsp'
          });
        }
        
        // Использование == None вместо is None
        if (/==\s*None/.test(trimmedLine) || /None\s*==/.test(trimmedLine)) {
          markers.push({
            severity: window.monaco.MarkerSeverity.Warning,
            message: 'Используйте "is None" вместо "== None" для проверки на None.',
            startLineNumber: lineIndex + 1,
            startColumn: 1,
            endLineNumber: lineIndex + 1,
            endColumn: line.length + 1,
            source: 'python-lsp'
          });
        }
        
        // Использование == True вместо напрямую
        if (/==\s*True/.test(trimmedLine) || /True\s*==/.test(trimmedLine)) {
          markers.push({
            severity: window.monaco.MarkerSeverity.Warning,
            message: 'Вместо "== True" просто используйте выражение напрямую.',
            startLineNumber: lineIndex + 1,
            startColumn: 1,
            endLineNumber: lineIndex + 1,
            endColumn: line.length + 1,
            source: 'python-lsp'
          });
        }
        
        // Использование mutable значения как значения по умолчанию аргумента
        if (/def\s+\w+\([^)]*=\s*(\[\]|\{\}|\(\))\s*[,)]/.test(trimmedLine)) {
          markers.push({
            severity: window.monaco.MarkerSeverity.Warning,
            message: 'Использование изменяемых объектов ([], {}, set()) в качестве значений по умолчанию может привести к неожиданному поведению.',
            startLineNumber: lineIndex + 1,
            startColumn: 1,
            endLineNumber: lineIndex + 1,
            endColumn: line.length + 1,
            source: 'python-lsp'
          });
        }
        
        // Использование глобальных переменных в функциях без объявления global
        const assignmentMatch = /^\s*(\w+)\s*=/.exec(trimmedLine);
        if (assignmentMatch && 
            context.defNames.has(context.lastDef || '') && 
            context.globalVars.has(assignmentMatch[1]) && 
            !trimmedLine.includes('global')) {
          markers.push({
            severity: window.monaco.MarkerSeverity.Error,
            message: `Переменная "${assignmentMatch[1]}" используется глобально и требует объявления "global ${assignmentMatch[1]}" внутри функции.`,
            startLineNumber: lineIndex + 1,
            startColumn: line.indexOf(assignmentMatch[1]) + 1,
            endLineNumber: lineIndex + 1,
            endColumn: line.indexOf(assignmentMatch[1]) + assignmentMatch[1].length + 1,
            source: 'python-lsp'
          });
        }
        
        // Нет пробелов вокруг операторов
        if (/[a-zA-Z0-9_]([\+\-\*\/])[a-zA-Z0-9_]/.test(trimmedLine)) {
          markers.push({
            severity: window.monaco.MarkerSeverity.Warning,
            message: 'Рекомендуется добавлять пробелы вокруг операторов для лучшей читаемости.',
            startLineNumber: lineIndex + 1,
            startColumn: 1,
            endLineNumber: lineIndex + 1,
            endColumn: line.length + 1,
            source: 'python-lsp'
          });
        }
        
        // Проверка неправильных отступов (spaces vs tabs)
        if (line.match(/^ +\t/) || line.match(/^\t+ /)) {
          markers.push({
            severity: window.monaco.MarkerSeverity.Warning,
            message: 'Смешанные отступы (пробелы и табуляции)',
            startLineNumber: lineIndex + 1,
            startColumn: 1,
            endLineNumber: lineIndex + 1,
            endColumn: line.length + 1,
            source: 'python-lsp'
          });
        }
        
        // Проверка на syntax error в import
        if (trimmedLine.startsWith('import') && line.includes(',')) {
          markers.push({
            severity: window.monaco.MarkerSeverity.Error,
            message: 'Неправильный синтаксис import. Используйте несколько строк import или from ... import',
            startLineNumber: lineIndex + 1,
            startColumn: 1,
            endLineNumber: lineIndex + 1,
            endColumn: line.length + 1,
            source: 'python-lsp'
          });
        }
        
        // Проверка незакрытых скобок в строке
        const openParens = (line.match(/\(/g) || []).length;
        const closeParens = (line.match(/\)/g) || []).length;
        const openBrackets = (line.match(/\[/g) || []).length;
        const closeBrackets = (line.match(/\]/g) || []).length;
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;
        
        // Обновляем контекст с открытыми и закрытыми скобками
        context.openParens += openParens - closeParens;
        context.openBrackets += openBrackets - closeBrackets;
        context.openBraces += openBraces - closeBraces;
        
        // Если скобки не в балансе в этой строке и строка не продолжается
        if (!line.trim().endsWith('\\') && !context.inMultilineString) {
          if (openParens !== closeParens && !line.includes('"""') && !line.includes("'''")) {
            markers.push({
              severity: window.monaco.MarkerSeverity.Error,
              message: 'Непарные круглые скобки в строке',
              startLineNumber: lineIndex + 1,
              startColumn: 1,
              endLineNumber: lineIndex + 1,
              endColumn: line.length + 1,
              source: 'python-lsp'
            });
          }
          
          if (openBrackets !== closeBrackets) {
            markers.push({
              severity: window.monaco.MarkerSeverity.Error,
              message: 'Непарные квадратные скобки в строке',
              startLineNumber: lineIndex + 1,
              startColumn: 1,
              endLineNumber: lineIndex + 1,
              endColumn: line.length + 1,
              source: 'python-lsp'
            });
          }
          
          if (openBraces !== closeBraces) {
            markers.push({
              severity: window.monaco.MarkerSeverity.Error,
              message: 'Непарные фигурные скобки в строке',
              startLineNumber: lineIndex + 1,
              startColumn: 1,
              endLineNumber: lineIndex + 1,
              endColumn: line.length + 1,
              source: 'python-lsp'
            });
          }
        }
        
        // Переключаем состояние многострочного литерала
        if ((line.match(/"""/g) || []).length % 2 !== 0 || (line.match(/'''/g) || []).length % 2 !== 0) {
          context.inMultilineString = !context.inMultilineString;
        }
        
        // Проверка незакрытых одинарных и двойных кавычек в строке (не в многострочном режиме)
        if (!context.inMultilineString) {
          const singleQuotes = (line.match(/'/g) || []).length - (line.match(/'''/g) || []).length * 3;
          const doubleQuotes = (line.match(/"/g) || []).length - (line.match(/"""/g) || []).length * 3;
          
          if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
            markers.push({
              severity: window.monaco.MarkerSeverity.Error,
              message: 'Незакрытые строковые литералы',
              startLineNumber: lineIndex + 1,
              startColumn: 1,
              endLineNumber: lineIndex + 1,
              endColumn: line.length + 1,
              source: 'python-lsp'
            });
          }
        }
        
        // Обновляем контекст для отслеживания текущей функции
        if (/^def\s+(\w+)/.test(trimmedLine)) {
          const match = /^def\s+(\w+)/.exec(trimmedLine);
          if (match) {
            context.lastDef = match[1];
          }
        }
      });
      
      // Проверка оставшихся непарных скобок после анализа всего файла
      if (context.openParens !== 0 || context.openBrackets !== 0 || context.openBraces !== 0) {
        markers.push({
          severity: window.monaco.MarkerSeverity.Error,
          message: `Непарные скобки в файле: ${context.openParens > 0 ? '+' : ''}${context.openParens} круглых, ${context.openBrackets > 0 ? '+' : ''}${context.openBrackets} квадратных, ${context.openBraces > 0 ? '+' : ''}${context.openBraces} фигурных`,
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 10,
          source: 'python-lsp'
        });
      }
      
      // Добавляем маркеры в редактор
      console.log(`Найдено ${markers.length} проблем в Python файле`);
      
      try {
        // Преобразуем URI в формат Monaco
        let monacoUri;
        try {
          monacoUri = window.monaco.Uri.parse(uri);
        } catch (e) {
          // Обрабатываем различные форматы URI
          if (uri.startsWith('file://')) {
            // Формируем нормализованный URI
            let path = uri.substring(7);
            
            // Обрабатываем пути с кириллицей
            if (path.includes('%')) {
              try {
                path = decodeURIComponent(path);
              } catch (decodeErr) {
                console.warn('Не удалось декодировать URI:', uri);
              }
            }
            
            // Нормализуем слэши для Windows
            path = path.replace(/\\/g, '/');
            
            monacoUri = window.monaco.Uri.file(path);
          } else {
            // Если это не file://, просто используем как путь
            monacoUri = window.monaco.Uri.file(uri.replace(/\\/g, '/'));
          }
        }
        
        // Для диагностики
        console.log(`URI для маркеров: ${monacoUri.toString()}`);
        
        // Устанавливаем маркеры через хранилище диагностики
        // Используем оба варианта URI для большей надежности
        diagnosticsStore.setMarkers(monacoUri.toString(), markers);
        
        // Также пробуем установить для различных вариантов URI
        // Это необходимо из-за различий в обработке URI в разных частях кода
        const alternativeUri = `file:///${encodeURIComponent(uri.replace(/^file:\/\//, '').replace(/\\/g, '/'))}`;
        if (alternativeUri !== monacoUri.toString()) {
          console.log(`Устанавливаем маркеры также для альтернативного URI: ${alternativeUri}`);
          diagnosticsStore.setMarkers(alternativeUri, markers);
        }
        
        console.log(`Маркеры установлены для ${uri}`);
        
        // Уведомляем об обновлении маркеров
        document.dispatchEvent(new CustomEvent('markers-updated'));
      } catch (e) {
        console.error('Ошибка при установке маркеров:', e);
      }
    } catch (error) {
      console.error('Ошибка при создании тестовой диагностики Python:', error);
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
  private async mockHoverResponse(params: any): Promise<any> {
    try {
      // Получаем текст документа
      const document = await this.getDocument(params.textDocument.uri);
      if (!document) {
        return null;
      }

      // Получаем позицию в документе
      const position = params.position;
      const offset = this.getOffsetFromPosition(document, position);

      // Получаем слово в позиции
      const word = this.getWordAtPosition(document, offset);
      if (!word) {
        return null;
      }

      // Получаем контекст строки
      const lineText = document.split('\n')[position.line];
      
      // Определяем тип файла
      const fileType = this.getFileTypeFromUri(params.textDocument.uri);

      // Если это TypeScript/TSX файл, используем TypeScript Language Server
      if (fileType === 'typescript' || fileType === 'typescriptreact') {
        const server = this.getServer('typescript');
        if (server && this.isConnected('typescript')) {
          // Отправляем запрос к TypeScript Language Server
          const response = await this.sendRequest('typescript', 'textDocument/hover', {
            textDocument: params.textDocument,
            position: params.position
          });

          if (response && response.contents) {
            // Добавляем дополнительную информацию для TSX файлов
            if (fileType === 'typescriptreact') {
              const additionalInfo = this.getTSXAdditionalInfo(word, lineText);
              if (additionalInfo) {
                response.contents.value += `\n\n${additionalInfo}`;
              }
            }
            return response;
          }
        }
      }

      // Если не удалось получить ответ от сервера, используем базовую информацию
      return this.generateBasicHoverContent(word, lineText, fileType);
    } catch (error) {
      console.error('Ошибка при получении hover информации:', error);
      return null;
    }
  }
  
  private getTSXAdditionalInfo(word: string, lineText: string): string {
    // Проверяем, является ли слово React компонентом
    if (lineText.includes('function') && word.match(/^[A-Z]/)) {
      return `\n**React Component**\n\n\`\`\`tsx\nfunction ${word}(props: {}) {\n  return <div></div>;\n}\n\`\`\``;
    }

    // Проверяем, является ли слово React хуком
    if (word.startsWith('use')) {
      const hookInfo = this.getReactHookInfo(word);
      if (hookInfo) {
        return `\n**React Hook**\n\n${hookInfo}`;
      }
    }

    // Проверяем, является ли слово JSX элементом
    if (lineText.includes('<') && lineText.includes('>')) {
      const elementInfo = this.getJSXElementInfo(word);
      if (elementInfo) {
        return `\n**JSX Element**\n\n${elementInfo}`;
      }
    }

    return '';
  }

  private getReactHookInfo(hookName: string): string {
    const hooks: { [key: string]: string } = {
      'useState': '```tsx\nconst [state, setState] = useState<Type>(initialValue);\n```\n\n**Parameters:**\n- `initialValue`: Initial state value\n\n**Returns:**\n- `state`: Current state value\n- `setState`: Function to update state',
      'useEffect': '```tsx\nuseEffect(() => {\n  // Effect code\n  return () => {\n    // Cleanup code\n  };\n}, [dependencies]);\n```\n\n**Parameters:**\n- `effect`: Function containing effect code\n- `dependencies`: Array of dependencies (optional)\n\n**Returns:**\n- Cleanup function (optional)',
      'useContext': '```tsx\nconst value = useContext(MyContext);\n```\n\n**Parameters:**\n- `context`: Context object\n\n**Returns:**\n- Current context value',
      'useRef': '```tsx\nconst ref = useRef<Type>(initialValue);\n```\n\n**Parameters:**\n- `initialValue`: Initial ref value\n\n**Returns:**\n- Mutable ref object',
      'useMemo': '```tsx\nconst memoizedValue = useMemo(() => computeExpensiveValue(a, b), [a, b]);\n```\n\n**Parameters:**\n- `create`: Function that returns value to memoize\n- `dependencies`: Array of dependencies\n\n**Returns:**\n- Memoized value',
      'useCallback': '```tsx\nconst memoizedCallback = useCallback(() => {\n  doSomething(a, b);\n}, [a, b]);\n```\n\n**Parameters:**\n- `callback`: Function to memoize\n- `dependencies`: Array of dependencies\n\n**Returns:**\n- Memoized callback'
    };

    return hooks[hookName] || '';
  }

  private getJSXElementInfo(elementName: string): string {
    const elements: { [key: string]: string } = {
      'div': '```tsx\n<div\n  className?: string\n  style?: React.CSSProperties\n  children?: React.ReactNode\n  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void\n  // ... other HTML attributes\n/>\n```',
      'span': '```tsx\n<span\n  className?: string\n  style?: React.CSSProperties\n  children?: React.ReactNode\n  onClick?: (event: React.MouseEvent<HTMLSpanElement>) => void\n  // ... other HTML attributes\n/>\n```',
      'button': '```tsx\n<button\n  className?: string\n  style?: React.CSSProperties\n  children?: React.ReactNode\n  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void\n  disabled?: boolean\n  type?: "button" | "submit" | "reset"\n  // ... other HTML attributes\n/>\n```',
      'input': '```tsx\n<input\n  className?: string\n  style?: React.CSSProperties\n  type?: string\n  value?: string\n  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void\n  placeholder?: string\n  disabled?: boolean\n  // ... other HTML attributes\n/>\n```'
    };

    return elements[elementName.toLowerCase()] || '';
  }

  private generateBasicHoverContent(word: string, lineText: string, fileType: string): any {
    return {
      contents: {
        kind: 'markdown',
        value: `**${word}**\n\nType: ${this.getTypeFromContext(lineText, word)}\nFile Type: ${fileType}`
      }
    };
  }

  private getTypeFromContext(lineText: string, word: string): string {
    if (lineText.includes('function')) return 'Function';
    if (lineText.includes('const') || lineText.includes('let') || lineText.includes('var')) return 'Variable';
    if (lineText.includes('class')) return 'Class';
    if (lineText.includes('interface')) return 'Interface';
    if (lineText.includes('type')) return 'Type';
    if (lineText.includes('enum')) return 'Enum';
    return 'Unknown';
  }

  private getFileTypeFromUri(uri: string): string {
    const extension = uri.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'tsx': return 'typescriptreact';
      case 'ts': return 'typescript';
      case 'jsx': return 'javascriptreact';
      case 'js': return 'javascript';
      case 'html': return 'html';
      case 'css': return 'css';
      case 'json': return 'json';
      default: return 'unknown';
    }
  }

  private getOffsetFromPosition(document: string, position: { line: number; character: number }): number {
    const lines = document.split('\n');
    let offset = 0;
    for (let i = 0; i < position.line; i++) {
      offset += lines[i].length + 1; // +1 for newline
    }
    return offset + position.character;
  }

  private getWordAtPosition(document: string, offset: number): string | null {
    const lines = document.split('\n');
    let currentOffset = 0;
    
    for (const line of lines) {
      const lineLength = line.length + 1; // +1 for newline
      if (offset >= currentOffset && offset < currentOffset + lineLength) {
        const relativeOffset = offset - currentOffset;
        const beforeCursor = line.slice(0, relativeOffset);
        const match = beforeCursor.match(/\b\w+\b$/);
        return match ? match[0] : null;
      }
      currentOffset += lineLength;
    }
    
    return null;
  }

  private async getDocument(uri: string): Promise<string | null> {
    try {
      // Получаем модель документа из Monaco
      const model = monaco.editor.getModel(uri);
      if (model) {
        return model.getValue();
      }
      return null;
    } catch (error) {
      console.error('Ошибка при получении документа:', error);
      return null;
    }
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