// Добавим недостающие поля в FileItem
export interface FileItem {
  name: string;
  path: string;
  filePath?: string; // Добавляем для обратной совместимости
  isFolder: boolean;
  children?: FileItem[];
} 