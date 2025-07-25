import {
  ActionPanel,
  Action,
  List,
  showToast,
  Toast,
  getPreferenceValues,
  Icon,
  openExtensionPreferences,
  Detail,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { promises as fs } from "fs";
import path from "path";
import { homedir } from "os";
import { exec } from "child_process";
import { promisify } from "util";

interface Preferences {
  targetDirectory: string;
}

interface FileInfo {
  name: string;
  path: string;
  createdAt: Date;
  size: number;
  isDirectory: boolean;
}

const execAsync = promisify(exec);

function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico', '.tiff'].includes(ext);
}

function getFileIcon(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const iconMap: { [key: string]: string } = {
    ".png": "🖼️",
    ".jpg": "🖼️",
    ".jpeg": "🖼️",
    ".gif": "🖼️",
    ".svg": "🖼️",
    ".webp": "🖼️",
    ".bmp": "🖼️",
    ".ico": "🖼️",
    ".tiff": "🖼️",
    ".pdf": "📄",
    ".doc": "📝",
    ".docx": "📝",
    ".txt": "📝",
    ".md": "📝",
    ".js": "💻",
    ".ts": "💻",
    ".jsx": "💻",
    ".tsx": "💻",
    ".json": "💻",
    ".html": "🌐",
    ".css": "🎨",
    ".mp4": "🎬",
    ".mov": "🎬",
    ".avi": "🎬",
    ".mp3": "🎵",
    ".wav": "🎵",
    ".zip": "📦",
    ".tar": "📦",
    ".gz": "📦",
  };
  return iconMap[ext] || "📄";
}

async function getRecentFiles(directory: string): Promise<FileInfo[]> {
  try {
    // ディレクトリが存在するか確認
    try {
      await fs.access(directory, fs.constants.R_OK);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Directory does not exist: ${directory}`);
      } else if (error.code === 'EACCES' || error.code === 'EPERM') {
        throw new Error(`Permission denied: Cannot access ${directory}. Please grant Full Disk Access to Raycast in System Preferences > Security & Privacy > Privacy > Full Disk Access.`);
      }
      throw new Error(`Cannot access directory: ${directory}`);
    }

    const files = await fs.readdir(directory);
    const fileInfos: FileInfo[] = [];

    for (const file of files) {
      // 隠しファイルをスキップ
      if (file.startsWith('.')) continue;
      
      const filePath = path.join(directory, file);
      try {
        const stats = await fs.stat(filePath);
        fileInfos.push({
          name: file,
          path: filePath,
          createdAt: stats.birthtime,
          size: stats.size,
          isDirectory: stats.isDirectory(),
        });
      } catch (error) {
        // ファイルへのアクセスができない場合はスキップ
        console.error(`Cannot access file: ${filePath}`, error);
      }
    }

    // 作成日時でソート（新しい順）
    fileInfos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // 上位20件を返す
    return fileInfos.slice(0, 20);
  } catch (error: any) {
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      throw new Error(`Permission denied: Cannot access ${directory}. Please check the directory permissions or choose a different directory in preferences.`);
    }
    throw new Error(`Failed to read directory: ${error.message || error}`);
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024)
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
}

function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} minutes ago`;
    }
    return `${diffHours} hours ago`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}


export default function Command() {
  const preferences = getPreferenceValues<Preferences>();
  const targetDirectory = preferences.targetDirectory.replace("~", homedir());

  const {
    data: files,
    isLoading,
    error,
  } = usePromise(async () => await getRecentFiles(targetDirectory), []);

  if (error) {
    showToast({
      style: Toast.Style.Failure,
      title: "Failed to load files",
      message: error.message,
    });
  }

  return (
    <List 
      isLoading={isLoading} 
      searchBarPlaceholder="Search recent files..."
      isShowingDetail={true}
    >
      {error && (
        <List.EmptyView
          title="Cannot access directory"
          description={error.message}
          icon={Icon.ExclamationMark}
          actions={
            <ActionPanel>
              <Action
                title="Open Extension Preferences"
                onAction={openExtensionPreferences}
                icon={Icon.Gear}
              />
              <Action.OpenInBrowser
                title="How to Grant Full Disk Access"
                url="https://support.apple.com/guide/mac-help/control-access-to-files-and-folders-on-mac-mchld5a35146/mac"
                icon={Icon.QuestionMark}
              />
            </ActionPanel>
          }
        />
      )}
      {!error && files?.length === 0 && (
        <List.EmptyView
          title="No files found"
          description={`No recent files found in ${targetDirectory}`}
          icon={Icon.Document}
        />
      )}
      {!error && files?.map((file) => (
        <List.Item
          key={file.path}
          icon={file.isDirectory ? Icon.Folder : getFileIcon(file.path)}
          title={file.name}
          subtitle={file.isDirectory ? "Folder" : ""}
          accessories={[{ text: formatDate(file.createdAt) }]}
          detail={
            isImageFile(file.path) && !file.isDirectory ? (
              <List.Item.Detail
                markdown={`<img src="file://${encodeURI(file.path)}" alt="${file.name}" style="display: block; margin: 0 auto; max-width: 100%; max-height: 100%;" />`}
              />
            ) : undefined
          }
          actions={
            <ActionPanel>
              <Action.CopyToClipboard
                title="Copy Path to Clipboard"
                content={file.path}
              />
              <Action.Open
                title="Open File"
                target={file.path}
                shortcut={{ modifiers: ["cmd"], key: "return" }}
              />
              <Action.ShowInFinder
                title="Show in Finder"
                path={file.path}
                shortcut={{ modifiers: ["cmd", "shift"], key: "f" }}
              />
              <Action.CopyToClipboard
                title="Copy File Name"
                content={file.name}
                shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
