/**
 * @jest-environment node
 *
 * #1861: sendWelcomeRegistrationEmail used the literal string
 * "process.env.EMAIL_USER" as its `from` address, so the welcome email was
 * rejected for every signup.
 */
const mockSendMail = jest.fn();
jest.mock("nodemailer", () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
  },
}));
jest.mock("@/components/templates/WelcomeUserEmail", () => ({
  __esModule: true,
  default: (name: string) => `<p>Welcome ${name}</p>`,
}));
jest.mock("@/components/templates/VerifyEmailCode", () => ({
  __esModule: true,
  default: () => "<p>verify</p>",
}));
jest.mock("@/components/templates/WaitlistConfirm", () => ({
  WaitlistConfirmation: () => "<p>waitlist</p>",
}));

import { sendWelcomeRegistrationEmail } from "@/utils/send-email";

describe("sendWelcomeRegistrationEmail", () => {
  const originalEmailUser = process.env.EMAIL_USER;

  beforeEach(() => {
    mockSendMail.mockReset();
    mockSendMail.mockResolvedValue({});
  });

  afterAll(() => {
    if (originalEmailUser === undefined) {
      delete process.env.EMAIL_USER;
    } else {
      process.env.EMAIL_USER = originalEmailUser;
    }
  });

  it("sends from the configured EMAIL_USER address", async () => {
    process.env.EMAIL_USER = "noreply@streamfi.example";

    await sendWelcomeRegistrationEmail("viewer@example.com", "Viewer");

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail.mock.calls[0][0].from).toEqual({
      name: "StreamFi",
      address: "noreply@streamfi.example",
    });
  });

  it("falls back to the support address when EMAIL_USER is unset", async () => {
    delete process.env.EMAIL_USER;

    await sendWelcomeRegistrationEmail("viewer@example.com", "Viewer");

    expect(mockSendMail.mock.calls[0][0].from).toEqual({
      name: "StreamFi",
      address: "support@streamfi.xyz",
    });
  });

  it("never uses the literal variable name as the from address", async () => {
    process.env.EMAIL_USER = "noreply@streamfi.example";

    await sendWelcomeRegistrationEmail("viewer@example.com", "Viewer");

    expect(JSON.stringify(mockSendMail.mock.calls[0][0].from)).not.toContain(
      "process.env"
    );
  });

  it("addresses the email and passes the rendered template", async () => {
    process.env.EMAIL_USER = "noreply@streamfi.example";

    await sendWelcomeRegistrationEmail("viewer@example.com", "Viewer");

    expect(mockSendMail.mock.calls[0][0]).toMatchObject({
      to: "viewer@example.com",
      subject: "Welcome to Streamfi!",
      html: "<p>Welcome Viewer</p>",
    });
  });
});
