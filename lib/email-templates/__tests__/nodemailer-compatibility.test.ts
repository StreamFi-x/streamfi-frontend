/**
 * @jest-environment node
 */
/**
 * Verifies nodemailer@8 compatibility with StreamFi's actual transport
 * configuration (Gmail-shaped `createTransport` options, DKIM signing,
 * pooled connections) and with the HTML strings produced by this repo's
 * email templates.
 *
 * This repo's templates (WelcomeUserEmail, VerifyEmailCode,
 * WaitlistConfirmation, the transactional-emails.ts set) are all plain
 * functions returning raw HTML strings -- none of them import or call
 * @react-email/render or @react-email/components, so there is no React
 * Email rendering step in the actual send path to go incompatible.
 * @react-email/render is a declared dependency but is unused dead weight
 * (see streamfi#1765-adjacent dead-code concerns).
 *
 * Since no real Gmail/SMTP credentials exist in CI or this sandbox, this
 * test proves wire-level compatibility against a local SMTP server
 * (smtp-server, the same author's companion package to nodemailer) rather
 * than against Gmail directly: it starts a real SMTP listener, points a
 * nodemailer transporter at it using the same dkim/pool option shape
 * lib/email-service.ts and utils/send-email.ts use (service-independent
 * host/port instead of `service: "Gmail"`, and no AUTH exchange, only
 * because Gmail itself is unreachable without real credentials and this
 * local test server implements no AUTH mechanism -- the SMTP envelope,
 * MIME generation, and DKIM signing code paths this exercises are
 * identical regardless of transport target), and asserts the server
 * actually receives a fully-formed, parseable MIME message containing
 * one of this repo's real templates.
 */
import { SMTPServer } from "smtp-server";
import nodemailer from "nodemailer";
import WelcomeUserEmail from "@/components/templates/WelcomeUserEmail";
import { getNewFollowerEmail } from "../transactional-emails";

describe("nodemailer@8 transport compatibility", () => {
  let server: SMTPServer;
  let port: number;
  let receivedMessages: { data: string }[] = [];

  beforeAll(done => {
    server = new SMTPServer({
      secure: false,
      disabledCommands: ["STARTTLS", "AUTH"],
      onData(stream, _session, callback) {
        let data = "";
        stream.on("data", chunk => (data += chunk));
        stream.on("end", () => {
          receivedMessages.push({ data });
          callback();
        });
      },
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.server.address();
      port = typeof addr === "object" && addr ? addr.port : 0;
      done();
    });
  });

  afterAll(done => {
    server.close(() => done());
  });

  let openTransporters: nodemailer.Transporter[] = [];

  beforeEach(() => {
    receivedMessages = [];
    openTransporters = [];
  });

  afterEach(() => {
    for (const t of openTransporters) t.close();
  });

  function buildTransporter() {
    // Same option keys/shape as lib/email-service.ts's getTransporter(),
    // minus `service: "Gmail"` (replaced with a direct host/port so the
    // test can run without network access or real credentials).
    const transporter = nodemailer.createTransport({
      host: "127.0.0.1",
      port,
      secure: false,
      ignoreTLS: true,
      dkim: {
        domainName: "streamfi.xyz",
        keySelector: "default",
        privateKey: TEST_DKIM_PRIVATE_KEY,
      },
      pool: {
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 14,
      },
    });
    openTransporters.push(transporter);
    return transporter;
  }

  it("creates a transporter with this repo's exact option shape (dkim/pool)", () => {
    const transporter = buildTransporter();
    expect(typeof transporter.sendMail).toBe("function");
    expect(typeof transporter.verify).toBe("function");
  });

  it("verify() succeeds against a live SMTP listener (transport handshake compatible)", async () => {
    const transporter = buildTransporter();
    await expect(transporter.verify()).resolves.toBe(true);
  });

  it("sends a plain-string HTML template (WelcomeUserEmail) end-to-end and the server receives valid MIME", async () => {
    const transporter = buildTransporter();
    const htmlContent = WelcomeUserEmail("Ada");

    const info = await transporter.sendMail({
      from: { name: "StreamFi", address: "support@streamfi.xyz" },
      to: "ada@example.com",
      subject: "Welcome to Streamfi!",
      html: htmlContent,
    });

    expect(info.messageId).toBeTruthy();
    expect(receivedMessages).toHaveLength(1);
    const raw = receivedMessages[0].data;
    expect(raw).toContain("Subject: Welcome to Streamfi!");
    expect(raw).toContain("Ada");
    // DKIM-Signature header proves dkim option was accepted and applied by v8.
    expect(raw).toMatch(/DKIM-Signature:/i);
  });

  it("sends a transactional-emails.ts template (new follower) with html+text parts and custom headers", async () => {
    const transporter = buildTransporter();
    const { subject, htmlContent, textContent } = getNewFollowerEmail({
      recipientName: "Ada",
      followerName: "Grace",
      followerUsername: "grace",
      followerProfileUrl: "https://streamfi.xyz/grace",
      creatorProfileUrl: "https://streamfi.xyz/ada",
    });

    const info = await transporter.sendMail({
      from: { name: "StreamFi", address: "support@streamfi.xyz" },
      to: "ada@example.com",
      subject,
      html: htmlContent,
      text: textContent,
      headers: {
        "X-Mailer": "StreamFi Notification Service",
        Precedence: "bulk",
      },
    });

    expect(info.messageId).toBeTruthy();
    expect(receivedMessages).toHaveLength(1);
    const raw = receivedMessages[0].data;
    expect(raw).toContain("X-Mailer: StreamFi Notification Service");
    expect(raw).toContain("Precedence: bulk");
    expect(raw).toMatch(/Content-Type: multipart\/(alternative|mixed)/i);
  });

  it("rejects cleanly (no silent failure) when the SMTP server refuses the connection", async () => {
    const transporter = nodemailer.createTransport({
      host: "127.0.0.1",
      port: 1, // nothing listens here
      secure: false,
      auth: { user: "test@example.com", pass: "testpass" },
      connectionTimeout: 1000,
    });

    await expect(
      transporter.sendMail({
        from: "support@streamfi.xyz",
        to: "ada@example.com",
        subject: "x",
        html: "x",
      })
    ).rejects.toThrow();
  });
});

