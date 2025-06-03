import { DropzoneProps } from "react-dropzone";
import { Dropzone, DropZoneArea, DropzoneMessage, DropzoneTrigger, useDropzone } from "./dropzone";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";

export type StreamFiDropzoneProps = {
    avatarSrc?: string,
    onFileUploaded: (file: File, objectURL: string) => void,
    validation?: {
        accept?: Record<string, string[]>,
        maxSize?: number,
        maxFiles?: number,
    },
    className?: string,
    dropzoneOptions: Partial<DropzoneProps>,
    isPending?: boolean,
    fallbackText?: string,
    uploadText?: string,
    hintText?: string,
}

export const StreamFiDropzone = ({
    avatarSrc, 
    onFileUploaded,
    validation = {
        accept: { 'image/*': ['.png', '.jpg', '.jpeg'] },
        maxSize: 10 * 1024 * 1024,
        maxFiles: 1
    },
    className,
    dropzoneOptions = {},
    isPending = false,
    fallbackText = 'US',
    uploadText = 'Upload a new avatar',
    hintText = 'Please select an image smaller than 10mb'
}: StreamFiDropzoneProps) => {
    const dropzone = useDropzone({
        onDropFile: async(file: File) => {
            const objectURL = URL.createObjectURL(file);
            onFileUploaded(file, objectURL);
            return {
                status: 'success',
                result: objectURL
            };
        },
        validation,
        shiftOnMaxFiles: true,
        ...dropzoneOptions
    });
    return (
        <Dropzone {...dropzone}>
            <div className="flex justify-between">
                <DropzoneMessage />
            </div>

            <DropZoneArea className="w-fit p-0">
                <DropzoneTrigger className={"flex flex-col gap-3 items-center bg-transparent text-sm w-[20%] p-12 " + className}>
                    <Avatar className={cn(isPending && 'animate-pulse')}>
                        <AvatarImage className="object-cover" src={avatarSrc} />
                        <AvatarFallback>
                            <Upload className="text-6xl" />
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex flex-col gap-1 font-semibold">
                        <p>
                            {uploadText}
                        </p>
                        <p className="text text-xs text-muted-foreground">{hintText}</p>
                    </div>
                </DropzoneTrigger>
            </DropZoneArea>
        </Dropzone>
    )
}