import {
  getSessionCookieName,
  getSessionCookieOptions,
} from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getAppSnapshot, saveAppSnapshot, deleteAppSnapshot } from "./db";
import { z } from "zod";
import type { AppSnapshot } from "../shared/ps-types";

const snapshotSchema = z.custom<AppSnapshot>((value) => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.devices)
    && candidate.devices.length <= 500
    && Array.isArray(candidate.sessions)
    && candidate.sessions.length <= 100_000
    && !!candidate.settings
    && typeof candidate.settings === "object"
    && JSON.stringify(value).length <= 2_000_000;
}, { message: "Invalid or oversized store snapshot" });

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(getSessionCookieName(ctx.req), {
        ...cookieOptions,
        maxAge: -1,
      });
      return {
        success: true,
      } as const;
    }),
  }),
  store: router({
    getSnapshot: protectedProcedure.query(async ({ ctx }) => {
      const row = await getAppSnapshot(ctx.user.openId);
      if (!row) return null;
      return { snapshot: JSON.parse(row.snapshot), version: row.version, updatedAt: row.updatedAt };
    }),
    saveSnapshot: protectedProcedure.input(z.object({ snapshot: snapshotSchema, version: z.number().int().positive().default(1) })).mutation(async ({ ctx, input }) => {
      await saveAppSnapshot(ctx.user.openId, JSON.stringify(input.snapshot), input.version);
      return { success: true as const, updatedAt: new Date() };
    }),
    clearSnapshot: protectedProcedure.mutation(async ({ ctx }) => {
      await deleteAppSnapshot(ctx.user.openId);
      return { success: true as const };
    }),
  }),
});

export type AppRouter = typeof appRouter;
