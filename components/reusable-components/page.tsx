"use client";

import Button from "@/components/ui/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  StreamFiDropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDropzone } from "@/components/ui/dropzone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/passwordInput";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StreamFiDropzone } from "@/components/ui/streamfi-dropzone";
import Pagination from "@/components/ui/streamfi-pagination";
import { Textarea } from "@/components/ui/textarea";

import { DropdownMenuCheckboxItemProps } from "@radix-ui/react-dropdown-menu";
import React, { useState } from "react";

type Checked = DropdownMenuCheckboxItemProps["checked"];

// Customization not needed in all components

export default function ReusableComponents() {
  const [showPanel, setShowPanel] = React.useState<Checked>(false);
  const [isUploading, setIsUploading] = useState(false);
  const dropzone = useDropzone({
    onDropFile: async (file: File) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return {
        status: "success",
        result: URL.createObjectURL(file),
      };
    },
    validation: {
      accept: {
        "image/*": [".png", ".jpg", ".jpeg"],
      },
      maxSize: 10 * 1024 * 1024,
      maxFiles: 1,
    },
    shiftOnMaxFiles: true,
  });

  const avatarSrc = dropzone.fileStatuses?.[0]?.result;
  const isPending = dropzone.fileStatuses?.[0]?.status === "pending";

  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 10;

  const handlePageChange = (newPage: number) => {
    // fetch new data or something
    console.log("Fetching new page: ", newPage);
    setCurrentPage(newPage);
  };

  return (
    <>
      <div className="mt-20 mx-auto w-[50%] text-white flex flex-col gap-5">
        <Input type="text" id="someInput" className="" />
        <PasswordInput className="w-80" />

        <Textarea />

        <RadioGroup defaultValue="option-1">
          <div className="flex space-x-2 items-center">
            <RadioGroupItem value="option-1" />
            <Label>Choose Me</Label>
          </div>
          <div className="flex space-x-2 items-center">
            <RadioGroupItem value="option-2" />
            <Label>Choose Me nstead</Label>
          </div>
        </RadioGroup>

        <div className="text-white">
          <DropdownMenu>
            <StreamFiDropdownMenuTrigger>Open</StreamFiDropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel className="text-white">
                My Account
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="border-white text-white" />
              <DropdownMenuItem className="text-white">
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="text-white">
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem className="text-white">Team</DropdownMenuItem>
              <DropdownMenuItem className="text-white">
                Subscription
              </DropdownMenuItem>
              <DropdownMenuCheckboxItem
                checked={showPanel}
                onCheckedChange={setShowPanel}
                className="text-white"
              >
                Check Me
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button variant="destructive">I&apos;m the button</Button>
      </div>

      <StreamFiDropzone
        onFileUploaded={(file: File) => {
          console.log("Uploaded file: ", file);
        }}
        className="w-[100%] bg-[#16062b] text-white"
        dropzoneOptions={{}}
        fallbackText="S.U"
        isPending={isUploading}
        hintText="Supports JPG, PNG Up to 10MB"
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        maxVisiblePages={3}
        showPrevNext
      />

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Share</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share link</DialogTitle>
            <DialogDescription>
              Anyone who has this link will be able to view this.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="link" className="sr-only">
                Link
              </Label>
              <Input
                id="link"
                defaultValue="https://ui.shadcn.com/docs/installation"
                readOnly
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-start">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
