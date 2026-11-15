// Google sign-in session helpers and the "auth first" rule for API routes.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  DEFAULT_AFTER_LOGIN,
  cookieOptions,
  createPkcePair,
  decodeJwtClaims,
  googleAvatarUrl,
  isProtectedPath,
  needsRefresh,
  parseTokenResponse,
  pkceChallenge,
  safeNextPath,
} from "../src/lib/auth/session.ts";

const USER_ID = "11111111-2222-4333-8444-555555555555";

function fakeJwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

describe("PKCE", () => {
  it("matches the RFC 7636 appendix B example", async () => {
    assert.equal(
      await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("creates a fresh base64url verifier of 43 characters each time", async () => {
    const a = await createPkcePair();
    const b = await createPkcePair();
    assert.match(a.verifier, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(a.verifier, b.verifier);
    assert.equal(a.challenge, await pkceChallenge(a.verifier));
  });
});

describe("decodeJwtClaims", () => {
  it("reads sub, exp and email", () => {
    assert.deepEqual(decodeJwtClaims(fakeJwt({ sub: USER_ID, exp: 2_000_000_000, email: "a@example.com" })), {
      sub: USER_ID,
      exp: 2_000_000_000,
      email: "a@example.com",
      avatarUrl: null,
    });
  });

  it("reads the Google photo from user_metadata", () => {
    const claims = decodeJwtClaims(
      fakeJwt({ sub: USER_ID, exp: 2_000_000_000, user_metadata: { avatar_url: "https://lh3.googleusercontent.com/a/x=s96-c" } }),
    );
    assert.equal(claims?.avatarUrl, "https://lh3.googleusercontent.com/a/x=s96-c");
  });

  it("rejects malformed tokens and missing claims", () => {
    assert.equal(decodeJwtClaims("not-a-jwt"), null);
    assert.equal(decodeJwtClaims("a.%%%.c"), null);
    assert.equal(decodeJwtClaims(fakeJwt({ exp: 2_000_000_000 })), null);
    assert.equal(decodeJwtClaims(fakeJwt({ sub: "../../profiles", exp: 2_000_000_000 })), null);
    assert.equal(decodeJwtClaims(fakeJwt({ sub: USER_ID })), null);
  });
});

describe("needsRefresh", () => {
  const now = 1_700_000_000_000;
  it("refreshes missing, expired and nearly expired tokens", () => {
    assert.equal(needsRefresh(null, now), true);
    assert.equal(needsRefresh({ sub: USER_ID, exp: now / 1000 - 10, email: null, avatarUrl: null }, now), true);
    assert.equal(needsRefresh({ sub: USER_ID, exp: now / 1000 + 30, email: null, avatarUrl: null }, now), true);
  });
  it("keeps a token with more than a minute left", () => {
    assert.equal(needsRefresh({ sub: USER_ID, exp: now / 1000 + 600, email: null, avatarUrl: null }, now), false);
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    assert.equal(safeNextPath("/logs"), "/logs");
    assert.equal(safeNextPath("/assistant?x=1"), "/assistant?x=1");
  });
  it("blocks open redirects and loops", () => {
    for (const bad of [null, "", "https://evil.example", "//evil.example", "/\\evil.example", "logs", "/login", "/auth/callback"]) {
      assert.equal(safeNextPath(bad), DEFAULT_AFTER_LOGIN, String(bad));
    }
  });
});

describe("cookies and tokens", () => {
  it("session cookies are httpOnly, lax and site-wide", () => {
    assert.deepEqual(cookieOptions(true, 60), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 });
  });
  it("parses only complete token responses", () => {
    assert.deepEqual(parseTokenResponse({ access_token: "a", refresh_token: "r", user: {} }), {
      accessToken: "a",
      refreshToken: "r",
    });
    assert.equal(parseTokenResponse({ access_token: "a" }), null);
    assert.equal(parseTokenResponse(null), null);
  });
});

describe("protected pages", () => {
  it("covers every app page and leaves landing and login public", () => {
    const appPages = readdirSync("src/app/(app)").filter((name) => statSync(join("src/app/(app)", name)).isDirectory());
    for (const page of appPages) assert.equal(isProtectedPath(`/${page}`), true, page);
    for (const open of ["/", "/login", "/auth/login", "/auth/callback"]) assert.equal(isProtectedPath(open), false, open);
    assert.equal(isProtectedPath("/logsx"), false);
  });
});

describe("API routes authenticate first", () => {
  // Every route that touches user data must resolve the session before any other work,
  // and must never read a profile id from the request.
  const dataRoutes = [
    "src/app/api/profile/route.ts",
    "src/app/api/health-logs/route.ts",
    "src/app/api/reminders/route.ts",
    "src/app/api/reminders/[id]/route.ts",
    "src/app/api/assistant/sessions/route.ts",
    "src/app/api/assistant/chat/route.ts",
    "src/app/api/insights/weekly/route.ts",
    "src/app/api/auth/account/route.ts",
  ];

  for (const file of dataRoutes) {
    it(file, () => {
      const source = readFileSync(file, "utf8");
      const handlers = source.split(/export async function (?=GET|POST|PATCH|DELETE)/).slice(1);
      assert.ok(handlers.length > 0);
      for (const handler of handlers) {
        const body = handler.slice(handler.indexOf("{"));
        const auth = body.indexOf("await authenticate(");
        assert.ok(auth > 0, `${handler.slice(0, 6)} calls authenticate`);
        for (const later of ["readJsonBody(", "supabaseRest(", "runAssistantTurn(", "safeParse("]) {
          const at = body.indexOf(later);
          if (at !== -1) assert.ok(at > auth, `${handler.slice(0, 6)}: ${later} runs after authenticate`);
        }
      }
      assert.doesNotMatch(source, /DEMO_PROFILE_ID|profileId\s*[:=]\s*(body|parsed|query)/);
    });
  }
});

describe("delete_medimate_account migration", () => {
  const sql = readFileSync("supabase/migrations/0005_delete_account.sql", "utf8");

  it("only deletes the caller's own rows", () => {
    for (const statement of sql.match(/(delete from|update) [^;]+;/g) ?? []) {
      assert.match(statement, /= caller/, statement);
    }
  });

  it("never deletes the shared demo profile, only unlinks it", () => {
    assert.match(sql, /delete from public\.profiles where user_id = caller and id <> demo_id/);
    assert.match(sql, /set user_id = null[^;]+where id = demo_id and user_id = caller/);
  });

  it("is callable by signed-in users only", () => {
    assert.match(sql, /revoke all on function public\.delete_medimate_account\(\) from public, anon/);
    assert.match(sql, /grant execute on function public\.delete_medimate_account\(\) to authenticated/);
  });
});

describe("googleAvatarUrl", () => {
  it("accepts https Google photo URLs (avatar_url or picture)", () => {
    assert.equal(googleAvatarUrl({ picture: "https://lh5.googleusercontent.com/p" }), "https://lh5.googleusercontent.com/p");
  });

  it("drops other hosts, http, script URLs and non-objects", () => {
    for (const bad of [
      { avatar_url: "https://evil.example.com/a.png" },
      { avatar_url: "http://lh3.googleusercontent.com/a" },
      { avatar_url: "javascript:alert(1)" },
      { avatar_url: "https://lh3.googleusercontent.com.evil.com/a" },
      { avatar_url: 42 },
      null,
      "x",
    ]) {
      assert.equal(googleAvatarUrl(bad), null, JSON.stringify(bad));
    }
  });
});
