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
import { useState } from "react";

interface Preferences {
  targetDirectories: string;
}

interface FileInfo {
  name: string;
  path: string;
  createdAt: Date;
  size: number;
  isDirectory: boolean;
  parentDirectory: string;
}

const execAsync = promisify(exec);

function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".webp",
    ".bmp",
    ".ico",
    ".tiff",
  ].includes(ext);
}

function getFileExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return ext || "";
}

async function getRecentFiles(directories: string[]): Promise<FileInfo[]> {
  const allFileInfos: FileInfo[] = [];

  for (const directory of directories) {
    try {
      const fileInfos = await getFilesFromDirectory(directory);
      allFileInfos.push(...fileInfos);
    } catch (error: any) {
      console.error(`Error reading directory ${directory}:`, error.message);
      // Continue with other directories even if one fails
    }
  }

  // Sort all files by creation date
  allFileInfos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return allFileInfos;
}

async function getFilesFromDirectory(directory: string): Promise<FileInfo[]> {
  try {
    // ディレクトリが存在するか確認
    try {
      await fs.access(directory, fs.constants.R_OK);
    } catch (error: any) {
      if (error.code === "ENOENT") {
        throw new Error(`Directory does not exist: ${directory}`);
      } else if (error.code === "EACCES" || error.code === "EPERM") {
        throw new Error(
          `Permission denied: Cannot access ${directory}. Please grant Full Disk Access to Raycast in System Preferences > Security & Privacy > Privacy > Full Disk Access.`
        );
      }
      throw new Error(`Cannot access directory: ${directory}`);
    }

    const files = await fs.readdir(directory);
    const fileInfos: FileInfo[] = [];

    for (const file of files) {
      // 隠しファイルをスキップ
      if (file.startsWith(".")) continue;

      const filePath = path.join(directory, file);
      try {
        const stats = await fs.stat(filePath);
        fileInfos.push({
          name: file,
          path: filePath,
          createdAt: stats.birthtime,
          size: stats.size,
          isDirectory: stats.isDirectory(),
          parentDirectory: directory,
        });
      } catch (error) {
        // ファイルへのアクセスができない場合はスキップ
        console.error(`Cannot access file: ${filePath}`, error);
      }
    }

    return fileInfos;
  } catch (error: any) {
    if (error.code === "EACCES" || error.code === "EPERM") {
      throw new Error(
        `Permission denied: Cannot access ${directory}. Please check the directory permissions or choose a different directory in preferences.`
      );
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

const ITEMS_PER_PAGE = 20;

export default function Command() {
  const preferences = getPreferenceValues<Preferences>();
  const directoriesString = preferences.targetDirectories || "~/Downloads";
  const directories = directoriesString
    .split(",")
    .map((dir) => dir.trim())
    .filter((dir) => dir.length > 0)
    .map((dir) => dir.replace("~", homedir()));

  const [page, setPage] = useState(0);

  const {
    data: allFiles,
    isLoading,
    error,
  } = usePromise(async () => await getRecentFiles(directories), []);

  const totalPages = allFiles ? Math.ceil(allFiles.length / ITEMS_PER_PAGE) : 0;
  const files = allFiles?.slice(
    page * ITEMS_PER_PAGE,
    (page + 1) * ITEMS_PER_PAGE
  );

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
          description={`No recent files found in the specified directories`}
          icon={Icon.Document}
        />
      )}
      {!error &&
        files?.map((file) => (
          <List.Item
            key={file.path}
            title={`${file.isDirectory ? "[📁]" : `[${getFileExtension(file.path)}]`} ${file.name}`}
            detail={
              <List.Item.Detail
                markdown={
                  isImageFile(file.path) && !file.isDirectory
                    ? `![](file://${encodeURI(file.path)})`
                    : ""
                }
                metadata={
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label
                      title="Name"
                      text={file.name}
                    />
                    <List.Item.Detail.Metadata.Label
                      title="Location"
                      text={file.parentDirectory}
                    />
                    <List.Item.Detail.Metadata.Label
                      title="Size"
                      text={formatFileSize(file.size)}
                    />
                    <List.Item.Detail.Metadata.Label
                      title="Created"
                      text={formatDate(file.createdAt)}
                    />
                  </List.Item.Detail.Metadata>
                }
              />
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
                <Action
                  title="Open Extension Preferences"
                  onAction={openExtensionPreferences}
                  icon={Icon.Gear}
                  shortcut={{ modifiers: ["cmd"], key: "," }}
                />
              </ActionPanel>
            }
          />
        ))}
      {totalPages > 1 && !isLoading && !error && (
        <List.Section title={`Page ${page + 1} of ${totalPages}`}>
          <List.Item
            title="Load More"
            subtitle={`Showing ${files?.length || 0} of ${allFiles?.length || 0} files`}
            icon={Icon.ArrowDown}
            actions={
              <ActionPanel>
                {page < totalPages - 1 && (
                  <Action
                    title="Next Page"
                    onAction={() => setPage(page + 1)}
                    icon={Icon.ArrowRight}
                  />
                )}
                {page > 0 && (
                  <Action
                    title="Previous Page"
                    onAction={() => setPage(page - 1)}
                    icon={Icon.ArrowLeft}
                  />
                )}
              </ActionPanel>
            }
          />
        </List.Section>
      )}
    </List>
  );
}
