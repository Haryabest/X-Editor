/**
 * Регистрация поддержки TSX в Monaco
 */

/**
 * Регистрирует TSX поддержку
 */
export function registerTSX(): boolean {
  try {
    if (!window.monaco) {
      console.warn('Monaco не найден');
      return false;
    }
    
    console.log('Регистрация TSX поддержки...');
    const monaco = window.monaco;
    
    // Регистрируем язык TSX если не зарегистрирован
    if (!monaco.languages.getLanguages().some((lang: { id: string }) => lang.id === 'typescriptreact')) {
      monaco.languages.register({
        id: 'typescriptreact',
        extensions: ['.tsx'],
        aliases: ['TypeScript React', 'tsx'],
        mimetypes: ['text/typescript-jsx']
      });
    }
    
    // Настраиваем поддержку JSX в TypeScript
    if (monaco.languages.typescript) {
      const ts = monaco.languages.typescript;
      const compilerOptions = {
        jsx: ts.JsxEmit.React,
        jsxFactory: 'React.createElement',
        reactNamespace: 'React',
        allowNonTsExtensions: true,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true
      };
      
      ts.typescriptDefaults.setCompilerOptions(compilerOptions);
      
      // Добавляем минимальные React определения
      const reactDefs = `
declare namespace React {
  function createElement(type: any, props?: any, ...children: any[]): any;
  function useState<T>(initialState: T): [T, (newState: T) => void];
  function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  
  class Component<P = {}, S = {}> {
    props: P;
    state: S;
    setState(state: S): void;
    render(): any;
  }
}

declare namespace JSX {
  interface Element {}
  interface IntrinsicElements {
    div: any;
    span: any;
    button: any;
    input: any;
    [elemName: string]: any;
  }
}
`;
      ts.typescriptDefaults.addExtraLib(reactDefs, 'react.d.ts');
    }
    
    // Устанавливаем язык для TSX файлов
    monaco.editor.onDidCreateModel((model: { uri: { path: string } }) => {
      if (model.uri.path.endsWith('.tsx')) {
        monaco.editor.setModelLanguage(model, 'typescriptreact');
      }
    });
    
    console.log('TSX поддержка успешно настроена');
    return true;
  } catch (error) {
    console.error('Ошибка при настройке TSX:', error);
    return false;
  }
} 