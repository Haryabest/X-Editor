/**
 * Скрипт для тестирования Monaco Editor
 * 
 * Этот скрипт позволяет автоматически открывать тестовые файлы
 * в редакторе и проверять отображение ошибок.
 */

// Импортируем необходимые зависимости
import * as monaco from 'monaco-editor';
import { configureMonaco } from '../monaco-config';
import { setupSmartCodeAnalyzer } from '../monaco-config/index';
import { loadTestFile, analyzeEditorErrors, displayErrors } from './test-utils';

// Добавляем отладочное логирование
console.log('Monaco languages in test-runner:', monaco.languages.getLanguages().map(lang => lang.id));

// Регистрируем язык typescriptreact если он еще не зарегистрирован
if (!monaco.languages.getLanguages().some(lang => lang.id === 'typescriptreact')) {
  console.log('Registering typescriptreact language in test-runner');
  monaco.languages.register({ id: 'typescriptreact' });
}

// Список тестовых файлов
const TEST_FILES = [
  'src/monaco-tests/TypeScriptTest.ts',
  'src/monaco-tests/ReactComponentTest.tsx',
  'src/monaco-tests/JsxComponentTest.jsx',
  'src/monaco-tests/SmartAnalyzerTest.ts'
];

// Настройка тестовой среды
let editor = null;
let testContainer = null;
let errorsContainer = null;

/**
 * Инициализация тестовой среды
 */
function initTestEnvironment() {
  // Создаем контейнер для ошибок
  errorsContainer = document.createElement('div');
  errorsContainer.style.width = '800px';
  errorsContainer.style.margin = '20px auto';
  errorsContainer.style.padding = '10px';
  errorsContainer.style.backgroundColor = '#f9f9f9';
  errorsContainer.style.borderRadius = '5px';
  errorsContainer.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
  document.body.appendChild(errorsContainer);

  // Создаем контейнер для редактора
  testContainer = document.createElement('div');
  testContainer.style.width = '800px';
  testContainer.style.height = '600px';
  testContainer.style.margin = '20px auto';
  testContainer.style.border = '1px solid #ccc';
  testContainer.style.borderRadius = '5px';
  testContainer.style.overflow = 'hidden';
  testContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
  document.body.appendChild(testContainer);

  // Предварительная настройка Monaco
  configureMonaco();

  // Создаем редактор
  editor = monaco.editor.create(testContainer, {
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 14,
    lineNumbers: 'on',
    theme: 'vs',
    wordWrap: 'on',
    fontFamily: 'Consolas, "Courier New", monospace',
  });

  // Создаем интерфейс выбора файлов
  createFileSelector();
  
  // Настраиваем анализ ошибок при изменении содержимого
  editor.onDidChangeModelContent(() => {
    setTimeout(updateErrorList, 1000);
  });
}

/**
 * Создает интерфейс для выбора тестового файла
 */
function createFileSelector() {
  const selector = document.createElement('div');
  selector.style.margin = '20px auto';
  selector.style.width = '800px';
  selector.style.textAlign = 'center';
  
  const label = document.createElement('h3');
  label.textContent = 'Выберите тестовый файл:';
  selector.appendChild(label);
  
  // Создаем кнопки для каждого тестового файла
  TEST_FILES.forEach(file => {
    const button = document.createElement('button');
    button.textContent = file.split('/').pop();
    button.style.margin = '5px';
    button.style.padding = '8px 15px';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    button.style.backgroundColor = '#f5f5f5';
    button.style.border = '1px solid #ddd';
    button.style.fontSize = '14px';
    
    button.addEventListener('mouseover', () => {
      button.style.backgroundColor = '#e9e9e9';
    });
    
    button.addEventListener('mouseout', () => {
      button.style.backgroundColor = '#f5f5f5';
    });
    
    button.addEventListener('click', () => openTestFile(file));
    selector.appendChild(button);
  });
  
  // Добавляем кнопку для анализа ошибок
  const analyzeButton = document.createElement('button');
  analyzeButton.textContent = 'Анализировать ошибки';
  analyzeButton.style.margin = '5px 0 0 10px';
  analyzeButton.style.padding = '8px 15px';
  analyzeButton.style.borderRadius = '4px';
  analyzeButton.style.backgroundColor = '#4CAF50';
  analyzeButton.style.color = 'white';
  analyzeButton.style.border = 'none';
  analyzeButton.style.cursor = 'pointer';
  analyzeButton.style.fontSize = '14px';
  
  analyzeButton.addEventListener('mouseover', () => {
    analyzeButton.style.backgroundColor = '#45a049';
  });
  
  analyzeButton.addEventListener('mouseout', () => {
    analyzeButton.style.backgroundColor = '#4CAF50';
  });
  
  analyzeButton.addEventListener('click', updateErrorList);
  selector.appendChild(analyzeButton);
  
  // Добавляем селектор на страницу
  document.body.insertBefore(selector, errorsContainer);
}

