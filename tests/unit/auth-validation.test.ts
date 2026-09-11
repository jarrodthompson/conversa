import { describe, it, expect } from "vitest";
import { signInSchema, signUpSchema } from "@/lib/validations/auth";

describe("auth validation schemas", () => {
  it("accepts a valid sign-in", () => {
    expect(signInSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(signInSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });

  it("requires a strong-enough password on sign-up", () => {
    expect(signUpSchema.safeParse({ fullName: "Jane Doe", email: "a@b.com", password: "short" }).success).toBe(false);
    expect(signUpSchema.safeParse({ fullName: "Jane Doe", email: "a@b.com", password: "onlyletters" }).success).toBe(false);
    expect(signUpSchema.safeParse({ fullName: "Jane Doe", email: "a@b.com", password: "abcd1234" }).success).toBe(true);
  });

  it("requires a full name", () => {
    expect(signUpSchema.safeParse({ fullName: "J", email: "a@b.com", password: "abcd1234" }).success).toBe(false);
  });
});
