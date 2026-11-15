import { expect, test } from "vitest";
import * as z from "zod/v4";

const later = (v: { startsAt?: number; endsAt?: number }) =>
  v.startsAt === undefined || v.endsAt === undefined || v.endsAt > v.startsAt;

const base = z
  .object({ id: z.number(), startsAt: z.number(), endsAt: z.number() })
  .refine(later, { keys: ["startsAt", "endsAt"], path: ["endsAt"], name: "ends_after_starts" });

test("the keys param is kept on the check", () => {
  expect(base._zod.def.checks![0]!._zod.def.keys).toEqual(["startsAt", "endsAt"]);
});

test("omit keeps a keyed refinement whose keys remain", () => {
  const s = base.omit({ id: true });
  expect(s.safeParse({ startsAt: 2, endsAt: 1 }).error?.issues[0]?.path).toEqual(["endsAt"]);
  expect(s.safeParse({ startsAt: 1, endsAt: 2 }).success).toBe(true);
});

test("omit and pick drop a keyed refinement once one of its keys is removed", () => {
  expect(base.omit({ startsAt: true }).safeParse({ id: 1, endsAt: 1 }).success).toBe(true);
  expect(base.omit({ startsAt: true })._zod.def.checks).toEqual([]);
  expect(base.pick({ endsAt: true })._zod.def.checks).toEqual([]);
  expect(base.pick({ startsAt: true, endsAt: true }).safeParse({ startsAt: 2, endsAt: 1 }).success).toBe(false);
});

test("partial, required, extend and merge keep keyed refinements", () => {
  expect(base.partial().safeParse({ startsAt: 2, endsAt: 1 }).success).toBe(false);
  expect(base.partial().safeParse({ startsAt: 2 }).success).toBe(true);
  expect(base.partial().required().safeParse({ id: 1, startsAt: 2, endsAt: 1 }).success).toBe(false);
  expect(base.extend({ endsAt: z.coerce.number() }).safeParse({ id: 1, startsAt: 2, endsAt: "1" }).success).toBe(false);
  expect(
    base.merge(z.object({ note: z.string() })).safeParse({ id: 1, startsAt: 2, endsAt: 1, note: "" }).success
  ).toBe(false);
});

test("update() can replace a keyed refinement's message by name", () => {
  const s = base.omit({ id: true }).update({ ends_after_starts: "End after the start" });
  expect(s.safeParse({ startsAt: 2, endsAt: 1 }).error?.issues[0]?.message).toBe("End after the start");
});

test("refinements without keys still throw", () => {
  const s = z.object({ a: z.number() }).refine(() => true);
  expect(() => s.omit({ a: true })).toThrow(".omit() cannot be used on object schemas containing refinements");
  expect(() => s.pick({ a: true })).toThrow(".pick() cannot be used on object schemas containing refinements");
  expect(() => s.partial()).toThrow(".partial() cannot be used on object schemas containing refinements");
  expect(() => s.extend({ a: z.string() })).toThrow("Cannot overwrite keys");
  expect(() => s.merge(z.object({}))).toThrow(".merge() cannot be used");
  // a mix of keyed and unkeyed refinements is treated like an unkeyed one
  expect(() => base.refine(() => true).omit({ id: true })).toThrow();
});
