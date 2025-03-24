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
    strict: true,
    isolatedModules: true,
    lib: ["ESNext", "DOM", "DOM.Iterable"],
    typeRoots: ["node_modules/@types"]
  });

  // Configure diagnostics options
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false,
    diagnosticCodesToIgnore: [2669, 1046, 2307]
  });

  // Add React types
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    reactTypes,
    'file:///node_modules/@types/react/index.d.ts'
  );

  // Enable language features
  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
  monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);

  return monaco;
};
