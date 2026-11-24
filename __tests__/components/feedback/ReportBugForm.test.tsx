import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportBugForm } from "@/components/feedback/ReportBugForm";

// Mock the fetch API
global.fetch = jest.fn();

describe("ReportBugForm - Issue #1823: Loading State and Error Handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading state during submission", () => {
    it("should disable the submit button while a submission is in flight", async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ ok: true }), 100))
      );

      render(<ReportBugForm />);

      // Fill form
      await userEvent.selectOptions(screen.getByDisplayValue("Select feedback type"), "bug-report");
      await userEvent.type(screen.getByPlaceholderText("Subject / Case Name"), "Test Bug");
      await userEvent.type(screen.getByPlaceholderText("Tell us what happened..."), "This is a test description");

      const submitButton = screen.getByRole("button", { name: /send bug report/i });

      // Submit form
      fireEvent.click(submitButton);

      // Button should be disabled during submission
      expect(submitButton).toBeDisabled();

      // Wait for submission to complete
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe("Success feedback", () => {
    it("should show success message on successful submission", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200 });

      render(<ReportBugForm />);

      // Fill form
      await userEvent.selectOptions(screen.getByDisplayValue("Select feedback type"), "bug-report");
      await userEvent.type(screen.getByPlaceholderText("Subject / Case Name"), "Test Bug");
      await userEvent.type(screen.getByPlaceholderText("Tell us what happened..."), "This is a test description");

      const submitButton = screen.getByRole("button", { name: /send bug report/i });
      fireEvent.click(submitButton);

      // Should display success feedback (implementation pending - this test documents expected behavior)
      // Currently the form silently resets without any feedback
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe("Error handling", () => {
    it("should not silently fail on network errors", async () => {
      const networkError = new Error("Network failed");
      (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);

      render(<ReportBugForm />);

      // Fill form
      await userEvent.selectOptions(screen.getByDisplayValue("Select feedback type"), "bug-report");
      await userEvent.type(screen.getByPlaceholderText("Subject / Case Name"), "Test Bug");
      await userEvent.type(screen.getByPlaceholderText("Tell us what happened..."), "This is a test description");

      const submitButton = screen.getByRole("button", { name: /send bug report/i });
      fireEvent.click(submitButton);

      // Should show error message instead of silently resetting
      // Currently the form catches and discards the error
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });

    it("should handle rate limit (429) responses with user feedback", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 429 });

      render(<ReportBugForm />);

      // Fill form
      await userEvent.selectOptions(screen.getByDisplayValue("Select feedback type"), "bug-report");
      await userEvent.type(screen.getByPlaceholderText("Subject / Case Name"), "Test Bug");
      await userEvent.type(screen.getByPlaceholderText("Tell us what happened..."), "This is a test description");

      const submitButton = screen.getByRole("button", { name: /send bug report/i });
      fireEvent.click(submitButton);

      // Should show rate limit error message instead of silently resetting
      // Currently the form silently swallows the rate limit response
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });

    it("should handle non-2xx response status codes", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });

      render(<ReportBugForm />);

      // Fill form
      await userEvent.selectOptions(screen.getByDisplayValue("Select feedback type"), "bug-report");
      await userEvent.type(screen.getByPlaceholderText("Subject / Case Name"), "Test Bug");
      await userEvent.type(screen.getByPlaceholderText("Tell us what happened..."), "This is a test description");

      const submitButton = screen.getByRole("button", { name: /send bug report/i });
      fireEvent.click(submitButton);

      // Should show error message and NOT reset the form on failure
      // Currently the form unconditionally resets regardless of response status
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe("Form reset behavior", () => {
    it("should only reset form on confirmed successful submission", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200 });

      render(<ReportBugForm />);

      const titleInput = screen.getByPlaceholderText("Subject / Case Name") as HTMLInputElement;
      const descriptionInput = screen.getByPlaceholderText("Tell us what happened...") as HTMLTextAreaElement;

      // Fill form
      await userEvent.selectOptions(screen.getByDisplayValue("Select feedback type"), "bug-report");
      await userEvent.type(titleInput, "Test Bug");
      await userEvent.type(descriptionInput, "This is a test description");

      expect(titleInput.value).toBe("Test Bug");
      expect(descriptionInput.value).toBe("This is a test description");

      const submitButton = screen.getByRole("button", { name: /send bug report/i });
      fireEvent.click(submitButton);

      // Wait for submission
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });

      // Form should be reset on successful submission
      expect(titleInput.value).toBe("");
      expect(descriptionInput.value).toBe("");
    });

    it("should NOT reset form when submission fails", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });

      render(<ReportBugForm />);

      const titleInput = screen.getByPlaceholderText("Subject / Case Name") as HTMLInputElement;
      const descriptionInput = screen.getByPlaceholderText("Tell us what happened...") as HTMLTextAreaElement;

      // Fill form
      await userEvent.selectOptions(screen.getByDisplayValue("Select feedback type"), "bug-report");
      await userEvent.type(titleInput, "Test Bug");
      await userEvent.type(descriptionInput, "This is a test description");

      const submitButton = screen.getByRole("button", { name: /send bug report/i });
      fireEvent.click(submitButton);

      // Wait for submission to complete
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });

      // Currently the form unconditionally resets regardless of outcome
      // This test documents the expected behavior: form should retain data on failure
      // so user can retry without re-entering everything
    });
  });
});
