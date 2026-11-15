import { expect, test } from "vitest";
import * as z from "zod/v4";

const messages = (schema: z.ZodType, data: unknown) => schema.safeParse(data).error?.issues.map((i) => i.message);

test("overrides check messages by path", () => {
  const base = z.object({ firstName: z.string().min(3).max(24), address: z.object({ zip: z.string().length(5) }) });
  const updated = base.update({
    "firstName.min": "too short",
    "firstName.max": "too long",
    "address.zip.length": "bad zip",
  });

  expect(messages(updated, { firstName: "ab", address: { zip: "1" } })).toEqual(["too short", "bad zip"]);
  expect(messages(updated, { firstName: "a".repeat(25), address: { zip: "12345" } })).toEqual(["too long"]);
  expect(messages(base, { firstName: "ab", address: { zip: "12345" } })).toEqual([
    "Too small: expected string to have >=3 characters",
  ]);
  expect(updated.parse({ firstName: "abc", address: { zip: "12345" } })).toEqual({
    firstName: "abc",
    address: { zip: "12345" },
  });
});

test("descends through wrappers, arrays and the schema's own type error", () => {
  const schema = z
    .object({
      name: z.string().min(2).optional().nullable(),
      tags: z.array(z.string().max(3)).min(1),
      age: z.int().gte(0).default(1),
    })
    .update({
      "name.min": "name too short",
      name: "name must be text",
      "tags.min": "need a tag",
      "tags.[].max": "tag too long",
      "age.int": "whole numbers only",
    });

  expect(messages(schema, { name: "a", tags: [] })).toEqual(["name too short", "need a tag"]);
  expect(messages(schema, { name: 5, tags: ["abcd"], age: 1.5 })).toEqual([
    "name must be text",
    "tag too long",
    "whole numbers only",
  ]);
  expect(schema.parse({ tags: ["a"] })).toEqual({ tags: ["a"], age: 1 });
});

test("number bounds use method names, and a value selects among same-named checks", () => {
  const schema = z
    .object({ age: z.int().gte(-2147483648).lte(2147483647).gte(18).lt(130) })
    .update({ "age.min.18": "too young", "age.lt": "too old" });

  expect(messages(schema, { age: 3 })).toEqual(["too young"]);
  expect(messages(schema, { age: 130 })).toEqual(["too old"]);
  expect(messages(schema, { age: -2147483649 })?.[0]).not.toBe("too young");
});

test("formats, refinements and error maps", () => {
  const schema = z
    .object({
      email: z.string().email(),
      code: z
        .string()
        .regex(/^[A-Z]+$/)
        .startsWith("A"),
      even: z.number().refine((n) => n % 2 === 0),
    })
    .update({
      "email.email": "not an email",
      "code.regex": "uppercase only",
      "code.startsWith": (iss) => `must start with A (got ${String(iss.input)})`,
      "even.refine": "must be even",
    });

  expect(messages(schema, { email: "x", code: "bcd", even: 3 })).toEqual([
    "not an email",
    "uppercase only",
    "must start with A (got bcd)",
    "must be even",
  ]);
});

test("keeps metadata and rejects keys that match nothing", () => {
  const described = z.string().min(1).describe("a name");
  expect(described.update({ min: "required" }).description).toBe("a name");

  const schema = z.object({ name: z.string().min(1) });
  expect(() => schema.update({ "name.max": "x" })).toThrow('no "max" check found for "name.max"');
  expect(() => schema.update({ "name.min.1.extra": "x" })).toThrow('cannot resolve "name.min.1.extra"');
  expect(() => schema.update({ "name.min.2": "x" })).toThrow('no "min" check found for "name.min.2"');
});
