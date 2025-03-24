import { Monaco } from '@monaco-editor/react';

export function configureJSX(monaco: Monaco) {
  // Добавляем базовые определения для JSX
  const jsxTypes = `
    // Глобальные определения для JSX
    declare namespace JSX {
      interface Element {}
      interface ElementClass {
        render(): any;
      }
      interface ElementAttributesProperty {
        props: {};
      }
      interface ElementChildrenAttribute {
        children: {};
      }
      
      interface IntrinsicElements {
        div: any;
        span: any;
        h1: any;
        h2: any;
        h3: any;
        h4: any;
        h5: any;
        h6: any;
        p: any;
        a: any;
        button: any;
        input: any;
        textarea: any;
        select: any;
        option: any;
        form: any;
        img: any;
        ul: any;
        ol: any;
        li: any;
        table: any;
        tr: any;
        td: any;
        th: any;
        thead: any;
        tbody: any;
        label: any;
        nav: any;
        header: any;
        footer: any;
        main: any;
        section: any;
        article: any;
        aside: any;
        canvas: any;
        code: any;
        pre: any;
        hr: any;
        br: any;
        svg: any;
        path: any;
        circle: any;
        rect: any;
        line: any;
        g: any;
        iframe: any;
      }
    }
  `;

  // Добавляем определения для JSX
  monaco.languages.typescript.javascriptDefaults.addExtraLib(jsxTypes, 'jsx-types.d.ts');
  monaco.languages.typescript.typescriptDefaults.addExtraLib(jsxTypes, 'jsx-types.d.ts');
} 