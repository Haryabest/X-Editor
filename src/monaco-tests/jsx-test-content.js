/**
 * Содержимое файла JsxComponentTest.jsx
 * Может быть скопировано в элемент #jsx-test-content
 */
const jsxTestContent = `// Этот файл содержит тестовые сценарии для React/JSX кода
// для проверки корректной обработки в Monaco Editor

import React, { useState, useEffect } from 'react';

// ===== ТЕСТ 1: Простой компонент с JSX (должен работать без ошибок) =====
function SimpleJsxComponent() {
  return (
    <div className="container">
      <h1>Заголовок</h1>
      <p>Параграф текста</p>
    </div>
  );
}

// ===== ТЕСТ 2: Компонент с пропсами (должен работать без ошибок) =====
function JsxButton({ text, onClick, disabled }) {
  return (
    <button 
      className="button" 
      onClick={onClick} 
      disabled={disabled}
    >
      {text}
    </button>
  );
}

// ===== ТЕСТ 3: Хуки и состояние (должен работать без ошибок) =====
function JsxCounter() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    document.title = \`Count: \${count}\`;
  }, [count]);
  
  return (
    <div>
      <p>Текущий счет: {count}</p>
      <JsxButton 
        text="Увеличить" 
        onClick={() => setCount(count + 1)} 
      />
    </div>
  );
}

// ===== ТЕСТ 4: Классовый компонент (должен работать без ошибок) =====
class JsxClassCounter extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      count: 0
    };
  }
  
  increment = () => {
    this.setState({ count: this.state.count + 1 });
  };
  
  render() {
    return (
      <div>
        <p>Счет: {this.state.count}</p>
        <button onClick={this.increment}>Увеличить</button>
      </div>
    );
  }
}

// ===== ТЕСТ 5: Проверка синтаксиса TypeScript в JSX файле =====
// Эти конструкции используют JavaScript комментарии вместо TypeScript синтаксиса

// Типизация переменных в JSX (комментарии вместо настоящих типов)
// @type {string}
const typedVar = "Это должно работать в JSX файле";

// @type {number}
const numberVar = 42;

// Интерфейсы и типы (в комментариях)
/*
interface TestInterface {
  property: string;
}

type TestType = "a" | "b" | "c";
*/

// Дженерики (заменены на обычные функции)
function genericFunction(value) {
  return value;
}

// ===== ТЕСТ 6: Смешанные конструкции, которые должны работать =====
function MixedComponent() {
  // JSX и условия
  const condition = true;
  
  // Spread props
  const buttonProps = {
    text: "Нажми меня",
    onClick: () => alert("Клик!"),
    className: "primary"
  };
  
  return (
    <div>
      {condition ? (
        <div>Условие истинно</div>
      ) : (
        <span>Условие ложно</span>
      )}
      
      <JsxButton {...buttonProps} />
      
      {/* Комментарий в JSX */}
      <div>
        {/* Массивы и ключи */}
        {[1, 2, 3].map(item => <div key={item}>{item}</div>)}
      </div>
    </div>
  );
}

// Экспортируем компоненты
export {
  SimpleJsxComponent,
  JsxButton,
  JsxCounter,
  JsxClassCounter,
  MixedComponent
};`;

export default jsxTestContent; 