/**
 * Открывает тестовый файл в редакторе
 * @param {string} filePath - Путь к файлу
 */
async function openTestFile(filePath) {
  try {
    // Определяем язык по расширению файла
    let language = 'typescript';
    if (filePath.endsWith('.tsx')) {
      language = 'typescriptreact';
    } else if (filePath.endsWith('.jsx')) {
      language = 'javascriptreact';
    } else if (filePath.endsWith('.js')) {
      language = 'javascript';
    } else if (filePath.endsWith('.ts')) {
      language = 'typescript';
    }
    
    // Загружаем содержимое файла
    const fileContent = await loadTestFile(filePath);
    
    // Создаем URI для файла
    const uri = monaco.Uri.parse(filePath);
    
    // Проверяем, существует ли модель для этого файла
    let model = monaco.editor.getModel(uri);
    if (model) {
      // Если модель существует, обновляем её содержимое
      model.setValue(fileContent);
    } else {
      // Создаем новую модель
      model = monaco.editor.createModel(fileContent, language, uri);
    }
    
    // Устанавливаем модель в редактор
    editor.setModel(model);
    
    // Применяем дополнительные настройки для языка
    if (language === 'typescript' || language === 'javascript' || 
        language === 'typescriptreact' || language === 'javascriptreact') {
      const isJsx = language === 'typescriptreact' || language === 'javascriptreact';
      
      // Настраиваем компилятор TypeScript для JSX файлов
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        jsx: isJsx ? monaco.languages.typescript.JsxEmit.React : monaco.languages.typescript.JsxEmit.None,
        jsxFactory: 'React.createElement',
        jsxFragmentFactory: 'React.Fragment',
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
      });
      
      // Настраиваем JavaScript для JSX файлов
      if (language === 'javascript' || language === 'javascriptreact') {
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
          jsx: isJsx ? monaco.languages.typescript.JsxEmit.React : monaco.languages.typescript.JsxEmit.None,
          jsxFactory: 'React.createElement',
          jsxFragmentFactory: 'React.Fragment',
          target: monaco.languages.typescript.ScriptTarget.ESNext,
          allowNonTsExtensions: true,
          moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
          module: monaco.languages.typescript.ModuleKind.ESNext,
          allowSyntheticDefaultImports: true,
          esModuleInterop: true,
        });
      }
      
      // Настраиваем диагностику
      setupSmartCodeAnalyzer(monaco, filePath);
    }
    
    // Обновляем список ошибок
    setTimeout(updateErrorList, 2000);
    
    // Обновляем заголовок контейнера с ошибками
    updateErrorsContainerHeader(filePath);
    
    console.log(`Открыт файл: ${filePath}, язык: ${language}`);
  } catch (error) {
    console.error('Ошибка при открытии файла:', error);
    errorsContainer.innerHTML = `<div style="color: red; padding: 10px;">Ошибка при открытии файла: ${error.message}</div>`;
  }
}

/**
 * Обновляет список ошибок в UI
 */
function updateErrorList() {
  if (!editor || !editor.getModel()) {
    return;
  }
  
  const errors = analyzeEditorErrors(editor);
  displayErrors(errors, errorsContainer);
}

/**
 * Обновляет заголовок контейнера с ошибками
 * @param {string} filePath - Путь к файлу
 */
function updateErrorsContainerHeader(filePath) {
  const fileName = filePath.split('/').pop();
  
  // Удаляем предыдущий заголовок
  const existingHeader = errorsContainer.querySelector('h3');
  if (existingHeader) {
    errorsContainer.removeChild(existingHeader);
  }
  
  // Создаем новый заголовок
  const header = document.createElement('h3');
  header.textContent = `Ошибки в файле: ${fileName}`;
  header.style.borderBottom = '1px solid #ddd';
  header.style.paddingBottom = '10px';
  header.style.marginTop = '0';
  
  // Добавляем заголовок в начало контейнера
  errorsContainer.insertBefore(header, errorsContainer.firstChild);
}

// Экспортируем функцию инициализации
export function initTestRunner() {
  initTestEnvironment();
  console.log('Тестовая среда Monaco Editor инициализирована');
} 