import { describe, expect, it } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

type User = NonNullable<TrpcContext["user"]>;

const baseContext = (user: User | null): TrpcContext => ({
  user,
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

const user: User = {
  id: 7,
  openId: "owner-7",
  email: "owner@example.test",
  name: "Owner",
  loginMethod: "test",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("store persistence API", () => {
  it("rejects unauthenticated snapshot reads", async () => {
    const caller = appRouter.createCaller(baseContext(null));
    await expect(caller.store.getSnapshot()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects malformed snapshots before touching the database", async () => {
    const caller = appRouter.createCaller(baseContext(user));
    await expect(caller.store.saveSnapshot({ snapshot: { devices: "not-an-array", sessions: [], settings: {} } as never })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
