/**
 * Содержимое файла TypeScriptTest.ts
 * Может быть скопировано в элемент #typescript-test-content
 */
const typeScriptTestContent = `// Этот файл содержит различные сценарии TypeScript для тестирования 
// работы Monaco Editor и обработки ошибок

// ===== ТЕСТ 1: Базовая типизация (должен работать без ошибок) =====
let testString: string = "Hello, world!";
let testNumber: number = 42;
let testBoolean: boolean = true;

// ===== ТЕСТ 2: Интерфейсы и типы (должен работать без ошибок) =====
interface User {
  id: number;
  name: string;
  isActive: boolean;
}

type UserRole = "admin" | "user" | "guest";

const user: User = {
  id: 1,
  name: "John",
  isActive: true
};

const role: UserRole = "admin";

// ===== ТЕСТ 3: Функции с типами (должен работать без ошибок) =====
function add(a: number, b: number): number {
  return a + b;
}

const multiply = (a: number, b: number): number => a * b;

// ===== ТЕСТ 4: Дженерики (должен работать без ошибок) =====
function identity<T>(arg: T): T {
  return arg;
}

function identityArrow<T>(arg: T): T {
  return arg;
}

// ===== ТЕСТ 5: Промисы и асинхронность (должен работать без ошибок) =====
async function fetchData(): Promise<string> {
  return "Data received";
}

const asyncArrow = async (): Promise<number> => {
  return 123;
};

// ===== ТЕСТ 6: Намеренные ошибки TypeScript - раскомментируйте для проверки =====

/* 
Раскомментируйте примеры, чтобы увидеть ошибки.
ВАЖНО: ошибки должны быть видны при проверке!
*/

// Ошибка: Несоответствие типов (код 2322)
function typeErrorExample() {
  // Раскомментируйте строку ниже для проверки ошибки:
  // const errorString: string = 123; // Type 'number' is not assignable to type 'string'
}

// Ошибка: Отсутствует свойство в объекте (код 2741)
function missingPropertyExample() {
  // Раскомментируйте строки ниже для проверки ошибки:
  /*
  const errorUser: User = {
    id: 1,
    name: "John"
    // отсутствует isActive
  };
  */
}

// Ошибка: Неверное количество аргументов (код 2554)
function wrongArgumentsExample() {
  // Раскомментируйте строку ниже для проверки ошибки:
  // add(1); // Expected 2 arguments, but got 1
}

// Ошибка: Неверное значение для типа-объединения (код 2322)
function wrongUnionTypeExample() {
  // Раскомментируйте строку ниже для проверки ошибки:
  // const errorRole: UserRole = "manager"; // Type '"manager"' is not assignable to type 'UserRole'
}

// ===== ТЕСТ 7: Модули и импорты =====
// Эта ошибка должна быть скрыта, т.к. модуль не существует (код 2307)
import { Something } from './non-existent-module';

// ===== ТЕСТ 8: Объявление модуля (должно работать без ошибок в .ts) =====
declare module 'some-module' {
  export const value: string;
}

// ===== ТЕСТ 9: Аннотации типов (должны работать в .ts) =====
const annotatedValue: string = "test";

// ===== ТЕСТ 10: Глобальные объявления (должны работать без ошибок) =====
declare global {
  interface Window {
    customProperty: string;
  }
}

window.customProperty = "test";

// ===== ТЕСТ 11: Новые возможности ES2021+ (должны работать без ошибок) =====
// Nullish coalescing оператор (??)
const nullishValue = null;
const defaultValue = nullishValue ?? "default";

// Optional chaining (?.)
const obj = { nested: { property: "value" } };
const nestedValue = obj?.nested?.property;

// ===== ТЕСТ 12: Более новый синтаксис TypeScript (должен работать без ошибок) =====
// Утверждение типа с "as"
const asTypeAssertion = "string" as string;

// Условные типы
type IsString<T> = T extends string ? true : false;
type StringCheckResult = IsString<"test">;

// Mapped types
type Readonly<T> = { readonly [P in keyof T]: T[P] };
type ReadonlyUser = Readonly<User>;

// Импорт типа
import type { Something as SomethingType } from './non-existent-module';

// Экспортируем что-нибудь, чтобы файл был модулем
export const testExport = { user, role };`;

export default typeScriptTestContent; 