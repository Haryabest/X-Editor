// Этот файл содержит различные сценарии TypeScript для тестирования 
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

// ===== ТЕСТ 6: Намеренные ошибки, которые должны отображаться =====

/* 
Примечание: Ниже следуют примеры кода с намеренными ошибками.
Некоторые из них закомментированы с помощью @ts-ignore или помещены внутрь
функций, чтобы они не мешали остальным тестам.
*/

// Ошибка: Несоответствие типов (закомментировано для компиляции)
function typeErrorExample() {
  // @ts-ignore
  const errorString: string = 123; // Type 'number' is not assignable to type 'string'
}

// Ошибка: Отсутствует свойство (закомментировано для компиляции)
function missingPropertyExample() {
  // @ts-ignore
  const errorUser: User = {
    id: 1,
    name: "John"
    // отсутствует isActive
  };
}

// Ошибка: Неверное количество аргументов (обернуто в функцию)
function wrongArgumentsExample() {
  // @ts-ignore
  add(1); // Expected 2 arguments, but got 1
}

// Ошибка: Неверное значение для union типа (обернуто в функцию)
function wrongUnionTypeExample() {
  // @ts-ignore
  const errorRole: UserRole = "manager"; // Type '"manager"' is not assignable to type 'UserRole'
}

// ===== ТЕСТ 7: Модули и импорты =====
// Эта ошибка может быть скрыта, так как модуль не существует в тестовой среде
// @ts-ignore
import { Something } from './non-existent-module';

// ===== ТЕСТ 8: Объявление модуля (должно работать без ошибок в .ts, но вызвать ошибку в .jsx) =====
// @ts-ignore
declare module 'some-module' {
  export const value: string;
}

// ===== ТЕСТ 9: Аннотации типов (должны работать в .ts, но вызывать ошибку в .jsx) =====
const annotatedValue: string = "test";

// ===== ТЕСТ 10: Глобальные объявления (должны работать без ошибок) =====
declare global {
  interface Window {
    customProperty: string;
  }
}

window.customProperty = "test";

// Экспортируем что-нибудь, чтобы файл был модулем
export const testExport = { user, role }; 