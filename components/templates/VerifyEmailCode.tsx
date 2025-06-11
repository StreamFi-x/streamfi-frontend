export default function VerifyEmailCode(name: string, token: string) {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
 <head>
  <meta charset="UTF-8">
  <meta content="width=device-width, initial-scale=1" name="viewport">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta content="telephone=no" name="format-detection">
  <title>Email Verification</title><!--[if (mso 16)]>
    <![endif]--><!--[if gte mso 9]><style>sup { font-size: 100% !important; }</style><![endif]--><!--[if gte mso 9]>
<noscript>
         <xml>
           <o:OfficeDocumentSettings>
           <o:AllowPNG></o:AllowPNG>
           <o:PixelsPerInch>96</o:PixelsPerInch>
           </o:OfficeDocumentSettings>
         </xml>
      </noscript>
<![endif]--><!--[if mso]><xml>
    <w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word">
      <w:DontUseAdvancedTypographyReadingMail/>
    </w:WordDocument>
    </xml><![endif]-->

 </head>
 <body class="body" style="width:100%;height:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;Margin:0">
 <table className="min-h-screen p-4">
      {/* Main Email Container */}
      <tr className="max-w-3xl mx-auto bg-gray-50 rounded-lg overflow-hidden font-inter font-medium">
        {/* Logo Section */}
        <tr className="">
          <tr className="p-8 pb-6 flex items-center gap-2 mb-2 bg-[#F8F7FB]">
            {/* StreamFi Logo */}
            <td className="flex items-center space-x-2 font-bold text-xl">
              <img
                src="https://streamfi.io/Images/STRMLogo.svg"
                alt="StreamFi Logo"
                width="120"
                height="120"
              />
            </td>
          </tr>
          <tr className="px-8 pb-6">
            {/* Main Heading */}
            <h1 className="text-4xl font-semibold text-gray-900 mb-8 tracking-wide">
              VERIFY YOUR EMAIL ADDRESS
            </h1>

            {/* Body Text */}
            <td className="space-y-4 text-gray-700 text-base font-medium leading-relaxed mb-8">
              <p>Hey ${name},</p>
              <p>
                You're just one step away from unlocking your personalized
                streaming experience on StreamFi — the decentralized platform
                built for creators, gamers, and digital communities shaping the
                future of entertainment.
              </p>
            </td>

            {/* Verification Code Section */}
            <td className="mb-8">
              <p className="text-gray-700 text-base font-medium mb-6">
                Use the verification code below:
              </p>

              {/* Code Box */}
              <p className="bg-[#EFE8F5] p-6 mb-6 flex justify-center items-center max-w-[185px] max-h-[65px]">
                <span className="text-2xl font-medium font-inter text-gray-900 tracking-[0.5em]">
                  ${token}
                </span>
              </p>

              <td className="space-y-2 text-gray-700 text-base">
                <p>This code will expire in 5 minutes.</p>
                <p>
                  If you didn't request this verification, feel free to ignore
                  this message and
                  <a href="https://streamfi.io/support" className="text-[#A44AFB] hover:underline">
                    contact our support team
                  </a>
                  .
                </p>
              </td>
              {/* Separator Line */}
              <hr className="border-gray-300 my-8" />

              {/* Closing Message */}
              <td className="mb-8">
                <p className="text-gray-700 text-base mb-2">
                  We'll be in touch soon. Stay tuned, stay hyped.
                </p>
                <p className="text-gray-700 text-base flex items-center gap-1">
                  — The StreamFi Team
                  <span style="color: #A44AFB; fill: #A44AFB;">❤️</span>
                </p>
              </td>
            </td>
          </tr>
        </tr>
        {/* Social Media Icons */}
        <tr className="flex justify-center gap-6 mb-8 bg-[#F8F7FB] pt-4">
          <a href="https://twitter.com/streamfi" className="text-purple-600 hover:text-purple-700">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a href="https://discord.gg/streamfi" className="text-purple-600 hover:text-purple-700">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
          </a>
          <a href="https://facebook.com/streamfi" className="text-purple-600 hover:text-purple-700">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </a>
        </tr>

        {/* Footer */}
        <tr className="text-center text-[#1E1E1E99] text-base font-medium mb-2">
          @2025 StreamFi. All Rights Reserved.
        </tr>
      </tr>
    </table>
 </body>
</html>`
}
