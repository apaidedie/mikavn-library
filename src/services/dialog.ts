import { open, save } from '@tauri-apps/plugin-dialog';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function chooseDirectory(currentValue = ''): Promise<string | null> {
  if (isTauri) {
    const selected = await open({ directory: true, multiple: false, title: '选择 Galgame 库目录' });
    return typeof selected === 'string' ? selected : null;
  }

  return window.prompt('输入要扫描的目录路径', currentValue || 'D:\\Games\\VisualNovel');
}

export async function chooseArchiveDirectory(currentValue = ''): Promise<string | null> {
  if (isTauri) {
    const selected = await open({ directory: true, multiple: false, title: '选择 MikaVN 库归档目录' });
    return typeof selected === 'string' ? selected : null;
  }

  return window.prompt('输入归档目录路径', currentValue || 'D:\\MikaVN-Archives');
}

export async function chooseArchivePath(currentValue = ''): Promise<string | null> {
  if (isTauri) {
    const selected = await open({
      multiple: false,
      title: '选择 MikaVN 库归档目录或 ZIP',
      filters: [
        { name: 'MikaVN Archive', extensions: ['zip'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return typeof selected === 'string' ? selected : null;
  }

  return window.prompt('输入归档目录或 ZIP 路径', currentValue || 'D:\\MikaVN-Archives\\mikavn-library-archive.zip');
}

export async function chooseImage(currentValue = ''): Promise<string | null> {
  if (isTauri) {
    const selected = await open({
      multiple: false,
      title: '选择用于识别的图片',
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] },
      ],
    });
    return typeof selected === 'string' ? selected : null;
  }

  return window.prompt('输入图片路径', currentValue || 'D:\\cover.jpg');
}

export async function chooseExecutable(currentValue = ''): Promise<string | null> {
  if (isTauri) {
    const selected = await open({
      multiple: false,
      title: '选择启动程序',
      filters: [
        { name: 'Executable or Shortcut', extensions: ['exe', 'bat', 'cmd', 'lnk'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return typeof selected === 'string' ? selected : null;
  }

  return window.prompt('输入启动程序路径', currentValue || 'D:\\Games\\VisualNovel\\game.exe');
}

export async function chooseMarkdownSavePath(defaultPath = 'mikavn-report.md'): Promise<string | null> {
  if (isTauri) {
    const selected = await save({
      title: '导出报告',
      defaultPath,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });
    return typeof selected === 'string' ? selected : null;
  }

  return defaultPath;
}

export async function chooseDatabaseBackupPath(defaultPath = `mikavn-backup-${new Date().toISOString().slice(0, 10)}.db`): Promise<string | null> {
  if (isTauri) {
    const selected = await save({
      title: '备份数据库',
      defaultPath,
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }],
    });
    return typeof selected === 'string' ? selected : null;
  }

  return defaultPath;
}

export async function chooseDatabaseRestorePath(currentValue = ''): Promise<string | null> {
  if (isTauri) {
    const selected = await open({
      multiple: false,
      title: '选择要恢复的数据库备份',
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }],
    });
    return typeof selected === 'string' ? selected : null;
  }

  return window.prompt('输入要恢复的数据库备份路径', currentValue || 'D:\\MikaVN-Backups\\mikavn.db');
}
