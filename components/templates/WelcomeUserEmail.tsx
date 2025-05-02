/* eslint-disable @next/next/no-img-element */
// import { Button } from "../ui/Button";

export default function WelcomeUserEmail({ name }: { name: string }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "725px",
        margin: "auto",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "255px",
          background: "linear-gradient(180deg, #08000F 0%, #15012A 100%)",
          overflow: "hidden",
          position: "relative",
          marginBottom: "32px",
        }}
      >
        <img
          src={"/Images/streamFiLogo.svg"}
          width={120}
          height={40}
          alt="Logo"
          style={{
            marginLeft: "30px",
            marginTop: "30px",
          }}
        />
        <img
          src={"/Images/mail-header-image.svg"}
          alt="header-img"
          width={686}
          height={493}
          style={{ position: "absolute", right: "0px", top: "0px" }}
        />
      </div>
      <div
        style={{
          marginLeft: "38px",
          marginRight: "38px",
          marginBottom: "35px",
        }}
      >
        <h1
          style={{
            fontFamily: "PP Neue Machina",
            fontWeight: "800",
            fontSize: "34px",
            textTransform: "uppercase",
            marginBottom: "24px",
          }}
        >
          You are now part of the StreamFi Community!
        </h1>
        <p style={{ marginBottom: "16px" }}>
          <span style={{ fontWeight: 600 }}>Welcome Aboard {name}</span> <br />
          <br />
          We’re thrilled to have you as a part of the StreamFi Community — where
          streaming meets Web3 magic.
          <br />
          Here’s what you can look forward to:
          <br />
          &nbsp;&nbsp;&nbsp;&nbsp;Stream and Earn – Watch your favorite creators
          and earn rewards
          <br />
          &nbsp;&nbsp;&nbsp;&nbsp;Support Your Faves – Tip streamers in
          real-time with Starknet tokens.
          <br />
          &nbsp;&nbsp;&nbsp;&nbsp;On-chain Rewards – All interactions are
          powered by blockchain, secure and transparent.
          <br />
          &nbsp;&nbsp;&nbsp;&nbsp;On-chain Rewards – All interactions are
          powered by blockchain, secure and transparent.
          <br />
          &nbsp;&nbsp;&nbsp;&nbsp;A New Era of Streaming – You’re part of
          something game-changing.
          <br />
          <br />
          Ready to dive in?
        </p>
        <a
          href="/explore"
          style={{
            marginBottom: "24px",
            width: "100%",
            paddingTop: "19px",
            paddingBottom: "19px",
            borderRadius: "16px",
            color: "#fff",
            background: "#5A189A",
            display: "block",
            textAlign: "center",
          }}
        >
          Explore streams
        </a>
        <p>
          Let’s build the future of streaming, together. <br />
          <br />
          Cheers, <br />
          The StreamFi Team. <br />
          <br />
        </p>
      </div>

      <div
        style={{
          borderTop: "1px solid #1E1E1E33",
          padding: "22px 38px 24px 38px",
        }}
      >
        <p
          style={{
            color: "#1E1E1E99",
            fontWeight: "500",
            marginBottom: "24px",
          }}
        >
          If you do not want any emails from StreamFi? Click here to{" "}
          <a
            href="#"
            style={{
              textDecoration: "underline",
              color: "#1E1E1E",
              fontWeight: "600",
            }}
          >
            Unsubscribe
          </a>
        </p>
        <div style={{ display: "flex", gap: "16px" }}>
          <a
            href="#"
            style={{
              width: "40px",
              height: "40px",
              background: "#F8F7FB",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img src={"/Images/x-primary.svg"} width={16} height={16} alt="x" />
          </a>
          <a
            href="#"
            style={{
              width: "40px",
              height: "40px",
              background: "#F8F7FB",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={"/Images/discord-primary.svg"}
              width={21}
              height={16}
              alt="x"
            />
          </a>
          <a
            href="#"
            style={{
              width: "40px",
              height: "40px",
              background: "#F8F7FB",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={"/Images/facebook-primary.svg"}
              width={10}
              height={20}
              alt="x"
            />
          </a>
        </div>
      </div>
    </div>
  );
}
