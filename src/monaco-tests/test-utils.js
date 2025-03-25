/**
 * Утилиты для тестирования Monaco Editor
 */

// Импортируем необходимые зависимости
import * as monaco from 'monaco-editor';

/**
 * Загружает содержимое тестового файла
 * @param {string} filePath - Путь к файлу
 * @returns {Promise<string>} - Содержимое файла
 */
export async function loadTestFile(filePath) {
  // Карта содержимого файлов для локальной разработки
  const fileContentMap = {
    'src/monaco-tests/TypeScriptTest.ts': document.querySelector('#typescript-test-content')?.textContent || '',
    'src/monaco-tests/ReactComponentTest.tsx': document.querySelector('#react-test-content')?.textContent || '',
    'src/monaco-tests/JsxComponentTest.jsx': document.querySelector('#jsx-test-content')?.textContent || '',
    'src/monaco-tests/SmartAnalyzerTest.ts': document.querySelector('#smart-analyzer-test-content')?.textContent || ''
  };

  // Проверяем, есть ли файл в нашей карте
  if (fileContentMap[filePath]) {
    console.log(`Загружен файл из DOM: ${filePath}`);
    return fileContentMap[filePath];
  }

  try {
    // Если нет в карте, пробуем загрузить через fetch
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.error(`Ошибка загрузки файла ${filePath}:`, error);
    return `// Ошибка загрузки файла ${filePath}\n// ${error.message}`;
  }
}

/**
 * Анализ ошибок в редакторе
 * @param {monaco.editor.IStandaloneCodeEditor} editor - Экземпляр редактора
 * @returns {Array<Object>} - Массив ошибок
 */
export function analyzeEditorErrors(editor) {
  const markers = monaco.editor.getModelMarkers({
    resource: editor.getModel()?.uri
  });
  
  return markers.map(marker => ({
    startLineNumber: marker.startLineNumber,
    startColumn: marker.startColumn,
    endLineNumber: marker.endLineNumber,
    endColumn: marker.endColumn,
    message: marker.message,
    severity: marker.severity,
    code: marker.code
  }));
}

/**
 * Отображение найденных ошибок в UI
 * @param {Array<Object>} errors - Массив ошибок
 * @param {HTMLElement} container - Контейнер для отображения ошибок
 */
export function displayErrors(errors, container) {
  container.innerHTML = '';
  
  if (errors.length === 0) {
    const noErrorsMsg = document.createElement('p');
    noErrorsMsg.textContent = 'Ошибок не обнаружено.';
    container.appendChild(noErrorsMsg);
    return;
  }
  
  const list = document.createElement('ul');
  list.className = 'error-list';
  
  errors.forEach(error => {
    const item = document.createElement('li');
    item.innerHTML = `
      <strong>Строка ${error.startLineNumber}:${error.startColumn}:</strong>
      ${escapeHtml(error.message)}
      ${error.code ? `<code>[${error.code}]</code>` : ''}
    `;
    
    // Добавляем цвет в зависимости от важности ошибки
    switch (error.severity) {
      case monaco.MarkerSeverity.Error:
        item.style.color = '#e74c3c';
        break;
      case monaco.MarkerSeverity.Warning:
        item.style.color = '#f39c12';
        break;
      case monaco.MarkerSeverity.Info:
        item.style.color = '#3498db';
        break;
    }
    
    list.appendChild(item);
  });
  
  container.appendChild(list);
}

