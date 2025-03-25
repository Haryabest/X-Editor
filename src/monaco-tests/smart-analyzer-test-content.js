/**
 * Содержимое файла SmartAnalyzerTest.ts
 * Может быть скопировано в элемент #smart-analyzer-test-content
 */
const smartAnalyzerTestContent = `// Этот файл содержит тесты для проверки работы умного анализатора кода
// и убеждения, что критические ошибки все еще отображаются

// Добавляем необходимые определения для работы с JSX в TS файлах
declare namespace React {
  function createElement(type: any, props?: any, ...children: any[]): any;
}

// ===== ТЕСТ 1: Критические ошибки синтаксиса (должны отображаться) =====

// Раскомментируйте эти строки, чтобы увидеть ошибки:

/*
// Функция с несоответствием скобок (код 1005)
function brokenFunction1() {
  if (true {
    console.log("Ошибка");
  }
}

// Объект с пропущенной запятой (код 1005)
const brokenObject1 = {
  name: "Test"
  value: 42
};

// Отсутствующая точка с запятой (код 1005)
let x = 10
const y = 20
*/

// ===== ТЕСТ 2: Важные логические ошибки (должны отображаться) =====

function generateErrorsForTesting() {
  // Вызов несуществующего метода (код 2551)
  const obj = {};
  // @ts-ignore - раскомментируйте следующую строку для проверки ошибки:
  // obj.nonExistentMethod();
  
  // Неверные аргументы функции (код 2554)
  function testRequiredParams(a: string, b: number): string {
    return a + b.toString();
  }
  
  // @ts-ignore - раскомментируйте следующую строку для проверки ошибки:
  // testRequiredParams("test"); // ошибка - отсутствует второй параметр
  
  // Присвоение несовместимого типа (код 2322)
  let str: string = "test";
  // @ts-ignore - раскомментируйте следующую строку для проверки ошибки:
  // str = 42; // ошибка - нельзя присвоить number переменной типа string
  
  return { obj, testRequiredParams };
}

// ===== ТЕСТ 3: Проверка игнорирования кодов ошибок =====

// Импорт несуществующего модуля (код 2307) - должен игнорироваться
import { Something } from './non-existent-module';

// Объявление модуля (код 8006 в JSX файлах) - должно игнорироваться
declare module 'test-module' {
  export const value: string;
}

// Аннотации типов (код 8010 в JSX файлах) - должно игнорироваться
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

// Функции с дженериками (должны работать без ошибок)
function identity<T>(arg: T): T {
  return arg;
}

// Пример с типом T, который ограничен строкой (должен работать без ошибок)
function stringIdentity<T extends string>(arg: T): T {
  return arg;
}

// Пример с интерфейсом (должен работать без ошибок)
interface HasLength {
  length: number;
}

function getLength<T extends HasLength>(arg: T): number {
  return arg.length;
}

// Условные типы (должны работать без ошибок)
type ConditionalType<T> = T extends string ? 'string' : 'other';

// Mapped types (должны работать без ошибок)
type MappedType<T> = {
  [K in keyof T]: T[K];
};

// Опциональное связывание (должно работать без ошибок)
function optionalChaining(obj: any) {
  return obj?.property?.nested;
}

// ===== ТЕСТ 7: Синтаксис ES2021+ (должен работать без ошибок) =====

// Nullish коалесцирующий оператор
function nullishCoalescing(value: string | null | undefined): string {
  return value ?? "default";
}

// Optional chaining с вызовом метода
function optionalMethodCall(obj: any) {
  return obj?.method?.();
}

// Приватные поля класса
class WithPrivateField {
  #privateField: string = "private";
  
  getPrivate(): string {
    return this.#privateField;
  }
}

// Экспортируем для использования в тестах
export const testExport = {
  identity,
  stringIdentity,
  getLength,
  optionalChaining,
  nullishCoalescing,
  optionalMethodCall
};`;

export default smartAnalyzerTestContent; 