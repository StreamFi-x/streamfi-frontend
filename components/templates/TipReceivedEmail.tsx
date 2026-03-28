interface TipReceivedEmailProps {
  username: string;
  amount: string;
  senderLabel: string;
  dashboardUrl: string;
}

export default function TipReceivedEmail({
  username,
  amount,
  senderLabel,
  dashboardUrl,
}: TipReceivedEmailProps) {
  return (
    <html>
      <body
        style={{
          margin: 0,
          backgroundColor: "#f3f4f6",
          color: "#111827",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <table
          width="100%"
          cellPadding="0"
          cellSpacing="0"
          role="presentation"
          style={{ padding: "32px 16px" }}
        >
          <tbody>
            <tr>
              <td align="center">
                <table
                  width="100%"
                  cellPadding="0"
                  cellSpacing="0"
                  role="presentation"
                  style={{
                    maxWidth: "560px",
                    backgroundColor: "#ffffff",
                    borderRadius: "20px",
                    overflow: "hidden",
                    boxShadow: "0 20px 45px rgba(15, 23, 42, 0.08)",
                  }}
                >
                  <tbody>
                    <tr>
                      <td
                        style={{
                          padding: "32px 32px 24px",
                          background:
                            "linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)",
                          color: "#ffffff",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "12px",
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            opacity: 0.72,
                          }}
                        >
                          StreamFi Notifications
                        </div>
                        <h1
                          style={{
                            margin: "12px 0 0",
                            fontSize: "28px",
                            lineHeight: "1.2",
                          }}
                        >
                          You received a new tip
                        </h1>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "32px" }}>
                        <p style={{ margin: "0 0 16px", fontSize: "16px" }}>
                          Hi {username || "there"},
                        </p>
                        <p
                          style={{
                            margin: "0 0 24px",
                            fontSize: "16px",
                            lineHeight: "1.65",
                            color: "#374151",
                          }}
                        >
                          {senderLabel} just sent you{" "}
                          <strong>{amount} XLM</strong>. Your latest payout
                          details are ready in your dashboard.
                        </p>
                        <a
                          href={dashboardUrl}
                          style={{
                            display: "inline-block",
                            padding: "12px 18px",
                            borderRadius: "999px",
                            backgroundColor: "#111827",
                            color: "#ffffff",
                            textDecoration: "none",
                            fontWeight: 600,
                          }}
                        >
                          View payout activity
                        </a>
                        <p
                          style={{
                            margin: "24px 0 0",
                            fontSize: "13px",
                            lineHeight: "1.6",
                            color: "#6b7280",
                          }}
                        >
                          You can disable tip emails anytime from your
                          notification settings.
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
