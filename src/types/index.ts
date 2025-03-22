import { ReactNode } from 'react';

export interface FileItem {
  name: string;
  is_directory: boolean;
  path: string;
  children?: FileItem[];
  expanded: boolean;
  loaded: boolean;
  icon?: ReactNode; // Унифицируем тип с FileManager.tsx
}