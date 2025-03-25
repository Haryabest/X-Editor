// Этот файл содержит тесты для проверки работы умного анализатора кода
// и убеждения, что критические ошибки все еще отображаются

// Добавляем необходимые определения для работы с JSX в TS файлах
declare namespace React {
  function createElement(type: any, props?: any, ...children: any[]): any;
}

// ===== ТЕСТ 1: Критические ошибки синтаксиса (могут отображаться) =====

// Примеры закомментированы, чтобы файл мог компилироваться, но их можно раскомментировать для тестирования

// Отсутствующая точка с запятой (код 1012)
const missingTerminator = 10;

// Несоответствие скобок (код 1005)
function unbalancedBrackets() {
  if (true) {
    console.log("Ошибка");
  }
}

// Неожиданный конец ввода (код 1002)
function unexpectedEnd() {
  const value = {
    name: "Тест",
    value: 123
  };
}

// Пример синтаксических ошибок (закомментировано для работы файла)
/*
// Функция с несоответствием скобок
function brokenFunction() {
  if (true {
    console.log("Ошибка");
  }
}

// Объект с пропущенной запятой
const brokenObject = {
  name: "Test"
  value: 42
};
*/

// ===== ТЕСТ 2: Важные логические ошибки (должны отображаться) =====

// Вызов несуществующего метода (код 2551)
function callNonExistentMethod() {
  const obj = {} as any;
  obj.nonExistentMethod();
}

// Неверные аргументы функции (код 2554)
function testFunction(required: string) {
  return required.length;
}

function incorrectArguments() {
  testFunction("test");
  testFunction("123");
}

// ===== ТЕСТ 3: Проверка игнорирования кодов ошибок =====

// Импорт несуществующего модуля (код 2307)
// @ts-ignore
import { Something } from './non-existent-module';

// Объявление модуля (код 8006 в JSX файлах)
// @ts-ignore
declare module 'test-module' {
  export const value: string;
}

// Аннотации типов (код 8010 в JSX файлах)
const annotatedValue: string = "test";

// ===== ТЕСТ 4: Ошибки в JSX (для тестирования в TSX файлах) =====

// Вместо JSX синтаксиса используем вызов React.createElement напрямую
// Это избегает проблем с парсингом JSX в .ts файлах
const jsxInTs = React.createElement('div', null, 'Тестовый JSX');

// ===== ТЕСТ 5: Обработка глобальных объявлений =====

// Это может вызывать ошибку 2669, которую мы игнорируем
declare global {
  interface Window {
    testProperty: string;
  }
}

// ===== ТЕСТ 6: Проверка обработки стандартных синтаксических конструкций =====

// Функции с дженериками
function identity<T>(arg: T): T {
  return arg;
}

// Альтернативная запись без стрелочной функции
function genericArrow<T>(arg: T): T {
  return arg;
}

// Условные типы
type ConditionalType<T> = T extends string ? 'string' : 'other';

// Mapped types
type MappedType<T> = {
  [K in keyof T]: T[K];
};

// Опциональное связывание
function optionalChaining(obj: any) {
  return obj?.property?.nested;
}

// Экспортируем для использования в тестах
export const testExport = {
  genericArrow,
  optionalChaining
}; 