import * as React from "react";
import { Upload, X, FileText, FileCode, FileArchive } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "./button";

interface UploadedFile {
  name: string;
  type: string;
  size: number;
}

interface FileDropzoneProps {
  label: string;
  accept: string;
  description?: string;
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  onRawFilesChange?: (files: File[]) => void;
  multiple?: boolean;
  className?: string;
}

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "cpp":
    case "h":
    case "c":
      return FileCode;
    case "zip":
      return FileArchive;
    default:
      return FileText;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileDropzone({
  label,
  accept,
  description,
  files,
  onFilesChange,
  onRawFilesChange,
  multiple = false,
  className,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [rawFiles, setRawFiles] = React.useState<File[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFiles = (fileList: File[]) => {
    const acceptedExtensions = accept
      .split(",")
      .map((ext) => ext.trim().toLowerCase());

    const validFiles = fileList.filter((file) => {
      const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
      return acceptedExtensions.some(
        (accepted) => accepted === ext || accepted === file.type
      );
    });

    if (validFiles.length === 0) return;

    const newFiles: UploadedFile[] = validFiles.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
    }));

    if (multiple) {
      onFilesChange([...files, ...newFiles]);
      const newRawFiles = [...rawFiles, ...validFiles];
      setRawFiles(newRawFiles);
      onRawFilesChange?.(newRawFiles);
    } else {
      onFilesChange(newFiles.slice(0, 1));
      setRawFiles(validFiles.slice(0, 1));
      onRawFilesChange?.(validFiles.slice(0, 1));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleRemoveFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
    const newRawFiles = rawFiles.filter((_, i) => i !== index);
    setRawFiles(newRawFiles);
    onRawFilesChange?.(newRawFiles);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className={cn("space-y-3", className)}>
      <label className="text-sm font-medium leading-none">{label}</label>

      {/* Dropzone */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors",
          isDragging
            ? "border-emerald-500 bg-emerald-50"
            : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
        />

        <div
          className={cn(
            "rounded-full p-3",
            isDragging ? "bg-emerald-100" : "bg-gray-100"
          )}
        >
          <Upload
            className={cn(
              "h-6 w-6",
              isDragging ? "text-emerald-600" : "text-gray-400"
            )}
          />
        </div>

        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">
            {isDragging ? "Drop files here" : "Drag & drop or click to upload"}
          </p>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
        </div>
      </div>

      {/* Uploaded Files List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => {
            const FileIcon = getFileIcon(file.name);
            return (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2"
              >
                <div className="rounded-lg bg-gray-100 p-2">
                  <FileIcon className="h-4 w-4 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile(index);
                  }}
                  className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
