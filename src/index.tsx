import {
  ActionPanel,
  Action,
  List,
  showToast,
  Toast,
  getPreferenceValues,
  Icon,
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

async function getFileIcon(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const iconMap: { [key: string]: string } = {
    ".png": "🖼️",
    ".jpg": "🖼️",
    ".jpeg": "🖼️",
    ".gif": "🖼️",
    ".svg": "🖼️",
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
    const files = await fs.readdir(directory);
    const fileInfos: FileInfo[] = [];

    for (const file of files) {
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
  } catch (error) {
    throw new Error(`Failed to read directory: ${error}`);
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
    <List isLoading={isLoading} searchBarPlaceholder="Search recent files...">
      {files?.map((file) => (
        <List.Item
          key={file.path}
          // icon={file.isDirectory ? Icon.Folder : getFileIcon(file.path)}
          title={file.name}
          subtitle={file.isDirectory ? "Folder" : formatFileSize(file.size)}
          accessories={[{ text: formatDate(file.createdAt) }]}
          actions={
            <ActionPanel>
              <Action.CopyToClipboard
                title="Copy Path to Clipboard"
                content={file.path}
                shortcut={{ modifiers: ["cmd"], key: "c" }}
              />
              <Action.Open
                title="Open File"
                target={file.path}
                shortcut={{ modifiers: ["cmd"], key: "o" }}
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
