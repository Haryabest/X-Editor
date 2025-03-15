export interface FileItem {
  name: string;
  path: string;
  icon: string;
  is_directory?: boolean;
  expanded?: boolean;
  loaded?: boolean;
  children?: FileItem[];
}