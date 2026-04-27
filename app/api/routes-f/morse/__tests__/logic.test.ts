import { encodeMorse, decodeMorse } from "../_lib/utils";

describe("Morse Code Logic", () => {
    test("encodes text to Morse code with default dot/dash", () => {
        expect(encodeMorse("ABC")).toBe(".- -... -.-.");
        expect(encodeMorse("Hello World")).toBe(".... . .-.. .-.. --- / .-- --- .-. .-.. -..");
    });

    test("decodes Morse code to text with default dot/dash", () => {
        expect(decodeMorse(".- -... -.-.")).toBe("ABC");
        expect(decodeMorse(".... . .-.. .-.. --- / .-- --- .-. .-.. -..")).toBe("HELLO WORLD");
    });

    test("supports custom dot/dash characters", () => {
        expect(encodeMorse("ABC", "*", "-")).toBe("*- -*** -*-*");
        expect(decodeMorse("*- -*** -*-*", "*", "-")).toBe("ABC");

        expect(encodeMorse("SOS", "o", "x")).toBe("ooo xxx ooo");
        expect(decodeMorse("ooo xxx ooo", "o", "x")).toBe("SOS");
    });

    test("handles punctuation", () => {
        expect(encodeMorse("HI!")).toBe(".... .. -.-.--");
        expect(decodeMorse(".... .. -.-.--")).toBe("HI!");
    });

    test("decodes unknown sequences as ?", () => {
        expect(decodeMorse("........")).toBe("?");
        expect(decodeMorse(".- ... --... / ........")).toBe("AS7 ?");
    });

    test("lossless round-trip for supported chars", () => {
        const input = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,?!:;";
        const encoded = encodeMorse(input);
        const decoded = decodeMorse(encoded);
        expect(decoded).toBe(input);
    });

    test("handles multiple spaces in input", () => {
        expect(encodeMorse("A   B")).toBe(".- / -...");
    });
});
