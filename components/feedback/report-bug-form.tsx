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

import { FeedbackHeader } from "./feedback-header";
import { FileUpload } from "./file-upload";

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
          className="space-y-6 bg-[#21202033] p-6"
        >
          <FormField
            control={form.control}
            name="feedbackType"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base font-medium">
                  Select type of feedback:
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className=" h-[60px] border border-[#D9CAE2] focus:border-[#5A189A] focus:ring-0 text-[#AF6EFF]">
                      <SelectValue placeholder="Select feedback type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-[#111111] border-gray-400">
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
                <FormLabel className="text-base font-medium">Title</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Subject / Case Name"
                    className="h-[82px] text-lg border border-[#D9CAE2] focus:border-[#5A189A] focus:ring-0"
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
                <FormLabel className="text-base font-medium">
                  Description
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Tell us what happened or what you'd like to see improved..."
                    className=" border-[#D9CAE2] min-h-[120px] resize-none focus:border-[#5A189A] focus:ring-0"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <label className="text-base font-medium">
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
              className="bg-[#5A189A] hover:bg-[#7B2CBF] text-white px-6"
            >
              Send bug report
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
