export const configureMonaco = (monaco: any) => {
  if (!monaco) {
    console.error('Monaco instance is undefined');
    return;
  }

  // Add basic React types
  const reactTypes = `
    declare module "react" {
      export = React;
      export as namespace React;
      
      declare namespace React {
        export type ReactNode = string | number | boolean | null | undefined | React.ReactElement | React.ReactFragment | React.ReactPortal;
        export interface ReactElement<P = any> {
          type: string | React.ComponentType<P>;
          props: P;
          key: string | number | null;
        }
        export type ComponentType<P = {}> = React.ComponentClass<P> | React.FunctionComponent<P>;
        export interface FunctionComponent<P = {}> {
          (props: P): ReactElement | null;
        }
        export const useState: <T>(initialState: T | (() => T)) => [T, (newState: T | ((prev: T) => T)) => void];
        export const useEffect: (effect: () => void | (() => void), deps?: readonly any[]) => void;
        export const useCallback: <T extends (...args: any[]) => any>(callback: T, deps: readonly any[]) => T;
        export const useMemo: <T>(factory: () => T, deps: readonly any[]) => T;
        export const useRef: <T>(initialValue: T) => { current: T };
      }
    }
  `;

  // Configure TypeScript compiler options
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    noEmit: true,
    esModuleInterop: true,
    jsx: monaco.languages.typescript.JsxEmit.React,
    reactNamespace: "React",
    allowJs: true,
    skipLibCheck: true,
    strict: false,
    noImplicitAny: false,
    isolatedModules: true,
    lib: ["ESNext", "DOM", "DOM.Iterable"],
    typeRoots: ["node_modules/@types"],
    noUnusedLocals: false,
    noUnusedParameters: false,
    strictNullChecks: false,
    noStrictGenericChecks: true,
    suppressImplicitAnyIndexErrors: true,
    baseUrl: ".",
    paths: {
      "*": ["*", "node_modules/*", "src/*"],
      "@/*": ["./src/*", "./components/*"],
      "../*": ["../src/*", "../*"],
      "~/*": ["./*"],
      "react": ["./node_modules/react", "./src/types/react"],
      "react-dom": ["./node_modules/react-dom"]
    }
  });

  // Configure diagnostics options - расширяем список игнорируемых ошибок
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: true,
    diagnosticCodesToIgnore: [
      2669, 1046, 2307, 7031, 1161, 2304, 7026, 2322, 7006,
      2740, 2339, 2531, 2786, 2605, 1005, 1003, 17008, 2693, 1109,
      1128, 1434, 1136, 1110, 8006, 8010, 2688, 1039, 2792, 1183, 
      1254, 2695, 2365, 2714, 2552, 2362, 2503, 2363, 18004, 7027,
      2451, 6133, 2769, 7005, 2355, 18002, 18003, 2306, 2665, 6196,
      7053, 2602, 2551, 2578, 7008, 2525, 2683, 2821, 2614, 2459, 2580, 2487,
      1011, // An element access expression should take an argument
      8016  // Type assertion expressions can only be used in TypeScript files
    ]
  });

  // Add React types
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    reactTypes,
    'file:///node_modules/@types/react/index.d.ts'
  );

  // Enable language features
  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
  monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);

  // Применяем те же настройки для JavaScript файлов
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    noEmit: true,
    esModuleInterop: true,
    jsx: monaco.languages.typescript.JsxEmit.React,
    reactNamespace: "React",
    allowJs: true,
    skipLibCheck: true,
    noImplicitAny: false,
    suppressImplicitAnyIndexErrors: true
  });

  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: true,
    diagnosticCodesToIgnore: [
      2669, 1046, 2307, 7031, 1161, 2304, 7026, 2322, 7006,
      2740, 2339, 2531, 2786, 2605, 1005, 1003, 17008, 2693, 1109,
      1128, 1434, 1136, 1110, 8006, 8010, 2688, 1039, 2792, 1183, 
      1254, 2695, 2365, 2714, 2552, 2362, 2503, 2363, 18004, 7027,
      2451, 6133, 2769, 7005, 2355, 18002, 18003, 2306, 2665, 6196,
      7053, 2602, 2551, 2578, 7008, 2525, 2683, 2821, 2614, 2459, 2580, 2487,
      1011, // An element access expression should take an argument
      8016  // Type assertion expressions can only be used in TypeScript files (важно для .jsx файлов)
    ]
  });

  return monaco;
};
