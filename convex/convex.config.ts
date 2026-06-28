import { defineApp } from "convex/server";
import betterAuth from "@convex-dev/better-auth/convex.config";
import replicate from "@trestleinc/replicate/convex.config";

const app = defineApp();

app.use(betterAuth);
app.use(replicate);

export default app;
