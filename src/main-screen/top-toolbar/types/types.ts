export interface MenuItem {
    text: string;
    shortcut: string;
    action?: () => void;
    subMenu?: MenuItem[];
  }
  
  export interface FileItem {
    name: string;
    path: string;
    icon: string;
    is_directory?: boolean;
  }