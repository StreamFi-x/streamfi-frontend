'use client'

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Button from "@/components/ui/Button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, StreamFiDropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dropzone, DropZoneArea, DropzoneMessage, DropzoneTrigger, useDropzone } from "@/components/ui/dropzone"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/passwordInput"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { DropdownMenuCheckboxItemProps } from "@radix-ui/react-dropdown-menu"
import React from "react"

type Checked = DropdownMenuCheckboxItemProps["checked"]

export default function ReusableComponents () {
    const [showPanel, setShowPanel] = React.useState<Checked>(false)
    const dropzone = useDropzone({
        onDropFile: async(file: File) => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return {
                status: "success",
                result: URL.createObjectURL(file)
            };
        },
        validation: {
            accept: {
                "image/*": [".png", ".jpg", ".jpeg"]
            },
            maxSize: 10 * 1024 * 1024,
            maxFiles: 1
        },
        shiftOnMaxFiles: true,
    });

    const avatarSrc = dropzone.fileStatuses?.[0]?.result;
    const isPending = dropzone.fileStatuses?.[0]?.status === "pending"

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
                            <DropdownMenuLabel className="text-white">My Account</DropdownMenuLabel>
                            <DropdownMenuSeparator className="border-white text-white"/>
                            <DropdownMenuItem className="text-white">Profile</DropdownMenuItem>
                            <DropdownMenuItem className="text-white">Billing</DropdownMenuItem>
                            <DropdownMenuItem className="text-white">Team</DropdownMenuItem>
                            <DropdownMenuItem className="text-white">Subscription</DropdownMenuItem>
                            <DropdownMenuCheckboxItem checked={showPanel} onCheckedChange={setShowPanel} className="text-white">
                                Check Me
                            </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <Button variant="destructive">
                    I'm the button
                </Button>


        
            </div>

            <Dropzone {...dropzone}>
                <div className="flex justify-between">
                    <DropzoneMessage />
                </div>
                <DropZoneArea className="">
                    <DropzoneTrigger className="flex gap-8 bg-transparent text-sm">
                    <Avatar className={cn(isPending && "animate-pulse")}>
                        <AvatarImage className="object-cover" src={avatarSrc} />
                        <AvatarFallback>JG</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-1 font-semibold">
                        <p>Upload a new avatar</p>
                        <p className="text-xs text-muted-foreground">
                        Please select an image smaller than 10MB
                        </p>
                    </div>
                    </DropzoneTrigger>
                </DropZoneArea>
            </Dropzone>
        </>
    )
}