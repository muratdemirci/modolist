import { defineConfig } from "vite";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  define: {
    "process.env.SUPABASE_URL": JSON.stringify(process.env.SUPABASE_URL),
    "process.env.SUPABASE_ANON_KEY": JSON.stringify(
      process.env.SUPABASE_ANON_KEY
    ),
  },
});
