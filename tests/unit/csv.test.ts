import { describe, it, expect } from "vitest";
import { parseCSV, guessMapping, isValidEmail } from "@/lib/contacts/csv";

describe("CSV parser", () => {
  it("parses headers and rows", () => {
    const { headers, rows } = parseCSV("a,b,c\n1,2,3\n4,5,6");
    expect(headers).toEqual(["a", "b", "c"]);
    expect(rows).toEqual([["1", "2", "3"], ["4", "5", "6"]]);
  });

  it("handles quoted fields with commas and newlines", () => {
    const { rows } = parseCSV('name,note\n"Doe, Jane","line1\nline2"');
    expect(rows[0]).toEqual(["Doe, Jane", "line1\nline2"]);
  });

  it("handles escaped double quotes", () => {
    const { rows } = parseCSV('q\n"she said ""hi"""');
    expect(rows[0][0]).toBe('she said "hi"');
  });

  it("strips a UTF-8 BOM and CRLF", () => {
    const { headers, rows } = parseCSV("﻿a,b\r\n1,2\r\n");
    expect(headers).toEqual(["a", "b"]);
    expect(rows).toEqual([["1", "2"]]);
  });

  it("ignores fully blank rows", () => {
    const { rows } = parseCSV("a,b\n1,2\n\n3,4");
    expect(rows).toEqual([["1", "2"], ["3", "4"]]);
  });
});

describe("column auto-mapping", () => {
  it("maps common header synonyms to fields", () => {
    const m = guessMapping(["First Name", "Surname", "E-mail", "Mobile", "Company", "Labels"]);
    expect(m.first_name).toBe(0);
    expect(m.last_name).toBe(1);
    expect(m.email).toBe(2);
    expect(m.phone).toBe(3);
    expect(m.company).toBe(4);
    expect(m.tags).toBe(5);
  });

  it("returns -1 for unmapped fields", () => {
    const m = guessMapping(["random", "columns"]);
    expect(m.email).toBe(-1);
  });
});

describe("email validation", () => {
  it.each([
    ["a@b.com", true],
    ["jane.doe@example.co.uk", true],
    ["not-an-email", false],
    ["a@b", false],
    ["", false],
  ])("%s -> %s", (email, ok) => {
    expect(isValidEmail(email)).toBe(ok);
  });
});
