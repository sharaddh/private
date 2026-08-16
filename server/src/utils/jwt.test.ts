import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { signAccess, signRefresh, verifyToken } from "./jwt";

describe("jwt", () => {
  it("signs and verifies an access token", () => {
    const token = signAccess({ sub: "user-1", role: "owner", username: "admin" });
    const payload = verifyToken<{ sub: string; role: string; username: string }>(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.role).toBe("owner");
    expect(payload.username).toBe("admin");
  });

  it("signs and verifies a refresh token", () => {
    const token = signRefresh({ sub: "user-1" });
    const payload = verifyToken<{ sub: string }>(token);
    expect(payload.sub).toBe("user-1");
  });

  it("embeds an expiry in issued tokens", () => {
    const token = signAccess({ sub: "user-1" });
    const decoded = jwt.decode(token) as { exp: number; iat: number };
    expect(decoded.exp).toBeGreaterThan(decoded.iat);
  });

  it("rejects tokens signed with a different secret", () => {
    const token = jwt.sign({ sub: "x" }, "wrong-secret", { expiresIn: "1h" });
    expect(() => verifyToken(token)).toThrow();
  });

  it("rejects expired tokens", () => {
    const token = jwt.sign(
      { sub: "x" },
      process.env.JWT_SECRET || "dev-secret-not-for-production",
      { expiresIn: "-10s" }
    );
    expect(() => verifyToken(token)).toThrow();
  });
});