/**
 * Экранирование HTML-тегов
 * @param {string} text - Исходный текст
 * @returns {string} - Экранированный текст
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Содержимое тестовых файлов
function getTypeScriptTestContent() {
  return `// Тестовый файл: TypeScriptTest.ts
// Примеры базовых типов и интерфейсов в TypeScript

// Базовые типы
const name: string = 'John Doe';
const age: number = 30;
const isActive: boolean = true;

// Сложные типы
type UserRole = 'admin' | 'user' | 'guest';
interface User {
  id: number;
  name: string;
  age?: number;
  isActive: boolean;
  role: UserRole;
}

// Функция с типизацией
function greet(user: User): string {
  return \`Hello, \${user.name}! You are \${user.age ?? 'unknown'} years old.\`;
}

// Функция с несколькими параметрами
function add(a: number, b: number): number {
  return a + b;
}

// Обобщенные типы (generics)
function identity<T>(value: T): T {
  return value;
}

// Использование промисов
async function fetchData<T>(url: string): Promise<T> {
  const response = await fetch(url);
  return response.json() as Promise<T>;
}

// Пример, который должен вызвать ошибку: несоответствие типов
const errorString: string = 123; // ошибка: Type 'number' is not assignable to type 'string'

// Пример, который должен вызвать ошибку: отсутствующее свойство
const errorUser: User = {
  id: 1,
  name: 'Jane',
  role: 'admin'
  // отсутствует isActive: boolean
};

// Пример, который должен вызвать ошибку: неверный вызов функции
add(1); // ошибка: Expected 2 arguments, but got 1

// Пример, который должен вызвать ошибку: неверный тип
const errorRole: UserRole = "manager"; // ошибка: Type '"manager"' is not assignable to type 'UserRole'

// Пример, который может быть проигнорирован: импорт несуществующего модуля
import { nonExistentFunction } from './non-existent-module';

// Пример, который может быть проигнорирован: объявление глобального модуля
declare module 'some-module' {
  export interface GlobalConfig {
    setting: string;
  }
}

// Пример использования стрелочных функций
const arrowFunction = (x: number): number => x * 2;

// Пример использования условных типов
type NonNullable<T> = T extends null | undefined ? never : T;
`;
}

function getReactComponentTestContent() {
  return `// Тестовый файл: ReactComponentTest.tsx
// Примеры React компонентов с использованием TypeScript

import React, { useState, useEffect, FC, ReactNode } from 'react';

// Простой функциональный компонент
const SimpleComponent: FC = () => {
  return (
    <div>
      <h1>Hello, World!</h1>
      <p>This is a simple React component.</p>
    </div>
  );
};

// Компонент с props
interface ButtonProps {
  text: string;
  onClick: () => void;
  disabled?: boolean;
}

const Button: FC<ButtonProps> = ({ text, onClick, disabled = false }) => {
  return (
    <button 
      className="button primary" 
      onClick={onClick} 
      disabled={disabled}
    >
      {text}
    </button>
  );
};

// Компонент с использованием хуков
const CounterComponent: FC = () => {
  const [count, setCount] = useState<number>(0);
  
  useEffect(() => {
    document.title = \`Count: \${count}\`;
  }, [count]);
  
  return (
    <div>
      <p>Count: {count}</p>
      <Button 
        text="Increment" 
        onClick={() => setCount(prev => prev + 1)} 
      />
    </div>
  );
};

// Компонент с вложенными элементами
interface NestedComponentProps {
  showDetails: boolean;
  children?: ReactNode;
}

const NestedComponent: FC<NestedComponentProps> = ({ showDetails, children }) => {
  return (
    <div className="container">
      <h2>Nested Component</h2>
      {showDetails && (
        <div className="details">
          <p>Additional details are shown here.</p>
          {children}
        </div>
      )}
    </div>
  );
};

// Классовый компонент с состоянием
interface ClassCounterState {
  count: number;
}

class ClassCounter extends React.Component<{}, ClassCounterState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      count: 0
    };
  }
  
  increment = () => {
    this.setState(prevState => ({
      count: prevState.count + 1
    }));
  };
  
  render() {
    return (
      <div>
        <p>Class Component Count: {this.state.count}</p>
        <button onClick={this.increment}>Increment</button>
      </div>
    );
  }
}

// =========================================================
// Примеры, которые должны вызвать ошибки в TSX:
// =========================================================

// Пример, который должен вызвать ошибку: неизвестный атрибут
const InvalidJsxAttribute = () => (
  <div invalidAttr="value">
    This should not cause an error in JSX, but might in TSX
  </div>
);

// Пример, который должен вызвать ошибку: пропущен обязательный prop
const MissingPropExample = () => (
  <Button onClick={() => console.log("click")} />
  // Отсутствует обязательное свойство text
);

// Пример, который должен вызвать ошибку: неверный тип props
const WrongPropTypeExample = () => (
  <Button text={123} onClick={() => {}} />
  // text должен быть string, а не number
);

// =========================================================
// Примеры валидного JSX синтаксиса:
// =========================================================

// Использование фрагментов
const FragmentExample = () => (
  <>
    <h1>Fragment Title</h1>
    <p>This uses React Fragments</p>
  </>
);

// Self-closing теги
const SelfClosingExample = () => (
  <div>
    <img src="image.jpg" alt="Example" />
    <br />
    <input type="text" />
  </div>
);

// Типизированный компонент
interface TypedComponentProps {
  name: string;
  count: number;
}

const TypedComponent: FC<TypedComponentProps> = ({ name, count }) => (
  <div data-testid="typed-component">
    <h3>{name}</h3>
    <p>Count: {count}</p>
  </div>
);

export {
  SimpleComponent,
  Button,
  CounterComponent,
  NestedComponent,
  ClassCounter,
  InvalidJsxAttribute,
  MissingPropExample,
  WrongPropTypeExample,
  FragmentExample,
  SelfClosingExample,
  TypedComponent
};
`;
}

function getJsxComponentTestContent() {
  return `// Тестовый файл: JsxComponentTest.jsx
// Примеры React компонентов без использования TypeScript

import React, { useState, useEffect } from 'react';

// Простой JSX компонент
const SimpleJsxComponent = () => {
  return (
    <div>
      <h1>Hello, JSX World!</h1>
      <p>This is a simple React component using JSX.</p>
    </div>
  );
};

// Компонент с props
const JsxButton = ({ text, onClick, disabled = false }) => {
  return (
    <button 
      className="button primary" 
      onClick={onClick} 
      disabled={disabled}
    >
      {text}
    </button>
  );
};

// Компонент с использованием хуков
const JsxCounter = () => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    document.title = \`Count: \${count}\`;
  }, [count]);
  
  return (
    <div>
      <p>Count: {count}</p>
      <JsxButton 
        text="Increment" 
        onClick={() => setCount(prev => prev + 1)} 
      />
    </div>
  );
};

// Классовый компонент
class JsxClassCounter extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      count: 0
    };
  }
  
  increment = () => {
    this.setState(prevState => ({
      count: prevState.count + 1
    }));
  };
  
  render() {
    return (
      <div>
        <p>Class Component Count: {this.state.count}</p>
        <button onClick={this.increment}>Increment</button>
      </div>
    );
  }
}

// =========================================================
// Проверка ошибок TypeScript внутри JSX файла
// =========================================================

// Это должно работать без ошибок в JSX файле
const typedVariable = "test";
const numberVar = 42;

// Это должно работать без ошибок в JSX, но вызовет ошибки в TS
interface TestInterface {
  name: string;
  age: number;
}

function testFunction(param: string): string {
  return param;
}

// =========================================================
// Сложный компонент с разными JSX конструкциями
// =========================================================

const MixedComponent = ({ items, isLoggedIn, userData }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const handleItemClick = (index) => {
    setSelectedIndex(index);
  };
  
  return (
    <div className="mixed-component">
      {isLoggedIn ? (
        <div className="user-panel">
          <h2>Welcome, {userData.name}!</h2>
          
          <ul className="item-list">
            {items.map((item, index) => (
              <li 
                key={item.id} 
                className={index === selectedIndex ? 'selected' : ''}
                onClick={() => handleItemClick(index)}
              >
                {item.label}
              </li>
            ))}
          </ul>
          
          <JsxButton 
            text="Logout" 
            onClick={() => console.log('Logout clicked')} 
            {...userData.buttonProps}
          />
        </div>
      ) : (
        <div className="login-prompt">
          <p>Please log in to continue</p>
          <JsxButton text="Login" onClick={() => console.log('Login clicked')} />
        </div>
      )}
    </div>
  );
};

export {
  SimpleJsxComponent,
  JsxButton,
  JsxCounter,
  JsxClassCounter,
  MixedComponent
};
`;
}

function getSmartAnalyzerTestContent() {
  return `// Тестовый файл: SmartAnalyzerTest.ts
// Тесты для проверки умного анализатора кода

// =========================================================
// Тест 1: Критические синтаксические ошибки
// =========================================================

// Ошибка: пропущенная точка с запятой
const missingSemicolon = 42

// Ошибка: несбалансированные скобки
function unbalancedBrackets() {
  if (true) {
    console.log("This function is missing a closing bracket"
}

// Ошибка: неожиданный конец ввода
const incompleteObject = {
  name: "Test",
  value: 42,
  

// =========================================================
// Тест 2: Важные логические ошибки
// =========================================================

// Ошибка: вызов несуществующего метода
function callNonExistentMethod() {
  const obj = {};
  obj.nonExistentMethod();
}

// Ошибка: неверные аргументы функции
function requiredTwoParams(a: string, b: string): string {
  return a + b;
}
requiredTwoParams("only one");

// =========================================================
// Тест 3: Игнорирование кодов ошибок
// =========================================================

// Должно игнорироваться: импорт несуществующего модуля (код 2307)
import { nonExistentFunction } from './non-existent-module';

// Должно игнорироваться: объявление модуля (код 8006 - 'module' declarations can only be used in TypeScript files)
declare module "custom-module" {
  export interface CustomType {
    property: string;
  }
}

// =========================================================
// Тест 4: JSX ошибки
// =========================================================

// Должно игнорироваться в TS файле (коды 8006, 8010 - TypeScript-only features in non-TS files)
const jsx = <div>Hello, world!</div>;

// =========================================================
// Тест 5: Глобальные объявления
// =========================================================

// Должно игнорироваться (код 2669 - Augmentations for the global scope)
declare global {
  interface Window {
    customProperty: string;
  }
}

// =========================================================
// Тест 6: Стандартные синтаксические конструкции
// =========================================================

// Стрелочные функции с обобщенными типами
const identity = <T>(value: T): T => value;

// Условные типы
type NonNullable<T> = T extends null | undefined ? never : T;

// Отображаемые типы
type ReadonlyProps<T> = {
  readonly [P in keyof T]: T[P];
};

// Опциональная цепочка
const user = {
  profile: {
    address: {
      city: "New York"
    }
  }
};

const city = user?.profile?.address?.city;
`;
} 