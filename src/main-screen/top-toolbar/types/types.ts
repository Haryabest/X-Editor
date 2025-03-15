export interface MenuItem {
    text: string;
    shortcut: string;
  }
  
  export interface FileItem {
    name: string;
    path: string;
    icon: string;
    is_directory?: boolean;
  }