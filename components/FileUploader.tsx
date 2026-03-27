"use client";

import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { UploadCloud, File as FileIcon, X } from "lucide-react";

interface FileUploaderProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  onFileReject?: (rejections: FileRejection[]) => void;
}

export default function FileUploader({ file, onFileSelect, onFileReject }: FileUploaderProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      if (fileRejections.length > 0 && onFileReject) {
        onFileReject(fileRejections);
      }
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect, onFileReject],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/json": [".json"],
    },
    maxFiles: 1,
  });

  if (file) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <div className="flex items-center gap-3">
          <FileIcon className="h-6 w-6 text-zinc-500" />
          <p className="text-sm font-medium text-zinc-800">{file.name}</p>
        </div>
        <button
          type="button"
          onClick={() => onFileSelect(null)}
          className="rounded-full p-1 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"
          aria-label="Remove file"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`cursor-pointer rounded-lg border-2 border-dashed border-zinc-300 bg-white p-8 text-center transition-colors hover:border-indigo-400 ${
        isDragActive ? "border-indigo-500 bg-indigo-50" : ""
      }`}
    >
      <input {...getInputProps()} />
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
        <UploadCloud className="h-6 w-6 text-zinc-500" />
      </div>
      <p className="text-sm font-semibold text-indigo-700">
        Click to upload or drag and drop
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        JSON session file (max 1)
      </p>
    </div>
  );
}
