// Этот файл содержит тестовые сценарии для React/TSX кода
// и проверки корректной обработки JSX синтаксиса в Monaco Editor

import React, { useState, useEffect, FC, ReactNode } from 'react';

// ===== ТЕСТ 1: Простой функциональный компонент (должен работать без ошибок) =====
const SimpleComponent: FC = () => {
  return (
    <div>
      <h1>Hello, World!</h1>
      <p>This is a simple React component.</p>
    </div>
  );
};

// ===== ТЕСТ 2: Компонент с пропсами (должен работать без ошибок) =====
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

// ===== ТЕСТ 3: Хуки и состояние (должен работать без ошибок) =====
const CounterComponent: FC = () => {
  const [count, setCount] = useState<number>(0);
  
  useEffect(() => {
    document.title = `Count: ${count}`;
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

// ===== ТЕСТ 4: Вложенные компоненты и условия (должен работать без ошибок) =====
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

// ===== ТЕСТ 5: Классовый компонент (должен работать без ошибок) =====
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

// ===== ТЕСТ 6: Намеренные ошибки JSX, которые должны отображаться =====

// Ошибка: Неизвестный атрибут (может не показываться, но это нормально)
const ErrorComponent1 = () => (
  <div invalid-attr="test">
    Неверный атрибут
  </div>
);

/* 
 * Примечание: Ниже следуют примеры компонентов с намеренными ошибками.
 * Эти ошибки обернуты в функции, чтобы они не мешали компиляции.
 */

// Ошибка: Пропущено свойство (должна быть видна)
function MissingPropComponent() {
  // В реальном использовании это вызовет ошибку:
  // Property 'text' is missing in type '{ onClick: () => void; }' 
  // but required in type 'ButtonProps'.
  return (
    <Button 
      // @ts-ignore - Намеренно пропущен обязательный пропс text
      onClick={() => console.log("click")} text={''}    />
  );
}

// Ошибка: Неверный тип пропса (должна быть видна)
function WrongPropTypeComponent() {
  // В реальном использовании это вызовет ошибку:
  // Type 'number' is not assignable to type 'string'.
  return (
    <Button 
      // @ts-ignore - Намеренно передан неверный тип
      text={123}
      onClick={() => {}} 
    />
  );
}

// ===== ТЕСТ 7: JSX синтаксис, который обычно вызывает ложные ошибки, но должен работать =====

// Фрагменты (должны работать без ошибок)
const FragmentComponent = () => (
  <>
    <div>Элемент 1</div>
    <div>Элемент 2</div>
  </>
);

// Self-closing теги (должны работать без ошибок)
const SelfClosingComponent = () => (
  <div>
    <img src="image.jpg" alt="изображение" />
    <br />
    <input type="text" value="test" onChange={() => {}} />
  </div>
);

// JSX в выражениях (должно работать без ошибок)
const JsxInExpressions = () => {
  const element = <span>Внутренний элемент</span>;
  
  return (
    <div>
      {element}
      {[1, 2, 3].map(item => (
        <div key={item}>{item}</div>
      ))}
    </div>
  );
};

// ===== ТЕСТ 8: Типизация в JSX контексте =====
// Это может вызывать ошибки 8006 и 8010, которые мы игнорируем
const TypedComponent = () => {
  const value: string = "Строка";
  
  return (
    <div>{value}</div>
  );
};

// Экспортируем компоненты
export {
  SimpleComponent,
  Button,
  CounterComponent,
  NestedComponent,
  ClassCounter,
  ErrorComponent1,
  MissingPropComponent,
  WrongPropTypeComponent,
  FragmentComponent,
  SelfClosingComponent,
  JsxInExpressions,
  TypedComponent
}; 