// A throwaway 512-bit test key is fine here: it only needs to be
// well-formed PEM so nodemailer's DKIM signer runs its real code path;
// no signature is ever verified against it.
const TEST_DKIM_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIICXgIBAAKBgQDAgjRITH/DK27Mp2EN3pmjiW5V2DQOMTJJuUGrQ9H5M0N3IjTN
FtbWrcZBIpQ/dm5xiN0oDeXf1dDl5W0zrwAw5pF17AcB2H+mcTMoLGfGbA8lrzUK
NyhRoFRLtK/7j5bxRLgbTxaN9KKoU+ZxByd5vqWk+UzWhberzOdG2Ttq9QIDAQAB
AoGAD6UFNrLw1x2afYtEuenTNpUeoF9Xq6eX3KHvkkmKsOPXocDn5ZrrjrrEl9qF
jbrEMvnabzzh55TqyyQgAclBDJP1VpYrfByJnm0xxjFckPND3EMhJGfRS69mu5yu
PfVmrgAgP+Oo3Y5eXosBV7rfORkUYJlvp+vsWYAtyhDPY+kCQQD7CA/eCSjyTg0/
9SuOsbMiaPBB9wsjuMRD4HI9IC/yuJMk7840qr0n2i1HMlfjAh2Qz7oD1E1YW0aH
gqAQ9e3/AkEAxFGdpIf5xnurg7bCHPQpZ/zxUUvcnU280SMMu9KTlblisyQbT6Rh
CPcoNrgBGQuAgKFx7/qiMRjXpJkgvsfPCwJBAK4sydWlRWPaBBd8ZNx9L22QoiMi
5ffDG2p9MMZ4rswahP375XdlgBlGqGPd6lz3+sufVdGSXJgRvL4JREaAXMECQQCK
6AC14OxPj0OdT5vrZqtBg8yvrBCuUMnP5I/m+akpYGHAxUR5xqJN+KtAhFNqiCPl
X9ZBacKHIL+8HAj6VGBfAkEAx1wxdg2BHNW26iEv0bHnC1IDHwHmVbkNYhPloGMm
1ASfv5rg3CgEeibeYV1xwfMlxHXtoRVIR35hhY963qFUGw==
-----END RSA PRIVATE KEY-----`;
