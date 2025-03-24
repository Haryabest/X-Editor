import { Monaco } from '@monaco-editor/react';

export function configureTSXLanguage(monaco: Monaco) {
  // Регистрируем новый язык для TSX файлов
  monaco.languages.register({ id: 'typescript-react', extensions: ['.tsx'] });
  
  // Настраиваем токенизатор для TSX файлов
  monaco.languages.setMonarchTokensProvider('typescript-react', {
    defaultToken: 'invalid',
    tokenPostfix: '.tsx',
    
    // Общие регулярные выражения
    brackets: [
      { open: '{', close: '}', token: 'delimiter.curly' },
      { open: '[', close: ']', token: 'delimiter.square' },
      { open: '(', close: ')', token: 'delimiter.parenthesis' },
      { open: '<', close: '>', token: 'delimiter.angle' }
    ],
    
    keywords: [
      'abstract', 'any', 'as', 'async', 'await', 'boolean', 'break', 'case', 'catch', 'class',
      'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export',
      'extends', 'false', 'finally', 'for', 'from', 'function', 'get', 'if', 'implements',
      'import', 'in', 'infer', 'instanceof', 'interface', 'is', 'keyof', 'let', 'module',
      'namespace', 'never', 'new', 'null', 'number', 'object', 'package', 'private', 'protected',
      'public', 'readonly', 'require', 'return', 'set', 'static', 'string', 'super', 'switch',
      'symbol', 'this', 'throw', 'true', 'try', 'type', 'typeof', 'unique', 'unknown', 'var',
      'void', 'while', 'with', 'yield'
    ],
    
    typeKeywords: [
      'any', 'boolean', 'number', 'object', 'string', 'undefined'
    ],
    
    // Определяем операторы напрямую в регулярных выражениях
    
    // Мы определяем начальное состояние
    tokenizer: {
      root: [
        // JSX
        [/(<)([a-zA-Z][\w\-\.]*)/, ['delimiter.angle', { token: 'tag.tagname', next: '@jsxtag' }]],
        [/(<\/)([a-zA-Z][\w\-\.]*)/, ['delimiter.angle', { token: 'tag.tagname', next: '@jsxclosingtag' }]],
        
        // Идентификаторы и ключевые слова
        [/[a-z_$][\w$]*/, {
          cases: {
            '@typeKeywords': 'keyword.type',
            '@keywords': 'keyword',
            '@default': 'identifier'
          }
        }],
        
        // Числа
        [/\d+/, 'number'],
        
        // Разделители и операторы
        [/[{}()\[\]]/, 'delimiter'],
        [/[<>]/, 'delimiter.angle'],
        
        // Операторы - перечисляем их напрямую
        [/<=|>=|==|!=|===|!==|=>|\+|-|\*\*|\*|\/|%|\+\+|--|\|\||&&|\?\?|\?|:|=|\+=|-=|\*=|\*\*=|\/=|%=|<<=|>>=|>>>=|&=|\|=|\^=|@/, 'operator'],
        
        // Строки
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/'([^'\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string_double'],
        [/'/, 'string', '@string_single'],
        [/`/, 'string', '@string_backtick']
      ],
      
      jsxtag: [
        [/[ \t\r\n]+/, ''],
        [/(\/)?>/, 'delimiter.angle', '@pop'],
        [/([a-zA-Z][\w\-]*)(\s*=\s*)("[^"]*"|'[^']*')/, ['attribute.name', '', 'attribute.value']],
        [/([a-zA-Z][\w\-]*)(\s*=\s*)/, ['attribute.name', '']],
        [/[a-zA-Z][\w\-]*/, 'attribute.name'],
        [/=/, 'operator']
      ],
      
      jsxclosingtag: [
        [/[ \t\r\n]+/, ''],
        [/>/, 'delimiter.angle', '@pop']
      ],
      
      string_double: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop']
      ],
      
      string_single: [
        [/[^\\']+/, 'string'],
        [/\\./, 'string.escape'],
        [/'/, 'string', '@pop']
      ],
      
      string_backtick: [
        [/[^\\`$]+/, 'string'],
        [/\$\{/, { token: 'delimiter.bracket', next: '@bracketCounting' }],
        [/\\./, 'string.escape'],
        [/`/, 'string', '@pop']
      ],
      
      bracketCounting: [
        [/\{/, 'delimiter.bracket', '@bracketCounting'],
        [/\}/, 'delimiter.bracket', '@pop'],
        { include: 'root' }
      ]
    }
  });
  
  // Добавляем определение для TSX файлов напрямую
  monaco.languages.typescript.typescriptDefaults.addExtraLib(`
    // Определение для TSX файлов
    declare module '*.tsx' {
      import React from 'react';
      const component: React.FC<any>;
      export default component;
    }
  `, 'tsx-module.d.ts');
} 