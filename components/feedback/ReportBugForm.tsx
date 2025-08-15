"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { FeedbackHeader } from "./FeedbackHeader";
import { FileUpload } from "./FileUpload";
import {
  bgClasses,
  borderClasses,
  combineClasses,
  componentClasses,
  ringClasses,
  textClasses,
} from "@/lib/theme-classes";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  feedbackType: z.string().min(1, {
    message: "Please select a feedback type.",
  }),
  title: z
    .string()
    .min(1, {
      message: "Title is required.",
    })
    .min(3, {
      message: "Title must be at least 3 characters.",
    }),
  description: z
    .string()
    .min(1, {
      message: "Description is required.",
    })
    .min(10, {
      message: "Description must be at least 10 characters.",
    }),
  screenshot: z.any().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function ReportBugForm() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      feedbackType: "",
      title: "",
      description: "",
      screenshot: null,
    },
  });

  function onSubmit(data: FormData) {
    const submissionData = {
      ...data,
      screenshot: uploadedFile
        ? {
            name: uploadedFile.name,
            size: uploadedFile.size,
            type: uploadedFile.type,
          }
        : null,
    };

    console.log("Bug report submitted:", submissionData);

    // Reset form after submission
    form.reset();
    setUploadedFile(null);
  }

  return (
    <div className="space-y-8">
      <FeedbackHeader />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={`space-y-6 ${bgClasses.tertiary} p-6`}
        >
          <FormField
            control={form.control}
            name="feedbackType"
            render={({ field }) => (
              <FormItem>
                <FormLabel
                  className={`text-base font-medium ${textClasses.primary}`}
                >
                  Select type of feedback:
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger
                      className={`h-[60px] ${borderClasses.primary} ${ringClasses.primary} ${textClasses.primary}`}
                    >
                      <SelectValue placeholder="Select feedback type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent
                    className={`${bgClasses.dropdown} ${borderClasses.primary} ${textClasses.primary}`}
                  >
                    <SelectItem value="bug-report">Bug Report</SelectItem>
                    <SelectItem value="feature-suggestion">
                      Feature Suggestion
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel
                  className={`text-base font-medium ${textClasses.primary}`}
                >
                  Title
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Subject / Case Name"
                    className={cn(
                      combineClasses(
                        componentClasses.input,
                        bgClasses.tertiary
                      ),
                      "h-[82px] text-lg"
                    )}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel
                  className={`text-base font-medium ${textClasses.primary}`}
                >
                  Description
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Tell us what happened or what you'd like to see improved..."
                    className={cn(
                      combineClasses(
                        componentClasses.input,
                        bgClasses.tertiary
                      ),
                      "min-h-[120px] resize-none"
                    )}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <label className={`text-base font-medium ${textClasses.primary}`}>
              Screenshot (optional)
            </label>
            <FileUpload
              onFileSelect={setUploadedFile}
              selectedFile={uploadedFile}
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              className=" bg-[#5A189A] hover:bg-[#7B2CBF] text-white px-6"
            >
              Send bug report
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
